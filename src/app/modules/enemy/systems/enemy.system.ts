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
  NINJA_DODGE_CHANCE,
  NINJA_DODGE_COST,
  NINJA_DODGE_HOP,
  PACK_ARRIVED,
  NINJA_DODGE_MAX,
  NINJA_DODGE_RANGE,
  PACK_CALL_MAX,
  PACK_CALL_PER_LEVEL,
  PACK_CALL_RADIUS,
  PACK_RING,
  RAGE_DASH,
  RAGE_DETECT,
  RAGE_HEARING,
  RAGE_PURSUIT,
  RAGE_THRESHOLD,
  RAGE_VIEW,
  BULLET_RADIUS,
  ENEMY_CRIT_CHANCE,
  ENEMY_CRIT_FROM_LEVEL,
  ENEMY_CRIT_MAX,
  ENEMY_CRIT_MULT,
  ENEMY_CRIT_PER_LEVEL,
  ENEMY_DAMAGE_PER_LEVEL,
  ENEMY_DAMAGE_SHARE,
  ENEMY_DAMAGE_SHARE_MAX,
  ENEMY_DAMAGE_SHARE_PER_LEVEL,
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
    evading: false,
    enraged: false,
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

// nivel (contrato) que o inimigo vale; o multiplayer adianta (threatBoost)
function levelOf(world: World, enemy: Enemy): number {
  return Math.max(
    1,
    Math.ceil((enemy.roomIndex + threatBoost(world)) / SHOP_EVERY),
  );
}

// Dano de um ataque de dano base `base` contra o jogador em foco: cresce com
// o nivel e nunca cai abaixo de uma fatia da vida maxima do alvo.
export function enemyDamage(world: World, enemy: Enemy, base: number): number {
  const level = levelOf(world, enemy);
  const share = Math.min(
    ENEMY_DAMAGE_SHARE_MAX,
    ENEMY_DAMAGE_SHARE + ENEMY_DAMAGE_SHARE_PER_LEVEL * (level - 1),
  );
  return Math.round(
    Math.max(
      base * (1 + ENEMY_DAMAGE_PER_LEVEL * (level - 1)),
      // a fatia e do golpe de ninja; ataques mais fracos levam a proporcao
      world.player.maxHp * share * (base / NINJA_DAMAGE),
    ),
  );
}

// Sorteia o ataque de dano base `base`: dano do nivel e, a partir de
// ENEMY_CRIT_FROM_LEVEL, a chance de sair critico. Antes desse nivel nao
// sorteia nada, para o comeco do jogo seguir igual.
export function enemyStrike(
  world: World,
  enemy: Enemy,
  base: number,
): { damage: number; critical: boolean } {
  const damage = enemyDamage(world, enemy, base);
  const level = levelOf(world, enemy);
  if (level < ENEMY_CRIT_FROM_LEVEL) return { damage, critical: false };
  const chance = Math.min(
    ENEMY_CRIT_MAX,
    ENEMY_CRIT_CHANCE + ENEMY_CRIT_PER_LEVEL * (level - ENEMY_CRIT_FROM_LEVEL),
  );
  if (nextRandom(world) >= chance) return { damage, critical: false };
  return { damage: Math.round(damage * ENEMY_CRIT_MULT), critical: true };
}

// Viu um colega morto: entra em furia. Fica mais esperto ate morrer e, se
// ainda nao sabe do player, vai conferir o corpo.
function witness(world: World, enemy: Enemy): void {
  if (enemy.enraged) return;
  const corpse = world.enemies.find(
    (other) => other.state === 'dead' && canSee(world, enemy, other.pos),
  );
  if (!corpse) return;
  enemy.enraged = true;
  // copia: o perfil de inteligencia e compartilhado pelo nivel inteiro
  enemy.intelligence = {
    ...enemy.intelligence,
    hearing: enemy.intelligence.hearing * RAGE_HEARING,
    hearingThreshold: enemy.intelligence.hearingThreshold * RAGE_THRESHOLD,
    pursuit: enemy.intelligence.pursuit * RAGE_PURSUIT,
    dash: enemy.intelligence.dash * RAGE_DASH,
  };
  enemy.viewRange += RAGE_VIEW;
  enemy.detectTime *= RAGE_DETECT;
  if (enemy.state === 'alert') return;
  enemy.heard = { ...corpse.pos };
  enemy.searchTimer = SEARCH_TIME * enemy.intelligence.hearing;
  enemy.route = [];
  enemy.repathTimer = 0;
}

