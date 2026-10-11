import { breakPropAt } from '@/app/modules/level/utils/grid.util';
import { movePlayer } from '@/app/modules/player/systems/player.system';
import {
  ADRENALINE_BOOST,
  ADRENALINE_TIME,
  DASH_COOLDOWN,
  DASH_SPEED,
  DASH_TIME,
  FIXED_DT,
  NOISE_DASH,
  NOISE_WALK,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from '@/app/modules/world/constants/world.constants';
import type { World } from '@/app/modules/world/types/world.types';
import { createArenaWorld } from '@/test/world.fixture';

function walk(world: World, moveX: number, moveY: number, seconds: number) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    movePlayer(world, { moveX, moveY, dash: false }, FIXED_DT);
  }
}

describe('movePlayer', () => {
  it('anda para frente na velocidade do player e vira para la', () => {
    const world = createArenaWorld();
    walk(world, 0, 1, 1);
    expect(world.player.pos.y).toBeCloseTo(2.5 + PLAYER_SPEED, 1);
    expect(world.player.pos.x).toBe(5.5);
    expect(world.player.facing).toBeCloseTo(Math.PI / 2);
  });

  it('fica parado sem input', () => {
    const world = createArenaWorld();
    walk(world, 0, 0, 1);
    expect(world.player.pos).toEqual({ x: 5.5, y: 2.5 });
  });

  it('nao atravessa parede', () => {
    const world = createArenaWorld();
    walk(world, -1, 0, 5);
    const wallEdge = 1 + PLAYER_RADIUS;
    expect(world.player.pos.x).toBeGreaterThanOrEqual(wallEdge - 1e-9);
    expect(world.player.pos.x).toBeLessThan(wallEdge + PLAYER_SPEED * FIXED_DT);
  });

  it('desliza na parede quando anda na diagonal contra ela', () => {
    const world = createArenaWorld();
    world.player.pos.x = 1.4;
    walk(world, -1, 1, 1);
    expect(world.player.pos.x).toBeLessThan(1.5);
    expect(world.player.pos.y).toBeGreaterThan(5);
  });

  it('para na caixa e passa depois que ela quebra', () => {
    const world = createArenaWorld({ 7: '#....o....#' });
    walk(world, 0, 1, 2);
    expect(world.player.pos.y).toBeLessThan(5);

    breakPropAt(world, 5.5, 5.5);
    walk(world, 0, 1, 1);
    expect(world.player.pos.y).toBeGreaterThan(6);
  });

  it('adrenalina acelera e acaba', () => {
    const world = createArenaWorld();
    world.player.adrenaline = ADRENALINE_TIME;
    walk(world, 0, 1, 1);
    expect(world.player.pos.y).toBeCloseTo(
      2.5 + PLAYER_SPEED * ADRENALINE_BOOST,
      1,
    );

    walk(world, 0, 0, ADRENALINE_TIME);
    expect(world.player.adrenaline).toBe(0);
  });

  it('nao anda mais rapido na diagonal', () => {
    const world = createArenaWorld();
    walk(world, 1, 1, 0.5);
    const moved = Math.hypot(
      world.player.pos.x - 5.5,
      world.player.pos.y - 2.5,
    );
    expect(moved).toBeCloseTo(PLAYER_SPEED * 0.5, 1);
  });

  it('salto avanca reto a distancia fixa, mesmo com input para o lado', () => {
    const world = createArenaWorld();
    movePlayer(world, { moveX: 0, moveY: 1, dash: true }, FIXED_DT);
    for (let i = 0; i < 60; i++) {
      if (world.player.dash === 0) break;
      movePlayer(world, { moveX: 1, moveY: 0, dash: false }, FIXED_DT);
    }
    expect(world.player.pos.x).toBe(5.5);
    expect(world.player.pos.y).toBeCloseTo(2.5 + DASH_SPEED * DASH_TIME, 5);
  });

  it('salto para na parede e so repete depois da recarga', () => {
    const world = createArenaWorld();
    world.player.facing = Math.PI;
    const hold = { moveX: 0, moveY: 0, dash: true };
    const steps = Math.round(DASH_COOLDOWN / FIXED_DT) - 2;
    for (let i = 0; i < steps; i++) movePlayer(world, hold, FIXED_DT);
    expect(world.player.pos.x).toBeCloseTo(5.5 - DASH_SPEED * DASH_TIME, 5);

    for (let i = 0; i < 120; i++) movePlayer(world, hold, FIXED_DT);
    expect(world.player.pos.x).toBeGreaterThanOrEqual(1 + PLAYER_RADIUS - 1e-9);
    expect(world.player.pos.x).toBeLessThan(1.5);
  });
});

it('faz barulho ao andar e mais ao saltar; parado fica em silencio', () => {
  const world = createArenaWorld();
  walk(world, 1, 0, FIXED_DT);
  expect(world.player.noise).toBe(NOISE_WALK);
  walk(world, 0.5, 0, FIXED_DT);
  expect(world.player.noise).toBe(NOISE_WALK / 2);
  movePlayer(world, { moveX: 0, moveY: 0, dash: true }, FIXED_DT);
  expect(world.player.noise).toBe(NOISE_DASH);
  world.player.dash = 0;
  walk(world, 0, 0, FIXED_DT);
  expect(world.player.noise).toBe(0);
});
