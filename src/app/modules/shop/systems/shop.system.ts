import { roomIndexAt, tileAt } from '@/app/modules/level/utils/grid.util';
import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import type { ItemId, World } from '@/app/modules/world/types/world.types';

export function canBuy(world: World, id: ItemId): boolean {
  return world.run.money >= ITEMS[id].price;
}

export function buyItem(world: World, id: ItemId): boolean {
  if (!canBuy(world, id)) return false;
  const item = ITEMS[id];
  world.run.money -= item.price;
  if (id === 'armor') {
    world.player.maxHp += item.bonusHp;
    world.player.hp = world.player.maxHp;
  } else {
    world.player.weapon = { id, ammo: item.ammo };
  }
  return true;
}

// pisar na zona 'S' abre a loja uma vez por sala
export function updateShopTrigger(world: World): void {
  const { x, y } = world.player.pos;
  if (tileAt(world, Math.floor(x), Math.floor(y)) !== 'S') return;
  const room = world.rooms.find((r) => r.index === roomIndexAt(y));
  if (!room || room.shopVisited) return;
  room.shopVisited = true;
  world.status = 'shop';
}

export function closeShop(world: World): void {
  if (world.status === 'shop') world.status = 'playing';
}
