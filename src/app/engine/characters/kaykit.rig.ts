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
    idle: { name: 'Idle_A' },
    move: { name: 'Running_A' },
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
    spin: { name: 'Melee_2H_Attack_Spin', from: 0.2, to: 0.75 },
    // corpo encolhido, parado nesse quadro: quem gira e o `roll`
    dash: { name: 'Crouching', from: 0.3, to: 0.3 },
    shot: { name: 'Ranged_1H_Shoot', to: 0.6 },
    death: { name: 'Death_A' },
  },
};
