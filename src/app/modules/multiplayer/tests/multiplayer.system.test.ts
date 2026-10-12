import {
  spawnProjectile,
  updateProjectiles,
} from '@/app/modules/combat/systems/combat.system';
import { updateEnemies } from '@/app/modules/enemy/systems/enemy.system';
import {
  createMultiWorld,
  stepMultiWorld,
} from '@/app/modules/multiplayer/systems/multiplayer.system';
import {
  ADRENALINE_TIME,
  ENEMY_BULLET_DAMAGE,
  ENEMY_BULLET_SPEED,
  FIXED_DT,
  PLAYER_BULLET_SPEED,
  PLAYER_MAX_HP,
  ROOM_H,
} from '@/app/modules/world/constants/world.constants';
import { createPlayer } from '@/app/modules/world/systems/world.system';
import type { InputState, World } from '@/app/modules/world/types/world.types';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

const SEATS = [
  { name: 'Host', color: '#ff8a3c' },
  { name: 'Ana', color: '#39d0ff' },
  { name: 'Bia', color: '#3fe08a' },
];
const IDLE: InputState = { moveX: 0, moveY: 0, dash: false };
const RIGHT: InputState = { moveX: 1, moveY: 0, dash: false };

// arena de teste com dois jogadores: o host em (5.5, 2.5) e `second`
function arena(second: { x: number; y: number }): World {
  const world = createArenaWorld();
  world.mode = 'multi';
  const guest = createPlayer(1, 'Ana', '#39d0ff');
  guest.pos = { ...second };
  world.players.push(guest);
  return world;
}

function run(world: World, inputs: InputState[], seconds: number) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) stepMultiWorld(world, inputs, FIXED_DT);
}

describe('createMultiWorld', () => {
  it('senta cada jogador com nome, cor e lugar proprios; o host e o foco', () => {
    const world = createMultiWorld(1, SEATS);
    expect(world.mode).toBe('multi');
    expect(world.players.map((p) => p.name)).toEqual(['Host', 'Ana', 'Bia']);
    expect(world.players.map((p) => p.id)).toEqual([0, 1, 2]);
    expect(new Set(world.players.map((p) => p.pos.x)).size).toBe(3);
    expect(world.player).toBe(world.players[0]);
  });
});

describe('stepMultiWorld', () => {
  it('cada jogador anda pelo proprio input e o foco volta ao local', () => {
    const world = arena({ x: 3.5, y: 6.5 });
    run(world, [IDLE, RIGHT], 0.5);
    expect(world.players[0].pos).toEqual({ x: 5.5, y: 2.5 });
    expect(world.players[1].pos.x).toBeGreaterThan(4.5);
    expect(world.player).toBe(world.players[0]);
  });

  it('inimigo vai atras do jogador vivo mais perto dele', () => {
    const world = arena({ x: 5.5, y: 10.5 });
    // de frente para o convidado, de costas para o host
    const enemy = addEnemy(world, 5.5, 8, Math.PI / 2);
    for (let i = 0; i < 120; i++) updateEnemies(world, FIXED_DT);
    expect(enemy.state).toBe('alert');
    expect(world.player).toBe(world.players[0]);
    expect(world.projectiles.every((p) => p.vel.y > 0)).toBe(true);
  });

  it('bala inimiga fere so quem ela acerta', () => {
    const world = arena({ x: 8.5, y: 2.5 });
    spawnProjectile(
      world,
      'enemy',
      { x: 8.5, y: 6.5 },
      -Math.PI / 2,
      ENEMY_BULLET_SPEED,
      ENEMY_BULLET_DAMAGE,
      8,
    );
    for (let i = 0; i < 90; i++) updateProjectiles(world, FIXED_DT);
    expect(world.players[0].hp).toBe(PLAYER_MAX_HP);
    expect(world.players[1].hp).toBe(PLAYER_MAX_HP - ENEMY_BULLET_DAMAGE);
  });

  it('morte por bala conta para quem atirou', () => {
    const world = arena({ x: 8.5, y: 2.5 });
    const enemy = addEnemy(world, 8.5, 4.5, Math.PI / 2);
    enemy.hp = 1;
    spawnProjectile(
      world,
      'player',
      world.players[1].pos,
      Math.PI / 2,
      PLAYER_BULLET_SPEED,
      50,
      8,
    ).by = 1;
    for (let i = 0; i < 60; i++) updateProjectiles(world, FIXED_DT);
    expect(enemy.state).toBe('dead');
    expect(world.players[1].adrenaline).toBe(ADRENALINE_TIME);
    expect(world.players[0].adrenaline).toBe(0);
  });

  it('carteira e de cada um: quem pega a moeda fica com ela', () => {
    const world = arena({ x: 8.5, y: 6.5 });
    world.pickups.push({
      id: 99,
      kind: 'money',
      roomIndex: 0,
      pos: { x: 8.5, y: 6.5 },
      value: 40,
    });
    stepMultiWorld(world, [IDLE, IDLE], FIXED_DT);
    expect(world.players[1].money).toBe(40);
    expect(world.players[0].money).toBe(0);
  });

  it('morto nao age nem e alvo; a partida so acaba quando todos morrem', () => {
    const world = arena({ x: 3.5, y: 6.5 });
    world.players[1].hp = 0;
    run(world, [IDLE, RIGHT], 0.3);
    expect(world.status).toBe('playing');
    expect(world.players[1].pos).toEqual({ x: 3.5, y: 6.5 });

    world.players[0].hp = 0;
    stepMultiWorld(world, [IDLE, IDLE], FIXED_DT);
    expect(world.status).toBe('dead');
  });

  it('quem fica para tras e puxado para a entrada da sala do lider', () => {
    const world = createMultiWorld(1, SEATS.slice(0, 2));
    const [leader, behind] = world.players;
    leader.pos = { x: 5.5, y: ROOM_H * 2 + 1.5 };
    stepMultiWorld(world, [IDLE, IDLE], FIXED_DT);
    expect(world.run.roomIndex).toBe(2);
    expect(behind.pos).toEqual(world.run.checkpoint);
    // uma sala atras ainda vale: nao e puxado
    behind.pos = { x: 5.5, y: ROOM_H + 1.5 };
    stepMultiWorld(world, [IDLE, IDLE], FIXED_DT);
    expect(behind.pos.y).toBeCloseTo(ROOM_H + 1.5, 0);
  });
});