// Quem entrou em alerta chama os colegas por perto: entram em alerta no
// passo seguinte e chamam tambem.
function rally(world: World, caller: Enemy): void {
  const radius = Math.min(
    PACK_CALL_MAX,
    PACK_CALL_RADIUS + PACK_CALL_PER_LEVEL * (levelOf(world, caller) - 1),
  );
  for (const ally of world.enemies) {
    if (ally.state === 'dead' || ally.state === 'alert') continue;
    if (distance(ally.pos, caller.pos) <= radius) ally.detection = 1;
  }
}

// Para onde o ninja corre atras do alvo. Sozinho: direto. Em bando: cada um
// tem um lado do alvo, repartido por igual em volta dele a partir de onde
// esta o mais antigo do bando; corre para o ponto do aro desse lado e, ja do
// lado certo, parte direto para o golpe. A reparticao e pela ordem de id, que
// nao muda: se fosse por quem esta mais perto, trocariam de lado a cada passo.
function packTarget(world: World, enemy: Enemy): Vec2 {
  const target = world.player.pos;
  const pack = world.enemies.filter(
    (ally) =>
      ally.state === 'alert' &&
      !ENEMY_KINDS[ally.kind].ranged &&
      nearestPlayer(world, ally.pos) === world.player,
  );
  if (pack.length < 2) return target;
  const side =
    angleTo(target, pack[0].pos) +
    (pack.indexOf(enemy) * Math.PI * 2) / pack.length;
  if (Math.abs(angleDiff(side, angleTo(target, enemy.pos))) < PACK_ARRIVED) {
    return target;
  }
  const spot = {
    x: target.x + Math.cos(side) * PACK_RING,
    y: target.y + Math.sin(side) * PACK_RING,
  };
  // ponto do aro dentro de parede ou caixa: vai direto
  return circleHitsWall(world, spot.x, spot.y, ENEMY_RADIUS) ? target : spot;
}

// caminho reto de `length` a partir do inimigo, livre de parede e caixa
function leapClear(world: World, enemy: Enemy, angle: number, length: number) {
  const sealed = doorsSealed(world);
  for (let d = ENEMY_RADIUS; d <= length; d += ENEMY_RADIUS) {
    if (
      circleHitsWall(
        world,
        enemy.pos.x + Math.cos(angle) * d,
        enemy.pos.y + Math.sin(angle) * d,
        ENEMY_RADIUS,
        sealed,
      )
    ) {
      return false;
    }
  }
  return true;
}

