import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Kit de cenario: um arquivo glTF com varias pecas soltas (parede, piso,
// caixa...), cada uma num no `piece_<nome>`. Quem desenha pede a peca pelo
// nome e nao sabe de que arquivo ela veio. Nada aqui sabe de que jogo se
// trata: ver docs/engine-reuse.md.

export type ModelKit = {
  // copia da peca, pronta para entrar em cena; null se o kit nao tem
  clone(name: string): THREE.Object3D | null;
  // geometria e material da peca, para desenhar muitas de uma vez
  // (InstancedMesh). So para peca de uma malha so; null nas outras.
  // Compartilhados: nao alterar nem descartar
  mesh(
    name: string,
  ): { geometry: THREE.BufferGeometry; material: THREE.Material } | null;
  dispose(): void;
};

const PREFIX = 'piece_';

// `scene`: a cena do arquivo, como o carregador entrega.
export function createModelKit(scene: THREE.Object3D): ModelKit {
  // Lambert no lugar do material fisico do arquivo: mais barato, e o cenario
  // nao precisa de brilho. Um por material de origem
  const materials = new Map<THREE.Material, THREE.MeshLambertMaterial>();
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const source = child.material as THREE.MeshStandardMaterial;
    let plain = materials.get(source);
    if (!plain) {
      plain = new THREE.MeshLambertMaterial({
        map: source.map ?? null,
        color: source.color,
      });
      materials.set(source, plain);
    }
    child.material = plain;
  });
  const pieces = new Map(
    scene.children
      .filter((child) => child.name.startsWith(PREFIX))
      .map((child) => [child.name.slice(PREFIX.length), child]),
  );

  return {
    clone(name) {
      return pieces.get(name)?.clone() ?? null;
    },
    mesh(name) {
      const meshes: THREE.Mesh[] = [];
      pieces.get(name)?.traverse((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
      if (meshes.length !== 1) return null;
      return {
        geometry: meshes[0].geometry,
        material: meshes[0].material as THREE.Material,
      };
    },
    dispose() {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      for (const material of materials.values()) {
        material.map?.dispose();
        material.dispose();
      }
    },
  };
}

// Rejeita se o arquivo nao chegar: quem chama decide o que mostrar no lugar.
export async function loadModelKit(url: string): Promise<ModelKit> {
  return createModelKit((await new GLTFLoader().loadAsync(url)).scene);
}
