import type { RigSpec } from '@/app/engine/characters/gltf-character.view';

// Esqueleto "Rig_Medium" dos pacotes KayKit (Kay Lousberg, CC0): Adventurers,
// Skeletons e os demais personagens medios usam os mesmos ossos, entao todos
// servem com este mesmo `RigSpec` e o mesmo arquivo de clipes.
// Os clipes daqui tem que existir em public/models/kaykit/medium.anims.glb
// (scripts/pack-kaykit.mjs); tests/kaykit.assets.test.ts confere.

export const KAYKIT_CLIPS_URL = '/models/kaykit/medium.anims.glb';

export const KAYKIT_MEDIUM: RigSpec = {
  // o modelo tem ~2.2 de altura; os personagens do jogo, ~1.45
  scale: 0.66,
  // glTF olha para +z; o jogo usa +x como frente
  turn: Math.PI / 2,
  slots: { rightHand: 'handslot.r', leftHand: 'handslot.l' },
  // medido nas poses de mira (Ranged_1H_Aiming, Ranged_2H_Aiming e
  // Ranged_Bow_Aiming_Idle): a frente e o topo do mundo nos eixos da mao
  grips: {
    '': { slot: 'rightHand', forward: [1, 0, 0], up: [0, 1, 0] },
    crossbow: { slot: 'rightHand', forward: [0.61, 0, 0.79], up: [0, 1, 0] },
    // o arco vai na esquerda; a direita puxa a corda
    bow: { slot: 'leftHand', forward: [-0.7, 0.71, 0], up: [0, 0, 1] },
  },
  roll: { turns: 1, height: 0.7, pivot: 0.6 },
  lower: [
    'root',
    'hips',
    ...['upperleg', 'lowerleg', 'foot', 'toes'].flatMap((bone) => [
      `${bone}.l`,
      `${bone}.r`,
    ]),
  ],
  clips: {
    // variacoes: cada personagem pega uma, pelo `variant` dele
    idle: [{ name: 'Idle_A' }, { name: 'Idle_B' }],
    walk: [{ name: 'Walking_A' }, { name: 'Walking_B' }, { name: 'Walking_C' }],
    move: [{ name: 'Running_A' }, { name: 'Running_B' }],
    crouch: { name: 'Crouching' },
    sneak: { name: 'Sneaking' },
    // Os clipes de golpe duram mais de 1 s e o golpe do jogo, bem menos: o
    // trecho escolhido e so o corte, sem o preparo longo nem a volta
    attacks: [
      { name: 'Melee_1H_Attack_Slice_Diagonal', from: 0.15, to: 0.7 },
      { name: 'Melee_1H_Attack_Slice_Horizontal', from: 0.15, to: 0.7 },
      { name: 'Melee_1H_Attack_Chop', from: 0.15, to: 0.7 },
      { name: 'Melee_1H_Attack_Stab', from: 0.15, to: 0.7 },
    ],
    // estilo do que esta na mao (`pose.style`): arma de estocar (adaga,
    // varinha), de talhar (machado) e de duas maos (montante, cajado)
    attackStyles: {
      stab: [
        { name: 'Melee_1H_Attack_Stab', from: 0.15, to: 0.7 },
        { name: 'Melee_1H_Attack_Slice_Diagonal', from: 0.15, to: 0.7 },
      ],
      chop: [
        { name: 'Melee_1H_Attack_Chop', from: 0.15, to: 0.7 },
        { name: 'Melee_1H_Attack_Slice_Horizontal', from: 0.15, to: 0.7 },
      ],
      two: [
        { name: 'Melee_2H_Attack_Slice', from: 0.15, to: 0.75 },
        { name: 'Melee_2H_Attack_Chop', from: 0.2, to: 0.7 },
        { name: 'Melee_2H_Attack_Stab', from: 0.15, to: 0.7 },
      ],
    },
    // golpe de salto: o giro; com arma de uma mao leve, o talho pulando
    spin: { name: 'Melee_2H_Attack_Spin', from: 0.2, to: 0.75 },
    spinStyles: {
      stab: { name: 'Melee_1H_Attack_Jump_Chop', from: 0.1, to: 0.75 },
      chop: { name: 'Melee_1H_Attack_Jump_Chop', from: 0.1, to: 0.75 },
    },
    // corpo encolhido, parado nesse quadro: quem gira e o `roll`
    dash: { name: 'Crouching', from: 0.3, to: 0.3 },
    // mira e disparo, por tipo de arma de alcance. Sem estilo: arma de uma
    // mao. `bow`: o arco vai na mao esquerda e a direita puxa a corda
    aim: { name: 'Ranged_1H_Aiming' },
    shot: { name: 'Ranged_1H_Shoot', to: 0.6 },
    aimStyles: {
      bow: { name: 'Ranged_Bow_Aiming_Idle' },
      crossbow: { name: 'Ranged_2H_Aiming' },
    },
    shotStyles: {
      bow: { name: 'Ranged_Bow_Release', to: 0.5 },
      crossbow: { name: 'Ranged_2H_Shoot', to: 0.6 },
    },
    throw: { name: 'Throw', from: 0.25, to: 0.75 },
    hits: [{ name: 'Hit_A' }, { name: 'Hit_B' }],
    block: { name: 'Melee_Block_Hit', to: 0.6 },
    emotes: { cheer: { name: 'Cheering' }, wave: { name: 'Waving' } },
    death: [{ name: 'Death_A' }, { name: 'Death_B' }],
  },
};

// Esqueletos (KayKit Skeletons): o mesmo esqueleto e os mesmos clipes, com o
// jeito proprio de ficar parado, andar e desabar, e um grito de desafio.
export const KAYKIT_SKELETON: RigSpec = {
  ...KAYKIT_MEDIUM,
  clips: {
    ...KAYKIT_MEDIUM.clips,
    idle: { name: 'Skeletons_Idle' },
    walk: { name: 'Skeletons_Walking' },
    death: { name: 'Skeletons_Death' },
    taunt: { name: 'Skeletons_Taunt' },
  },
};
