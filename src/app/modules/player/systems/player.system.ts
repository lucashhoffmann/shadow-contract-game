import { moveCircle } from '@/app/modules/level/utils/grid.util';
import {
  ADRENALINE_BOOST,
  DASH_COOLDOWN,
  DASH_SPEED,
  DASH_TIME,
  NOISE_DASH,
  NOISE_WALK,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from '@/app/modules/world/constants/world.constants';
import type { InputState, World } from '@/app/modules/world/types/world.types';

const DEAD_ZONE = 0.01;

export function movePlayer(world: World, input: InputState, dt: number): void {
  const player = world.player;
  player.adrenaline = Math.max(0, player.adrenaline - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.noise = 0;
  const length = Math.hypot(input.moveX, input.moveY);
  if (input.dash && player.dashCooldown === 0) {
    player.dash = DASH_TIME;
    player.dashCooldown = DASH_COOLDOWN;
    // salta para onde o input aponta; sem input, para onde ja olha
    if (length >= DEAD_ZONE) {
      player.facing = Math.atan2(input.moveY, input.moveX);
    }
  }
  if (player.dash > 0) {
    // ultimo passo pode ser menor que dt: a distancia do salto e fixa
    const step = DASH_SPEED * Math.min(dt, player.dash);
    player.dash = Math.max(0, player.dash - dt);
    player.noise = NOISE_DASH;
    moveCircle(
      world,
      player.pos,
      Math.cos(player.facing) * step,
      Math.sin(player.facing) * step,
      PLAYER_RADIUS,
    );
    return;
  }
  if (length < DEAD_ZONE) return;
  // vetor maior que 1 (diagonal no teclado) e normalizado; menor (joystick
  // pela metade) anda mais devagar
  // joystick pela metade faz menos barulho
  player.noise = NOISE_WALK * Math.min(1, length);
  const speed = PLAYER_SPEED * (player.adrenaline > 0 ? ADRENALINE_BOOST : 1);
  const scale = (speed * dt) / Math.max(1, length);
  moveCircle(
    world,
    world.player.pos,
    input.moveX * scale,
    input.moveY * scale,
    PLAYER_RADIUS,
  );
  world.player.facing = Math.atan2(input.moveY, input.moveX);
}
