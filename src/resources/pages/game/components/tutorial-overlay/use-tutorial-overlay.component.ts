import { useEffect, useState } from 'react';

import {
  nextTutorialStep,
  type TutorialStep,
} from '@/app/modules/tutorial/systems/tutorial.system';
import { getWorld, useGameStore } from '@/app/store/game-store/game.store';

// de quanto em quanto tempo confere o World (posicao e agachar nao passam
// pelo hud, entao nao da para assinar o store)
const POLL_EVERY = 150;

export function useTutorialOverlay() {
  const active = useGameStore((state) => state.tutorial);
  const screen = useGameStore((state) => state.screen);
  const begin = useGameStore((state) => state.begin);
  const finishTutorial = useGameStore((state) => state.finishTutorial);
  const backToMenu = useGameStore((state) => state.backToMenu);
  const startRun = useGameStore((state) => state.startRun);
  // o passo volta ao comeco toda vez que um tutorial (re)comeca
  const [state, setState] = useState({
    active,
    step: 'welcome' as TutorialStep,
  });
  if (state.active !== active) setState({ active, step: 'welcome' });
  const step = state.step;

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const world = getWorld();
      if (!world) return;
      setState((current) => {
        const next = nextTutorialStep(world, current.step);
        return next === current.step ? current : { ...current, step: next };
      });
    }, POLL_EVERY);
    return () => clearInterval(timer);
  }, [active]);

  const touch =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  return {
    // so por cima do jogo: pausa, loja e derrota tem as proprias telas
    open: active && (screen === 'intro' || screen === 'playing'),
    step,
    touch,
    // boas-vindas solta a simulacao
    begin,
    // pular: o guia some e a run (controlada) segue ate o jogador sair
    skip: finishTutorial,
    // fim: volta ao menu ou ja comeca uma run de verdade
    menu: backToMenu,
    play: () => startRun(),
  };
}
