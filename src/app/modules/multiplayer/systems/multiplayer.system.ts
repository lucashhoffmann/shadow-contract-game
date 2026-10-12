import {
  collectPickups,
  updateFloaters,
  updateProjectiles,
} from '@/app/modules/combat/systems/combat.system';
import { updateEnemies } from '@/app/modules/enemy/systems/enemy.system';
import {
  spawnRoom,
  updateRooms,
} from '@/app/modules/level/systems/level.system';
import { roomIndexAt } from '@/app/modules/level/utils/grid.util';
import { movePlayer } from '@/app/modules/player/systems/player.system';
import { ROOMS_BEHIND } from '@/app/modules/world/constants/world.constants';
import {
  createEmptyWorld,
  createPlayer,
  fight,
} from '@/app/modules/world/systems/world.system';
import type {
  InputState,
  Player,
  World,
} from '@/app/modules/world/types/world.types';
import { alivePlayers, asPlayer } from '@/app/modules/world/utils/players.util';
import { getTexts } from '@/shared/i18n';

// Regras que so valem com varios jogadores. O nucleo (movimento, inimigo,
// combate) e o mesmo do solo; aqui fica quem age em que ordem, como o grupo
// avanca de sala e quando a partida acaba.

const IDLE: InputState = { moveX: 0, moveY: 0, dash: false };
// jogadores nascem lado a lado, em volta do ponto de partida do solo
const SPAWN_OFFSETS = [0, -1, 1, -2];

export type Seat = { name: string; color: string };

// mundo de uma partida com `seats.length` jogadores; `players[0]` e o host
export function createMultiWorld(seed: number, seats: Seat[]): World {
  const world = createEmptyWorld(seed, {}, null, 'multi');
  world.players = seats.map((seat, id) => {
    const player = createPlayer(id, seat.name, seat.color);
    player.pos.x += SPAWN_OFFSETS[id] ?? 0;
    return player;
  });
  world.player = world.players[0];
  // salas so depois dos jogadores: a quantidade de inimigos depende deles
  spawnRoom(world, 0);
  updateRooms(world);
  return world;
}

// O grupo anda junto: a sala avanca com quem vai na frente, e quem ficou
// alem de ROOMS_BEHIND (a sala dele viraria parede) e puxado para a entrada
// da sala nova.
function advanceRooms(world: World): void {
  const alive = alivePlayers(world);
  const leader = alive.reduce<Player | undefined>(
    (ahead, player) => (!ahead || player.pos.y > ahead.pos.y ? player : ahead),
    undefined,
  );
  if (!leader) return;
  asPlayer(world, leader, () => updateRooms(world));
  const min = roomIndexAt(leader.pos.y) - ROOMS_BEHIND;
  for (const player of alive) {
    if (roomIndexAt(player.pos.y) >= min) continue;
    player.pos = { ...world.run.checkpoint };
    player.dash = 0;
  }
}

// `inputs[i]` e o input de `players[i]`; sem input, o jogador fica parado.
// Morto (`hp <= 0`) nao age nem e alvo; a partida acaba quando todos morrem.
export function stepMultiWorld(
  world: World,
  inputs: (InputState | undefined)[],
  dt: number,
): void {
  if (world.status !== 'playing') return;
  world.run.seconds += dt;
  const each = (act: (input: InputState) => void) => {
    for (const player of alivePlayers(world)) {
      asPlayer(world, player, () => act(inputs[player.id] ?? IDLE));
    }
  };
  each((input) => movePlayer(world, input, dt));
  advanceRooms(world);
  updateEnemies(world, dt);
  each((input) => fight(world, input, dt));
  updateProjectiles(world, dt);
  updateFloaters(world, dt);
  each(() => collectPickups(world));
  if (alivePlayers(world).length > 0) return;
  world.status = 'dead';
  world.run.events.push({
    at: world.run.seconds,
    text: getTexts().events.contractEnded(world.run.roomIndex),
  });
}
