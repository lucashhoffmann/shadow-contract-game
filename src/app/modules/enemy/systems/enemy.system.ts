import {
  damagePlayer,
  spawnProjectile,
} from '@/app/modules/combat/systems/combat.system';
import {
  circleHitsWall,
  doorsSealed,
  hasLineOfSight,
  moveCircle,
} from '@/app/modules/level/utils/grid.util';
import { findPath } from '@/app/modules/level/utils/pathfinding.util';
import {
  nearestPlayer,
  threatBoost,
} from '@/app/modules/world/utils/players.util';
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
  LAUNCH_DISTANCE,
  LAUNCH_TIME,
  HEARING_YELLOW,
  NINJA_DAMAGE,
  NINJA_DASH_TURN,
  NINJA_LUNGE_STRIKE,
  NINJA_REACH,
  REPATH_INTERVAL,
  SEARCH_TIME,
  SHURIKEN_DAMAGE,
  SHURIKEN_FIRST,
  SHURIKEN_FROM_LEVEL,
  SHURIKEN_INTERVAL,
  SHURIKEN_MIN_GAP,
  SHURIKEN_RANGE,
  SHURIKEN_SPEED,
  SENSE_MAX_BONUS,
  SENSE_PER_CONTRACT,
  SENSE_RANGE,
  SHOP_EVERY,
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
import { angleDiff, angleTo, clamp, distance } from '@/shared/utils/math.util';
import { nextRandom } from '@/shared/utils/rng.util';

const NODE_REACH = 0.1;

function intelligenceForRoom(world: World, roomIndex: number) {
  const level = Math.max(1, Math.ceil(roomIndex / SHOP_EVERY));
  const saved = world.intelligence[level];
  if (saved) return saved;
  const growth = 1 - 0.85 ** (level - 1);
  const rng = { rngState: world.rngState ^ Math.imul(level, 0x9e3779b9) };
  const roll = () => (level < 6 ? 1 : 1 + nextRandom(rng) * 0.1);
  const intelligence = {
    hearing: (1 + 0.7 * growth) * roll(),
    hearingThreshold: (1 - 0.25 * growth) / roll(),
    pursuit: (1 + 0.55 * growth) * roll(),
    dash: (1 + 0.5 * growth) * roll(),
  };
  world.intelligence = { ...world.intelligence, [level]: intelligence };
  return intelligence;
}

export function createEnemy(
  world: World,
  roomIndex: number,
  patrol: Vec2[],
  kind: EnemyKind = 'suit',
): Enemy {
  const stats = ENEMY_KINDS[kind];
  // multiplayer adianta a dificuldade: `threat` e a sala que ele "vale"
  const threat = roomIndex + threatBoost(world);
  const intelligence = intelligenceForRoom(world, threat);
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
      Math.min(VIEW_RANGE_MAX_BONUS, threat * VIEW_RANGE_PER_ROOM),
    detectTime: Math.max(
      DETECT_TIME_MIN,
      DETECT_TIME - threat * DETECT_TIME_PER_ROOM,
    ),
    intelligence,
    dash: 0,
    dashCooldown: 0,
    dashEvery:
      threat < ENEMY_DASH_FROM_ROOM
        ? 0
        : Math.max(
            ENEMY_DASH_MIN_INTERVAL,
            ENEMY_DASH_INTERVAL -
              (threat - ENEMY_DASH_FROM_ROOM) * ENEMY_DASH_PER_ROOM,
          ) / intelligence.dash,
    hearing: 0,
    heard: null,
    searchTimer: 0,
    launch: 0,
    throwCooldown: 0,
  };
}

// raio em que o inimigo nota o player em qualquer direcao
export function senseRange(enemy: Enemy): number {
  const contract = Math.floor(enemy.roomIndex / SHOP_EVERY);
  return SENSE_RANGE + Math.min(SENSE_MAX_BONUS, contract * SENSE_PER_CONTRACT);
}

