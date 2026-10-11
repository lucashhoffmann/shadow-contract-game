import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  FIXED_DT,
  PLAYER_MAX_HP,
  ROOM_H,
} from '@/app/modules/world/constants/world.constants';
import { getWorld, useGameStore } from '@/app/store/game-store/game.store';

const IDLE = { moveX: 0, moveY: 0 };
const store = () => useGameStore.getState();

beforeEach(() => {
  store().backToMenu();
  useGameStore.setState({ best: 0 });
});

describe('game store', () => {
  it('startRun cria o mundo e vai para playing', () => {
    store().startRun(1);
    expect(store().screen).toBe('playing');
    expect(store().hud.hp).toBe(PLAYER_MAX_HP);
    expect(getWorld()).not.toBeNull();
  });

  it('tick avanca a simulacao e sincroniza o hud', () => {
    store().startRun(1);
    const startY = getWorld()!.player.pos.y;
    getWorld()!.run.money = 80;

    store().tick({ moveX: 0, moveY: 1 }, FIXED_DT);

    expect(getWorld()!.player.pos.y).toBeGreaterThan(startY);
    expect(store().hud.money).toBe(80);
  });

  it('nao notifica a UI quando nada visivel mudou', () => {
    store().startRun(1);
    const listener = vi.fn();
    const unsubscribe = useGameStore.subscribe(listener);

    for (let i = 0; i < 30; i++) store().tick(IDLE, FIXED_DT);

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it('buy debita e mostra a arma no hud', () => {
    store().startRun(1);
    getWorld()!.run.money = 300;

    store().buy('pistol');

    expect(store().hud.weaponId).toBe('pistol');
    expect(store().hud.ammo).toBe(ITEMS.pistol.ammo);
    expect(store().hud.money).toBe(300 - ITEMS.pistol.price);
  });

  it('closeShop volta para playing', () => {
    store().startRun(1);
    getWorld()!.status = 'shop';
    useGameStore.setState({ screen: 'shop' });

    store().closeShop();

    expect(store().screen).toBe('playing');
  });

  it('morte vai para gameover e para de simular', () => {
    store().startRun(1);
    getWorld()!.player.hp = 0;

    store().tick(IDLE, FIXED_DT);
    expect(store().screen).toBe('gameover');

    const y = getWorld()!.player.pos.y;
    store().tick({ moveX: 0, moveY: 1 }, FIXED_DT);
    expect(getWorld()!.player.pos.y).toBe(y);
  });

  it('guarda a maior sala alcancada em best', () => {
    store().startRun(1);
    getWorld()!.player.pos.y = 3 * ROOM_H + 1.5;

    store().tick(IDLE, FIXED_DT);

    expect(store().hud.room).toBe(3);
    expect(store().best).toBe(3);
  });

  it('backToMenu descarta o mundo e mantem best', () => {
    useGameStore.setState({ best: 7 });
    store().startRun(1);

    store().backToMenu();

    expect(store().screen).toBe('menu');
    expect(getWorld()).toBeNull();
    expect(store().best).toBe(7);
  });
});
