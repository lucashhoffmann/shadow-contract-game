import {
  collectPickups,
  meleeTarget,
  updateCombat,
  updateFloaters,
  updateProjectiles,
} from '@/app/modules/combat/systems/combat.system';
import { eventText } from '@/shared/i18n';
import {
  createEnemy,
  updateEnemies,
} from '@/app/modules/enemy/systems/enemy.system';
import {
  spawnRoom,
  updateRooms,
} from '@/app/modules/level/systems/level.system';
import {
  breakProp,
  isSolidTile,
  nearbyProp,
  roomIndexAt,
  tileAt,
  tileCenter,
} from '@/app/modules/level/utils/grid.util';
import { findPath } from '@/app/modules/level/utils/pathfinding.util';
import { movePlayer } from '@/app/modules/player/systems/player.system';
import {
  createMarket,
  openChest,
} from '@/app/modules/shop/systems/shop.system';
import {
  ATTACK_COOLDOWN,
  DASH_MAX,
  HEADSHOT_BASE,
  IDLE_MAX_ENEMIES,
  IDLE_WARNING_DELAY,
  IDLE_WARNING_INTERVAL,
  PLAYER_MAX_HP,
  REVIVE_HP,
  ROOM_H,
  ROOM_W,
  setRoomSize,
  SLASH_TIME,
  STREAK_NEVER,
} from '@/app/modules/world/constants/world.constants';
import type {
  AttackVariance,
  EnemyIntelligence,
  InputState,
  Player,
  Vec2,
  World,
  WorldMode,
} from '@/app/modules/world/types/world.types';
import { angleTo, distance } from '@/shared/utils/math.util';
import { nextRandom } from '@/shared/utils/rng.util';

// ponto de partida: centro da sala inicial, perto da parede de tras
function startPoint(): Vec2 {
  return tileCenter(0, Math.floor(ROOM_W / 2), ROOM_H - 3);
}

// jogador novo, de vida cheia, no ponto de partida da sala inicial
export function createPlayer(
  id: number,
  name = '',
  color: string | null = null,
): Player {
  return {
    id,
    name,
    color,
    money: 0,
    shopping: false,
    reviving: false,
    kills: 0,
    deaths: 0,
    streak: 0,
    lastKillAt: STREAK_NEVER,
    pos: startPoint(),
    facing: Math.PI / 2,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    shield: 0,
    attackCooldown: 0,
    slash: 0,
    shot: 0,
    adrenaline: 0,
    invisible: 0,
    invisibleTotal: 0,
    invincible: 0,
    invincibleTotal: 0,
    dash: 0,
    dashCooldown: 0,
    dashes: DASH_MAX,
    noise: 0,
    crouching: false,
    headshot: HEADSHOT_BASE,
    weapon: null,
    arsenal: [],
  };
}

// mundo sem salas; usado pela fixture de teste para montar geometria propria
export function createEmptyWorld(
  seed: number,
  intelligence: Record<number, EnemyIntelligence> = {},
  savedAttackVariance?: AttackVariance | null,
  mode: WorldMode = 'solo',
): World {
  setRoomSize(mode);
  const attackRng = { rngState: seed ^ 0x51f15e };
  const attackVariance = savedAttackVariance ?? {
    // minimo nunca abaixo do dano base: dois golpes sempre matam
    min: (100 + Math.floor(nextRandom(attackRng) * 11)) / 100,
    max: (140 + Math.floor(nextRandom(attackRng) * 11)) / 100,
  };
  const player = createPlayer(0);
  return {
    rngState: seed | 0,
    nextId: 1,
    status: 'playing',
    mode,
    players: [player],
    player,
    enemies: [],
    projectiles: [],
    props: [],
    pickups: [],
    floaters: [],
    rooms: [],
    run: {
      earned: 0,
      roomIndex: 0,
      kills: 0,
      shops: 0,
      revives: 0,
      checkpoint: startPoint(),
      seconds: 0,
      lastMovedAt: 0,
      lastIdleWarningAt: 0,
      idleWarnings: 0,
      attackVariance,
      meleeMissChance: 0,
      nextMeleeChanceAt: 0,
      stats: {
        meleeAttempts: 0,
        meleeHits: 0,
        damageDealt: 0,
        projectilesFired: 0,
        projectilesHit: 0,
        damageTaken: 0,
        damageBlocked: 0,
        healthRecovered: 0,
      },
      events: [
        { at: 0, ...eventText((t) => t.events.contractStarted) },
        {
          at: 0,
          ...eventText((t) =>
            t.events.attackVariance(
              Math.round(attackVariance.min * 100),
              Math.round(attackVariance.max * 100),
            ),
          ),
        },
      ],
    },
    market: createMarket(),
    intelligence: { ...intelligence },
  };
}