// no cone ate `viewRange`, ou em qualquer direcao dentro de `senseRange`
export function canSee(world: World, enemy: Enemy, target: Vec2): boolean {
  const gap = distance(enemy.pos, target);
  if (gap > enemy.viewRange) return false;
  const offset = angleDiff(angleTo(enemy.pos, target), enemy.facing);
  if (Math.abs(offset) > VIEW_HALF_ANGLE && gap > senseRange(enemy))
    return false;
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
    enemy.route = findPath(world, enemy.pos, target, doorsSealed(world));
    enemy.repathTimer =
      REPATH_INTERVAL /
      (enemy.state === 'alert' ? enemy.intelligence.pursuit : 1);
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
    doorsSealed(world),
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

function hearingRange(world: World, enemy: Enemy): number {
  return (
    world.player.noise *
    (1 + Math.min(HEAR_MAX_BONUS, enemy.roomIndex * HEAR_PER_ROOM)) *
    enemy.intelligence.hearing
  );
}

// O primeiro som ja muda a rota; escuta acumulada leva ao alerta.
function listen(world: World, enemy: Enemy, dt: number): boolean {
  const range = hearingRange(world, enemy);
  const gap = distance(enemy.pos, world.player.pos);
  if (gap >= range) {
    enemy.hearing = Math.max(0, enemy.hearing - dt * DETECT_DECAY);
    return false;
  }
  // player agachado so e ouvido ate o nivel branco: nunca vira alerta
  const limit = enemy.intelligence.hearingThreshold;
  enemy.hearing = Math.min(
    world.player.crouching ? limit * HEARING_YELLOW - 1e-3 : limit,
    enemy.hearing +
      (dt * (1 - gap / range) * enemy.intelligence.hearing) / HEAR_TIME,
  );
  const routedTo = enemy.route.at(-1);
  if (
    !enemy.heard ||
    (routedTo && distance(routedTo, world.player.pos) >= 0.5)
  ) {
    enemy.route = [];
    enemy.repathTimer = 0;
  }
  enemy.heard = { ...world.player.pos };
  enemy.searchTimer = SEARCH_TIME * enemy.intelligence.hearing;
  return enemy.hearing >= limit;
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
  enemy.alertTimer = ALERT_DURATION * enemy.intelligence.pursuit;
  enemy.fireCooldown = FIRE_DELAY;
  // primeiro salto nao vem junto com o alerta
  enemy.dashCooldown = enemy.dashEvery / 2;
  enemy.throwCooldown = SHURIKEN_FIRST;
  enemy.route = [];
  enemy.repathTimer = 0;
}

// Alerta enxerga em 360 graus: basta linha de visao.
// Terno para no alcance de tiro e atira; ninja corre ate encostar e golpeia.
function alert(world: World, enemy: Enemy, dt: number): void {
  const player = world.player;
  const stats = ENEMY_KINDS[enemy.kind];
  const los = hasLineOfSight(world, enemy.pos, player.pos);
  const audible = distance(enemy.pos, player.pos) < hearingRange(world, enemy);
  enemy.alertTimer =
    los || audible
      ? ALERT_DURATION * enemy.intelligence.pursuit
      : enemy.alertTimer - dt;
  if (enemy.alertTimer <= 0) {
    enemy.state = 'patrol';
    enemy.detection = 0;
    enemy.route = [];
    return;
  }
  const reach = stats.ranged ? FIRE_RANGE : NINJA_REACH;
  const gap = distance(enemy.pos, player.pos);
  if (enemy.dash > 0) {
    // bote do ninja acompanha o player que tenta sair da frente
    if (!stats.ranged) {
      const turn = angleDiff(angleTo(enemy.pos, player.pos), enemy.facing);
      enemy.facing += clamp(turn, -NINJA_DASH_TURN * dt, NINJA_DASH_TURN * dt);
    }
    const step =
      DASH_SPEED * enemy.intelligence.dash * Math.min(dt, enemy.dash);
    enemy.dash = Math.max(0, enemy.dash - dt);
    moveCircle(
      world,
      enemy.pos,
      Math.cos(enemy.facing) * step,
      Math.sin(enemy.facing) * step,
      ENEMY_RADIUS,
      doorsSealed(world),
    );
    // ninja pousa ao alcancar o player, em vez de passar por ele
    if (!stats.ranged && distance(enemy.pos, player.pos) <= reach) {
      enemy.dash = 0;
      // pousou colado: o golpe vem logo, sem esperar a recarga inteira
      enemy.fireCooldown = Math.min(enemy.fireCooldown, NINJA_LUNGE_STRIKE);
    }
    return;
  }
  enemy.dashCooldown = Math.max(0, enemy.dashCooldown - dt);
  enemy.throwCooldown = Math.max(0, enemy.throwCooldown - dt);
  // ninja de nivel alto arremessa shuriken de longe e segue se aproximando
  if (
    !stats.ranged &&
    Math.ceil(enemy.roomIndex / SHOP_EVERY) >= SHURIKEN_FROM_LEVEL &&
    enemy.throwCooldown === 0 &&
    los &&
    gap >= SHURIKEN_MIN_GAP &&
    gap <= SHURIKEN_RANGE
  ) {
    enemy.facing = angleTo(enemy.pos, player.pos);
    spawnProjectile(
      world,
      'enemy',
      enemy.pos,
      enemy.facing,
      SHURIKEN_SPEED,
      SHURIKEN_DAMAGE,
      SHURIKEN_RANGE,
      'pistol',
      enemy.id,
    ).shuriken = true;
    enemy.throwCooldown = SHURIKEN_INTERVAL;
    enemy.attack = SLASH_TIME;
  }
  // Ninja fora do alcance do golpe: bote para cima do player, so quando o
  // salto chega nele (de mais longe, corre). Terno: longe salta para cima,
  // ja no alcance de tiro salta de lado, para sair da mira.
  if (
    enemy.dashEvery > 0 &&
    enemy.dashCooldown === 0 &&
    los &&
    (stats.ranged ||
      (gap > reach && gap <= DASH_SPEED * enemy.intelligence.dash * DASH_TIME))
  ) {
    const toward = angleTo(enemy.pos, player.pos);
    const side = nextRandom(world) < 0.5 ? 1 : -1;
    const angles =
      gap > reach
        ? [toward]
        : [toward + (side * Math.PI) / 2, toward - (side * Math.PI) / 2];
    // confere o trajeto inteiro do salto, nao so um ponto: com parede, caixa
    // ou bau no caminho, nao salta (antes saltava contra o obstaculo e
    // escorregava pela quina no ar, parecendo atravessar)
    const leap = DASH_SPEED * enemy.intelligence.dash * DASH_TIME;
    const sealed = doorsSealed(world);
    const clear = (candidate: number) => {
      for (let d = ENEMY_RADIUS; d <= leap; d += ENEMY_RADIUS) {
        // quem salta para cima do player para ao chegar nele
        if (gap > reach && d > gap) break;
        if (
          circleHitsWall(
            world,
            enemy.pos.x + Math.cos(candidate) * d,
            enemy.pos.y + Math.sin(candidate) * d,
            ENEMY_RADIUS,
            sealed,
          )
        ) {
          return false;
        }
      }
      return true;
    };
    const angle = angles.find(clear);
    if (angle !== undefined) {
      enemy.facing = angle;
      enemy.dash = DASH_TIME;
      enemy.dashCooldown = enemy.dashEvery;
      enemy.route = [];
      enemy.repathTimer = 0;
      return;
    }
  }
  if (!los || gap > reach) {
    navigate(
      world,
      enemy,
      player.pos,
      stats.chaseSpeed * enemy.intelligence.pursuit,
      dt,
    );
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
      'pistol',
      enemy.id,
    );
  } else {
    damagePlayer(world, NINJA_DAMAGE, enemy.pos);
  }
  enemy.attack = SLASH_TIME;
}

