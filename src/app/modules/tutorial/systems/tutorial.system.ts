import type { World } from '@/app/modules/world/types/world.types';

// Tutorial guiado da primeira run: cada passo pede uma acao e so avanca quando
// o `World` mostra que ela aconteceu. Regra pura: a UI so pergunta
// `nextTutorialStep` de tempos em tempos e desenha o cartao do passo atual.

export const TUTORIAL_STEPS = [
  // tela de boas-vindas, antes de soltar a simulacao
  'welcome',
  'move',
  'crouch',
  'dash',
  // atravessar a porta da sala inicial
  'door',
  // eliminar um inimigo por tras
  'kill',
  // pegar o ouro que ele soltou
  'loot',
  'done',
] as const;

export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

// quanto o player precisa andar, em tiles, para contar como "sabe mover"
const MOVE_DISTANCE = 2;

function moved(world: World): boolean {
  const { pos } = world.player;
  const { checkpoint } = world.run;
  return Math.hypot(pos.x - checkpoint.x, pos.y - checkpoint.y) > MOVE_DISTANCE;
}

// o passo esta cumprido neste `World`?
function stepDone(world: World, step: TutorialStep): boolean {
  switch (step) {
    case 'welcome':
      return world.status !== 'intro';
    case 'move':
      return moved(world);
    case 'crouch':
      return world.player.crouching;
    case 'dash':
      return world.player.dash > 0;
    case 'door':
      return world.run.roomIndex >= 1;
    case 'kill':
      return world.run.kills >= 1;
    case 'loot':
      return world.player.money > 0;
    case 'done':
      return false;
  }
}

// avanca todos os passos ja cumpridos (um golpe pode cumprir varios de uma vez)
export function nextTutorialStep(
  world: World,
  step: TutorialStep,
): TutorialStep {
  let current = step;
  while (stepDone(world, current)) {
    current = TUTORIAL_STEPS[TUTORIAL_STEPS.indexOf(current) + 1];
  }
  return current;
}
