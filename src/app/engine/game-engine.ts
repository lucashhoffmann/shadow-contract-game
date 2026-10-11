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
const CAMERA_FOV = 45;
// soco de camera ao matar e ao levar dano: zoom curto com blur que se desfaz
const PUNCH_TIME = 0.35;
const PUNCH_ZOOM = 3.5;
const PUNCH_BLUR = 1.2;
const CAMERA_FOLLOW_RATE = 14;
const CAMERA_SNAP_DISTANCE = 3;

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

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  const view = createWorldRenderer(scene, useGameStore.getState().look);

  const keys = new Set<string>();
  const onKeyDown = (event: KeyboardEvent) => {
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyP') useGameStore.getState().togglePause();
    if (event.code === 'Enter') useGameStore.getState().begin();
  };
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

  const input: InputState = { moveX: 0, moveY: 0, dash: false };
  let last = performance.now();
  let accumulator = 0;
  let frameId = 0;
  let kills = 0;
  let hp = 0;
  let punch = 0;
  const focus = { x: 0, y: 0 };

  const frame = (now: number) => {
    frameId = requestAnimationFrame(frame);
    const frameTime = Math.min(MAX_FRAME_TIME, (now - last) / 1000);
    accumulator += frameTime;
    last = now;

    input.moveX =
      axis(keys, ['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) +
      joystickInput.moveX;
    input.moveY =
      axis(keys, ['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) +
      joystickInput.moveY;
    input.dash = keys.has('Space') || joystickInput.dash;

    // passo fixo: a simulacao nao depende do fps
    const tick = useGameStore.getState().tick;
    while (accumulator >= FIXED_DT) {
      tick(input, FIXED_DT);
      accumulator -= FIXED_DT;
    }

    const world = getWorld();
    if (!world) return;
    view.sync(world, now / 1000);

    if (world.run.kills > kills || world.player.hp < hp) punch = 1;
    kills = world.run.kills;
    hp = world.player.hp;
    punch = Math.max(0, punch - frameTime / PUNCH_TIME);
    camera.fov = CAMERA_FOV - PUNCH_ZOOM * punch;
    camera.updateProjectionMatrix();
    canvas.style.filter =
      punch > 0.02 ? `blur(${(punch * PUNCH_BLUR).toFixed(1)}px)` : '';

    // camera segue suavizada, como o personagem (ver world.renderer animate)
    const { x, y } = world.player.pos;
    const far = Math.hypot(x - focus.x, y - focus.y) > CAMERA_SNAP_DISTANCE;
    const follow = far ? 1 : Math.min(1, frameTime * CAMERA_FOLLOW_RATE);
    focus.x += (x - focus.x) * follow;
    focus.y += (y - focus.y) * follow;
    camera.position.set(focus.x, CAMERA_HEIGHT, -focus.y + CAMERA_BACK);
    camera.lookAt(focus.x, 0, -focus.y);
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
      canvas.style.filter = '';
      view.dispose();
      renderer.dispose();
    },
  };
}
