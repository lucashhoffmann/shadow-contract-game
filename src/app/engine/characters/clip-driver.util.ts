import type { CharacterPose } from '@/app/engine/characters/character-view.types';

// Decide que clipes de animacao tocam, com que peso e em que ponto, a partir
// da pose do quadro. Conta pura, sem three: e a regra que se testa.

// trecho de um clipe: `from` e `to` sao fracoes dele (0 a 1), para cortar o
// preparo ou a volta que nao cabem no tempo da acao
export type ClipRef = { name: string; from?: number; to?: number };

// os clipes de um esqueleto para cada coisa que o personagem faz
export type ClipSet = {
  idle: ClipRef;
  move: ClipRef;
  // parado e andando agachado; sem eles vale idle e move
  crouch?: ClipRef;
  sneak?: ClipRef;
  // um por jeito de golpear; `pose.swing` escolhe
  attacks: ClipRef[];
  spin?: ClipRef;
  dash?: ClipRef;
  shot?: ClipRef;
  death: ClipRef;
};

export type ClipCommand = {
  name: string;
  weight: number;
  // segundos dentro do clipe; null = ciclo, corre no tempo de quem anima
  time: number | null;
  // so essa metade do corpo; sem isto, o corpo inteiro
  part?: 'upper' | 'lower';
};

const at = (ref: ClipRef, phase: number, duration: number) => {
  const from = ref.from ?? 0;
  const to = ref.to ?? 1;
  return (from + Math.min(1, Math.max(0, phase)) * (to - from)) * duration;
};

// todos os clipes que o conjunto usa, sem repetir
export function clipNames(set: ClipSet): string[] {
  const refs = [
    set.idle,
    set.move,
    set.crouch,
    set.sneak,
    ...set.attacks,
    set.spin,
    set.dash,
    set.shot,
    set.death,
  ];
  return [...new Set(refs.flatMap((ref) => (ref ? [ref.name] : [])))];
}

// `deadFor`: segundos desde que morreu. `duration`: tamanho do clipe.
// `split`: o esqueleto sabe separar pernas de tronco; ai o tiro pega so o
// tronco e as pernas seguem andando.
// Clipe fora da lista devolvida fica com peso 0.
export function driveClips(
  set: ClipSet,
  pose: CharacterPose,
  deadFor: number,
  duration: (name: string) => number,
  split = false,
): ClipCommand[] {
  const once = (ref: ClipRef, phase: number): ClipCommand[] => [
    { name: ref.name, weight: 1, time: at(ref, phase, duration(ref.name)) },
  ];
  if (pose.dead) {
    // cai uma vez e fica no ultimo quadro
    const span =
      ((set.death.to ?? 1) - (set.death.from ?? 0)) * duration(set.death.name);
    return once(set.death, span > 0 ? deadFor / span : 1);
  }
  // acao pontual toma o corpo inteiro; o golpe vale mais que o resto
  if (pose.attack !== null && set.attacks.length > 0) {
    const swing =
      set.attacks[Math.abs(Math.trunc(pose.swing)) % set.attacks.length];
    return once(pose.spinning && set.spin ? set.spin : swing, pose.attack);
  }
  if (pose.dash !== null && set.dash) return once(set.dash, pose.dash);

  const moving = Math.min(1, Math.max(0, pose.moving));
  const still = (pose.crouching && set.crouch) || set.idle;
  const going = (pose.crouching && set.sneak) || set.move;
  const cycles: ClipCommand[] = [
    { name: still.name, weight: 1 - moving, time: null },
    { name: going.name, weight: moving, time: null },
  ];
  if (pose.shot === null || !set.shot) return cycles;
  // apontando ou atirando. Sem separar o corpo, o clipe de tiro toma tudo e
  // as pernas param; separando, ele fica no tronco e as pernas seguem o passo
  const [shot] = once(set.shot, pose.shot);
  if (!split) return [shot];
  return [
    ...cycles.map((cycle) => ({ ...cycle, part: 'lower' as const })),
    { ...shot, part: 'upper' },
  ];
}

// os clipes que o tiro separado usa em cada metade do corpo
export function splitClipNames(set: ClipSet): {
  upper: string[];
  lower: string[];
} {
  const names = (refs: (ClipRef | undefined)[]) => [
    ...new Set(refs.flatMap((ref) => (ref ? [ref.name] : []))),
  ];
  return {
    upper: names([set.shot]),
    lower: set.shot ? names([set.idle, set.move, set.crouch, set.sneak]) : [],
  };
}
