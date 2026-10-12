import { moveCircle } from '@/app/modules/level/utils/grid.util';
import {
  ADRENALINE_BOOST,
  CROUCH_NOISE,
  CROUCH_SPEED,
  DASH_COOLDOWN,
  DASH_SPEED,
  DASH_TIME,
  NOISE_DASH,
  NOISE_IDLE,
  NOISE_WALK,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from '@/app/modules/world/constants/world.constants';
import type {
  InputState,
  WeaponId,
  World,
} from '@/app/modules/world/types/world.types';

const DEAD_ZONE = 0.01;

export function movePlayer(world: World, input: InputState, dt: number): void {
  const player = world.player;
  player.adrenaline = Math.max(0, player.adrenaline - dt);
  player.invisible = Math.max(0, player.invisible - dt);
  player.invincible = Math.max(0, player.invincible - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  // salto levanta: so vale agachar com os pes no chao
  player.crouching = false;
  player.noise = NOISE_IDLE;
  const length = Math.hypot(input.moveX, input.moveY);
  // na sala inicial o salto e livre: so comeca a gastar depois de sair dela
  const counting = world.run.roomIndex > 0;
  if (
    input.dash &&
    player.dashCooldown === 0 &&
    (player.dashes > 0 || !counting)
  ) {
    if (counting) player.dashes--;
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
  player.crouching = !!input.crouch;
  const quiet = player.crouching ? CROUCH_NOISE : 1;
  player.noise *= quiet;
  if (length < DEAD_ZONE) return;
  // vetor maior que 1 (diagonal no teclado) e normalizado; menor (joystick
  // pela metade) anda mais devagar
  // joystick pela metade faz menos barulho
  player.noise = Math.max(NOISE_IDLE, NOISE_WALK * Math.min(1, length)) * quiet;
  const speed =
    PLAYER_SPEED *
    (player.adrenaline > 0 ? ADRENALINE_BOOST : 1) *
    (player.crouching ? CROUCH_SPEED : 1);
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

// Poe na mao a arma `id` do arsenal; null = espada. Arma que o player nao
// tem e ignorada. Vale mesmo sem bala: ela so nao atira.
export function selectWeapon(world: World, id: WeaponId | null): void {
  const player = world.player;
  if (id === null) {
    player.weapon = null;
    return;
  }
  const owned = player.arsenal.find((weapon) => weapon.id === id);
  if (owned) player.weapon = owned;
}

// proxima da fila: espada, depois cada arma do arsenal, e volta
export function cycleWeapon(world: World): void {
  const player = world.player;
  const slots = [null, ...player.arsenal];
  player.weapon = slots[(slots.indexOf(player.weapon) + 1) % slots.length];
}
