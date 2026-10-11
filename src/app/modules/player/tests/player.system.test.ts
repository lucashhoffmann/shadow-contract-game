import { movePlayer } from '@/app/modules/player/systems/player.system';
import {
  FIXED_DT,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from '@/app/modules/world/constants/world.constants';
import type { World } from '@/app/modules/world/types/world.types';
import { createArenaWorld } from '@/test/world.fixture';

function walk(world: World, moveX: number, moveY: number, seconds: number) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    movePlayer(world, { moveX, moveY }, FIXED_DT);
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

  it('nao anda mais rapido na diagonal', () => {
    const world = createArenaWorld();
    walk(world, 1, 1, 0.5);
    const moved = Math.hypot(
      world.player.pos.x - 5.5,
      world.player.pos.y - 2.5,
    );
    expect(moved).toBeCloseTo(PLAYER_SPEED * 0.5, 1);
  });
});
