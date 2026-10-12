import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createGameEngine } from '@/app/engine/game-engine';
import {
  createMarket,
  refillPrice,
} from '@/app/modules/shop/systems/shop.system';
import { createArenaWorld } from '@/test/world.fixture';
import type { Hud as HudData } from '@/app/store/game-store/game.store';
import { useGameStore } from '@/app/store/game-store/game.store';
import { GameOverDialog } from '@/resources/pages/game/components/game-over-dialog.component';
import { Hud } from '@/resources/pages/game/components/hud.component';
import { LegendDialog } from '@/resources/pages/game/components/legend-dialog.component';
import { MatchMenu } from '@/resources/pages/game/components/match-menu.component';
import { Scoreboard } from '@/resources/pages/game/components/scoreboard.component';
import { ShopDialog } from '@/resources/pages/game/components/shop-dialog.component';
import { GamePage } from '@/resources/pages/game/game.page';
import { useLanguage } from '@/shared/i18n';

// jsdom nao tem WebGL
const { dispose } = vi.hoisted(() => ({ dispose: vi.fn() }));
vi.mock('@/app/engine/game-engine', () => ({
  createGameEngine: vi.fn(() => ({ dispose })),
}));
vi.mock('@/app/engine/weapon-preview', () => ({
  renderWeaponPreviews: () => PREVIEWS,
}));

const PREVIEWS = {
  sword: 'data:sword',
  pistol: 'data:pistol',
  silenced: 'data:silenced',
  shotgun: 'data:shotgun',
  ammo: 'data:ammo',
};

const HUD: HudData = {
  hp: 50,
  maxHp: 100,
  shield: 0,
  invisible: 0,
  invincible: 0,
  dashes: 4,
  revives: 0,
  money: 250,
  room: 3,
  kills: 2,
  weaponId: 'pistol',
  ammo: 4,
  headshot: 15,
};

function segments(container: HTMLElement, state: string) {
  return container.querySelectorAll(`[data-state="${state}"]`).length;
}

