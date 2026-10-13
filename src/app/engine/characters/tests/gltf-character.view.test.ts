import * as THREE from 'three';

import type { CharacterPose } from '@/app/engine/characters/character-view.types';
import {
  createGltfCharacterView,
  type RigSpec,
} from '@/app/engine/characters/gltf-character.view';

// Modelo de mentira no formato que o carregador de glTF entrega: um osso que
// os clipes mexem, um ponto de mao e uma malha.
function model() {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'hips';
  const hand = new THREE.Bone();
  // o carregador ja tirou o ponto de 'handslot.r'
  hand.name = 'handslotr';
  hips.add(hand);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x336699 }),
  );
  mesh.name = 'skin';
  root.add(hips, mesh);
  return root;
}

// clipe de `seconds` que leva hips.x de 0 a `reach`, em linha
const slide = (name: string, seconds: number, reach: number) =>
  new THREE.AnimationClip(name, seconds, [
    new THREE.VectorKeyframeTrack(
      'hips.position',
      [0, seconds],
      [0, 0, 0, reach, 0, 0],
    ),
  ]);
const CLIPS = [
  slide('idle', 1, 0),
  slide('run', 1, 10),
  slide('slash', 2, 4),
  slide('death', 2, -8),
];
const RIG: RigSpec = {
  scale: 0.5,
  turn: Math.PI / 2,
  slots: { rightHand: 'handslot.r' },
  clips: {
    idle: { name: 'idle' },
    move: { name: 'run' },
    attacks: [{ name: 'slash' }],
    // nao existe em CLIPS
    dash: { name: 'missing' },
    death: { name: 'death' },
  },
};
const REST: CharacterPose = {
  moving: 0,
  crouching: false,
  attack: null,
  dash: null,
  shot: null,
  swing: 0,
  spinning: false,
  dead: false,
};
const hipsX = (view: ReturnType<typeof createGltfCharacterView>) =>
  view.object.getObjectByName('hips')!.position.x;

