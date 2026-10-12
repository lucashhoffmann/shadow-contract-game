import type { Snapshot } from '@/app/modules/multiplayer/utils/snapshot.util';
import { FIXED_DT } from '@/app/modules/world/constants/world.constants';
import type { InputState } from '@/app/modules/world/types/world.types';
import {
  getWorld,
  type MultiLink,
  useGameStore,
} from '@/app/store/game-store/game.store';

// Loja, revive e recomeco da partida em rede.

const store = () => useGameStore.getState();
const SEATS = [
  { name: 'Host', color: '#ff8a3c' },
  { name: 'Ana', color: '#39d0ff' },
];
const IDLE: InputState = { moveX: 0, moveY: 0, dash: false };
const wire = (value: unknown) => JSON.parse(JSON.stringify(value)) as Snapshot;

function link(host: boolean, you: number) {
  return {
    host,
    you,
    sendState: vi.fn<(snapshot: Snapshot) => void>(),
    sendInput: vi.fn<(input: InputState) => void>(),
    leave: vi.fn<() => void>(),
  } satisfies MultiLink;
}

beforeEach(() => store().backToMenu());

it('convidado manda compra, fechar loja, revive e troca de arma no input', () => {
  const net = link(false, 1);
  store().startMulti(SEATS, net);
  store().buy('pistol');
  store().tick(IDLE, FIXED_DT);
  store().closeShop();
  store().revive(0);
  store().cycleWeapon();
  store().tick(IDLE, FIXED_DT);
  store().tick(IDLE, FIXED_DT);

  const sent = net.sendInput.mock.calls.map(([input]) => input);
  expect(sent[0]).toMatchObject({ buy: 'pistol' });
  expect(sent[1]).toMatchObject({ leaveShop: true, revive: 0, select: 'next' });
  // pulso vai uma vez so
  expect(sent[2].buy).toBeUndefined();
  expect(sent[2].leaveShop).toBeUndefined();
});

it('loja em rede abre so na tela de quem esta nela, sem parar o mundo', () => {
  // estado do host com o convidado (lugar 1) na loja
  const hostNet = link(true, 0);
  store().startMulti(SEATS, hostNet, 1);
  const snapshot = wire(hostNet.sendState.mock.calls[0][0]);
  snapshot.players[1].shopping = true;
  // o host continua jogando
  store().tick(IDLE, FIXED_DT);
  expect(store().screen).toBe('playing');

  store().backToMenu();
  store().startMulti(SEATS, link(false, 1));
  store().receiveState(snapshot);
  expect(store().screen).toBe('shop');
  expect(getWorld()!.status).toBe('playing');
});

it('host recomeca para todos sem sair da sessao; so depois da derrota', () => {
  const net = link(true, 0);
  store().startMulti(SEATS, net, 1);
  const first = getWorld()!;
  store().restartMatch();
  expect(getWorld()).toBe(first);

  store().endMatch();
  expect(store().screen).toBe('gameover');
  const sent = net.sendState.mock.calls.length;
  store().restartMatch();

  expect(store().screen).toBe('playing');
  expect(getWorld()).not.toBe(first);
  expect(getWorld()!.players.map((p) => p.name)).toEqual(['Host', 'Ana']);
  expect(net.leave).not.toHaveBeenCalled();
  // o mundo novo vai inteiro, com salas, para os convidados voltarem junto
  expect(net.sendState.mock.calls.length).toBe(sent + 1);
  const fresh = net.sendState.mock.calls.at(-1)![0];
  expect(fresh.status).toBe('playing');
  expect(fresh.rooms).toBeDefined();
});

it('convidado nao recomeca, e volta a jogar quando chega o mundo novo', () => {
  const hostNet = link(true, 0);
  store().startMulti(SEATS, hostNet, 1);
  store().endMatch();
  const over = wire(hostNet.sendState.mock.calls.at(-1)![0]);
  store().restartMatch();
  const fresh = wire(hostNet.sendState.mock.calls.at(-1)![0]);

  store().backToMenu();
  const guest = link(false, 1);
  store().startMulti(SEATS, guest);
  store().receiveState(over);
  expect(store().screen).toBe('gameover');
  store().restartMatch();
  expect(store().screen).toBe('gameover');

  store().receiveState(fresh);
  expect(store().screen).toBe('playing');
  expect(guest.leave).not.toHaveBeenCalled();
});

it('atalho de desenvolvimento leva o grupo para a sala da loja; so o host', () => {
  store().startMulti(SEATS, link(true, 0), 1);
  store().devSkipToShop();
  store().tick(IDLE, FIXED_DT);
  const world = getWorld()!;
  expect(world.run.roomIndex).toBe(5);
  const room = world.rooms.find((r) => r.index === 5)!;
  expect(room.chest).not.toBeNull();
  expect(room.reviveChest).not.toBeNull();
  expect(world.players.every((p) => Math.floor(p.pos.y / 19) === 5)).toBe(true);

  store().backToMenu();
  store().startMulti(SEATS, link(false, 1));
  store().devSkipToShop();
  expect(getWorld()).toBeNull();
});
