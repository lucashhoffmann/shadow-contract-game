import * as THREE from 'three';

import { createModelKit } from '@/app/engine/scenery/model-kit';

// Cena no formato do arquivo: cada peca num no `piece_<nome>`.
function scene() {
  const root = new THREE.Group();
  const shared = new THREE.MeshStandardMaterial({ color: 0x808080 });
  const piece = (name: string, ...parts: string[]) => {
    const node = new THREE.Group();
    node.name = `piece_${name}`;
    let parent: THREE.Object3D = node;
    for (const part of parts) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), shared);
      mesh.name = part;
      parent.add(mesh);
      parent = mesh;
    }
    root.add(node);
  };
  piece('wall', 'wall');
  piece('chest', 'chest', 'chest_lid');
  // no solto que nao e peca: nao entra no kit
  const stray = new THREE.Group();
  stray.name = 'camera';
  root.add(stray);
  return root;
}

describe('createModelKit', () => {
  it('`clone` entrega copia propria da peca, com os nos de dentro', () => {
    const kit = createModelKit(scene());
    const [first, second] = [kit.clone('chest')!, kit.clone('chest')!];
    expect(first).not.toBe(second);
    expect(first.getObjectByName('chest_lid')).toBeDefined();
    first.getObjectByName('chest_lid')!.rotation.x = 1;
    expect(second.getObjectByName('chest_lid')!.rotation.x).toBeCloseTo(0);
  });

  it('peca que o kit nao tem, e no que nao e peca, devolvem null', () => {
    const kit = createModelKit(scene());
    expect(kit.clone('door')).toBeNull();
    expect(kit.clone('camera')).toBeNull();
    expect(kit.mesh('door')).toBeNull();
  });

  it('`mesh` so vale para peca de uma malha so', () => {
    const kit = createModelKit(scene());
    expect(kit.mesh('wall')?.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(kit.mesh('chest')).toBeNull();
  });

  it('troca o material do arquivo por um mais barato, o mesmo para todas as pecas', () => {
    const kit = createModelKit(scene());
    const wall = kit.mesh('wall')!.material;
    expect(wall).toBeInstanceOf(THREE.MeshLambertMaterial);
    const lid = kit.clone('chest')!.getObjectByName('chest_lid') as THREE.Mesh;
    expect(lid.material).toBe(wall);
  });
});
