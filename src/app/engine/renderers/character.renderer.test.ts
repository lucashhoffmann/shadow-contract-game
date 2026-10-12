import * as THREE from 'three';

import {
  createCharacterKit,
  poseAttack,
  poseCrouch,
  SWINGS,
  poseDead,
  SIDES,
  SWORD_REST_TILT,
} from '@/app/engine/renderers/character.renderer';
import { SLASH_TIME } from '@/app/modules/world/constants/world.constants';
import { DEFAULT_LOOK } from '@/app/store/game-store/game.store';

it('jogador e ninja cortam com a espada presa a mao e retornam ao repouso', () => {
  const kit = createCharacterKit(DEFAULT_LOOK);
  for (const kind of ['player', 'ninja'] as const) {
    const character = kit.make(kind);
    expect(character.sword?.parent).toBe(character.arms[0]);
    const bladeForward = () => {
      character.root.updateMatrixWorld(true);
      return (
        character.sword!.localToWorld(new THREE.Vector3(0, 0.9, 0)).x -
        character.sword!.getWorldPosition(new THREE.Vector3()).x
      );
    };

    poseAttack(character, SLASH_TIME * 0.85);
    const prepared = character.sword!.rotation.z;
    expect(character.body.rotation.y).toBeLessThan(0);
    expect(bladeForward()).toBeLessThan(0);

    poseAttack(character, SLASH_TIME * 0.4);
    expect(character.sword!.rotation.z).toBeLessThan(prepared - 2);
    expect(character.arms[0].rotation.z).toBeGreaterThan(character.hold!);
    expect(character.body.rotation.y).toBeGreaterThan(0);
    expect(bladeForward()).toBeGreaterThan(0.3);

    poseAttack(character, 0);
    expect(character.sword!.rotation.z).toBe(SWORD_REST_TILT);
    expect(character.body.rotation.y).toBe(0);
  }
  kit.dispose();
});

it('terno recua o corpo e o braco ao disparar', () => {
  const kit = createCharacterKit(DEFAULT_LOOK);
  const character = kit.make('suit');
  expect(character.sword).toBeNull();

  poseAttack(character, SLASH_TIME * 0.4);
  expect(character.body.position.x).toBeLessThan(0);
  expect(character.arms[0].rotation.z).toBeLessThan(character.hold!);
  kit.dispose();
});

it('agachado abre as pernas em passo e desce o corpo', () => {
  const kit = createCharacterKit(DEFAULT_LOOK);
  const character = kit.make('suit');
  expect(poseCrouch(character, 0, -1)).toBe(0);
  expect(poseCrouch(character, 1, -1)).toBeGreaterThan(0.1);
  // tronco dobra e encurta; cabeca desce e avanca
  expect(character.trunk.rotation.z).toBeLessThan(-0.3);
  expect(character.trunk.scale.y).toBeLessThan(1);
  expect(character.head.position.y).toBeLessThan(character.headY);
  expect(character.head.position.x).toBeGreaterThan(0);
  // parado: perna esquerda a frente, direita atras
  expect(character.legs[1].rotation.z).toBeGreaterThan(0.5);
  expect(character.legs[0].rotation.z).toBeLessThan(-0.5);
  kit.dispose();
});

it('morto fica estirado com bracos e pernas abertos para fora', () => {
  const kit = createCharacterKit(DEFAULT_LOOK);
  const character = kit.make('ninja');
  poseAttack(character, SLASH_TIME * 0.4);
  poseDead(character);
  SIDES.forEach((side, i) => {
    expect(Math.sign(character.arms[i].rotation.x)).toBe(-side);
    expect(Math.sign(character.legs[i].rotation.x)).toBe(-side);
  });
  expect(character.body.rotation.y).toBe(0);
  expect(character.sword!.rotation.z).toBe(SWORD_REST_TILT);
  kit.dispose();
});

describe('golpes de espada variados', () => {
  // faz `count` golpes inteiros e anota o jeito de cada um
  function swings(count: number) {
    const kit = createCharacterKit(DEFAULT_LOOK);
    const character = kit.make('player');
    const used: number[] = [];
    for (let i = 0; i < count; i++) {
      poseAttack(character, SLASH_TIME);
      used.push(character.swing);
      // o jeito nao muda no meio do golpe
      poseAttack(character, SLASH_TIME * 0.5);
      expect(character.swing).toBe(used.at(-1));
      poseAttack(character, 0);
    }
    kit.dispose();
    return used;
  }

  it('cada golpe novo usa um jeito diferente do anterior', () => {
    const used = swings(60);
    expect(used[0]).toBe(0);
    for (let i = 1; i < used.length; i++) expect(used[i]).not.toBe(used[i - 1]);
    // em 60 golpes aparecem todos
    expect(new Set(used).size).toBe(SWINGS.length);
  });

  it('os jeitos sao mesmo diferentes: lado do corte, altura do braco, volta inteira', () => {
    const kit = createCharacterKit(DEFAULT_LOOK);
    const pose = (swing: number, left: number) => {
      const character = kit.make('player');
      character.swing = swing;
      character.attackLeft = SLASH_TIME;
      poseAttack(character, SLASH_TIME * left);
      return character;
    };
    // reves gira o tronco para o outro lado do corte lateral
    expect(pose(0, 0.4).body.rotation.y).toBeGreaterThan(0);
    expect(pose(1, 0.4).body.rotation.y).toBeLessThan(0);
    // golpe de cima ergue o braco na preparacao; o lateral recua
    const overhead = pose(2, 0.85);
    expect(overhead.arms[0].rotation.z).toBeGreaterThan(overhead.hold! + 1);
    expect(pose(0, 0.85).arms[0].rotation.z).toBeLessThan(overhead.hold!);
    // giro: no meio do golpe o corpo esta de costas, e a espada aberta
    const spin = pose(3, 0.5);
    expect(Math.abs(spin.body.rotation.y - Math.PI)).toBeLessThan(0.4);
    // comeca e termina de frente
    expect(pose(3, 0.98).body.rotation.y).toBeLessThan(0.3);
    expect(pose(3, 0.02).body.rotation.y).toBeGreaterThan(Math.PI * 2 - 0.3);
    kit.dispose();
  });

  it('todo jeito volta ao repouso no fim', () => {
    const kit = createCharacterKit(DEFAULT_LOOK);
    SWINGS.forEach((_, swing) => {
      const character = kit.make('ninja');
      character.swing = swing;
      character.attackLeft = SLASH_TIME;
      poseAttack(character, SLASH_TIME * 0.4);
      poseAttack(character, 0);
      expect(character.body.rotation.y).toBe(0);
      expect(character.body.position.x).toBe(0);
      expect(character.sword!.rotation.z).toBe(SWORD_REST_TILT);
    });
    kit.dispose();
  });
});

it('golpe de salto e sempre o giro, mesmo sendo o primeiro golpe', () => {
  const character = createCharacterKit(DEFAULT_LOOK).make('player');
  for (let i = 0; i < 10; i++) {
    poseAttack(character, SLASH_TIME, true);
    expect(SWINGS[character.swing].spin).toBeGreaterThan(0);
    poseAttack(character, 0);
  }
});