describe('Hud', () => {
  it('mostra vida, sala, dinheiro e arma', () => {
    render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={HUD}
      />,
    );
    expect(screen.getByRole('progressbar', { name: 'Vida' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByText('Sala 3')).toBeInTheDocument();
    expect(screen.getByText('$ 250')).toBeInTheDocument();
    expect(screen.getByText('Pistola')).toBeInTheDocument();
    expect(screen.getByLabelText('Balas: 4 de 30')).toBeInTheDocument();
    expect(screen.getByText('Headshot 15%')).toBeInTheDocument();
  });

  it.each(['pistol', 'silenced', 'shotgun'] as const)(
    'mostra o preview da arma %s',
    (weaponId) => {
      const { container } = render(
        <Hud
          previews={PREVIEWS}
          arsenal={[]}
          onSelectWeapon={vi.fn()}
          hud={{ ...HUD, weaponId }}
        />,
      );
      expect(container.querySelector('img')).toHaveAttribute(
        'src',
        PREVIEWS[weaponId],
      );
    },
  );

  it('espada: mostra o preview e nao mostra balas', () => {
    const { container } = render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, weaponId: null, ammo: 0 }}
      />,
    );
    // espada: so a imagem, sem o nome escrito
    expect(screen.getByAltText('Espada')).toBeInTheDocument();
    expect(screen.queryByText('Espada')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', 'data:sword');
    expect(screen.queryByLabelText(/Balas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Headshot/)).not.toBeInTheDocument();
  });

  it('mostra os saltos guardados em tracos, de 6', () => {
    const { container } = render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, dashes: 4 }}
      />,
    );
    const pips = screen.getByRole('img', { name: 'Saltos: 4 de 6' });
    expect(pips.querySelectorAll('[data-state="full"]')).toHaveLength(4);
    expect(pips.querySelectorAll('[data-state="empty"]')).toHaveLength(2);
    expect(container).toContainElement(pips);
  });

  it('sem arma de fogo nao mostra a escolha de arma', () => {
    render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, weaponId: null, ammo: 0 }}
      />,
    );
    expect(
      screen.queryByRole('group', { name: 'Armas' }),
    ).not.toBeInTheDocument();
  });

  it('deixa escolher a arma, e a sem bala fica cinza mas escolhivel', async () => {
    const onSelectWeapon = vi.fn();
    render(
      <Hud
        previews={PREVIEWS}
        arsenal={[
          { id: 'pistol', ammo: 0 },
          { id: 'shotgun', ammo: 7 },
        ]}
        onSelectWeapon={onSelectWeapon}
        hud={{ ...HUD, weaponId: 'shotgun', ammo: 7 }}
      />,
    );
    const pistol = screen.getByRole('button', { name: /Pistola: 0/ });
    const shotgun = screen.getByRole('button', { name: /Escopeta: 7/ });
    expect(shotgun).toHaveAttribute('aria-pressed', 'true');
    expect(pistol).toHaveAttribute('aria-pressed', 'false');
    expect(pistol).toHaveAttribute('data-empty', 'true');
    expect(pistol).toHaveClass('grayscale');
    expect(shotgun).not.toHaveClass('grayscale');

    await userEvent.click(pistol);
    expect(onSelectWeapon).toHaveBeenCalledWith('pistol');
    await userEvent.click(screen.getByRole('button', { name: 'Espada' }));
    expect(onSelectWeapon).toHaveBeenLastCalledWith(null);
  });

  it('arma na mao sem bala aparece cinza no cartao', () => {
    const { container } = render(
      <Hud
        previews={PREVIEWS}
        arsenal={[{ id: 'pistol', ammo: 0 }]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, weaponId: 'pistol', ammo: 0 }}
      />,
    );
    expect(container.querySelector('[data-empty="true"]')).toHaveClass(
      'grayscale',
    );
  });

  it('escudo soma na barra em azul, na proporcao de vida + escudo', () => {
    const { rerender } = render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, hp: 100, maxHp: 100, shield: 25 }}
      />,
    );
    const bar = screen.getByRole('progressbar', { name: 'Vida' });
    expect(bar.firstElementChild).toHaveStyle({ width: '80%' });
    expect(screen.getByTestId('shield-bar')).toHaveStyle({ width: '20%' });
    expect(screen.getByLabelText('Escudo')).toHaveTextContent('+25');

    rerender(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, hp: 50, maxHp: 100, shield: 0 }}
      />,
    );
    expect(bar.firstElementChild).toHaveStyle({ width: '50%' });
    expect(screen.getByTestId('shield-bar')).toHaveStyle({ width: '0%' });
  });

  it('barra de contrato marca salas feitas, a atual e as que faltam', () => {
    const { container } = render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, room: 3 }}
      />,
    );
    expect(screen.getByText('Contrato 1')).toBeInTheDocument();
    expect(segments(container, 'done')).toBe(2);
    expect(segments(container, 'current')).toBe(1);
    expect(segments(container, 'todo')).toBe(2);
  });

  it('barra de contrato: sala inicial vazia, loja fecha o contrato', () => {
    const start = render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, room: 0 }}
      />,
    );
    expect(segments(start.container, 'todo')).toBe(5);
    start.unmount();

    const shop = render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, room: 5 }}
      />,
    );
    expect(screen.getByText('Contrato 1')).toBeInTheDocument();
    expect(segments(shop.container, 'done')).toBe(4);
    expect(screen.getByText('$')).toHaveAttribute('data-state', 'current');
    shop.unmount();

    render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={{ ...HUD, room: 7 }}
      />,
    );
    expect(screen.getByText('Contrato 2')).toBeInTheDocument();
  });
});

