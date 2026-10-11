import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import {
  type CharacterKit,
  createCharacterKit,
} from '@/app/engine/renderers/character.renderer';
import type { PlayerLook } from '@/app/store/game-store/game.store';

// Preview do player na tela de personagem: arrastar gira, roda do mouse
// aproxima. Desenha so quando algo muda; nao tem loop.

export type CharacterPreview = {
  setLook: (look: PlayerLook) => void;
  dispose: () => void;
};

export function createCharacterPreview(
  canvas: HTMLCanvasElement,
): CharacterPreview {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // mesma luz e fundo do jogo, para a cor do preview ser a cor da run
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1f2033);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(3, 10, 5);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 48),
    new THREE.MeshLambertMaterial({ color: 0x4a4f6a }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // personagem olha para +x: a camera comeca de frente, um pouco de lado
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(3, 1.8, 1.6);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.75, 0);
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 6;
  controls.maxPolarAngle = Math.PI / 2;
  controls.update();

  const draw = () => renderer.render(scene, camera);
  controls.addEventListener('change', draw);

  const resize = () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.updateProjectionMatrix();
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let kit: CharacterKit | null = null;
  let root: THREE.Group | null = null;
  const clear = () => {
    if (root) scene.remove(root);
    kit?.dispose();
  };

  return {
    setLook(look) {
      clear();
      kit = createCharacterKit(look);
      root = kit.make('player').root;
      scene.add(root);
      draw();
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      clear();
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
    },
  };
}
