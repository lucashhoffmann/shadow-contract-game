import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  buyItem,
  canBuy,
  createMarket,
} from '@/app/modules/shop/systems/shop.system';
import { DASH_MAX } from '@/app/modules/world/constants/world.constants';
import { createArenaWorld } from '@/test/world.fixture';

describe('saltos na loja', () => {
  it('estao no mercado, com preco proprio', () => {
    expect(createMarket().prices.dash).toBe(ITEMS.dash.price);
  });

  it('comprar repoe os saltos ate o maximo e cobra o preco', () => {
    const world = createArenaWorld();
    world.player.dashes = 2;
    world.player.money = 500;
    const price = world.market.prices.dash;

    expect(buyItem(world, 'dash')).toBe(true);
    expect(world.player.dashes).toBe(DASH_MAX);
    expect(world.player.money).toBe(500 - price);
    // nao mexe em arma nem em vida
    expect(world.player.weapon).toBeNull();
    expect(world.player.arsenal).toHaveLength(0);
  });

  it('com os saltos cheios, ou sem dinheiro, nao vende', () => {
    const world = createArenaWorld();
    world.player.money = 500;
    world.player.dashes = DASH_MAX;
    expect(canBuy(world, 'dash')).toBe(false);
    expect(buyItem(world, 'dash')).toBe(false);
    expect(world.player.money).toBe(500);

    world.player.dashes = 0;
    world.player.money = 0;
    expect(canBuy(world, 'dash')).toBe(false);
  });

  it('recomprar na mesma loja encarece, como os outros itens', () => {
    const world = createArenaWorld();
    world.player.money = 5000;
    world.player.dashes = 0;
    const first = world.market.prices.dash;
    buyItem(world, 'dash');
    expect(world.market.prices.dash).toBeGreaterThan(first);
  });
});