describe('ShopDialog', () => {
  it('compra item que cabe no saldo e bloqueia o que nao cabe', async () => {
    const onBuy = vi.fn();
    render(
      <ShopDialog
        open
        previews={PREVIEWS}
        arsenal={[]}
        money={250}
        market={createMarket()}
        onBuy={onBuy}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Escopeta/ })).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: /^Pistola(?! silenciada)/ }),
    );

    expect(onBuy).toHaveBeenCalledWith('pistol');
  });

  it('mostra o preco do mercado, a variacao e a inflacao', () => {
    const base = createMarket();
    render(
      <ShopDialog
        open
        previews={PREVIEWS}
        arsenal={[]}
        money={250}
        market={{
          inflation: 1.12,
          prices: { ...base.prices, pistol: 250, armor: 200 },
        }}
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Inflacao: \+12%/)).toBeInTheDocument();
    const pistol = screen.getByRole('button', {
      name: /^Pistola(?! silenciada)/,
    });
    expect(pistol).toHaveTextContent('250');
    expect(pistol.querySelector('img')).toHaveAttribute('src', 'data:pistol');
    expect(pistol).toHaveTextContent('▲ 25%');
    expect(screen.getByRole('button', { name: /Colete/ })).toHaveTextContent(
      '▼ 20%',
    );
  });

  it('arma que o player ja tem vira recarga mais barata; cheia, bloqueia', async () => {
    const onBuy = vi.fn();
    const market = createMarket();
    render(
      <ShopDialog
        open
        previews={PREVIEWS}
        arsenal={[
          { id: 'pistol', ammo: 5 },
          { id: 'shotgun', ammo: 30 },
        ]}
        money={5000}
        market={market}
        onBuy={onBuy}
        onClose={vi.fn()}
      />,
    );
    const pistol = screen.getByRole('button', {
      name: /^Pistola(?! silenciada)/,
    });
    expect(pistol).toHaveTextContent('Recarga: +25 balas');
    expect(pistol.querySelector('img')).toHaveAttribute('src', 'data:ammo');
    expect(pistol).toHaveTextContent(String(refillPrice(market.prices.pistol)));
    await userEvent.click(pistol);
    expect(onBuy).toHaveBeenCalledWith('pistol');

    const shotgun = screen.getByRole('button', { name: /Escopeta/ });
    expect(shotgun).toHaveTextContent('Municao cheia');
    expect(shotgun).toBeDisabled();
  });

  it('Continuar fecha a loja', async () => {
    const onClose = vi.fn();
    render(
      <ShopDialog
        open
        previews={PREVIEWS}
        arsenal={[]}
        money={0}
        market={createMarket()}
        onBuy={vi.fn()}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('nao renderiza fechado', () => {
    render(
      <ShopDialog
        open={false}
        previews={PREVIEWS}
        arsenal={[]}
        money={0}
        market={createMarket()}
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText('Escolha o equipamento')).not.toBeInTheDocument();
  });
});

describe('LegendDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useLanguage.getState().setLanguage('pt-BR');
  });

  it('mostra a legenda e dispara a acao', async () => {
    const onAction = vi.fn();
    render(
      <LegendDialog
        open
        title='Como jogar'
        actionLabel='Comecar'
        onMenu={vi.fn()}
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Como jogar')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('Ninja')).toBeInTheDocument();
    expect(screen.getByText('Terno')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Comecar' }));

    expect(onAction).toHaveBeenCalled();
  });

  it('mostra os controles de toque no mobile em portugues e ingles', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: coarse)',
    }));
    render(
      <LegendDialog
        open
        title='Como jogar'
        actionLabel='Comecar'
        onMenu={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Joystick')).toBeInTheDocument();
    expect(screen.getByText('Mão')).toBeInTheDocument();
    expect(screen.queryByText('Espaco')).toBeNull();
    expect(screen.queryByText('F')).toBeNull();

    act(() => useLanguage.getState().setLanguage('en'));
    expect(screen.getByText('Hand')).toBeInTheDocument();
    expect(screen.getByText('Arrows')).toBeInTheDocument();
    expect(screen.queryByText('Space')).toBeNull();
  });
});

