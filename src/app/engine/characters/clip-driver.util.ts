import type { CharacterPose } from '@/app/engine/characters/character-view.types';

// Decide que clipes de animacao tocam, com que peso e em que ponto, a partir
// da pose do quadro. Conta pura, sem three: e a regra que se testa.

// trecho de um clipe: `from` e `to` sao fracoes dele (0 a 1), para cortar o
// preparo ou a volta que nao cabem no tempo da acao
export type ClipRef = { name: string; from?: number; to?: number };
// um clipe, ou varios para variar de personagem para personagem
type Many = ClipRef | ClipRef[];

// Os clipes de um esqueleto para cada coisa que o personagem faz. So `idle`,
// `move`, `attacks` e `death` sao obrigatorios; o resto enriquece.
export type ClipSet = {
  idle: Many;
  // correndo
  move: Many;
  // andando devagar; sem ele, parado mistura direto com correndo
  walk?: Many;
  // parado e andando agachado; sem eles vale idle e move
  crouch?: ClipRef;
  sneak?: ClipRef;
  // um por jeito de golpear; `pose.swing` escolhe
  attacks: ClipRef[];
  // golpes de outro estilo de arma (`pose.style`)
  attackStyles?: Record<string, ClipRef[]>;
  spin?: ClipRef;
  spinStyles?: Record<string, ClipRef>;
  dash?: ClipRef;
  // disparo e mira; os `Styles` trocam por estilo de arma
  shot?: ClipRef;
  shotStyles?: Record<string, ClipRef>;
  aim?: ClipRef;
  aimStyles?: Record<string, ClipRef>;
  throw?: ClipRef;
  // reacao a golpe levado, e ao golpe que o escudo segurou
  hits?: ClipRef[];
  block?: ClipRef;
  taunt?: ClipRef;
  emotes?: Record<string, ClipRef>;
  death: Many;
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

const list = (many: Many | undefined): ClipRef[] =>
  many === undefined ? [] : Array.isArray(many) ? many : [many];
// variacao do personagem: sempre a mesma para o mesmo `variant`
const pick = (many: Many, variant: number): ClipRef => {
  const options = list(many);
  return options[Math.abs(Math.trunc(variant)) % options.length];
};
const names = (refs: (ClipRef | undefined)[]) => [
  ...new Set(refs.flatMap((ref) => (ref ? [ref.name] : []))),
];
const styled = <T>(styles?: Record<string, T>): T[] =>
  styles ? Object.values(styles) : [];

// clipes que so pegam o tronco (por cima do passo) e os que so pegam as
// pernas, quando o esqueleto separa o corpo
function halves(set: ClipSet): { upper: ClipRef[]; lower: ClipRef[] } {
  const upper = [
    set.shot,
    ...styled(set.shotStyles),
    set.aim,
    ...styled(set.aimStyles),
    ...(set.hits ?? []),
    set.block,
  ].flatMap((ref) => (ref ? [ref] : []));
  return {
    upper,
    lower:
      upper.length > 0
        ? [
            ...list(set.idle),
            ...list(set.move),
            ...list(set.walk),
            ...list(set.crouch),
            ...list(set.sneak),
          ]
        : [],
  };
}

// todos os clipes que o conjunto usa, sem repetir
export function clipNames(set: ClipSet): string[] {
  return names([
    ...list(set.idle),
    ...list(set.move),
    ...list(set.walk),
    set.crouch,
    set.sneak,
    ...set.attacks,
    ...styled(set.attackStyles).flat(),
    set.spin,
    ...styled(set.spinStyles),
    set.dash,
    set.throw,
    set.taunt,
    ...styled(set.emotes),
    ...halves(set).upper,
    ...list(set.death),
  ]);
}

// os clipes usados em cada metade do corpo
export function splitClipNames(set: ClipSet): {
  upper: string[];
  lower: string[];
} {
  const { upper, lower } = halves(set);
  return { upper: names(upper), lower: names(lower) };
}

// `deadFor`: segundos desde que morreu. `duration`: tamanho do clipe.
// `split`: o esqueleto sabe separar pernas de tronco; ai mira, tiro e reacao
// a golpe pegam so o tronco e as pernas seguem andando.
// Clipe fora da lista devolvida fica com peso 0.
export function driveClips(
  set: ClipSet,
  pose: CharacterPose,
  deadFor: number,
  duration: (name: string) => number,
  split = false,
): ClipCommand[] {
  const variant = pose.variant ?? 0;
  const style = pose.style ?? '';
  const once = (ref: ClipRef, phase: number): ClipCommand => ({
    name: ref.name,
    weight: 1,
    time: at(ref, phase, duration(ref.name)),
  });

  // --- corpo inteiro, uma coisa de cada vez
  if (pose.dead) {
    // cai uma vez e fica no ultimo quadro
    const death = pick(set.death, variant);
    const span = ((death.to ?? 1) - (death.from ?? 0)) * duration(death.name);
    return [once(death, span > 0 ? deadFor / span : 1)];
  }
  const emote = pose.emote && set.emotes?.[pose.emote.name];
  if (pose.emote && emote) return [once(emote, pose.emote.phase)];
  if (pose.taunt != null && set.taunt) return [once(set.taunt, pose.taunt)];
  // o golpe vale mais que o resto do combate
  const attacks = set.attackStyles?.[style] ?? set.attacks;
  if (pose.attack !== null && attacks.length > 0) {
    const swing = attacks[Math.abs(Math.trunc(pose.swing)) % attacks.length];
    const spin = set.spinStyles?.[style] ?? set.spin;
    return [once(pose.spinning && spin ? spin : swing, pose.attack)];
  }
  if (pose.throwing != null && set.throw) {
    return [once(set.throw, pose.throwing)];
  }
  if (pose.dash !== null && set.dash) return [once(set.dash, pose.dash)];

  // --- passo: parado, andando, correndo (ou agachado)
  const moving = Math.min(1, Math.max(0, pose.moving));
  const blend = (
    still: ClipRef,
    going: ClipRef,
    amount: number,
  ): ClipCommand[] => [
    { name: still.name, weight: 1 - amount, time: null },
    { name: going.name, weight: amount, time: null },
  ];
  let cycles: ClipCommand[];
  if (pose.crouching && (set.crouch || set.sneak)) {
    cycles = blend(
      set.crouch ?? pick(set.idle, variant),
      set.sneak ?? pick(set.move, variant),
      moving,
    );
  } else if (set.walk && moving <= 0.5) {
    // ate a metade do caminho, parado vira andando
    cycles = blend(
      pick(set.idle, variant),
      pick(set.walk, variant),
      moving * 2,
    );
  } else if (set.walk) {
    // dai em diante, andando vira correndo
    cycles = blend(
      pick(set.walk, variant),
      pick(set.move, variant),
      moving * 2 - 1,
    );
  } else {
    cycles = blend(pick(set.idle, variant), pick(set.move, variant), moving);
  }

  // --- por cima do passo: reacao a golpe, disparo, mira
  let overlay: ClipCommand | null = null;
  const struck = pose.blocked
    ? (set.block ?? (set.hits && pick(set.hits, variant)))
    : set.hits && pick(set.hits, variant);
  const shot = set.shotStyles?.[style] ?? set.shot;
  const aim = set.aimStyles?.[style] ?? set.aim;
  if (pose.hit != null && struck) overlay = once(struck, pose.hit);
  else if (pose.shot !== null && shot) overlay = once(shot, pose.shot);
  else if (pose.aiming && aim) {
    overlay = { name: aim.name, weight: 1, time: null };
  } else if (pose.aiming && shot) {
    // sem clipe de mira: fica no comeco do de tiro, ja de arma erguida
    overlay = once(shot, 0);
  }
  if (!overlay) return cycles;
  // sem separar o corpo, o que vem por cima toma tudo e as pernas param
  if (!split) return [overlay];
  return [
    ...cycles.map((cycle) => ({ ...cycle, part: 'lower' as const })),
    { ...overlay, part: 'upper' },
  ];
}
