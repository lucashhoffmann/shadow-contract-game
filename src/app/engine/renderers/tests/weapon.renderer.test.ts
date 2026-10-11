import * as THREE from 'three';

import {
  createWeaponModel,
  PISTOL_BORE_Y,
  PISTOL_MUZZLE_X,
  type WeaponModelId,
} from '@/app/engine/renderers/weapon.renderer';

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
