import * as THREE from 'three';

import { createWorldRenderer } from '@/app/engine/renderers/world.renderer';
import { FIXED_DT } from '@/app/modules/world/constants/world.constants';
import type { InputState } from '@/app/modules/world/types/world.types';
import {
  getWorld,
  joystickInput,
  useGameStore,
} from '@/app/store/game-store/game.store';

// Contrato em docs/contracts.md (secao Engine).

const CAMERA_HEIGHT = 13;
const CAMERA_BACK = 7;
const MAX_FRAME_TIME = 0.1;

export type GameEngine = { dispose: () => void };

function axis(keys: Set<string>, positive: string[], negative: string[]) {
  const has = (codes: string[]) => codes.some((code) => keys.has(code));
  return (has(positive) ? 1 : 0) - (has(negative) ? 1 : 0);
}

export function createGameEngine(canvas: HTMLCanvasElement): GameEngine {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1f2033);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(3, 10, 5);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const view = createWorldRenderer(scene);

  const keys = new Set<string>();
  const onKeyDown = (event: KeyboardEvent) => keys.add(event.code);
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
  const onBlur = () => keys.clear();

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', resize);
  resize();

  const input: InputState = { moveX: 0, moveY: 0 };
  let last = performance.now();
  let accumulator = 0;
  let frameId = 0;

  const frame = (now: number) => {
    frameId = requestAnimationFrame(frame);
    accumulator += Math.min(MAX_FRAME_TIME, (now - last) / 1000);
    last = now;

    input.moveX =
      axis(keys, ['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) +
      joystickInput.moveX;
    input.moveY =
      axis(keys, ['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) +
      joystickInput.moveY;

    // passo fixo: a simulacao nao depende do fps
    const tick = useGameStore.getState().tick;
    while (accumulator >= FIXED_DT) {
      tick(input, FIXED_DT);
      accumulator -= FIXED_DT;
    }

    const world = getWorld();
    if (!world) return;
    view.sync(world, now / 1000);
    const { x, y } = world.player.pos;
    camera.position.set(x, CAMERA_HEIGHT, -y + CAMERA_BACK);
    camera.lookAt(x, 0, -y);
    renderer.render(scene, camera);
  };
  frameId = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      view.dispose();
      renderer.dispose();
    },
  };
}
