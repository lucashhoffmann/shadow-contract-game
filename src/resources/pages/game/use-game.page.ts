import { useEffect, useRef } from 'react';

import { createGameEngine } from '@/app/engine/game-engine';
import { useGameStore } from '@/app/store/game-store/game.store';

export function useGamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screen = useGameStore((state) => state.screen);
  const hud = useGameStore((state) => state.hud);
  const market = useGameStore((state) => state.market);
  const best = useGameStore((state) => state.best);
  const buy = useGameStore((state) => state.buy);
  const closeShop = useGameStore((state) => state.closeShop);
  const startRun = useGameStore((state) => state.startRun);
  const begin = useGameStore((state) => state.begin);
  const togglePause = useGameStore((state) => state.togglePause);
  const backToMenu = useGameStore((state) => state.backToMenu);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createGameEngine(canvasRef.current);
    return () => engine.dispose();
  }, []);

  // a mesma legenda serve de abertura da run e de tela de pausa
  const legend =
    screen === 'paused'
      ? { title: 'Pausado', actionLabel: 'Continuar', onAction: togglePause }
      : { title: 'Como jogar', actionLabel: 'Comecar', onAction: begin };

  return {
    canvasRef,
    screen,
    hud,
    market,
    best,
    legend,
    buy,
    closeShop,
    restart: () => startRun(),
    backToMenu,
  };
}
