import * as THREE from 'three';

import {
  createCharacterKit,
  poseAttack,
  poseCrouch,
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
