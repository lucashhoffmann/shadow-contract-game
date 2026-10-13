import type * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

import type { CharacterView } from '@/app/engine/characters/character-view.types';
import {
  createGltfCharacterView,
  type RigSpec,
} from '@/app/engine/characters/gltf-character.view';

// De onde vem cada pedaco de um personagem de modelo. Personagens do mesmo
// esqueleto repetem `clipsUrl` e `rig`: so muda o `url`.
export type CharacterModel = {
  // malha e esqueleto
  url: string;
  // clipes de animacao desse esqueleto
  clipsUrl: string;
  rig: RigSpec;
  // objetos presos ao corpo: `slot` e um nome de `rig.slots`
  holds?: { slot: string; url: string }[];
  // jeito de lutar com o que ele segura (`pose.style`): escolhe o conjunto
  // de golpes ou de mira e tiro do esqueleto
  style?: string;
};

// cada arquivo e baixado e interpretado uma vez; quem pede depois reaproveita
const files = new Map<string, Promise<GLTF>>();
function loadGltf(url: string): Promise<GLTF> {
  let file = files.get(url);
  if (!file) {
    file = new GLTFLoader().loadAsync(url);
    files.set(url, file);
    // falhou (sem rede): a proxima tentativa baixa de novo
    file.catch(() => files.delete(url));
  }
  return file;
}

// So baixa e interpreta os arquivos do modelo, sem montar corpo: para a tela
// de carregamento. Depois disso `loadCharacterView` resolve sem esperar rede.
export async function preloadCharacterModel(
  model: CharacterModel,
): Promise<void> {
  await Promise.all([
    loadGltf(model.url),
    loadGltf(model.clipsUrl),
    ...(model.holds ?? []).map((hold) => loadGltf(hold.url)),
  ]);
}

// Baixa o que falta e monta um corpo novo. Rejeita se algum arquivo nao
// chegar: quem chama decide o que mostrar no lugar.
export async function loadCharacterView(
  model: CharacterModel,
): Promise<CharacterView> {
  const [body, clips, ...held] = await Promise.all([
    loadGltf(model.url),
    loadGltf(model.clipsUrl),
    ...(model.holds ?? []).map((hold) => loadGltf(hold.url)),
  ]);
  const view = createGltfCharacterView(body.scene, clips.animations, model.rig);
  (model.holds ?? []).forEach((hold, i) => {
    const prop: THREE.Object3D = held[i].scene.clone();
    view.slot(hold.slot)?.add(prop);
  });
  return view;
}
