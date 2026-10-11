import { spawnProjectile } from '@/app/modules/combat/systems/combat.system';
import {
  hasLineOfSight,
  moveCircle,
} from '@/app/modules/level/utils/grid.util';
import { findPath } from '@/app/modules/level/utils/pathfinding.util';
import {
  ALERT_DURATION,
  DETECT_DECAY,
  DETECT_TIME,
  DETECT_TIME_MIN,
  DETECT_TIME_PER_ROOM,
  ENEMY_BULLET_DAMAGE,
  ENEMY_BULLET_SPEED,
  ENEMY_KINDS,
  ENEMY_RADIUS,
  FIRE_DELAY,
  FIRE_INTERVAL,
  FIRE_RANGE,
  NINJA_DAMAGE,
  NINJA_REACH,
  REPATH_INTERVAL,
  VIEW_HALF_ANGLE,
  VIEW_RANGE_MAX_BONUS,
  VIEW_RANGE_PER_ROOM,
  WAYPOINT_REACH,
} from '@/app/modules/world/constants/world.constants';
import type {
  Enemy,
  EnemyKind,
  Vec2,
  World,
} from '@/app/modules/world/types/world.types';
import { angleDiff, angleTo, distance } from '@/shared/utils/math.util';

const NODE_REACH = 0.1;

export function createEnemy(
  world: World,
  roomIndex: number,
  patrol: Vec2[],
  kind: EnemyKind = 'suit',
): Enemy {
  const stats = ENEMY_KINDS[kind];
  return {
    id: world.nextId++,
    kind,
    roomIndex,
    pos: { ...patrol[0] },
    facing: patrol.length > 1 ? angleTo(patrol[0], patrol[1]) : 0,
    hp: stats.hp,
    state: 'patrol',
    detection: 0,
    patrol,
    waypoint: patrol.length > 1 ? 1 : 0,
    route: [],
    repathTimer: 0,
    alertTimer: 0,
    fireCooldown: 0,
    viewRange:
      stats.viewRange +
      Math.min(VIEW_RANGE_MAX_BONUS, roomIndex * VIEW_RANGE_PER_ROOM),
    detectTime: Math.max(
      DETECT_TIME_MIN,
      DETECT_TIME - roomIndex * DETECT_TIME_PER_ROOM,
    ),
  };
}

export function canSee(world: World, enemy: Enemy, target: Vec2): boolean {
  if (distance(enemy.pos, target) > enemy.viewRange) return false;
  const offset = angleDiff(angleTo(enemy.pos, target), enemy.facing);
  if (Math.abs(offset) > VIEW_HALF_ANGLE) return false;
  return hasLineOfSight(world, enemy.pos, target);
}

function navigate(
  world: World,
  enemy: Enemy,
  target: Vec2,
  speed: number,
  dt: number,
): void {
  enemy.repathTimer -= dt;
  if (enemy.repathTimer <= 0) {
    enemy.route = findPath(world, enemy.pos, target);
    enemy.repathTimer = REPATH_INTERVAL;
  }
  const next = enemy.route[0];
  if (!next) return;
  const d = distance(enemy.pos, next);
  if (d < NODE_REACH) {
    enemy.route.shift();
    return;
  }
  const step = Math.min(d, speed * dt) / d;
  enemy.facing = angleTo(enemy.pos, next);
  moveCircle(
    world,
    enemy.pos,
    (next.x - enemy.pos.x) * step,
    (next.y - enemy.pos.y) * step,
    ENEMY_RADIUS,
  );
}

function patrol(world: World, enemy: Enemy, dt: number): void {
  const target = enemy.patrol[enemy.waypoint];
  if (distance(enemy.pos, target) < WAYPOINT_REACH) {
    enemy.waypoint = (enemy.waypoint + 1) % enemy.patrol.length;
    enemy.route = [];
    return;
  }
  navigate(world, enemy, target, ENEMY_KINDS[enemy.kind].patrolSpeed, dt);
}

function enterAlert(enemy: Enemy): void {
  enemy.state = 'alert';
  enemy.alertTimer = ALERT_DURATION;
  enemy.fireCooldown = FIRE_DELAY;
  enemy.route = [];
  enemy.repathTimer = 0;
}

// Alerta enxerga em 360 graus: basta linha de visao.
// Terno para no alcance de tiro e atira; ninja corre ate encostar e golpeia.
function alert(world: World, enemy: Enemy, dt: number): void {
  const player = world.player;
  const stats = ENEMY_KINDS[enemy.kind];
  const los = hasLineOfSight(world, enemy.pos, player.pos);
  enemy.alertTimer = los ? ALERT_DURATION : enemy.alertTimer - dt;
  if (enemy.alertTimer <= 0) {
    enemy.state = 'patrol';
    enemy.detection = 0;
    enemy.route = [];
    return;
  }
  const reach = stats.ranged ? FIRE_RANGE : NINJA_REACH;
  if (!los || distance(enemy.pos, player.pos) > reach) {
    navigate(world, enemy, player.pos, stats.chaseSpeed, dt);
    return;
  }
  enemy.facing = angleTo(enemy.pos, player.pos);
  enemy.fireCooldown -= dt;
  if (enemy.fireCooldown > 0) return;
  enemy.fireCooldown = FIRE_INTERVAL;
  if (stats.ranged) {
    spawnProjectile(
      world,
      'enemy',
      enemy.pos,
      enemy.facing,
      ENEMY_BULLET_SPEED,
      ENEMY_BULLET_DAMAGE,
      FIRE_RANGE,
    );
  } else {
    player.hp -= NINJA_DAMAGE;
  }
}

export function updateEnemies(world: World, dt: number): void {
  for (const enemy of world.enemies) {
    if (enemy.state === 'dead') continue;
    // detection cheia vem de ver o player ou de levar tiro (damageEnemy)
    if (enemy.state !== 'alert' && enemy.detection >= 1) enterAlert(enemy);
    if (enemy.state === 'alert') {
      alert(world, enemy, dt);
      continue;
    }
    if (canSee(world, enemy, world.player.pos)) {
      enemy.detection = Math.min(1, enemy.detection + dt / enemy.detectTime);
      enemy.facing = angleTo(enemy.pos, world.player.pos);
      enemy.state = 'suspicious';
      continue;
    }
    enemy.detection = Math.max(0, enemy.detection - dt * DETECT_DECAY);
    if (enemy.detection > 0) {
      enemy.state = 'suspicious';
      continue;
    }
    enemy.state = 'patrol';
    patrol(world, enemy, dt);
  }
}
