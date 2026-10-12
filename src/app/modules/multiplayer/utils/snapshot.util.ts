import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import type {
  InputState,
  ItemId,
  Room,
  Run,
  World,
} from '@/app/modules/world/types/world.types';

// O host simula e manda o mundo para os convidados; o convidado manda so o
// proprio input. Aqui fica o formato dessas duas mensagens.
// ponytail: o snapshot e o mundo quase inteiro em JSON, 20 vezes por segundo.
// Serve em rede local e banda larga; se pesar, mandar so o que mudou.

export type Snapshot = Omit<
  World,
  'player' | 'rooms' | 'run' | 'intelligence'
> & {
  // so vem quando as salas mudaram (sala nova, caixa quebrada)
  rooms?: Room[];
  // o registro da partida so vem no fim, para a tela de derrota
  run: Omit<Run, 'events'> & { events?: Run['events'] };
};

// muda quando alguma sala entra, sai ou tem tile alterado
export function roomsKey(world: World): string {
  return world.rooms
    .map(
      (room) =>
        `${room.index}:${room.shopVisited}:${room.reviveFree}:${room.tiles.join('')}`,
    )
    .join('|');
}

// `sentRooms`: chave das salas do ultimo snapshot enviado
export function encodeSnapshot(world: World, sentRooms: string): Snapshot {
  const { rngState, nextId, status, mode, players, enemies } = world;
  const { projectiles, props, pickups, floaters, market, run } = world;
  return {
    rngState,
    nextId,
    status,
    mode,
    players,
    enemies,
    projectiles,
    props,
    pickups,
    floaters,
    market,
    ...(roomsKey(world) !== sentRooms && { rooms: world.rooms }),
    run: status === 'dead' ? run : { ...run, events: undefined },
  };
}

// Mundo do convidado a partir do snapshot. `you` e a posicao dele em
// `players`: vira o jogador em foco (camera e HUD). Sem salas no snapshot,
// ficam as do mundo anterior.
export function applySnapshot(
  previous: World | null,
  snapshot: Snapshot,
  you: number,
): World {
  return {
    ...snapshot,
    rooms: snapshot.rooms ?? previous?.rooms ?? [],
    run: { ...snapshot.run, events: snapshot.run.events ?? [] },
    intelligence: {},
    player: snapshot.players[you] ?? snapshot.players[0],
  };
}

// Input do convidado guardado pelo host ate o proximo passo. Pulso (F, B) que
// chegou nao pode se perder se outro input vier antes do passo.
export function mergeInput(
  pending: InputState | undefined,
  incoming: InputState,
): InputState {
  return {
    ...incoming,
    interact: incoming.interact || pending?.interact,
    open: incoming.open || pending?.open,
    buy: incoming.buy ?? pending?.buy,
    leaveShop: incoming.leaveShop || pending?.leaveShop,
    revive: incoming.revive ?? pending?.revive,
    select: incoming.select ?? pending?.select,
  };
}

// depois do passo: o pulso ja valeu
export function clearPulses(input: InputState | undefined): void {
  if (!input) return;
  input.interact = false;
  input.open = false;
  input.buy = undefined;
  input.leaveShop = false;
  input.revive = undefined;
  input.select = undefined;
}

// so o que o host aceita de um convidado: numeros limitados e booleanos
export function cleanInput(payload: unknown): InputState | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const axis = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(-1, Math.min(1, value))
      : 0;
  return {
    moveX: axis(raw.moveX),
    moveY: axis(raw.moveY),
    dash: raw.dash === true,
    crouch: raw.crouch === true,
    interact: raw.interact === true,
    open: raw.open === true,
    ...(typeof raw.buy === 'string' &&
      raw.buy in ITEMS && { buy: raw.buy as ItemId }),
    ...(raw.leaveShop === true && { leaveShop: true }),
    ...(Number.isInteger(raw.revive) && { revive: raw.revive as number }),
    ...(typeof raw.select === 'string' &&
      (raw.select === 'sword' ||
        raw.select === 'next' ||
        (raw.select in ITEMS &&
          ITEMS[raw.select as ItemId].kind === 'weapon')) && {
        select: raw.select as InputState['select'],
      }),
  };
}
