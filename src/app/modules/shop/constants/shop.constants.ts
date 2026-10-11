import type { ItemDef, ItemId } from '@/app/modules/world/types/world.types';

// `price` e o preco base; o preco cobrado vem de world.market (shop.system)
export const ITEMS: Record<ItemId, ItemDef> = {
  pistol: {
    id: 'pistol',
    name: 'Pistola',
    kind: 'weapon',
    price: 200,
    range: 5.5,
    ammo: 8,
    pellets: 1,
    spread: 0,
    bonusHp: 0,
  },
  // mesmos numeros da pistola; o tiro nao chama inimigos (combat.system)
  silenced: {
    id: 'silenced',
    name: 'Pistola silenciada',
    kind: 'weapon',
    price: 260,
    range: 5.5,
    ammo: 8,
    pellets: 1,
    spread: 0,
    bonusHp: 0,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Escopeta',
    kind: 'weapon',
    price: 450,
    range: 4,
    ammo: 5,
    pellets: 5,
    spread: 0.5,
    bonusHp: 0,
  },
  armor: {
    id: 'armor',
    name: 'Colete',
    kind: 'armor',
    price: 250,
    range: 0,
    ammo: 0,
    pellets: 0,
    spread: 0,
    bonusHp: 50,
  },
};

export const SHOP_ITEMS: ItemDef[] = Object.values(ITEMS);

// instabilidade: cada loja sorteia o preco de cada item em +-VOLATILITY
export const PRICE_VOLATILITY = 0.25;
// inflacao: indice geral sobe por loja visitada, ate o teto
export const INFLATION_PER_SHOP = 0.12;
export const MAX_INFLATION = 1.75;
// demanda: recomprar o mesmo item na mesma loja encarece
export const DEMAND_MARKUP = 1.25;
export const PRICE_STEP = 5;
