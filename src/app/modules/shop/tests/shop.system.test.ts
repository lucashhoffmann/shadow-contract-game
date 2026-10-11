import { spawnRoom } from '@/app/modules/level/systems/level.system';
import { SHOP_TEMPLATE } from '@/app/modules/level/templates/room.template';
import { tileCenter } from '@/app/modules/level/utils/grid.util';
import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  buyItem,
  canBuy,
  closeShop,
  updateShopTrigger,
} from '@/app/modules/shop/systems/shop.system';
import { PLAYER_MAX_HP } from '@/app/modules/world/constants/world.constants';
import { createEmptyWorld } from '@/app/modules/world/systems/world.system';
import { createArenaWorld } from '@/test/world.fixture';

describe('buyItem', () => {
  it('debita o preco e equipa a arma com municao cheia', () => {
    const world = createArenaWorld();
    world.run.money = 250;

    expect(buyItem(world, 'pistol')).toBe(true);

    expect(world.run.money).toBe(250 - ITEMS.pistol.price);
    expect(world.player.weapon).toEqual({
      id: 'pistol',
      ammo: ITEMS.pistol.ammo,
    });
  });

  it('nao compra sem saldo', () => {
    const world = createArenaWorld();
    world.run.money = ITEMS.pistol.price - 1;

    expect(canBuy(world, 'pistol')).toBe(false);
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
});

describe('updateShopTrigger', () => {
  function shopWorld() {
    const world = createEmptyWorld(1);
    spawnRoom(world, 0, SHOP_TEMPLATE);
    return world;
  }

  it('abre a loja ao pisar na zona, uma vez por sala', () => {
    const world = shopWorld();
    world.player.pos = tileCenter(0, 5, 5);

    updateShopTrigger(world);
    expect(world.status).toBe('shop');

    closeShop(world);
    expect(world.status).toBe('playing');

    updateShopTrigger(world);
    expect(world.status).toBe('playing');
  });

  it('nao abre fora da zona', () => {
    const world = shopWorld();
    world.player.pos = tileCenter(0, 5, 10);
    updateShopTrigger(world);
    expect(world.status).toBe('playing');
  });
});
