import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createGameEngine } from '@/app/engine/game-engine';
import type { Hud as HudData } from '@/app/store/game-store/game.store';
import { useGameStore } from '@/app/store/game-store/game.store';
import { GameOverDialog } from '@/resources/pages/game/components/game-over-dialog.component';
import { Hud } from '@/resources/pages/game/components/hud.component';
import { ShopDialog } from '@/resources/pages/game/components/shop-dialog.component';
import { GamePage } from '@/resources/pages/game/game.page';

// jsdom nao tem WebGL
const { dispose } = vi.hoisted(() => ({ dispose: vi.fn() }));
vi.mock('@/app/engine/game-engine', () => ({
  createGameEngine: vi.fn(() => ({ dispose })),
}));

const HUD: HudData = {
  hp: 50,
  maxHp: 100,
  money: 250,
  room: 3,
  kills: 2,
  weaponId: 'pistol',
  ammo: 4,
};

describe('Hud', () => {
  it('mostra vida, sala, dinheiro e arma', () => {
    render(<Hud hud={HUD} />);
    expect(screen.getByRole('progressbar', { name: 'Vida' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByText('Sala 3')).toBeInTheDocument();
    expect(screen.getByText('$ 250')).toBeInTheDocument();
    expect(screen.getByText('Pistola x4')).toBeInTheDocument();
  });

  it('avisa quando nao ha arma', () => {
    render(<Hud hud={{ ...HUD, weaponId: null, ammo: 0 }} />);
    expect(screen.getByText('Sem arma')).toBeInTheDocument();
  });
});

describe('ShopDialog', () => {
  it('compra item que cabe no saldo e bloqueia o que nao cabe', async () => {
    const onBuy = vi.fn();
    render(
      <ShopDialog
        open
        money={250}
        onBuy={onBuy}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Escopeta/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Pistola/ }));

    expect(onBuy).toHaveBeenCalledWith('pistol');
  });

  it('Continuar fecha a loja', async () => {
    const onClose = vi.fn();
    render(
      <ShopDialog
        open
        money={0}
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
        money={0}
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText('Escolha o equipamento')).not.toBeInTheDocument();
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

  it('abre loja e game over conforme a tela do store', () => {
    render(<GamePage />);
    expect(screen.queryByText('Escolha o equipamento')).not.toBeInTheDocument();

    act(() => useGameStore.setState({ screen: 'shop' }));
    expect(screen.getByText('Escolha o equipamento')).toBeInTheDocument();

    act(() => useGameStore.setState({ screen: 'gameover' }));
    expect(screen.getByText('Contrato encerrado')).toBeInTheDocument();
  });
});