describe('GameOverDialog', () => {
  it('mostra o resultado e dispara reiniciar e menu', async () => {
    const onRestart = vi.fn();
    const onMenu = vi.fn();
    render(
      <GameOverDialog
        open
        room={5}
        kills={7}
        best={8}
        run={createArenaWorld().run}
        onRestart={onRestart}
        onMenu={onMenu}
      />,
    );

    expect(
      screen.getByText('Sala 5, 7 eliminados. Recorde: sala 8.'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Jogar de novo' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(onRestart).toHaveBeenCalled();
    expect(onMenu).toHaveBeenCalled();
  });

  it('abre a análise com taxas, cura e registro da partida', async () => {
    const run = createArenaWorld().run;
    run.seconds = 65;
    run.stats.meleeAttempts = 4;
    run.stats.meleeHits = 3;
    run.stats.projectilesFired = 5;
    run.stats.projectilesHit = 2;
    run.stats.healthRecovered = 20;
    run.stats.damageDealt = 75;
    run.attackVariance = { min: 0.8, max: 1.2 };
    run.events.push({ at: 15, text: 'Facada errou.' });
    run.events.push({ at: 16, text: 'Facada acertou: 35 de dano.' });
    render(
      <GameOverDialog
        open
        room={2}
        kills={1}
        best={2}
        run={run}
        onRestart={vi.fn()}
        onMenu={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Ver análise do jogo' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Análise do jogo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Acertos: 3 (75%)')).toBeInTheDocument();
    expect(screen.getByText('Erros: 1 (25%)')).toBeInTheDocument();
    expect(screen.getByText('Acertos de tiro: 2 (40%)')).toBeInTheDocument();
    expect(screen.getByText('Erros de tiro: 3 (60%)')).toBeInTheDocument();
    expect(screen.getByText('Vida recuperada: 20')).toBeInTheDocument();
    expect(screen.getByText('Força do ataque: 80%–120%')).toBeInTheDocument();
    expect(screen.getByText('Dano causado: 75')).toBeInTheDocument();
    expect(screen.getByText('Tempo: 1:05')).toBeInTheDocument();
    expect(screen.getByText('Facada errou.')).toBeInTheDocument();
    expect(screen.getByText('Facada acertou: 35 de dano.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(
      screen.queryByRole('dialog', { name: 'Análise do jogo' }),
    ).not.toBeInTheDocument();
  });
});

describe('GamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().startRun(1);
  });

  it('liga a engine no canvas e desliga ao desmontar', () => {
    const { container, unmount } = render(<GamePage />);
    expect(createGameEngine).toHaveBeenCalledWith(
      container.querySelector('canvas'),
    );
    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it('abre na legenda e Comecar solta o jogo', async () => {
    render(<GamePage />);
    expect(screen.getByText('Como jogar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Joystick')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Comecar' }));

    expect(useGameStore.getState().screen).toBe('playing');
    expect(screen.queryByText('Como jogar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Joystick')).toBeInTheDocument();
  });

  it('Inicio volta para o menu, na abertura e na pausa', async () => {
    render(<GamePage />);
    act(() => useGameStore.getState().startRun(1));
    await userEvent.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(useGameStore.getState().screen).toBe('menu');

    act(() => useGameStore.getState().startRun(1));
    act(() => useGameStore.getState().begin());
    act(() => useGameStore.getState().togglePause());
    await userEvent.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(useGameStore.getState().screen).toBe('menu');
  });

  it('Tela cheia entra e sai da tela cheia', async () => {
    const enter = vi.fn();
    const exit = vi.fn();
    document.documentElement.requestFullscreen = enter;
    document.exitFullscreen = exit;
    render(<GamePage />);
    act(() => useGameStore.getState().startRun(1));

    await userEvent.click(screen.getByRole('button', { name: 'Tela cheia' }));
    expect(enter).toHaveBeenCalled();

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.documentElement,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Tela cheia' }));
    expect(exit).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
  });

  it('pausa mostra a legenda como Pausado e Continuar retoma', async () => {
    render(<GamePage />);
    act(() => useGameStore.getState().begin());
    act(() => useGameStore.getState().togglePause());
    expect(screen.getByText('Pausado')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(useGameStore.getState().screen).toBe('playing');
  });

  it('pausa oferece Reiniciar, que volta para a abertura de uma nova run', async () => {
    render(<GamePage />);
    expect(
      screen.queryByRole('button', { name: 'Reiniciar' }),
    ).not.toBeInTheDocument();
    act(() => useGameStore.getState().begin());
    act(() => useGameStore.getState().togglePause());

    await userEvent.click(screen.getByRole('button', { name: 'Reiniciar' }));

    expect(useGameStore.getState().screen).toBe('intro');
    expect(screen.getByText('Como jogar')).toBeInTheDocument();
  });

  it('abre loja e game over conforme a tela do store', () => {
    render(<GamePage />);
    expect(screen.queryByText('Escolha o equipamento')).not.toBeInTheDocument();

    act(() => useGameStore.setState({ screen: 'shop' }));
    expect(screen.getByText('Escolha o equipamento')).toBeInTheDocument();

    act(() => useGameStore.setState({ screen: 'gameover' }));
    expect(
      screen.getByRole('heading', { name: 'Voce morreu!' }),
    ).toBeInTheDocument();
  });
});

it('borda vermelha aparece so quando a vida cai', () => {
  const setHp = (hp: number) =>
    act(() =>
      useGameStore.setState((state) => ({ hud: { ...state.hud, hp } })),
    );
  setHp(100);
  render(<GamePage />);
  expect(screen.queryByTestId('damage-vignette')).toBeNull();
  setHp(80);
  expect(screen.getByTestId('damage-vignette')).toBeInTheDocument();
});

it('borda vermelha pulsa sem parar com menos de 20 de vida, e some ao curar ou morrer', () => {
  const setHp = (hp: number) =>
    act(() =>
      useGameStore.setState((state) => ({ hud: { ...state.hud, hp } })),
    );
  setHp(20);
  render(<GamePage />);
  expect(screen.queryByTestId('low-health-vignette')).toBeNull();
  setHp(19);
  expect(screen.getByTestId('low-health-vignette')).toHaveClass(
    'animate-low-health',
  );
  setHp(60);
  expect(screen.queryByTestId('low-health-vignette')).toBeNull();
  setHp(0);
  expect(screen.queryByTestId('low-health-vignette')).toBeNull();
});

it('borda azul usa o mesmo pulso quando ha aviso de inatividade', () => {
  act(() => useGameStore.setState({ idleWarnings: 0 }));
  render(<GamePage />);
  expect(screen.queryByTestId('idle-vignette')).toBeNull();

  act(() => useGameStore.setState({ idleWarnings: 1 }));
  expect(screen.getByTestId('idle-vignette')).toHaveClass('animate-damage');
  expect(screen.getByTestId('idle-vignette').style.background).toContain(
    '59, 130, 246',
  );
});

it('botao de pausa do cabecalho pausa o jogo e some fora da partida', async () => {
  useGameStore.getState().startRun(1);
  render(<GamePage />);
  expect(screen.queryByRole('button', { name: 'Pausar' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Comecar' }));

  await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));
  expect(useGameStore.getState().screen).toBe('paused');
  expect(screen.getByText('Pausado')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Pausar' })).toBeNull();
});

it('HUD mostra uma cruz por ficha de revive guardada, e nada sem ficha', () => {
  const { rerender } = render(
    <Hud
      previews={PREVIEWS}
      arsenal={[]}
      onSelectWeapon={vi.fn()}
      hud={HUD}
    />,
  );
  expect(screen.queryByRole('img', { name: /Fichas de revive/ })).toBeNull();
  rerender(
    <Hud
      previews={PREVIEWS}
      arsenal={[]}
      onSelectWeapon={vi.fn()}
      hud={{ ...HUD, revives: 2 }}
    />,
  );
  expect(
    screen.getByRole('img', { name: 'Fichas de revive: 2' }).children,
  ).toHaveLength(2);
});

describe('partida em rede: placar e menu', () => {
  const SCORES = [
    {
      id: 0,
      name: 'Lucas',
      color: '#ff8a3c',
      kills: 2,
      deaths: 1,
      alive: true,
      you: true,
      ping: 40,
    },
    {
      id: 1,
      name: 'Ana',
      color: '#39d0ff',
      kills: 5,
      deaths: 0,
      alive: false,
      you: false,
      ping: 120,
    },
  ];

  it('placar lista kills e mortes, quem matou mais em cima', () => {
    const { rerender } = render(
      <Scoreboard
        open={false}
        scores={SCORES}
      />,
    );
    expect(screen.queryByRole('table')).toBeNull();
    rerender(
      <Scoreboard
        open
        scores={SCORES}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Ana');
    expect(rows[0]).toHaveTextContent('5');
    expect(rows[1]).toHaveTextContent('Lucas');
    expect(rows[1]).toHaveAttribute('data-you', 'true');
    // ping de cada um, so quando ha medida
    expect(rows[0]).toHaveTextContent('120 ms');
    expect(rows[1]).toHaveTextContent('40 ms');
  });

  it('menu: so o host ve Encerrar partida; todos podem sair', async () => {
    const onEnd = vi.fn();
    const onLeave = vi.fn();
    const { rerender } = render(
      <MatchMenu
        open
        host={false}
        onResume={vi.fn()}
        onEnd={onEnd}
        onLeave={onLeave}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Encerrar partida' }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Sair da partida' }),
    );
    expect(onLeave).toHaveBeenCalled();

    rerender(
      <MatchMenu
        open
        host
        onResume={vi.fn()}
        onEnd={onEnd}
        onLeave={onLeave}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Encerrar partida' }),
    );
    expect(onEnd).toHaveBeenCalled();
  });

  it('icone do placar no HUD so existe quando ha acao para ele', async () => {
    const onScoreboard = vi.fn();
    const { rerender } = render(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={HUD}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Ver placar' })).toBeNull();
    rerender(
      <Hud
        previews={PREVIEWS}
        arsenal={[]}
        onSelectWeapon={vi.fn()}
        hud={HUD}
        onScoreboard={onScoreboard}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver placar' }));
    expect(onScoreboard).toHaveBeenCalled();
  });
});
