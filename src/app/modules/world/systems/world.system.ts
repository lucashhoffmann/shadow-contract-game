import {
  collectPickups,
  updateCombat,
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
  updateShopTrigger,
} from '@/app/modules/shop/systems/shop.system';
import {
  ATTACK_COOLDOWN,
  PLAYER_MAX_HP,
  SLASH_TIME,
} from '@/app/modules/world/constants/world.constants';
import type { InputState, World } from '@/app/modules/world/types/world.types';
import { angleTo } from '@/shared/utils/math.util';

// mundo sem salas; usado pela fixture de teste para montar geometria propria
export function createEmptyWorld(seed: number): World {
  return {
    rngState: seed | 0,
    nextId: 1,
    status: 'playing',
    player: {
      pos: tileCenter(0, 5, 10),
      facing: Math.PI / 2,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      attackCooldown: 0,
      slash: 0,
      adrenaline: 0,
      dash: 0,
      dashCooldown: 0,
      weapon: null,
    },
    enemies: [],
    projectiles: [],
    props: [],
    pickups: [],
    rooms: [],
    run: { money: 0, earned: 0, roomIndex: 0, kills: 0, shops: 0 },
    market: createMarket(),
  };
}

export function createWorld(seed: number): World {
  const world = createEmptyWorld(seed);
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
  collectPickups(world);
  updateShopTrigger(world);
  if (world.player.hp <= 0) world.status = 'dead';
}
