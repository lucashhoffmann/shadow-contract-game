import { useSyncExternalStore } from 'react';

// Oferta de instalar o jogo como app.
// Android/Chrome avisa com `beforeinstallprompt`, que pode chegar antes de a
// tela montar: por isso o evento e guardado aqui, no modulo. iPhone nao tem
// esse evento; la a instalacao e manual, pelo menu Compartilhar.

type InstallEvent = Event & { prompt: () => Promise<unknown> };

let pending: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // segura o aviso do navegador: quem oferece e o botao da tela inicial
    event.preventDefault();
    pending = event as InstallEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    pending = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ja aberto como app (tela cheia, sem navegador em volta)
function isInstalled(): boolean {
  return (
    (typeof matchMedia === 'function' &&
      matchMedia('(display-mode: standalone), (display-mode: fullscreen)')
        .matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstallApp() {
  const prompt = useSyncExternalStore(subscribe, () => pending);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    // 'prompt': da para instalar com um toque; 'ios': so com instrucao;
    // 'none': ja instalado, ou o navegador nao instala
    mode: isInstalled()
      ? ('none' as const)
      : prompt
        ? ('prompt' as const)
        : ios
          ? ('ios' as const)
          : ('none' as const),
    install: async () => {
      await pending?.prompt();
      // o aviso so vale uma vez
      pending = null;
      notify();
    },
  };
}
