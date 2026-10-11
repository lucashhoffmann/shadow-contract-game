import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createGameEngine } from '@/app/engine/game-engine';
import { createMarket } from '@/app/modules/shop/systems/shop.system';
import type { Hud as HudData } from '@/app/store/game-store/game.store';
import { useGameStore } from '@/app/store/game-store/game.store';
import { GameOverDialog } from '@/resources/pages/game/components/game-over-dialog.component';
import { Hud } from '@/resources/pages/game/components/hud.component';
import { LegendDialog } from '@/resources/pages/game/components/legend-dialog.component';
import { ShopDialog } from '@/resources/pages/game/components/shop-dialog.component';
import { GamePage } from '@/resources/pages/game/game.page';

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
};

const HUD: HudData = {
  hp: 50,
  maxHp: 100,
  money: 250,
  room: 3,
  kills: 2,
  weaponId: 'pistol',
  ammo: 4,
};

function segments(container: HTMLElement, state: string) {
  return container.querySelectorAll(`[data-state="${state}"]`).length;
}

describe('Hud', () => {
  it('mostra vida, sala, dinheiro e arma', () => {
    render(
      <Hud
        previews={PREVIEWS}
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
    expect(screen.getByLabelText('Balas: 4 de 8')).toBeInTheDocument();
  });

  it.each(['pistol', 'silenced', 'shotgun'] as const)(
    'mostra o preview da arma %s',
    (weaponId) => {
      const { container } = render(
        <Hud
          previews={PREVIEWS}
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
        hud={{ ...HUD, weaponId: null, ammo: 0 }}
      />,
    );
    expect(screen.getByText('Espada')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'data:sword');
    expect(screen.queryByLabelText(/Balas/)).not.toBeInTheDocument();
  });

  it('barra de contrato marca salas feitas, a atual e as que faltam', () => {
    const { container } = render(
      <Hud
        previews={PREVIEWS}
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
        hud={{ ...HUD, room: 0 }}
      />,
    );
    expect(segments(start.container, 'todo')).toBe(5);
    start.unmount();

    const shop = render(
      <Hud
        previews={PREVIEWS}
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

  it('Continuar fecha a loja', async () => {
    const onClose = vi.fn();
    render(
      <ShopDialog
        open
        previews={PREVIEWS}
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
  it('mostra a legenda e dispara a acao', async () => {
    const onAction = vi.fn();
    render(
      <LegendDialog
        open
        title='Como jogar'
        actionLabel='Comecar'
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

    await userEvent.click(screen.getByRole('button', { name: 'Comecar' }));

    expect(useGameStore.getState().screen).toBe('playing');
    expect(screen.queryByText('Como jogar')).not.toBeInTheDocument();
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
    expect(screen.getByText('Contrato encerrado')).toBeInTheDocument();
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
