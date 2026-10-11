import {
  FIXED_DT,
  KILL_MONEY,
} from '@/app/modules/world/constants/world.constants';
import {
  beginRun,
  createWorld,
  stepWorld,
  togglePause,
} from '@/app/modules/world/systems/world.system';
import type { InputState, World } from '@/app/modules/world/types/world.types';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

const IDLE: InputState = { moveX: 0, moveY: 0, dash: false };
const FORWARD: InputState = { moveX: 0, moveY: 1, dash: false };

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
  it('F quebra so a caixa intacta mais proxima ao alcance e anima o golpe', () => {
    const world = createArenaWorld({ 9: '#....oo...#' });
    world.player.pos = { x: 5.9, y: 2.6 };

    stepWorld(world, { ...IDLE, interact: true }, FIXED_DT);

    expect(
      world.props
        .filter((prop) => prop.roomIndex === 0)
        .map((prop) => prop.broken),
    ).toEqual([true, false]);
    expect(world.rooms[0].tiles[9]).toBe('#.....o...#');
    expect(world.player.slash).toBeGreaterThan(0);
    expect(world.player.facing).toBeCloseTo(Math.atan2(3.5 - 2.6, 5.5 - 5.9));

    stepWorld(world, IDLE, FIXED_DT);
    expect(
      world.props
        .filter((prop) => prop.roomIndex === 0)
        .map((prop) => prop.broken),
    ).toEqual([true, false]);
  });

  it('F fora do alcance ou com jogo pausado nao quebra a caixa', () => {
    const world = createArenaWorld({ 8: '#....o....#' });
    stepWorld(world, { ...IDLE, interact: true }, FIXED_DT);
    expect(world.props[0].broken).toBe(false);

    world.player.pos.y = 3.5;
    world.status = 'paused';
    stepWorld(world, { ...IDLE, interact: true }, FIXED_DT);
    expect(world.props[0].broken).toBe(false);
  });

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

  it('pausa congela e despausa retoma', () => {
    const world = createArenaWorld();
    togglePause(world);
    expect(world.status).toBe('paused');
    run(world, FORWARD, 1);
    expect(world.player.pos.y).toBe(2.5);

    togglePause(world);
    run(world, FORWARD, 1);
    expect(world.player.pos.y).toBeGreaterThan(2.5);
  });

  it('legenda inicial segura a simulacao ate beginRun', () => {
    const world = createArenaWorld();
    world.status = 'intro';
    togglePause(world);
    expect(world.status).toBe('intro');

    beginRun(world);
    expect(world.status).toBe('playing');
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
