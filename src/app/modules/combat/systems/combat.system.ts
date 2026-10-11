import { hasLineOfSight } from '@/app/modules/level/utils/grid.util';
import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  ATTACK_COOLDOWN,
  KILL_MONEY,
  MELEE_RANGE,
  PICKUP_RADIUS,
} from '@/app/modules/world/constants/world.constants';
import type { Enemy, World } from '@/app/modules/world/types/world.types';
import { distance } from '@/shared/utils/math.util';

export function killEnemy(world: World, enemy: Enemy): void {
  enemy.state = 'dead';
  enemy.detection = 0;
  world.run.kills++;
  world.pickups.push({
    id: world.nextId++,
    roomIndex: enemy.roomIndex,
    pos: { ...enemy.pos },
    value: KILL_MONEY,
  });
}

// ataque automatico: sem arma so mata quem nao esta em alerta; com arma mata
// qualquer um no alcance e gasta municao
export function updateCombat(world: World, dt: number): void {
  const player = world.player;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  if (player.attackCooldown > 0) return;

  const item = player.weapon ? ITEMS[player.weapon.id] : null;
  const range = item ? item.range : MELEE_RANGE;
  const targets = world.enemies
    .filter(
      (e) =>
        e.state !== 'dead' &&
        (item !== null || e.state !== 'alert') &&
        distance(player.pos, e.pos) <= range &&
        hasLineOfSight(world, player.pos, e.pos),
    )
    .sort((a, b) => distance(player.pos, a.pos) - distance(player.pos, b.pos));
  if (targets.length === 0) return;

  for (const target of item?.area ? targets : targets.slice(0, 1)) {
    killEnemy(world, target);
  }
  player.attackCooldown = ATTACK_COOLDOWN;
  if (player.weapon && --player.weapon.ammo <= 0) player.weapon = null;
}

export function collectPickups(world: World): void {
  world.pickups = world.pickups.filter((pickup) => {
    if (distance(world.player.pos, pickup.pos) > PICKUP_RADIUS) return true;
    world.run.money += pickup.value;
    return false;
  });
}
