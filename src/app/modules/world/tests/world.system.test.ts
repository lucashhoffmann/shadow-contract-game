import {
  FIXED_DT,
  KILL_MONEY,
} from '@/app/modules/world/constants/world.constants';
import {
  createWorld,
  stepWorld,
} from '@/app/modules/world/systems/world.system';
import type { InputState, World } from '@/app/modules/world/types/world.types';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

const IDLE: InputState = { moveX: 0, moveY: 0 };
const FORWARD: InputState = { moveX: 0, moveY: 1 };

function run(world: World, input: InputState, seconds: number) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) stepWorld(world, input, FIXED_DT);
}

describe('createWorld', () => {
  it('comeca jogando, na sala inicial, com a proxima sala pronta', () => {
    const world = createWorld(1);
    expect(world.status).toBe('playing');
    expect(world.rooms.map((r) => r.index)).toEqual([0, 1]);
    expect(world.rooms[0].kind).toBe('start');
    expect(world.enemies.every((e) => e.roomIndex === 1)).toBe(true);
  });
});

describe('stepWorld', () => {
  it('player chega por tras, mata o inimigo e coleta o dinheiro', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 8.5, Math.PI / 2);

    run(world, FORWARD, 3);

    expect(enemy.state).toBe('dead');
    expect(world.run.kills).toBe(1);
    expect(world.run.money).toBe(KILL_MONEY);
    expect(world.status).toBe('playing');
  });

  it('player parado dentro do cone morre', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 5.5 };
    addEnemy(world, 5.5, 8.5, -Math.PI / 2);

    run(world, IDLE, 10);

    expect(world.status).toBe('dead');
    expect(world.player.hp).toBeLessThanOrEqual(0);
  });

  it('congela fora de playing', () => {
    const world = createArenaWorld();
    world.status = 'shop';
    run(world, FORWARD, 1);
    expect(world.player.pos).toEqual({ x: 5.5, y: 2.5 });
  });

  it('e deterministico para o mesmo seed e os mesmos inputs', () => {
    const a = createWorld(42);
    const b = createWorld(42);
    run(a, FORWARD, 5);
    run(b, FORWARD, 5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.run.roomIndex).toBeGreaterThan(0);
  });
});
