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
import {
  cycleWeapon,
  movePlayer,
  selectWeapon,
} from '@/app/modules/player/systems/player.system';
import {
  buyItem,
  nearbyChest,
  visitShop,
} from '@/app/modules/shop/systems/shop.system';
import {
  CHEST_RANGE,
  REVIVE_HP,
  ROOMS_BEHIND,
} from '@/app/modules/world/constants/world.constants';
import {
  createEmptyWorld,
  createPlayer,
  fight,
} from '@/app/modules/world/systems/world.system';
import type {
  InputState,
  Player,
  Room,
  World,
} from '@/app/modules/world/types/world.types';
import { alivePlayers, asPlayer } from '@/app/modules/world/utils/players.util';
import { distance } from '@/shared/utils/math.util';
import { eventText } from '@/shared/i18n';

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

// sala cujo bau de revive esta ao alcance do jogador em foco
export function nearbyReviveChest(world: World): Room | undefined {
  return world.rooms.find(
    (room) =>
      room.reviveChest &&
      distance(world.player.pos, room.reviveChest) <= CHEST_RANGE,
  );
}

// Quantos o bau ainda levanta: um por ficha do grupo. Sem ficha, um de graca
// por bau, para o grupo nao ficar preso com gente morta.
export function reviveAllowance(world: World, room: Room): number {
  return world.run.revives > 0 ? world.run.revives : room.reviveFree ? 1 : 0;
}

// levanta `dead` ao lado do bau, gastando uma ficha (ou o revive gratis)
function reviveAt(world: World, room: Room, dead: Player): void {
  if (!room.reviveChest || dead.hp > 0) return;
  if (reviveAllowance(world, room) === 0) return;
  if (world.run.revives > 0) world.run.revives--;
  else room.reviveFree = false;
  dead.hp = Math.round(dead.maxHp * REVIVE_HP);
  // em volta do bau, um lugar por jogador
  dead.pos = {
    x: room.reviveChest.x + (SPAWN_OFFSETS[dead.id] ?? 0) * 0.6,
    y: room.reviveChest.y - 1.2,
  };
  dead.dash = 0;
}

// B no bau de revive. Da para levantar todos os mortos: levanta. Ha mais
// mortos que revives: quem abriu escolhe (`player.reviving`).
function openReviveChest(world: World, room: Room): void {
  const dead = world.players.filter((player) => player.hp <= 0);
  const allowance = reviveAllowance(world, room);
  if (dead.length === 0 || allowance === 0) return;
  if (dead.length > allowance) {
    world.player.reviving = true;
    return;
  }
  for (const player of dead) reviveAt(world, room, player);
}

// Loja, bau de revive e troca de arma do jogador em foco. Devolve true se
// ele esta ocupado (loja aberta ou escolhendo quem reviver): fica parado e
// nao ataca, enquanto o jogo dos outros segue.
function desk(world: World, input: InputState): boolean {
  const player = world.player;
  if (input.select) {
    if (input.select === 'next') cycleWeapon(world);
    else selectWeapon(world, input.select === 'sword' ? null : input.select);
  }
  if (player.shopping) {
    if (input.buy) buyItem(world, input.buy);
    if (input.leaveShop || !nearbyChest(world)) player.shopping = false;
    return player.shopping;
  }
  if (player.reviving) {
    const room = nearbyReviveChest(world);
    const chosen = world.players[input.revive ?? -1];
    if (room && chosen) reviveAt(world, room, chosen);
    // acabou o que escolher, ou ele fechou
    if (
      input.leaveShop ||
      !room ||
      reviveAllowance(world, room) === 0 ||
      world.players.every((other) => other.hp > 0)
    ) {
      player.reviving = false;
    }
    return player.reviving;
  }
  if (!input.open) return false;
  const shop = nearbyChest(world);
  if (shop) {
    visitShop(world, shop);
    player.shopping = true;
    return true;
  }
  const revive = nearbyReviveChest(world);
  if (revive) openReviveChest(world, revive);
  return player.reviving;
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
  // ocupado na loja ou no bau de revive: nao anda nem ataca neste passo
  const busy = new Set<Player>();
  each((input) => {
    if (desk(world, input)) busy.add(world.player);
    else movePlayer(world, input, dt);
  });
  advanceRooms(world);
  updateEnemies(world, dt);
  each((input) => {
    if (!busy.has(world.player)) fight(world, input, dt);
  });
  updateProjectiles(world, dt);
  updateFloaters(world, dt);
  each(() => collectPickups(world));
  if (alivePlayers(world).length > 0) return;
  world.status = 'dead';
  world.run.events.push({
    at: world.run.seconds,
    ...eventText((t) => t.events.contractEnded(world.run.roomIndex)),
  });
}
