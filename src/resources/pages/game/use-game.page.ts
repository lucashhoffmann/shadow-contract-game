import { useEffect, useRef, useState } from 'react';

import { createGameEngine } from '@/app/engine/game-engine';
import { renderWeaponPreviews } from '@/app/engine/weapon-preview';
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
  // fotos das armas para o HUD, tiradas uma vez por montagem
  const [previews] = useState(renderWeaponPreviews);

  // conta golpes levados: vida caiu desde o ultimo render
  const [damage, setDamage] = useState({ hp: hud.hp, hits: 0 });
  if (hud.hp !== damage.hp) {
    setDamage({
      hp: hud.hp,
      hits: damage.hits + (hud.hp < damage.hp ? 1 : 0),
    });
  }

  const restart = () => startRun();
  const legend =
    screen === 'paused'
      ? {
          title: 'Pausado',
          actionLabel: 'Continuar',
          onAction: togglePause,
          onRestart: restart,
        }
      : { title: 'Como jogar', actionLabel: 'Comecar', onAction: begin };

  return {
    canvasRef,
    screen,
    hud,
    hits: damage.hits,
    market,
    best,
    legend,
    previews,
    buy,
    closeShop,
    restart,
    backToMenu,
  };
}
