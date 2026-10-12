import { registerSW } from 'virtual:pwa-register';

import { useGameStore } from '@/app/store/game-store/game.store';

const CHECK_EVERY = 60 * 60 * 1000;

// Liga o service worker do app instalavel e mantem a versao em dia.
// Versao nova e baixada sozinha e aplicada sem perguntar, mas so com o
// jogador na tela inicial: recarregar no meio da partida jogaria a run fora.
export function setupPwa(): void {
  let waiting = false;
  const apply = () => {
    if (waiting && useGameStore.getState().screen === 'menu') {
      void updateServiceWorker(true);
    }
  };
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true;
      apply();
    },
    onRegisteredSW(_url, registration) {
      // procura versao nova ao voltar para o app e, aberto, de hora em hora
      const check = () => void registration?.update();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, CHECK_EVERY);
    },
  });
  // voltou para a tela inicial com versao esperando: aplica
  useGameStore.subscribe(apply);
}
