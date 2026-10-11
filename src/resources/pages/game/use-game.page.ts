import { useEffect, useRef } from 'react';

import { createGameEngine } from '@/app/engine/game-engine';
import { useGameStore } from '@/app/store/game-store/game.store';

export function useGamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screen = useGameStore((state) => state.screen);
  const hud = useGameStore((state) => state.hud);
  const best = useGameStore((state) => state.best);
  const buy = useGameStore((state) => state.buy);
  const closeShop = useGameStore((state) => state.closeShop);
  const startRun = useGameStore((state) => state.startRun);
  const backToMenu = useGameStore((state) => state.backToMenu);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createGameEngine(canvasRef.current);
    return () => engine.dispose();
  }, []);

  return {
    canvasRef,
    screen,
    hud,
    best,
    buy,
    closeShop,
    restart: () => startRun(),
    backToMenu,
  };
}
