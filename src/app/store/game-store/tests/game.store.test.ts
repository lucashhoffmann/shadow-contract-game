import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  FIXED_DT,
  PLAYER_MAX_HP,
  ROOM_H,
} from '@/app/modules/world/constants/world.constants';
import {
  DEFAULT_BLOOD_COLOR,
  DEFAULT_LOOK,
  getWorld,
  LOOK_SCALE,
  useGameStore,
} from '@/app/store/game-store/game.store';

const IDLE = { moveX: 0, moveY: 0, dash: false };
const FORWARD = { moveX: 0, moveY: 1, dash: false };
const store = () => useGameStore.getState();

// run ja passada da legenda inicial
function play() {
  store().startRun(1);
  store().begin();
}

beforeEach(() => {
  store().backToMenu();
  useGameStore.setState({
    best: 0,
    look: DEFAULT_LOOK,
    bloodColor: DEFAULT_BLOOD_COLOR,
  });
});

describe('game store', () => {
  it('startRun cria o mundo e abre na legenda, sem simular', () => {
    store().startRun(1);
    expect(store().screen).toBe('intro');
    expect(store().hud.hp).toBe(PLAYER_MAX_HP);

    const y = getWorld()!.player.pos.y;
    store().tick(FORWARD, FIXED_DT);
    expect(getWorld()!.player.pos.y).toBe(y);
  });

  it('begin sai da legenda para playing', () => {
    store().startRun(1);
    store().begin();
    expect(store().screen).toBe('playing');
  });

  it('togglePause congela e retoma', () => {
    play();
    store().togglePause();
    expect(store().screen).toBe('paused');

    const y = getWorld()!.player.pos.y;
    store().tick(FORWARD, FIXED_DT);
    expect(getWorld()!.player.pos.y).toBe(y);

    store().togglePause();
    expect(store().screen).toBe('playing');
  });

  it('tick avanca a simulacao e sincroniza o hud', () => {
    play();
    const startY = getWorld()!.player.pos.y;
    getWorld()!.run.money = 80;

    store().tick(FORWARD, FIXED_DT);

    expect(getWorld()!.player.pos.y).toBeGreaterThan(startY);
    expect(store().hud.money).toBe(80);
  });

  it('nao notifica a UI quando nada visivel mudou', () => {
    play();
    const listener = vi.fn();
    const unsubscribe = useGameStore.subscribe(listener);

    for (let i = 0; i < 30; i++) store().tick(IDLE, FIXED_DT);

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it('buy debita, mostra a arma no hud e publica o mercado novo', () => {
    play();
    getWorld()!.run.money = 300;
    const market = store().market;

    store().buy('pistol');

    expect(store().hud.weaponId).toBe('pistol');
    expect(store().hud.ammo).toBe(ITEMS.pistol.ammo);
    expect(store().hud.money).toBe(300 - ITEMS.pistol.price);
    expect(store().market).not.toBe(market);
    expect(store().market.prices.pistol).toBeGreaterThan(ITEMS.pistol.price);
  });

  it('closeShop volta para playing', () => {
    play();
    getWorld()!.status = 'shop';
    useGameStore.setState({ screen: 'shop' });

    store().closeShop();

    expect(store().screen).toBe('playing');
  });

  it('morte vai para gameover e para de simular', () => {
    play();
    getWorld()!.player.hp = 0;

    store().tick(IDLE, FIXED_DT);
    expect(store().screen).toBe('gameover');

    const y = getWorld()!.player.pos.y;
    store().tick(FORWARD, FIXED_DT);
    expect(getWorld()!.player.pos.y).toBe(y);
  });

  it('guarda a maior sala alcancada em best', () => {
    play();
    getWorld()!.player.pos.y = 3 * ROOM_H + 1.5;

    store().tick(IDLE, FIXED_DT);

    expect(store().hud.room).toBe(3);
    expect(store().best).toBe(3);
  });

  it('backToMenu descarta o mundo e mantem best', () => {
    useGameStore.setState({ best: 7 });
    play();

    store().backToMenu();

    expect(store().screen).toBe('menu');
    expect(getWorld()).toBeNull();
    expect(store().best).toBe(7);
  });

  it('setLook no menu muda cor e prende a escala na faixa', () => {
    store().setLook({ cloth: '#00ff00', head: 99, legs: -1 });

    expect(store().look.cloth).toBe('#00ff00');
    expect(store().look.head).toBe(LOOK_SCALE.max);
    expect(store().look.legs).toBe(LOOK_SCALE.min);
  });

  it('setLook ignora cor invalida', () => {
    store().setLook({ skin: 'red' });
    expect(store().look.skin).toBe(DEFAULT_LOOK.skin);
  });

  it('grava a cor do sangue e rejeita cor invalida', () => {
    store().setBloodColor('#22aa44');
    expect(store().bloodColor).toBe('#22aa44');
    expect(
      JSON.parse(localStorage.getItem('shadow-contract')!).state.bloodColor,
    ).toBe('#22aa44');
    store().setBloodColor('verde');
    expect(store().bloodColor).toBe('#22aa44');
  });

  it('openCharacter abre a tela de personagem, onde setLook ainda vale', () => {
    store().openCharacter();
    store().setLook({ cloth: '#00ff00' });

    expect(store().screen).toBe('character');
    expect(store().look.cloth).toBe('#00ff00');
  });

  it('openCharacter nao tira o jogador de uma run', () => {
    play();
    store().openCharacter();
    expect(store().screen).toBe('playing');
  });

  it('setLook nao muda nada depois que a run comeca', () => {
    store().startRun(1);
    store().setLook({ cloth: '#00ff00' });
    expect(store().look.cloth).toBe(DEFAULT_LOOK.cloth);
  });
});
