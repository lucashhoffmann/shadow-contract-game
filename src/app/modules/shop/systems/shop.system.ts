import { roomIndexAt, tileAt } from '@/app/modules/level/utils/grid.util';
import {
  DEMAND_MARKUP,
  INFLATION_PER_SHOP,
  ITEMS,
  MAX_INFLATION,
  PRICE_STEP,
  PRICE_VOLATILITY,
} from '@/app/modules/shop/constants/shop.constants';
import type {
  ItemDef,
  ItemId,
  Market,
  World,
} from '@/app/modules/world/types/world.types';
import { nextRandom } from '@/shared/utils/rng.util';

function roundPrice(value: number): number {
  return Math.round(value / PRICE_STEP) * PRICE_STEP;
}

// ordem fixa: o sorteio de precos consome o rng sempre na mesma sequencia
function priceAll(price: (item: ItemDef) => number): Record<ItemId, number> {
  return {
    pistol: price(ITEMS.pistol),
    shotgun: price(ITEMS.shotgun),
    armor: price(ITEMS.armor),
  };
}

export function createMarket(): Market {
  return { inflation: 1, prices: priceAll((item) => item.price) };
}

// Chamado ao abrir cada loja.
// Inflacao: indice sobe por loja ja visitada e para no teto, para o preco
// acompanhar o dinheiro acumulado sem disparar.
// Instabilidade: cada item oscila em torno do indice, por sorteio com seed.
export function rollMarket(world: World): void {
  const inflation = Math.min(
    MAX_INFLATION,
    1 + INFLATION_PER_SHOP * world.run.shops,
  );
  world.market = {
    inflation,
    prices: priceAll((item) => {
      const swing = (nextRandom(world) * 2 - 1) * PRICE_VOLATILITY;
      return roundPrice(item.price * inflation * (1 + swing));
    }),
  };
}

export function canBuy(world: World, id: ItemId): boolean {
  return world.run.money >= world.market.prices[id];
}

export function buyItem(world: World, id: ItemId): boolean {
  if (!canBuy(world, id)) return false;
  const price = world.market.prices[id];
  world.run.money -= price;
  if (id === 'armor') {
    world.player.maxHp += ITEMS.armor.bonusHp;
    world.player.hp = world.player.maxHp;
  } else {
    world.player.weapon = { id, ammo: ITEMS[id].ammo };
  }
  // objeto novo a cada mudanca: o store compara por referencia
  world.market = {
    ...world.market,
    prices: {
      ...world.market.prices,
      [id]: roundPrice(price * DEMAND_MARKUP),
    },
  };
  return true;
}

// pisar na zona 'S' abre a loja uma vez por sala, com precos novos
export function updateShopTrigger(world: World): void {
  const { x, y } = world.player.pos;
  if (tileAt(world, Math.floor(x), Math.floor(y)) !== 'S') return;
  const room = world.rooms.find((r) => r.index === roomIndexAt(y));
  if (!room || room.shopVisited) return;
  room.shopVisited = true;
  rollMarket(world);
  world.run.shops++;
  world.status = 'shop';
}

export function closeShop(world: World): void {
  if (world.status === 'shop') world.status = 'playing';
}
