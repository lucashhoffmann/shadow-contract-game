import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DEFAULT_BLOOD_COLOR,
  useGameStore,
} from '@/app/store/game-store/game.store';
import { HomePage } from '@/resources/pages/home/home.page';

beforeEach(() => {
  useGameStore.getState().backToMenu();
  useGameStore.setState({ best: 0, bloodColor: DEFAULT_BLOOD_COLOR });
});

describe('HomePage', () => {
  it('mostra o recorde salvo', () => {
    useGameStore.setState({ best: 9 });
    render(<HomePage />);
    expect(screen.getByText('Recorde: sala 9')).toBeInTheDocument();
  });

  it('Play inicia uma run, que abre na legenda', async () => {
    render(<HomePage />);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(useGameStore.getState().screen).toBe('intro');
  });

  it('Configurar personagem abre a tela de personagem', async () => {
    render(<HomePage />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Configurar personagem' }),
    );
    expect(useGameStore.getState().screen).toBe('character');
  });

  it('configuracoes permitem escolher a cor do sangue', async () => {
    render(<HomePage />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Configurações' }),
    );
    fireEvent.change(screen.getByLabelText('Cor do sangue'), {
      target: { value: '#22aa44' },
    });
    expect(useGameStore.getState().bloodColor).toBe('#22aa44');
  });
});
