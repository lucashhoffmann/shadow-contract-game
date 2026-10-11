import * as THREE from 'three';

import {
  createCharacterKit,
  poseAttack,
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
