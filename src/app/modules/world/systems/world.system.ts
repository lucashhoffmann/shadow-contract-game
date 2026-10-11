import {
  collectPickups,
  updateCombat,
  updateFloaters,
  updateProjectiles,
} from '@/app/modules/combat/systems/combat.system';
import { updateEnemies } from '@/app/modules/enemy/systems/enemy.system';
import {
  spawnRoom,
  updateRooms,
} from '@/app/modules/level/systems/level.system';
import {
  breakProp,
  nearbyProp,
  tileCenter,
} from '@/app/modules/level/utils/grid.util';
import { movePlayer } from '@/app/modules/player/systems/player.system';
import {
  createMarket,
  openChest,
} from '@/app/modules/shop/systems/shop.system';
import {
  ATTACK_COOLDOWN,
  PLAYER_MAX_HP,
  SLASH_TIME,
} from '@/app/modules/world/constants/world.constants';
import type {
  AttackVariance,
  EnemyIntelligence,
  InputState,
  World,
} from '@/app/modules/world/types/world.types';
import { angleTo } from '@/shared/utils/math.util';
import { nextRandom } from '@/shared/utils/rng.util';

// mundo sem salas; usado pela fixture de teste para montar geometria propria
export function createEmptyWorld(
  seed: number,
  intelligence: Record<number, EnemyIntelligence> = {},
  savedAttackVariance?: AttackVariance | null,
): World {
  const attackRng = { rngState: seed ^ 0x51f15e };
  const attackVariance = savedAttackVariance ?? {
    min: (75 + Math.floor(nextRandom(attackRng) * 11)) / 100,
    max: (115 + Math.floor(nextRandom(attackRng) * 11)) / 100,
  };
  return {
    rngState: seed | 0,
    nextId: 1,
    status: 'playing',
    player: {
      pos: tileCenter(0, 5, 10),
      facing: Math.PI / 2,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      shield: 0,
      attackCooldown: 0,
      slash: 0,
      shot: 0,
      adrenaline: 0,
      dash: 0,
      dashCooldown: 0,
      noise: 0,
      crouching: false,
      weapon: null,
    },
    enemies: [],
    projectiles: [],
    props: [],
    pickups: [],
    floaters: [],
    rooms: [],
    run: {
      money: 0,
      earned: 0,
      roomIndex: 0,
      kills: 0,
      shops: 0,
      seconds: 0,
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
        { at: 0, text: 'Contrato iniciado.' },
        {
          at: 0,
          text: `Variação de ataque: ${Math.round(attackVariance.min * 100)}% a ${Math.round(attackVariance.max * 100)}% do dano base.`,
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

export function stepWorld(world: World, input: InputState, dt: number): void {
  if (world.status !== 'playing') return;
  world.run.seconds += dt;
  movePlayer(world, input, dt);
  updateRooms(world);
  updateEnemies(world, dt);
  const prop = input.interact && nearbyProp(world);
  if (prop) {
    world.player.facing = angleTo(world.player.pos, prop.pos);
    world.player.slash = SLASH_TIME;
    world.player.attackCooldown = ATTACK_COOLDOWN;
    breakProp(world, prop);
  }
  updateCombat(world, dt);
  updateProjectiles(world, dt);
  updateFloaters(world, dt);
  collectPickups(world);
  if (input.open) openChest(world);
  if (world.player.hp <= 0) {
    world.status = 'dead';
    world.run.events.push({
      at: world.run.seconds,
      text: `Contrato encerrado na sala ${world.run.roomIndex}.`,
    });
  }
}
