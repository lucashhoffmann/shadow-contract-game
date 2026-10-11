import {
  hasLineOfSight,
  moveCircle,
} from '@/app/modules/level/utils/grid.util';
import { findPath } from '@/app/modules/level/utils/pathfinding.util';
import {
  ALERT_DURATION,
  BASE_VIEW_RANGE,
  DETECT_DECAY,
  DETECT_TIME,
  DETECT_TIME_MIN,
  DETECT_TIME_PER_ROOM,
  ENEMY_CHASE_SPEED,
  ENEMY_DAMAGE,
  ENEMY_PATROL_SPEED,
  ENEMY_RADIUS,
  FIRE_DELAY,
  FIRE_INTERVAL,
  FIRE_RANGE,
  REPATH_INTERVAL,
  VIEW_HALF_ANGLE,
  VIEW_RANGE_MAX_BONUS,
  VIEW_RANGE_PER_ROOM,
  WAYPOINT_REACH,
} from '@/app/modules/world/constants/world.constants';
import type { Enemy, Vec2, World } from '@/app/modules/world/types/world.types';
import { angleDiff, angleTo, distance } from '@/shared/utils/math.util';

const NODE_REACH = 0.1;

export function createEnemy(
  world: World,
  roomIndex: number,
  patrol: Vec2[],
): Enemy {
  return {
    id: world.nextId++,
    roomIndex,
    pos: { ...patrol[0] },
    facing: patrol.length > 1 ? angleTo(patrol[0], patrol[1]) : 0,
    state: 'patrol',
    detection: 0,
    patrol,
    waypoint: patrol.length > 1 ? 1 : 0,
    route: [],
    repathTimer: 0,
    alertTimer: 0,
    fireCooldown: 0,
    viewRange:
      BASE_VIEW_RANGE +
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
  navigate(world, enemy, target, ENEMY_PATROL_SPEED, dt);
}

// alerta enxerga em 360 graus: basta linha de visao
function alert(world: World, enemy: Enemy, dt: number): void {
  const player = world.player;
  const los = hasLineOfSight(world, enemy.pos, player.pos);
  enemy.alertTimer = los ? ALERT_DURATION : enemy.alertTimer - dt;
  if (enemy.alertTimer <= 0) {
    enemy.state = 'patrol';
    enemy.detection = 0;
    enemy.route = [];
    return;
  }
  if (!los || distance(enemy.pos, player.pos) > FIRE_RANGE) {
    navigate(world, enemy, player.pos, ENEMY_CHASE_SPEED, dt);
    return;
  }
  enemy.facing = angleTo(enemy.pos, player.pos);
  enemy.fireCooldown -= dt;
  if (enemy.fireCooldown <= 0) {
    player.hp -= ENEMY_DAMAGE;
    enemy.fireCooldown = FIRE_INTERVAL;
  }
}

export function updateEnemies(world: World, dt: number): void {
  for (const enemy of world.enemies) {
    if (enemy.state === 'dead') continue;
    if (enemy.state === 'alert') {
      alert(world, enemy, dt);
      continue;
    }
    if (canSee(world, enemy, world.player.pos)) {
      enemy.detection = Math.min(1, enemy.detection + dt / enemy.detectTime);
      enemy.facing = angleTo(enemy.pos, world.player.pos);
      if (enemy.detection < 1) {
        enemy.state = 'suspicious';
        continue;
      }
      enemy.state = 'alert';
      enemy.alertTimer = ALERT_DURATION;
      enemy.fireCooldown = FIRE_DELAY;
      enemy.route = [];
      enemy.repathTimer = 0;
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
