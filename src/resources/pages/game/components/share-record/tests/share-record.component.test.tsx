import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ShareRecord } from '@/resources/pages/game/components/share-record/share-record.component';

// jsdom nao tem canvas 2D: um contexto que aceita qualquer chamada, e um PNG
// de mentira no lugar do toBlob
function fakeCanvas() {
  const calls: string[] = [];
  const context = new Proxy(
    {},
    {
      get: (_target, name: string) =>
        name === 'measureText'
          ? () => ({ width: 100 })
          : name === 'createLinearGradient'
            ? () => ({ addColorStop: () => undefined })
            : (...args: unknown[]) => {
                if (name === 'fillText') calls.push(String(args[0]));
              },
      set: () => true,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    function (callback) {
      callback(new Blob(['png'], { type: 'image/png' }));
    },
  );
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe('ShareRecord', () => {
  it('desenha o cartao com o nome do jogo e o recorde e abre o compartilhamento', async () => {
    const drawn = fakeCanvas();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { canShare: () => true, share });
    render(
      <ShareRecord
        best={12}
        room={9}
        kills={7}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Compartilhar recorde' }),
    );

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(drawn).toEqual(
      expect.arrayContaining(['SHADOW', 'CONTRACT', 'SALA 12']),
    );
    expect(drawn.join(' ')).toContain('sala 9, 7 eliminados');
    const { files, text } = share.mock.calls[0][0];
    expect(files[0].name).toBe('shadow-contract-recorde.png');
    expect(files[0].type).toBe('image/png');
    expect(text).toContain('sala 12');
  });

  it('sem compartilhamento de arquivo, baixa o PNG', async () => {
    fakeCanvas();
    Object.assign(navigator, { canShare: () => false, share: vi.fn() });
    URL.createObjectURL = vi.fn(() => 'blob:card');
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(
      <ShareRecord
        best={3}
        room={3}
        kills={1}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Compartilhar recorde' }),
    );

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it('fechar a folha de compartilhamento sem escolher nao da erro', async () => {
    fakeCanvas();
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('cancelado', 'AbortError'));
    Object.assign(navigator, { canShare: () => true, share });
    render(
      <ShareRecord
        best={3}
        room={3}
        kills={0}
      />,
    );
    const button = screen.getByRole('button', { name: 'Compartilhar recorde' });

    await userEvent.click(button);

    await waitFor(() => expect(share).toHaveBeenCalled());
    await waitFor(() => expect(button).toBeEnabled());
  });
});
