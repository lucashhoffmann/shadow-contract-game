import type { Snapshot } from '@/app/modules/multiplayer/utils/snapshot.util';
import {
  FIXED_DT,
  ROOM_W,
} from '@/app/modules/world/constants/world.constants';
import type { InputState } from '@/app/modules/world/types/world.types';
import {
  getWorld,
  type MultiLink,
  useGameStore,
} from '@/app/store/game-store/game.store';

const store = () => useGameStore.getState();
const SEATS = [
  { name: 'Host', color: '#ff8a3c' },
  { name: 'Ana', color: '#39d0ff' },
];
const IDLE: InputState = { moveX: 0, moveY: 0, dash: false };
const RIGHT: InputState = { moveX: 1, moveY: 0, dash: false };

function link(host: boolean, you: number) {
  return {
    host,
    you,
    sendState: vi.fn<(snapshot: Snapshot) => void>(),
    sendInput: vi.fn<(input: InputState) => void>(),
    leave: vi.fn<() => void>(),
  } satisfies MultiLink;
}

beforeEach(() => {
  store().backToMenu();
  useGameStore.setState({ best: 0 });
});

describe('game store no multiplayer', () => {
  it('lobby so abre fora de uma run', () => {
    store().openLobby();
    expect(store().screen).toBe('lobby');
    store().startRun(1);
    store().openLobby();
    expect(store().screen).toBe('intro');
  });

  it('host comeca jogando, sem legenda, e manda o estado 30 vezes por segundo', () => {
    const net = link(true, 0);
    store().startMulti(SEATS, net, 1);
    expect(store().screen).toBe('playing');
    expect(getWorld()?.players).toHaveLength(2);
    expect(net.sendState).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 60; i++) store().tick(IDLE, FIXED_DT);
    expect(net.sendState).toHaveBeenCalledTimes(31);
    // salas so no primeiro envio
    expect(net.sendState.mock.calls[0][0].rooms).toBeDefined();
    expect(net.sendState.mock.calls[5][0].rooms).toBeUndefined();
  });

  it('host anda o convidado pelo input recebido e nao aceita input do proprio lugar', () => {
    store().startMulti(SEATS, link(true, 0), 1);
    const [host, guest] = getWorld()!.players;
    const from = { host: host.pos.x, guest: guest.pos.x };

    store().receiveInput(1, { moveX: -1, moveY: 0, dash: false });
    store().receiveInput(0, { moveX: 1, moveY: 0, dash: false });
    store().receiveInput(1, 'lixo');
    for (let i = 0; i < 30; i++) store().tick(IDLE, FIXED_DT);

    expect(guest.pos.x).toBeLessThan(from.guest - 1);
    expect(host.pos.x).toBe(from.host);
  });

  it('multiplayer nao pausa e a sala nao conta para o recorde do solo', () => {
    store().startMulti(SEATS, link(true, 0), 1);
    store().togglePause();
    expect(store().screen).toBe('playing');
    getWorld()!.run.roomIndex = 9;
    store().tick(IDLE, FIXED_DT);
    expect(store().hud.room).toBe(9);
    expect(store().best).toBe(0);
  });

  it('convidado nao simula: manda o input so quando muda', () => {
    const net = link(false, 1);
    store().startMulti(SEATS, net);
    expect(store().screen).toBe('playing');
    expect(getWorld()).toBeNull();
    expect(ROOM_W).toBe(17);

    store().tick(RIGHT, FIXED_DT);
    store().tick(RIGHT, FIXED_DT);
    store().tick(IDLE, FIXED_DT);
    expect(net.sendInput).toHaveBeenCalledTimes(2);
    expect(net.sendInput.mock.calls[0][0]).toMatchObject({ moveX: 1 });
    expect(net.sendState).not.toHaveBeenCalled();
  });

  it('convidado desenha o estado do host, com o HUD do proprio jogador', () => {
    const hostNet = link(true, 0);
    store().startMulti(SEATS, hostNet, 1);
    getWorld()!.players[1].money = 70;
    for (let i = 0; i < 3; i++) store().tick(IDLE, FIXED_DT);
    const sent = JSON.parse(
      JSON.stringify(hostNet.sendState.mock.calls.at(-1)![0]),
    ) as Snapshot;
    // primeiro envio levou as salas
    const first = JSON.parse(
      JSON.stringify(hostNet.sendState.mock.calls[0][0]),
    ) as Snapshot;

    store().backToMenu();
    store().startMulti(SEATS, link(false, 1));
    store().receiveState(first);
    store().receiveState(sent);

    expect(getWorld()?.player.name).toBe('Ana');
    expect(getWorld()?.rooms.length).toBeGreaterThan(0);
    expect(store().hud.money).toBe(70);
  });

  it('voltar ao menu ou comecar um solo sai da sessao', () => {
    const net = link(true, 0);
    store().startMulti(SEATS, net, 1);
    store().backToMenu();
    expect(net.leave).toHaveBeenCalledTimes(1);

    const again = link(false, 1);
    store().startMulti(SEATS, again);
    store().startRun(1);
    expect(again.leave).toHaveBeenCalledTimes(1);
    expect(getWorld()?.mode).toBe('solo');
    expect(ROOM_W).toBe(11);
  });
});