export function createWorld(
  seed: number,
  intelligence: Record<number, EnemyIntelligence> = {},
  attackVariance?: AttackVariance | null,
): World {
  const world = createEmptyWorld(seed, intelligence, attackVariance);
  spawnRoom(world, 0);
  updateRooms(world);
  return world;
}

// legenda inicial -> jogo
export function beginRun(world: World): void {
  if (world.status === 'intro') world.status = 'playing';
}

export function togglePause(world: World): void {
  if (world.status === 'playing') world.status = 'paused';
  else if (world.status === 'paused') world.status = 'playing';
}

function sendIdleEnemy(world: World): void {
  const player = world.player.pos;
  const living = world.enemies.filter((enemy) => enemy.state !== 'dead');
  const reachable = living
    .filter((enemy) => findPath(world, enemy.pos, player).length > 0)
    .sort((a, b) => distance(a.pos, player) - distance(b.pos, player));
  const available = reachable.find((enemy) => enemy.state !== 'alert');
  if (available) {
    available.detection = 1;
    available.route = [];
    available.repathTimer = 0;
    return;
  }
  if (reachable.length >= IDLE_MAX_ENEMIES) return;

  const room = world.rooms.find((room) => room.index === roomIndexAt(player.y));
  if (!room) return;
  const spots: Vec2[] = [];
  for (let row = 0; row < ROOM_H; row++) {
    for (let col = 0; col < ROOM_W; col++) {
      const pos = tileCenter(room.index, col, row);
      if (
        isSolidTile(tileAt(world, col, Math.floor(pos.y))) ||
        distance(pos, player) < 3 ||
        living.some((enemy) => distance(enemy.pos, pos) < 1)
      )
        continue;
      spots.push(pos);
    }
  }
  spots.sort((a, b) => distance(b, player) - distance(a, player));
  const spot = spots.find((pos) => findPath(world, pos, player).length > 0);
  if (!spot) return;
  const enemy = createEnemy(world, room.index, [spot], 'ninja');
  enemy.detection = 1;
  world.enemies.push(enemy);
}

function updateIdlePressure(world: World, before: Vec2): void {
  const run = world.run;
  if (distance(before, world.player.pos) > 0.001) {
    run.lastMovedAt = run.seconds;
    return;
  }
  if (
    run.seconds - run.lastMovedAt < IDLE_WARNING_DELAY ||
    run.seconds - run.lastIdleWarningAt < IDLE_WARNING_INTERVAL
  )
    return;
  run.lastIdleWarningAt = run.seconds;
  run.idleWarnings++;
  run.events.push({
    at: run.seconds,
    ...eventText((t) => t.events.idleEnemies),
  });
  sendIdleEnemy(world);
}

// Gasta uma ficha: o player volta na entrada da sala com parte da vida. Quem
// estava em cima dele perde o rastro e as balas no ar somem, para nao morrer
// de novo no mesmo instante.
function revive(world: World): void {
  const { player, run } = world;
  run.revives--;
  player.hp = Math.round(player.maxHp * REVIVE_HP);
  player.pos = { ...run.checkpoint };
  player.dash = 0;
  for (const enemy of world.enemies) {
    if (enemy.state === 'dead') continue;
    enemy.state = 'patrol';
    enemy.detection = 0;
    enemy.hearing = 0;
    enemy.heard = null;
    enemy.route = [];
    enemy.repathTimer = 0;
  }
  world.projectiles = world.projectiles.filter((p) => p.owner === 'player');
  run.events.push({
    at: run.seconds,
    ...eventText((t) => t.events.reviveUsed(run.revives)),
  });
}

// F e ataque do jogador em foco: facada, caixa ou tiro
export function fight(world: World, input: InputState, dt: number): void {
  // F com arma na mao e inimigo ao alcance e facada, nao caixa
  const knife =
    !!input.interact && !!world.player.weapon && !!meleeTarget(world);
  const prop = input.interact && !knife && nearbyProp(world);
  if (prop) {
    world.player.facing = angleTo(world.player.pos, prop.pos);
    world.player.slash = SLASH_TIME;
    world.player.attackCooldown = ATTACK_COOLDOWN;
    breakProp(world, prop);
  }
  updateCombat(world, dt, knife);
}

export function stepWorld(world: World, input: InputState, dt: number): void {
  if (world.status !== 'playing') return;
  world.run.seconds += dt;
  const before = { ...world.player.pos };
  movePlayer(world, input, dt);
  updateRooms(world);
  updateIdlePressure(world, before);
  updateEnemies(world, dt);
  fight(world, input, dt);
  updateProjectiles(world, dt);
  updateFloaters(world, dt);
  collectPickups(world);
  if (input.open) openChest(world);
  if (world.player.hp <= 0 && world.run.revives > 0) revive(world);
  if (world.player.hp <= 0) {
    world.status = 'dead';
    world.run.events.push({
      at: world.run.seconds,
      ...eventText((t) => t.events.contractEnded(world.run.roomIndex)),
    });
  }
}