// corpo lancado por um golpe so: anda LAUNCH_DISTANCE em LAUNCH_TIME,
// freando em linha ate parar; parede segura
function fly(world: World, enemy: Enemy, dt: number): void {
  if (enemy.launch <= 0) return;
  const span = Math.min(dt, enemy.launch);
  // velocidade media do trecho: comeca em 2D/T e chega a zero
  const speed =
    ((2 * LAUNCH_DISTANCE) / LAUNCH_TIME) *
    ((enemy.launch - span / 2) / LAUNCH_TIME);
  enemy.launch = Math.max(0, enemy.launch - dt);
  moveCircle(
    world,
    enemy.pos,
    Math.cos(enemy.facing) * speed * span,
    Math.sin(enemy.facing) * speed * span,
    ENEMY_RADIUS,
    doorsSealed(world),
  );
}

export function updateEnemies(world: World, dt: number): void {
  const focus = world.player;
  for (const enemy of world.enemies) {
    if (enemy.state === 'dead') {
      fly(world, enemy, dt);
      continue;
    }
    // cada inimigo lida com o jogador vivo mais perto dele
    world.player = nearestPlayer(world, enemy.pos) ?? focus;
    enemy.attack = Math.max(0, enemy.attack - dt);
    // detection cheia vem de ver o player ou de levar tiro (damageEnemy)
    if (enemy.state !== 'alert' && enemy.detection >= 1) enterAlert(enemy);
    if (enemy.state === 'alert') {
      alert(world, enemy, dt);
      continue;
    }
    if (listen(world, enemy, dt)) {
      enterAlert(enemy);
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
    if (enemy.heard) {
      enemy.state = 'suspicious';
      investigate(world, enemy, enemy.heard, dt);
      continue;
    }
    enemy.state = 'patrol';
    patrol(world, enemy, dt);
  }
  world.player = focus;
}