// Esquiva: se ha bala do player vindo na direcao do ninja, salta de lado.
// Devolve true se saltou. A sorte e fixa por par bala/ninja: a mesma bala
// nao e sorteada de novo a cada passo.
function dodge(world: World, enemy: Enemy): boolean {
  if (enemy.dashEvery === 0) return false;
  if (enemy.dashCooldown > enemy.dashEvery * (1 - NINJA_DODGE_COST)) {
    return false;
  }
  const chance = Math.min(
    NINJA_DODGE_MAX,
    NINJA_DODGE_CHANCE * enemy.intelligence.dash ** 2,
  );
  for (const bullet of world.projectiles) {
    if (bullet.owner !== 'player') continue;
    const speed = Math.hypot(bullet.vel.x, bullet.vel.y);
    if (speed === 0) continue;
    const [ux, uy] = [bullet.vel.x / speed, bullet.vel.y / speed];
    const [rx, ry] = [enemy.pos.x - bullet.pos.x, enemy.pos.y - bullet.pos.y];
    // quanto falta ate ele ao longo do tiro, e por quanto passaria de lado
    const along = rx * ux + ry * uy;
    const side = rx * uy - ry * ux;
    if (along <= 0 || along > NINJA_DODGE_RANGE) continue;
    if (Math.abs(side) > ENEMY_RADIUS + BULLET_RADIUS + 0.2) continue;
    if (((bullet.id * 31 + enemy.id * 17) % 100) / 100 >= chance) continue;
    // para o lado em que ja esta em relacao ao tiro; bloqueado, o outro.
    // Salto curto: so o bastante para sair da linha
    const heading = Math.atan2(uy, ux);
    const away = side >= 0 ? -1 : 1;
    const angle = [away, -away]
      .map((turn) => heading + (turn * Math.PI) / 2)
      .find((candidate) => leapClear(world, enemy, candidate, NINJA_DODGE_HOP));
    if (angle === undefined) return false;
    enemy.facing = angle;
    enemy.dash = NINJA_DODGE_HOP / (DASH_SPEED * enemy.intelligence.dash);
    enemy.evading = true;
    enemy.dashCooldown = enemy.dashEvery * NINJA_DODGE_COST;
    enemy.route = [];
    enemy.repathTimer = 0;
    return true;
  }
  return false;
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
    if (!stats.ranged && !enemy.evading) {
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
    if (
      !stats.ranged &&
      !enemy.evading &&
      distance(enemy.pos, player.pos) <= reach
    ) {
      enemy.dash = 0;
      // pousou colado: o golpe vem logo, sem esperar a recarga inteira
      enemy.fireCooldown = Math.min(enemy.fireCooldown, NINJA_LUNGE_STRIKE);
    }
    return;
  }
  enemy.evading = false;
  enemy.dashCooldown = Math.max(0, enemy.dashCooldown - dt);
  enemy.throwCooldown = Math.max(0, enemy.throwCooldown - dt);
  // ninja desvia de tiro com um salto de lado
  if (!stats.ranged && dodge(world, enemy)) return;
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
    const star = enemyStrike(world, enemy, SHURIKEN_DAMAGE);
    Object.assign(
      spawnProjectile(
        world,
        'enemy',
        enemy.pos,
        enemy.facing,
        SHURIKEN_SPEED,
        star.damage,
        SHURIKEN_RANGE,
        'pistol',
        enemy.id,
      ),
      { shuriken: true, ...(star.critical && { critical: true }) },
    );
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
      // ninja em bando cerca; terno e ninja sozinho vao direto
      stats.ranged ? player.pos : packTarget(world, enemy),
      stats.chaseSpeed * enemy.intelligence.pursuit,
      dt,
    );
    return;
  }
  enemy.facing = angleTo(enemy.pos, player.pos);
  enemy.fireCooldown -= dt;
  if (enemy.fireCooldown > 0) return;
  enemy.fireCooldown = FIRE_INTERVAL;
  const strike = enemyStrike(
    world,
    enemy,
    stats.ranged ? ENEMY_BULLET_DAMAGE : NINJA_DAMAGE,
  );
  if (stats.ranged) {
    const bullet = spawnProjectile(
      world,
      'enemy',
      enemy.pos,
      enemy.facing,
      ENEMY_BULLET_SPEED,
      strike.damage,
      FIRE_RANGE,
      'pistol',
      enemy.id,
    );
    if (strike.critical) bullet.critical = true;
  } else {
    damagePlayer(world, strike.damage, enemy.pos, strike.critical);
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
    witness(world, enemy);
    enemy.attack = Math.max(0, enemy.attack - dt);
    // detection cheia vem de ver o player ou de levar tiro (damageEnemy)
    if (enemy.state !== 'alert' && enemy.detection >= 1) {
      enterAlert(enemy);
      rally(world, enemy);
    }
    if (enemy.state === 'alert') {
      alert(world, enemy, dt);
      continue;
    }
    if (listen(world, enemy, dt)) {
      enterAlert(enemy);
      rally(world, enemy);
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
