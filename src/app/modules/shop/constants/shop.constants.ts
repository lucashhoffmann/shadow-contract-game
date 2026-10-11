import type { ItemDef, ItemId } from '@/app/modules/world/types/world.types';

export const ITEMS: Record<ItemId, ItemDef> = {
  pistol: {
    id: 'pistol',
    name: 'Pistola',
    kind: 'weapon',
    price: 200,
    range: 5,
    ammo: 6,
    area: false,
    bonusHp: 0,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Escopeta',
    kind: 'weapon',
    price: 500,
    range: 3.5,
    ammo: 4,
    area: true,
    bonusHp: 0,
  },
  armor: {
    id: 'armor',
    name: 'Colete',
    kind: 'armor',
    price: 300,
    range: 0,
    ammo: 0,
    area: false,
    bonusHp: 50,
  },
};

export const SHOP_ITEMS: ItemDef[] = Object.values(ITEMS);
