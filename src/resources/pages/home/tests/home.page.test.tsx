import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DEFAULT_BLOOD_COLOR,
  useGameStore,
} from '@/app/store/game-store/game.store';
import { HomePage } from '@/resources/pages/home/home.page';

// servidor de salas: cada teste diz se esta no ar
const { pingServer } = vi.hoisted(() => ({ pingServer: vi.fn() }));
vi.mock('@/app/net/session.client', () => ({ pingServer }));

beforeEach(() => {
  pingServer.mockResolvedValue(false);
  useGameStore.getState().backToMenu();
  useGameStore.setState({ best: 0, bloodColor: DEFAULT_BLOOD_COLOR });
});

describe('HomePage', () => {
  it('rodape credita o autor com link para o GitHub', () => {
    render(<HomePage />);
    expect(screen.getByRole('link', { name: 'Hoffmann' })).toHaveAttribute(
      'href',
      'https://github.com/lucashhoffmann/',
    );
  });

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

describe('multiplayer na home', () => {
  it('sem servidor de salas, o botao nao aparece', async () => {
    render(<HomePage />);
    await vi.waitFor(() => expect(pingServer).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Multiplayer' })).toBeNull();
  });

  it('com o servidor no ar, aparece e abre a sala de espera', async () => {
    pingServer.mockResolvedValue(true);
    render(<HomePage />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Multiplayer' }),
    );
    expect(useGameStore.getState().screen).toBe('lobby');
  });
});
