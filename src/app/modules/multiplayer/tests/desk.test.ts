import { spawnRoom } from '@/app/modules/level/systems/level.system';
import {
  createMultiWorld,
  reviveAllowance,
  stepMultiWorld,
} from '@/app/modules/multiplayer/systems/multiplayer.system';
import { MULTI_SHOP_TEMPLATE } from '@/app/modules/multiplayer/templates/room.template';
import {
  FIXED_DT,
  PLAYER_MAX_HP,
  REVIVE_HP,
} from '@/app/modules/world/constants/world.constants';
import type { InputState } from '@/app/modules/world/types/world.types';

// Loja, bau de revive e troca de arma em rede: acoes que viajam no input.

const SEATS = [
  { name: 'Host', color: '#ff8a3c' },
  { name: 'Ana', color: '#39d0ff' },
  { name: 'Bia', color: '#3fe08a' },
];
const IDLE: InputState = { moveX: 0, moveY: 0, dash: false };
const RIGHT: InputState = { moveX: 1, moveY: 0, dash: false };
const OPEN: InputState = { ...IDLE, open: true };
const LEAVE: InputState = { ...IDLE, leaveShop: true };

// partida de 3 na sala da loja (17x19): bau da loja e bau de revive
function shopRoom() {
  const world = createMultiWorld(1, SEATS);
  world.rooms = [];
  world.enemies = [];
  spawnRoom(world, 0, MULTI_SHOP_TEMPLATE);
  const room = world.rooms[0];
  const [host, ana, bia] = world.players;
  // host colado no bau da loja; os outros longe
  host.pos = { x: room.chest!.x, y: room.chest!.y - 1 };
  ana.pos = { x: 13.5, y: 3.5 };
  bia.pos = { x: 14.5, y: 3.5 };
  return { world, room, host, ana, bia };
}

function atReviveChest() {
  const set = shopRoom();
  const { room, host } = set;
  host.pos = { x: room.reviveChest!.x, y: room.reviveChest!.y - 1 };
  return set;
}

describe('loja em rede', () => {
  it('abre so para quem apertou B; os outros seguem jogando', () => {
    const { world, host, ana } = shopRoom();
    stepMultiWorld(world, [OPEN, RIGHT, IDLE], FIXED_DT);
    expect(world.status).toBe('playing');
    expect(host.shopping).toBe(true);
    expect(ana.shopping).toBe(false);
    expect(world.rooms[0].shopVisited).toBe(true);

    // com a loja aberta ele nao anda; a colega sim
    const at = { ...host.pos };
    const from = ana.pos.x;
    for (let i = 0; i < 20; i++) {
      stepMultiWorld(world, [RIGHT, RIGHT, IDLE], FIXED_DT);
    }
    expect(host.pos).toEqual(at);
    expect(ana.pos.x).toBeGreaterThan(from);

    stepMultiWorld(world, [LEAVE, IDLE, IDLE], FIXED_DT);
    expect(host.shopping).toBe(false);
  });

  it('compra sai da carteira de quem comprou e a arma e so dele', () => {
    const { world, host, ana } = shopRoom();
    host.money = 1000;
    ana.money = 1000;
    stepMultiWorld(world, [OPEN, IDLE, IDLE], FIXED_DT);
    const price = world.market.prices.pistol;
    stepMultiWorld(world, [{ ...IDLE, buy: 'pistol' }, IDLE, IDLE], FIXED_DT);

    expect(host.weapon?.id).toBe('pistol');
    expect(host.money).toBe(1000 - price);
    expect(ana.weapon).toBeNull();
    expect(ana.money).toBe(1000);
    // quem nao esta na loja nao compra
    stepMultiWorld(world, [IDLE, { ...IDLE, buy: 'pistol' }, IDLE], FIXED_DT);
    expect(ana.weapon).toBeNull();
  });

  it('troca de arma vale so para quem pediu', () => {
    const { world, host, ana } = shopRoom();
    host.arsenal = [{ id: 'pistol', ammo: 5 }];
    stepMultiWorld(world, [{ ...IDLE, select: 'next' }, IDLE, IDLE], FIXED_DT);
    expect(host.weapon?.id).toBe('pistol');
    stepMultiWorld(world, [{ ...IDLE, select: 'sword' }, IDLE, IDLE], FIXED_DT);
    expect(host.weapon).toBeNull();
    expect(ana.weapon).toBeNull();
  });
});

describe('bau de revive', () => {
  it('levanta todos os mortos quando as fichas do grupo dao', () => {
    const { world, room, host, ana, bia } = atReviveChest();
    ana.hp = 0;
    bia.hp = 0;
    world.run.revives = 2;

    stepMultiWorld(world, [OPEN, IDLE, IDLE], FIXED_DT);
    expect(ana.hp).toBe(PLAYER_MAX_HP * REVIVE_HP);
    expect(bia.hp).toBe(PLAYER_MAX_HP * REVIVE_HP);
    expect(world.run.revives).toBe(0);
    expect(host.reviving).toBe(false);
    // voltam ao lado do bau, cada um num lugar
    expect(ana.pos.y).toBeCloseTo(room.reviveChest!.y - 1.2);
    expect(ana.pos.x).not.toBe(bia.pos.x);
  });

  it('sem ficha, cada bau levanta um de graca, uma vez', () => {
    const { world, room, ana } = atReviveChest();
    ana.hp = 0;
    expect(reviveAllowance(world, room)).toBe(1);
    stepMultiWorld(world, [OPEN, IDLE, IDLE], FIXED_DT);
    expect(ana.hp).toBeGreaterThan(0);
    expect(room.reviveFree).toBe(false);

    ana.hp = 0;
    stepMultiWorld(world, [OPEN, IDLE, IDLE], FIXED_DT);
    expect(ana.hp).toBe(0);
    expect(reviveAllowance(world, room)).toBe(0);
  });

  it('mais mortos que revives: quem abriu escolhe quem volta', () => {
    const { world, host, ana, bia } = atReviveChest();
    ana.hp = 0;
    bia.hp = 0;

    stepMultiWorld(world, [OPEN, IDLE, IDLE], FIXED_DT);
    expect(host.reviving).toBe(true);
    expect([ana.hp, bia.hp]).toEqual([0, 0]);

    stepMultiWorld(world, [{ ...IDLE, revive: bia.id }, IDLE, IDLE], FIXED_DT);
    expect(bia.hp).toBeGreaterThan(0);
    expect(ana.hp).toBe(0);
    // acabou o que o bau levanta: a escolha fecha sozinha
    expect(host.reviving).toBe(false);
  });

  it('sem ninguem morto nao faz nada', () => {
    const { world, host } = atReviveChest();
    world.run.revives = 2;
    stepMultiWorld(world, [OPEN, IDLE, IDLE], FIXED_DT);
    expect(world.run.revives).toBe(2);
    expect(host.reviving).toBe(false);
  });
});
