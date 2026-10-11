import { spawnProjectile } from '@/app/modules/combat/systems/combat.system';
import {
  hasLineOfSight,
  moveCircle,
} from '@/app/modules/level/utils/grid.util';
import { findPath } from '@/app/modules/level/utils/pathfinding.util';
import {
  ALERT_DURATION,
  DASH_SPEED,
  DASH_TIME,
  DETECT_DECAY,
  DETECT_TIME,
  DETECT_TIME_MIN,
  DETECT_TIME_PER_ROOM,
  ENEMY_BULLET_DAMAGE,
  ENEMY_BULLET_SPEED,
  ENEMY_DASH_FROM_ROOM,
  ENEMY_DASH_INTERVAL,
  ENEMY_DASH_MIN_INTERVAL,
  ENEMY_DASH_PER_ROOM,
  ENEMY_KINDS,
  ENEMY_RADIUS,
  FIRE_DELAY,
  FIRE_INTERVAL,
  FIRE_RANGE,
  HEAR_MAX_BONUS,
  HEAR_PER_ROOM,
  HEAR_TIME,
  NINJA_DAMAGE,
  NINJA_REACH,
  REPATH_INTERVAL,
  SEARCH_TIME,
  SLASH_TIME,
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
import { nextRandom } from '@/shared/utils/rng.util';

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
    attack: 0,
    viewRange:
      stats.viewRange +
      Math.min(VIEW_RANGE_MAX_BONUS, roomIndex * VIEW_RANGE_PER_ROOM),
    detectTime: Math.max(
      DETECT_TIME_MIN,
      DETECT_TIME - roomIndex * DETECT_TIME_PER_ROOM,
    ),
    dash: 0,
    dashCooldown: 0,
    dashEvery:
      roomIndex < ENEMY_DASH_FROM_ROOM
        ? 0
        : Math.max(
            ENEMY_DASH_MIN_INTERVAL,
            ENEMY_DASH_INTERVAL -
              (roomIndex - ENEMY_DASH_FROM_ROOM) * ENEMY_DASH_PER_ROOM,
          ),
    hearing: 0,
    heard: null,
    searchTimer: 0,
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

// Barulho do player (andar, saltar) enche `hearing`, mais rapido quanto mais
// perto; atravessa parede. Cheio, o inimigo guarda onde ouviu e vai la.
function listen(world: World, enemy: Enemy, dt: number): void {
  const range =
    world.player.noise *
    (1 + Math.min(HEAR_MAX_BONUS, enemy.roomIndex * HEAR_PER_ROOM));
  const gap = distance(enemy.pos, world.player.pos);
  if (gap >= range) {
    enemy.hearing = Math.max(0, enemy.hearing - dt * DETECT_DECAY);
    return;
  }
  enemy.hearing += (dt * (1 - gap / range)) / HEAR_TIME;
  if (enemy.hearing < 1) return;
  enemy.hearing = 0;
  enemy.heard = { ...world.player.pos };
  enemy.searchTimer = SEARCH_TIME;
  enemy.route = [];
  enemy.repathTimer = 0;
}

// vai ate onde ouviu e espera la; acabou o tempo, volta a patrulha
function investigate(world: World, enemy: Enemy, heard: Vec2, dt: number) {
  enemy.searchTimer -= dt;
  if (enemy.searchTimer <= 0) {
    enemy.heard = null;
    enemy.route = [];
    enemy.repathTimer = 0;
    return;
  }
  if (distance(enemy.pos, heard) < WAYPOINT_REACH) return;
  navigate(world, enemy, heard, ENEMY_KINDS[enemy.kind].patrolSpeed, dt);
}

function enterAlert(enemy: Enemy): void {
  enemy.state = 'alert';
  enemy.hearing = 0;
  enemy.heard = null;
  enemy.alertTimer = ALERT_DURATION;
  enemy.fireCooldown = FIRE_DELAY;
  // primeiro salto nao vem junto com o alerta
  enemy.dashCooldown = enemy.dashEvery / 2;
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
  const gap = distance(enemy.pos, player.pos);
  if (enemy.dash > 0) {
    const step = DASH_SPEED * Math.min(dt, enemy.dash);
    enemy.dash = Math.max(0, enemy.dash - dt);
    moveCircle(
      world,
      enemy.pos,
      Math.cos(enemy.facing) * step,
      Math.sin(enemy.facing) * step,
      ENEMY_RADIUS,
    );
    // ninja pousa ao alcancar o player, em vez de passar por ele
    if (!stats.ranged && distance(enemy.pos, player.pos) <= reach) {
      enemy.dash = 0;
    }
    return;
  }
  enemy.dashCooldown = Math.max(0, enemy.dashCooldown - dt);
  // longe: salta para cima do player. Terno ja no alcance: salta de lado,
  // para sair da mira. Ninja no alcance nao salta, golpeia.
  if (
    enemy.dashEvery > 0 &&
    enemy.dashCooldown === 0 &&
    los &&
    (gap > reach || stats.ranged)
  ) {
    const side = nextRandom(world) < 0.5 ? 1 : -1;
    enemy.facing =
      angleTo(enemy.pos, player.pos) + (gap > reach ? 0 : (side * Math.PI) / 2);
    enemy.dash = DASH_TIME;
    enemy.dashCooldown = enemy.dashEvery;
    enemy.route = [];
    enemy.repathTimer = 0;
    return;
  }
  if (!los || gap > reach) {
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
  enemy.attack = SLASH_TIME;
}

export function updateEnemies(world: World, dt: number): void {
  for (const enemy of world.enemies) {
    if (enemy.state === 'dead') continue;
    enemy.attack = Math.max(0, enemy.attack - dt);
    // detection cheia vem de ver o player ou de levar tiro (damageEnemy)
    if (enemy.state !== 'alert' && enemy.detection >= 1) enterAlert(enemy);
    if (enemy.state === 'alert') {
      alert(world, enemy, dt);
      continue;
    }
    listen(world, enemy, dt);
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
    if (enemy.heard) {
      enemy.state = 'suspicious';
      investigate(world, enemy, enemy.heard, dt);
      continue;
    }
    enemy.state = 'patrol';
    patrol(world, enemy, dt);
  }
}