describe('menu e placar da partida em rede', () => {
  it('P abre e fecha o menu sem parar o jogo', () => {
    store().startMulti(SEATS, link(true, 0), 1);
    store().togglePause();
    expect(store()).toMatchObject({ menu: true, screen: 'playing' });
    const before = getWorld()!.run.seconds;
    store().tick(IDLE, FIXED_DT);
    expect(getWorld()!.run.seconds).toBeGreaterThan(before);
    store().togglePause();
    expect(store().menu).toBe(false);
  });

  it('host encerra a partida para todos; convidado nao consegue', () => {
    const guest = link(false, 1);
    store().startMulti(SEATS, guest);
    store().endMatch();
    expect(store().screen).toBe('playing');

    store().backToMenu();
    const net = link(true, 0);
    store().startMulti(SEATS, net, 1);
    store().togglePause();
    const sent = net.sendState.mock.calls.length;
    store().endMatch();
    expect(store()).toMatchObject({ screen: 'gameover', menu: false });
    // o fim vai na hora para os convidados
    expect(net.sendState.mock.calls.length).toBe(sent + 1);
    expect(net.sendState.mock.calls.at(-1)![0].status).toBe('dead');
  });

  it('placar acompanha kills, mortes e quem e voce', () => {
    store().startMulti(SEATS, link(true, 0), 1);
    expect(store().scores.map((s) => [s.name, s.you])).toEqual([
      ['Host', true],
      ['Ana', false],
    ]);
    const [, guest] = getWorld()!.players;
    guest.kills = 3;
    guest.deaths = 1;
    guest.hp = 0;
    store().tick(IDLE, FIXED_DT);
    expect(store().scores[1]).toMatchObject({
      kills: 3,
      deaths: 1,
      alive: false,
    });

    store().setScoreboard(true);
    expect(store().scoreboard).toBe(true);
    store().backToMenu();
    expect(store()).toMatchObject({ scoreboard: false, online: false });
  });
});

describe('ping e previsao do convidado', () => {
  it('placar leva o ping de cada lugar', () => {
    store().startMulti(SEATS, link(true, 0), 1);
    store().setPings([18, 64]);
    expect(store().scores.map((score) => score.ping)).toEqual([18, 64]);
    // solo: sem ping
    store().startRun(1);
    store().begin();
    store().tick(IDLE, FIXED_DT);
    expect(store().scores.every((score) => score.ping === 0)).toBe(true);
  });

  it('convidado anda o proprio boneco na hora, sem esperar o host', () => {
    const hostNet = link(true, 0);
    store().startMulti(SEATS, hostNet, 1);
    // cada estado chega como um objeto novo: a previsao mexe no que recebeu
    const text = JSON.stringify(hostNet.sendState.mock.calls[0][0]);
    const first = () => JSON.parse(text) as Snapshot;

    store().backToMenu();
    store().startMulti(SEATS, link(false, 1));
    store().receiveState(first());
    const from = getWorld()!.player.pos.x;
    for (let i = 0; i < 12; i++) store().tick(RIGHT, FIXED_DT);
    expect(getWorld()!.player.pos.x).toBeGreaterThan(from + 0.5);

    // estado do host, que ainda nao viu esse input: sem ping medido, vale a
    // posicao dele; com ping, o convidado reaplica o que falta
    store().receiveState(first());
    expect(getWorld()!.player.pos.x).toBeCloseTo(from);
    for (let i = 0; i < 12; i++) store().tick(RIGHT, FIXED_DT);
    store().setPings([50, 50]);
    store().receiveState(first());
    expect(getWorld()!.player.pos.x).toBeGreaterThan(from + 0.3);
  });
});
