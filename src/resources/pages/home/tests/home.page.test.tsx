import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useGameStore } from '@/app/store/game-store/game.store';
import { HomePage } from '@/resources/pages/home/home.page';

beforeEach(() => {
  useGameStore.getState().backToMenu();
  useGameStore.setState({ best: 0 });
});

describe('HomePage', () => {
  it('mostra o recorde salvo', () => {
    useGameStore.setState({ best: 9 });
    render(<HomePage />);
    expect(screen.getByText('Recorde: sala 9')).toBeInTheDocument();
  });

  it('Play inicia uma run', async () => {
    render(<HomePage />);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(useGameStore.getState().screen).toBe('playing');
  });
});
