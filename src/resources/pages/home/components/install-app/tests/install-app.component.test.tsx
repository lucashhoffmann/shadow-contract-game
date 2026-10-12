import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InstallApp } from '@/resources/pages/home/components/install-app/install-app.component';

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setUserAgent('jsdom');
  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });
});

describe('InstallApp', () => {
  it('sem aviso do navegador e fora do iPhone, nao oferece nada', () => {
    const { container } = render(<InstallApp />);
    expect(container).toBeEmptyDOMElement();
  });

  it('com o aviso do navegador, oferece o botao e instala no toque', async () => {
    render(<InstallApp />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt'), { prompt });
    const prevent = vi.spyOn(event, 'preventDefault');
    act(() => {
      window.dispatchEvent(event);
    });
    // o aviso padrao do navegador fica segurado
    expect(prevent).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Instalar app' }));

    expect(prompt).toHaveBeenCalled();
    // o aviso so vale uma vez: o botao some
    expect(
      screen.queryByRole('button', { name: 'Instalar app' }),
    ).not.toBeInTheDocument();
  });

  it('no iPhone mostra a instrucao manual', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    render(<InstallApp />);
    expect(
      screen.getByText(/Adicionar a\s+Tela de Inicio/),
    ).toBeInTheDocument();
  });

  it('ja instalado, nao oferece de novo', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: true,
    });
    const { container } = render(<InstallApp />);
    expect(container).toBeEmptyDOMElement();
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: undefined,
    });
  });
});
