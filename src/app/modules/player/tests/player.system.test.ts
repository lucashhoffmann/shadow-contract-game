import { breakPropAt } from '@/app/modules/level/utils/grid.util';
import {
  cycleWeapon,
  movePlayer,
  selectWeapon,
} from '@/app/modules/player/systems/player.system';
import {
  ADRENALINE_BOOST,
  ADRENALINE_TIME,
  CROUCH_NOISE,
  CROUCH_SPEED,
  DASH_COOLDOWN,
  DASH_MAX,
  DASH_SPEED,
  DASH_TIME,
  FIXED_DT,
  NOISE_DASH,
  NOISE_IDLE,
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

it('faz barulho ao andar e mais ao saltar; parado so se ouve de perto', () => {
  const world = createArenaWorld();
  walk(world, 1, 0, FIXED_DT);
  expect(world.player.noise).toBe(NOISE_WALK);
  walk(world, 0.5, 0, FIXED_DT);
  expect(world.player.noise).toBe(NOISE_IDLE);
  movePlayer(world, { moveX: 0, moveY: 0, dash: true }, FIXED_DT);
  expect(world.player.noise).toBe(NOISE_DASH);
  world.player.dash = 0;
  walk(world, 0, 0, FIXED_DT);
  expect(world.player.noise).toBe(NOISE_IDLE);
});

it('agachado anda mais devagar e faz menos barulho; o salto levanta', () => {
  const world = createArenaWorld();
  const crouch = { moveX: 1, moveY: 0, dash: false, crouch: true };
  const from = world.player.pos.x;
  for (let i = 0; i < 60; i++) movePlayer(world, crouch, FIXED_DT);
  expect(world.player.crouching).toBe(true);
  expect(world.player.pos.x - from).toBeCloseTo(PLAYER_SPEED * CROUCH_SPEED, 5);
  expect(world.player.noise).toBe(NOISE_WALK * CROUCH_NOISE);

  movePlayer(world, { ...crouch, moveX: 0 }, FIXED_DT);
  expect(world.player.noise).toBe(NOISE_IDLE * CROUCH_NOISE);

  movePlayer(world, { ...crouch, dash: true }, FIXED_DT);
  expect(world.player.crouching).toBe(false);
  expect(world.player.noise).toBe(NOISE_DASH);
});

it('cada salto gasta um dos saltos guardados; sem nenhum, nao salta', () => {
  const world = createArenaWorld();
  // ja saiu da sala inicial
  world.run.roomIndex = 1;
  const dash = { moveX: 0, moveY: 0, dash: true };
  expect(world.player.dashes).toBe(DASH_MAX);

  movePlayer(world, dash, FIXED_DT);
  expect(world.player.dashes).toBe(DASH_MAX - 1);
  expect(world.player.dash).toBeGreaterThan(0);

  // segurar a tecla nao gasta outro enquanto dura o cooldown
  movePlayer(world, dash, FIXED_DT);
  expect(world.player.dashes).toBe(DASH_MAX - 1);

  world.player.dashes = 0;
  world.player.dash = 0;
  world.player.dashCooldown = 0;
  const before = { ...world.player.pos };
  movePlayer(world, dash, FIXED_DT);
  expect(world.player.dash).toBe(0);
  expect(world.player.pos).toEqual(before);
});

it('na sala inicial o salto nao gasta, nem com os saltos zerados', () => {
  const world = createArenaWorld();
  const dash = { moveX: 0, moveY: 0, dash: true };
  expect(world.run.roomIndex).toBe(0);

  movePlayer(world, dash, FIXED_DT);
  expect(world.player.dash).toBeGreaterThan(0);
  expect(world.player.dashes).toBe(DASH_MAX);

  world.player.dashes = 0;
  world.player.dash = 0;
  world.player.dashCooldown = 0;
  movePlayer(world, dash, FIXED_DT);
  expect(world.player.dash).toBeGreaterThan(0);
  expect(world.player.dashes).toBe(0);
});

describe('escolha da arma', () => {
  function armed() {
    const world = createArenaWorld();
    world.player.arsenal = [
      { id: 'pistol', ammo: 0 },
      { id: 'shotgun', ammo: 4 },
    ];
    return world;
  }

  it('poe na mao a arma escolhida, mesmo sem bala; null volta para a espada', () => {
    const world = armed();
    selectWeapon(world, 'pistol');
    expect(world.player.weapon).toBe(world.player.arsenal[0]);

    selectWeapon(world, 'shotgun');
    expect(world.player.weapon).toBe(world.player.arsenal[1]);

    selectWeapon(world, null);
    expect(world.player.weapon).toBeNull();
  });

  it('ignora arma que o player nao tem', () => {
    const world = armed();
    selectWeapon(world, 'silenced');
    expect(world.player.weapon).toBeNull();
  });

  it('Q roda espada, cada arma do arsenal, e volta', () => {
    const world = armed();
    const seen = [];
    for (let i = 0; i < 4; i++) {
      cycleWeapon(world);
      seen.push(world.player.weapon?.id ?? 'sword');
    }
    expect(seen).toEqual(['pistol', 'shotgun', 'sword', 'pistol']);
  });
});
