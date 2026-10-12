import {
  AMMO_REFILL_PRICE,
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
  Weapon,
  World,
} from '@/app/modules/world/types/world.types';
import { distance } from '@/shared/utils/math.util';
import { eventText } from '@/shared/i18n';
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

// preco de recarregar uma arma que custa `price` na loja
export function refillPrice(price: number): number {
  return Math.max(PRICE_STEP, roundPrice(price * AMMO_REFILL_PRICE));
}

function ownedWeapon(world: World, id: ItemId): Weapon | undefined {
  return world.player.arsenal.find((weapon) => weapon.id === id);
}

// O que o item custa agora: arma que o player ja tem vende so a recarga.
export function itemPrice(world: World, id: ItemId): number {
  const price = world.market.prices[id];
  return ownedWeapon(world, id) ? refillPrice(price) : price;
}

export function canBuy(world: World, id: ItemId): boolean {
  const owned = ownedWeapon(world, id);
  // arma cheia nao tem o que recarregar
  if (owned && owned.ammo >= ITEMS[owned.id].ammo) return false;
  return world.player.money >= itemPrice(world, id);
}

export function buyItem(world: World, id: ItemId): boolean {
  if (!canBuy(world, id)) return false;
  const price = itemPrice(world, id);
  const owned = ownedWeapon(world, id);
  world.player.money -= price;
  if (id === 'armor') {
    const previousHp = world.player.hp;
    world.player.maxHp += ITEMS.armor.bonusHp;
    world.player.hp = world.player.maxHp;
    world.run.stats.healthRecovered += world.player.hp - previousHp;
  } else if (owned) {
    owned.ammo = ITEMS[id].ammo;
    world.player.weapon = owned;
  } else {
    // arma nova entra no arsenal e vai para a mao; as outras ficam guardadas
    const weapon = { id, ammo: ITEMS[id].ammo };
    world.player.arsenal.push(weapon);
    world.player.weapon = weapon;
  }
  world.run.events.push({
    at: world.run.seconds,
    ...eventText((t) => t.events.bought(!!owned, t.shop.items[id], price)),
  });
  // objeto novo a cada mudanca: o store compara por referencia
  world.market = {
    ...world.market,
    prices: {
      ...world.market.prices,
      [id]: roundPrice(world.market.prices[id] * DEMAND_MARKUP),
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
  visitShop(world, room);
  world.status = 'shop';
}

// primeira abertura do bau da sala: sorteia os precos
export function visitShop(world: World, room: Room): void {
  if (!room.shopVisited) {
    room.shopVisited = true;
    rollMarket(world);
    world.run.shops++;
    world.run.events.push({
      at: world.run.seconds,
      ...eventText((t) => t.events.shopVisited(world.run.shops)),
    });
  }
}

export function closeShop(world: World): void {
  if (world.status === 'shop') world.status = 'playing';
}
