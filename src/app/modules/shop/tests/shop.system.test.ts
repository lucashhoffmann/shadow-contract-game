import { spawnRoom } from '@/app/modules/level/systems/level.system';
import { SHOP_TEMPLATE } from '@/app/modules/level/templates/room.template';
import {
  isSolidTile,
  tileAt,
  tileCenter,
} from '@/app/modules/level/utils/grid.util';
import {
  DEMAND_MARKUP,
  INFLATION_PER_SHOP,
  ITEMS,
  MAX_INFLATION,
  PRICE_STEP,
  PRICE_VOLATILITY,
  SHOP_ITEMS,
} from '@/app/modules/shop/constants/shop.constants';
import {
  buyItem,
  itemPrice,
  refillPrice,
  canBuy,
  closeShop,
  rollMarket,
  nearbyChest,
  openChest,
} from '@/app/modules/shop/systems/shop.system';
import {
  FIXED_DT,
  PLAYER_MAX_HP,
} from '@/app/modules/world/constants/world.constants';
import {
  createEmptyWorld,
  stepWorld,
} from '@/app/modules/world/systems/world.system';
import { createArenaWorld } from '@/test/world.fixture';

function marketFor(seed: number, shops: number) {
  const world = createArenaWorld();
  world.rngState = seed;
  world.run.shops = shops;
  rollMarket(world);
  return world.market;
}

describe('buyItem', () => {
  it('debita o preco de mercado e equipa a arma com municao cheia', () => {
    const world = createArenaWorld();
    world.run.money = 250;

    expect(buyItem(world, 'pistol')).toBe(true);

    expect(world.run.money).toBe(250 - ITEMS.pistol.price);
    expect(world.player.weapon).toEqual({
      id: 'pistol',
      ammo: ITEMS.pistol.ammo,
    });
  });

  it('cobra o preco do mercado, nao o preco base', () => {
    const world = createArenaWorld();
    world.market.prices.pistol = 300;
    world.run.money = 299;
    expect(canBuy(world, 'pistol')).toBe(false);

    world.run.money = 300;
    expect(buyItem(world, 'pistol')).toBe(true);
    expect(world.run.money).toBe(0);
  });

  it('nao compra sem saldo', () => {
    const world = createArenaWorld();
    world.run.money = ITEMS.pistol.price - 1;

    expect(buyItem(world, 'pistol')).toBe(false);

    expect(world.run.money).toBe(ITEMS.pistol.price - 1);
    expect(world.player.weapon).toBeNull();
  });

  it('colete aumenta a vida maxima e cura', () => {
    const world = createArenaWorld();
    world.run.money = ITEMS.armor.price;
    world.player.hp = 40;

    buyItem(world, 'armor');

    expect(world.player.maxHp).toBe(PLAYER_MAX_HP + ITEMS.armor.bonusHp);
    expect(world.player.hp).toBe(world.player.maxHp);
    expect(world.player.weapon).toBeNull();
  });

  it('arma nova substitui a anterior', () => {
    const world = createArenaWorld();
    world.run.money = 1000;
    buyItem(world, 'pistol');
    buyItem(world, 'shotgun');
    expect(world.player.weapon?.id).toBe('shotgun');
  });

  it('recomprar o mesmo item encarece so ele, em um mercado novo', () => {
    const world = createArenaWorld();
    world.run.money = 1000;
    const before = world.market;

    buyItem(world, 'armor');

    expect(world.market).not.toBe(before);
    expect(world.market.prices.armor).toBeCloseTo(
      ITEMS.armor.price * DEMAND_MARKUP,
      -1,
    );
    expect(world.market.prices.pistol).toBe(ITEMS.pistol.price);
  });
});

