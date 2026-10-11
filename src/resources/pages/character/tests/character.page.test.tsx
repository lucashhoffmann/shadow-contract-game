import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_LOOK, useGameStore } from '@/app/store/game-store/game.store';
import { CharacterPage } from '@/resources/pages/character/character.page';

// jsdom nao tem WebGL
const { setLook, dispose } = vi.hoisted(() => ({
  setLook: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock('@/app/engine/character-preview', () => ({
  createCharacterPreview: vi.fn(() => ({ setLook, dispose })),
}));

beforeEach(() => {
  setLook.mockClear();
  dispose.mockClear();
  useGameStore.getState().backToMenu();
  useGameStore.getState().openCharacter();
  useGameStore.setState({ look: DEFAULT_LOOK });
});

describe('CharacterPage', () => {
  it('desenha o look atual no preview ao abrir', () => {
    render(<CharacterPage />);
    expect(setLook).toHaveBeenLastCalledWith(DEFAULT_LOOK);
  });

  it('mudar cor e tamanho grava no store e redesenha o preview', () => {
    render(<CharacterPage />);
    fireEvent.change(screen.getByLabelText('Roupa'), {
      target: { value: '#00ff00' },
    });
    fireEvent.change(screen.getByLabelText('Cabeca'), {
      target: { value: '1.3' },
    });

    const look = { ...DEFAULT_LOOK, cloth: '#00ff00', head: 1.3 };
    expect(useGameStore.getState().look).toEqual(look);
    expect(setLook).toHaveBeenLastCalledWith(look);
  });

  it('Restaurar padrao desfaz a customizacao', async () => {
    useGameStore.setState({ look: { ...DEFAULT_LOOK, legs: 1.4 } });
    render(<CharacterPage />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Restaurar padrao' }),
    );
    expect(useGameStore.getState().look).toEqual(DEFAULT_LOOK);
  });

  it('Voltar retorna ao menu e libera o preview', async () => {
    const { unmount } = render(<CharacterPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(useGameStore.getState().screen).toBe('menu');

    unmount();
    expect(dispose).toHaveBeenCalled();
  });
});
