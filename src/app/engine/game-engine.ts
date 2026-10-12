import { COLORS } from '@/shared/colors';
import * as THREE from 'three';

import { createWorldRenderer } from '@/app/engine/renderers/world.renderer';
import {
  CRIT_FOCUS_TIME,
  DASH_TIME,
  FIXED_DT,
} from '@/app/modules/world/constants/world.constants';
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
// por quanto tempo (ms) o clique que vem de um toque em icone e ignorado
const PROMPT_CLICK_GUARD = 600;
const PUNCH_TIME = 0.35;
const PUNCH_ZOOM = 3.5;
const PUNCH_BLUR = 3;
// F no corpo a corpo (`player.clash`): zoom e blur menores que os do soco,
// que duram enquanto o jogador segue apertando
const CLASH_ZOOM = 2;
const CLASH_BLUR = 1.2;
// raio, em px na tela, em que o toque conta como em cima do icone de
// interacao; folgado, para caber um dedo
const PROMPT_TAP_RADIUS = 44;
// blur de velocidade no dash do player: cresce e some junto com o salto
const DASH_BLUR = 2.2;
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
  scene.background = new THREE.Color(COLORS.model.c1f2033);
  scene.add(
    new THREE.HemisphereLight(COLORS.model.cffffff, COLORS.model.c444466, 1.8),
  );
  const sun = new THREE.DirectionalLight(COLORS.model.cffffff, 1.4);
  sun.position.set(3, 10, 5);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  const { look, bloodColor } = useGameStore.getState();
  const view = createWorldRenderer(scene, look, bloodColor);

  const keys = new Set<string>();
  const input: InputState = { moveX: 0, moveY: 0, dash: false };
  const onKeyDown = (event: KeyboardEvent) => {
    keys.add(event.code);
    // Ctrl agacha e as setas movem: evita atalhos e rolagem do navegador.
    // Ctrl+W (fechar aba) o navegador nao deixa bloquear; por isso C tambem agacha.
    if (
      (event.ctrlKey || event.code.startsWith('Arrow')) &&
      getWorld()?.status === 'playing'
    )
      event.preventDefault();
    // Tab segurado mostra o placar; sem isto o foco sairia do jogo
    if (event.code === 'Tab' && getWorld()) {
      event.preventDefault();
      useGameStore.getState().setScoreboard(true);
    }
    if (event.repeat) return;
    if (event.code === 'KeyP') useGameStore.getState().togglePause();
    // so em desenvolvimento: pula para a proxima sala de loja
    if (event.code === 'F8') useGameStore.getState().devSkipToShop();
    if (event.code === 'Enter') useGameStore.getState().begin();
    if (event.code === 'KeyF' && getWorld()?.status === 'playing')
      input.interact = true;
    // Q troca a arma na mao: espada, depois cada arma do arsenal
    if (event.code === 'KeyQ') useGameStore.getState().cycleWeapon();
    // B abre o bau ao alcance e fecha a loja aberta
    if (event.code === 'KeyB') {
      // pela tela, nao pelo mundo: em rede a loja e de cada jogador
      if (useGameStore.getState().screen === 'shop')
        useGameStore.getState().closeShop();
      else if (getWorld()?.status === 'playing') input.open = true;
    }
  };
  // Toque ou clique em cima do icone flutuante (F, B) faz o que a tecla
  // faria: no celular e o unico jeito de quebrar caixa, esfaquear e abrir bau.
  const spot = new THREE.Vector3();
  // O toque num icone abre a loja (ou outro dialogo) antes de o dedo subir.
  // No celular o clique desse mesmo toque cairia no que apareceu embaixo do
  // dedo: comprava sozinho o cartao da loja que nascesse ali. Engole esse
  // unico clique.
  const swallowClick = () => {
    const swallow = (click: MouseEvent) => {
      click.stopPropagation();
      click.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(
      () => window.removeEventListener('click', swallow, { capture: true }),
      PROMPT_CLICK_GUARD,
    );
  };

  const onPointerDown = (event: PointerEvent) => {
    if (getWorld()?.status !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    for (const { action, object } of view.prompts()) {
      // posicao do icone na tela
      object.getWorldPosition(spot).project(camera);
      const x = rect.left + ((spot.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - spot.y) / 2) * rect.height;
      if (
        Math.hypot(event.clientX - x, event.clientY - y) > PROMPT_TAP_RADIUS
      ) {
        continue;
      }
      input[action] = true;
      // o toque e do icone: nao comeca o joystick que esta por baixo
      event.stopPropagation();
      swallowClick();
      return;
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    keys.delete(event.code);
    if (event.code === 'Tab') useGameStore.getState().setScoreboard(false);
  };
  const onBlur = () => {
    keys.clear();
    useGameStore.getState().setScoreboard(false);
    input.interact = false;
    input.open = false;
  };

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // captura: chega antes do joystick, que cobre a parte de baixo da tela
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', resize);
  resize();

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
    // botao de ataque do toque: pulso unico, como a tecla F
    if (joystickInput.interact) {
      joystickInput.interact = false;
      if (getWorld()?.status === 'playing') input.interact = true;
    }
    input.crouch =
      keys.has('ControlLeft') ||
      keys.has('ControlRight') ||
      keys.has('KeyC') ||
      !!joystickInput.crouch;

    // passo fixo: a simulacao nao depende do fps
    const tick = useGameStore.getState().tick;
    while (accumulator >= FIXED_DT) {
      tick(input, FIXED_DT);
      input.interact = false;
      input.open = false;
      accumulator -= FIXED_DT;
    }

    const world = getWorld();
    if (!world) return;
    view.sync(world, now / 1000);

    // escudo absorvendo tambem conta como dano levado
    const health = world.player.hp + world.player.shield;
    if (world.run.kills > kills || health < hp) punch = 1;
    kills = world.run.kills;
    hp = health;
    punch = Math.max(0, punch - frameTime / PUNCH_TIME);
    const { dash } = world.player;
    const clash = world.player.clash / CRIT_FOCUS_TIME;
    camera.fov = CAMERA_FOV - PUNCH_ZOOM * punch - CLASH_ZOOM * clash;
    camera.updateProjectionMatrix();
    const rush =
      dash > 0 ? Math.sin(Math.PI * (1 - dash / DASH_TIME)) * DASH_BLUR : 0;
    // o mais forte vale; nao somam
    const blur = Math.max(punch * PUNCH_BLUR, rush, clash * CLASH_BLUR);
    canvas.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : '';

    // camera segue suavizada, como o personagem (ver world.renderer animate)
    // morto no multiplayer assiste: a camera passa a seguir um colega vivo
    const followed =
      world.player.hp > 0
        ? world.player
        : (world.players.find((p) => p.hp > 0) ?? world.player);
    const { x, y } = followed.pos;
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
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      canvas.style.filter = '';
      view.dispose();
      renderer.dispose();
    },
  };
}