describe('arsenal e recarga', () => {
  function richWorld() {
    const world = createArenaWorld();
    world.run.money = 5000;
    return world;
  }

  it('comprar outra arma guarda a anterior no arsenal', () => {
    const world = richWorld();
    buyItem(world, 'pistol');
    buyItem(world, 'shotgun');

    expect(world.player.arsenal.map((weapon) => weapon.id)).toEqual([
      'pistol',
      'shotgun',
    ]);
    expect(world.player.weapon).toBe(world.player.arsenal[1]);
  });

  it('arma que ja tem vende so a recarga, mais barata, e enche a municao', () => {
    const world = richWorld();
    buyItem(world, 'pistol');
    const pistol = world.player.arsenal[0];
    pistol.ammo = 3;
    const market = world.market.prices.pistol;
    const before = world.run.money;

    expect(itemPrice(world, 'pistol')).toBe(refillPrice(market));
    expect(refillPrice(market)).toBeLessThan(market / 2);
    expect(buyItem(world, 'pistol')).toBe(true);

    expect(world.run.money).toBe(before - refillPrice(market));
    expect(pistol.ammo).toBe(ITEMS.pistol.ammo);
    expect(world.player.arsenal).toHaveLength(1);
    expect(world.run.events.at(-1)?.text).toContain('Recarregou');
  });

  it('arma cheia nao tem o que recarregar', () => {
    const world = richWorld();
    buyItem(world, 'pistol');
    const before = world.run.money;

    expect(canBuy(world, 'pistol')).toBe(false);
    expect(buyItem(world, 'pistol')).toBe(false);
    expect(world.run.money).toBe(before);
  });
});

describe('rollMarket', () => {
  it('e deterministico por seed', () => {
    expect(marketFor(7, 1)).toEqual(marketFor(7, 1));
  });

  it('instabilidade: precos variam entre lojas, dentro da faixa', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const market = marketFor(seed, 2);
      seen.add(market.prices.pistol);
      for (const item of SHOP_ITEMS) {
        const center = item.price * market.inflation;
        const price = market.prices[item.id];
        expect(price % PRICE_STEP).toBe(0);
        expect(price).toBeGreaterThanOrEqual(
          center * (1 - PRICE_VOLATILITY) - PRICE_STEP,
        );
        expect(price).toBeLessThanOrEqual(
          center * (1 + PRICE_VOLATILITY) + PRICE_STEP,
        );
      }
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('inflacao: indice sobe por loja visitada e para no teto', () => {
    expect(marketFor(1, 0).inflation).toBe(1);
    expect(marketFor(1, 2).inflation).toBeCloseTo(1 + 2 * INFLATION_PER_SHOP);
    expect(marketFor(1, 500).inflation).toBe(MAX_INFLATION);
  });

  it('nenhum preco passa do teto de inflacao mais a oscilacao', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const market = marketFor(seed, 500);
      for (const item of SHOP_ITEMS) {
        expect(market.prices[item.id]).toBeLessThanOrEqual(
          item.price * MAX_INFLATION * (1 + PRICE_VOLATILITY) + PRICE_STEP,
        );
      }
    }
  });
});

describe('openChest', () => {
  // bau no tile (5, 5); o player chega pelo tile de baixo
  function shopWorld() {
    const world = createEmptyWorld(1);
    spawnRoom(world, 0, SHOP_TEMPLATE);
    world.player.pos = tileCenter(0, 5, 6);
    return world;
  }

  it('abre a loja perto do bau e reabre depois de fechar', () => {
    const world = shopWorld();

    openChest(world);
    expect(world.status).toBe('shop');

    closeShop(world);
    expect(world.status).toBe('playing');

    openChest(world);
    expect(world.status).toBe('shop');
  });

  it('sorteia precos so na primeira abertura; a primeira loja nao tem inflacao', () => {
    const world = shopWorld();
    const before = world.market;

    openChest(world);
    const first = world.market;
    expect(first).not.toBe(before);
    expect(first.inflation).toBe(1);
    expect(world.run.shops).toBe(1);

    closeShop(world);
    openChest(world);
    expect(world.market).toBe(first);
    expect(world.run.shops).toBe(1);
  });

  it('nao abre longe do bau nem em sala sem bau', () => {
    const world = shopWorld();
    world.player.pos = tileCenter(0, 5, 10);
    expect(nearbyChest(world)).toBeUndefined();
    openChest(world);
    expect(world.status).toBe('playing');

    const arena = createArenaWorld();
    openChest(arena);
    expect(arena.status).toBe('playing');
  });

  it('bau bloqueia a passagem', () => {
    const world = shopWorld();
    expect(isSolidTile(tileAt(world, 5, 7))).toBe(true);
  });

  it('stepWorld so abre com o pulso da tecla B', () => {
    const world = shopWorld();
    const idle = { moveX: 0, moveY: 0, dash: false };

    stepWorld(world, idle, FIXED_DT);
    expect(world.status).toBe('playing');

    stepWorld(world, { ...idle, open: true }, FIXED_DT);
    expect(world.status).toBe('shop');
  });
});