describe('createGltfCharacterView', () => {
  it('copia o modelo, ajusta escala e frente, e nao mexe no original', () => {
    const source = model();
    const view = createGltfCharacterView(source, CLIPS, RIG);
    const body = view.object.children[0].children[0];
    expect(body).not.toBe(source);
    expect(body.scale.x).toBe(0.5);
    expect(body.rotation.y).toBe(Math.PI / 2);
    view.pose({ ...REST, attack: 0.5 }, 0.016);
    expect(source.getObjectByName('hips')!.position.x).toBe(0);
  });

  it('acao pontual fica no ponto que a fase manda, sem andar sozinha', () => {
    const view = createGltfCharacterView(model(), CLIPS, RIG);
    view.pose({ ...REST, attack: 0.5 }, 0.016);
    expect(hipsX(view)).toBeCloseTo(2);
    // o tempo passa e a fase nao muda: o corpo nao sai do lugar
    view.pose({ ...REST, attack: 0.5 }, 0.5);
    expect(hipsX(view)).toBeCloseTo(2);
    view.pose({ ...REST, attack: 1 }, 0.016);
    expect(hipsX(view)).toBeCloseTo(4);
  });

  it('ciclo anda no tempo do quadro', () => {
    const view = createGltfCharacterView(model(), CLIPS, RIG);
    view.pose({ ...REST, moving: 1 }, 0.25);
    expect(hipsX(view)).toBeCloseTo(2.5);
    view.pose({ ...REST, moving: 1 }, 0.25);
    expect(hipsX(view)).toBeCloseTo(5);
  });

  it('morte cai uma vez e trava no fim; voltar a viver recomeca', () => {
    const view = createGltfCharacterView(model(), CLIPS, RIG);
    view.pose({ ...REST, dead: true }, 1);
    expect(hipsX(view)).toBeCloseTo(-4);
    view.pose({ ...REST, dead: true }, 30);
    expect(hipsX(view)).toBeCloseTo(-8);
    view.pose(REST, 0.016);
    view.pose({ ...REST, dead: true }, 0.5);
    expect(hipsX(view)).toBeCloseTo(-2);
  });

  it('clipe que falta no arquivo nao quebra: a acao so nao aparece', () => {
    const view = createGltfCharacterView(model(), CLIPS, RIG);
    expect(() => view.pose({ ...REST, dash: 0.5 }, 0.016)).not.toThrow();
  });

  it('`slot` acha o osso pelo nome do arquivo, ou devolve null', () => {
    const view = createGltfCharacterView(model(), CLIPS, RIG);
    expect(view.slot('rightHand')?.name).toBe('handslotr');
    expect(view.slot('leftHand')).toBeNull();
  });

  it('destaque pinta so este corpo e volta ao normal', () => {
    const source = model();
    const [first, second] = [0, 1].map(() =>
      createGltfCharacterView(source, CLIPS, RIG),
    );
    const glow = (view: typeof first) =>
      (
        (view.object.getObjectByName('skin') as THREE.Mesh)
          .material as THREE.MeshToonMaterial
      ).emissive.getHex();
    first.highlight(0xff0000);
    expect(glow(first)).toBe(0xff0000);
    expect(glow(second)).toBe(0);
    first.highlight(null);
    expect(glow(first)).toBe(0);
  });

  it('cambalhota: no salto o corpo da a volta inteira e sobe no meio', () => {
    const rig = { ...RIG, roll: { turns: 1, height: 0.7, pivot: 0.6 } };
    const view = createGltfCharacterView(model(), CLIPS, rig);
    const tumble = view.object.children[0];
    view.pose(REST, 0.016);
    expect(tumble.rotation.z).toBe(0);
    expect(tumble.position.y).toBeCloseTo(0.6);

    view.pose({ ...REST, dash: 0.5 }, 0.016);
    // meia volta para frente, no ponto mais alto
    expect(tumble.rotation.z).toBeCloseTo(-Math.PI);
    expect(tumble.position.y).toBeCloseTo(1.3);

    view.pose({ ...REST, dash: 1 }, 0.016);
    expect(tumble.rotation.z).toBeCloseTo(-Math.PI * 2);
    expect(tumble.position.y).toBeCloseTo(0.6);

    // pousou: de pe de novo; morto no ar nao fica girado
    view.pose(REST, 0.016);
    expect(tumble.rotation.z).toBe(0);
    view.pose({ ...REST, dash: 0.5, dead: true }, 0.016);
    expect(tumble.rotation.z).toBe(0);
  });

  it('sem `roll` no esqueleto o salto nao gira o corpo', () => {
    const view = createGltfCharacterView(model(), CLIPS, RIG);
    view.pose({ ...REST, dash: 0.5 }, 0.016);
    expect(view.object.children[0].rotation.z).toBe(0);
    expect(view.object.children[0].position.y).toBe(0);
  });

  it('com as pernas separadas, o tiro mexe so no tronco e as pernas seguem correndo', () => {
    // dois ossos: `hips` (pernas) e `chest` (tronco), cada clipe mexe nos dois
    const body = model();
    const chest = new THREE.Bone();
    chest.name = 'chest';
    body.add(chest);
    const both = (name: string, hips: number, top: number) =>
      new THREE.AnimationClip(name, 1, [
        new THREE.VectorKeyframeTrack(
          'hips.position',
          [0, 1],
          [0, 0, 0, hips, 0, 0],
        ),
        new THREE.VectorKeyframeTrack(
          'chest.position',
          [0, 1],
          [0, 0, 0, top, 0, 0],
        ),
      ]);
    const clips = [
      both('idle', 0, 0),
      both('run', 10, 10),
      both('shoot', 100, 100),
      slide('death', 2, -8),
    ];
    const rig: RigSpec = {
      ...RIG,
      lower: ['hips'],
      clips: { ...RIG.clips, attacks: [], shot: { name: 'shoot' } },
    };
    const view = createGltfCharacterView(body, clips, rig);
    const at = (name: string) => view.object.getObjectByName(name)!.position.x;

    // correndo e atirando, no meio do clipe de tiro
    view.pose({ ...REST, moving: 1, shot: 0.5 }, 0.25);
    // pernas: o ciclo de corrida, que andou 0.25 s
    expect(at('hips')).toBeCloseTo(2.5);
    // tronco: o tiro, parado na fase
    expect(at('chest')).toBeCloseTo(50);

    // sem tiro, o corpo inteiro volta ao ciclo
    view.pose({ ...REST, moving: 1 }, 0.25);
    expect(at('chest')).toBeLessThan(11);
  });

  it('`dispose` tira o corpo de cena', () => {
    const scene = new THREE.Scene();
    const view = createGltfCharacterView(model(), CLIPS, RIG);
    scene.add(view.object);
    view.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
