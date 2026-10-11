import * as THREE from 'three';

import { createCharacterKit } from '@/app/engine/renderers/character.renderer';
import {
  createHeldGuns,
  createWeaponModel,
  PISTOL_BORE_Y,
  PISTOL_MUZZLE_X,
  type WeaponModelId,
} from '@/app/engine/renderers/weapon.renderer';
import { DEFAULT_LOOK } from '@/app/store/game-store/game.store';

function bounds(id: WeaponModelId): THREE.Box3 {
  return new THREE.Box3().setFromObject(createWeaponModel(id).root);
}

describe('createWeaponModel', () => {
  it.each(['sword', 'pistol', 'silenced', 'shotgun'] as const)(
    '%s: comprida em x e simetrica em z',
    (id) => {
      const box = bounds(id);
      const size = box.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(size.y);
      expect(size.x).toBeGreaterThan(size.z);
      expect(box.min.z).toBeCloseTo(-box.max.z);
    },
  );

  it('silenciador so alonga a pistola para frente, no eixo do cano', () => {
    const plain = bounds('pistol');
    const silenced = bounds('silenced');
    expect(plain.max.x).toBeCloseTo(PISTOL_MUZZLE_X);
    expect(silenced.max.x).toBeGreaterThan(PISTOL_MUZZLE_X + 1);
    expect(silenced.min.x).toBeCloseTo(plain.min.x);
    // nao passa da altura nem da largura da propria pistola
    expect(silenced.max.y).toBeCloseTo(plain.max.y);
    expect(silenced.min.y).toBeCloseTo(plain.min.y);
    expect(silenced.max.z).toBeCloseTo(plain.max.z);

    const added = createWeaponModel('silenced').root.children.slice(
      createWeaponModel('pistol').root.children.length,
    );
    expect(added.length).toBeGreaterThan(0);
    for (const part of added) {
      expect(part.position.y).toBe(PISTOL_BORE_Y);
      expect(part.position.z).toBe(0);
    }
  });
});

it('createHeldGuns troca espada por arma na mao direita e volta', () => {
  const character = createCharacterKit(DEFAULT_LOOK).make('player');
  const swordArm = character.arms[0].rotation.z;
  const held = createHeldGuns(character);
  expect(held.mount.parent).toBe(character.arms[0]);

  held.hold('shotgun');
  expect(held.roots.shotgun.visible).toBe(true);
  expect(held.roots.pistol.visible).toBe(false);
  expect(character.sword?.visible).toBe(false);
  // braco estendido para frente
  expect(character.arms[0].rotation.z).toBeGreaterThan(1);

  held.hold(null);
  expect(held.roots.shotgun.visible).toBe(false);
  expect(character.sword?.visible).toBe(true);
  expect(character.arms[0].rotation.z).toBe(swordArm);
});
