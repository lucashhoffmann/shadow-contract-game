import {
  DEMAND_MARKUP,
  INFLATION_PER_SHOP,
  ITEMS,
  MAX_INFLATION,
  PRICE_STEP,
  PRICE_VOLATILITY,
} from '@/app/modules/shop/constants/shop.constants';
import { CHEST_RANGE } from '@/app/modules/world/constants/world.constants';
import type {
  ItemDef,
  ItemId,
  Market,
  Room,
  World,
} from '@/app/modules/world/types/world.types';
import { distance } from '@/shared/utils/math.util';
import { nextRandom } from '@/shared/utils/rng.util';

function roundPrice(value: number): number {
  return Math.round(value / PRICE_STEP) * PRICE_STEP;
}

// ordem fixa: o sorteio de precos consome o rng sempre na mesma sequencia
function priceAll(price: (item: ItemDef) => number): Record<ItemId, number> {
  return {
    pistol: price(ITEMS.pistol),
    silenced: price(ITEMS.silenced),
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
    const previousHp = world.player.hp;
    world.player.maxHp += ITEMS.armor.bonusHp;
    world.player.hp = world.player.maxHp;
    world.run.stats.healthRecovered += world.player.hp - previousHp;
  } else {
    world.player.weapon = { id, ammo: ITEMS[id].ammo };
  }
  world.run.events.push({
    at: world.run.seconds,
    text: `Comprou ${ITEMS[id].name} por $${price}.`,
  });
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

// sala cujo bau esta ao alcance do player
export function nearbyChest(world: World): Room | undefined {
  return world.rooms.find(
    (room) =>
      room.chest && distance(world.player.pos, room.chest) <= CHEST_RANGE,
  );
}

// tecla B perto do bau abre a loja, quantas vezes quiser. Precos novos so na
// primeira abertura da sala; reabrir mostra os mesmos
export function openChest(world: World): void {
  const room = nearbyChest(world);
  if (!room) return;
  if (!room.shopVisited) {
    room.shopVisited = true;
    rollMarket(world);
    world.run.shops++;
    world.run.events.push({
      at: world.run.seconds,
      text: `Loja ${world.run.shops} visitada.`,
    });
  }
  world.status = 'shop';
}

export function closeShop(world: World): void {
  if (world.status === 'shop') world.status = 'playing';
}
