import { moveCircle } from '@/app/modules/level/utils/grid.util';
import {
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from '@/app/modules/world/constants/world.constants';
import type { InputState, World } from '@/app/modules/world/types/world.types';

const DEAD_ZONE = 0.01;

export function movePlayer(world: World, input: InputState, dt: number): void {
  const length = Math.hypot(input.moveX, input.moveY);
  if (length < DEAD_ZONE) return;
  // vetor maior que 1 (diagonal no teclado) e normalizado; menor (joystick
  // pela metade) anda mais devagar
  const scale = (PLAYER_SPEED * dt) / Math.max(1, length);
  moveCircle(
    world,
    world.player.pos,
    input.moveX * scale,
    input.moveY * scale,
    PLAYER_RADIUS,
  );
  world.player.facing = Math.atan2(input.moveY, input.moveX);
}
