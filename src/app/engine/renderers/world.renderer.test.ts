import * as THREE from 'three';

import { createWorldRenderer } from '@/app/engine/renderers/world.renderer';
import { FIXED_DT } from '@/app/modules/world/constants/world.constants';
import { stepWorld } from '@/app/modules/world/systems/world.system';
import {
  DEFAULT_BLOOD_COLOR,
  DEFAULT_LOOK,
} from '@/app/store/game-store/game.store';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

it('remove o F da cena assim que a caixa quebra', () => {
  const world = createArenaWorld({ 9: '#....o....#' });
  const scene = new THREE.Scene();
  const renderer = createWorldRenderer(
    scene,
    DEFAULT_LOOK,
    DEFAULT_BLOOD_COLOR,
  );

  renderer.sync(world, 1);
  const prompt = scene.getObjectByName('interactionPrompt');
  expect(prompt?.visible).toBe(true);
  expect(prompt?.parent).not.toBe(scene);

  stepWorld(
    world,
    { moveX: 0, moveY: 0, dash: false, interact: true },
    FIXED_DT,
  );
  renderer.sync(world, 1 + FIXED_DT);
  expect(world.props[0].broken).toBe(true);
  expect(prompt?.visible).toBe(false);
  expect(scene.getObjectByName('interactionPrompt')).toBeUndefined();

  renderer.dispose();
});

it('poça cresce suavemente ate o limite com a cor escolhida', () => {
  const world = createArenaWorld();
  const enemy = addEnemy(world, 5.5, 5.5, 0);
  const scene = new THREE.Scene();
  const renderer = createWorldRenderer(scene, DEFAULT_LOOK, '#22aa44');

  renderer.sync(world, 1);
  const blood = scene.getObjectByName('bloodPool') as THREE.Mesh;
  expect(blood.visible).toBe(false);
  expect((blood.material as THREE.MeshBasicMaterial).color.getHexString()).toBe(
    '22aa44',
  );

  enemy.state = 'dead';
  renderer.sync(world, 2);
  const start = blood.scale.x;
  renderer.sync(world, 3.25);
  const middle = blood.scale.x;
  renderer.sync(world, 4.5);
  expect(blood.visible).toBe(true);
  expect(start).toBeLessThan(middle);
  expect(middle).toBeLessThan(blood.scale.x);
  expect(blood.scale.x).toBeCloseTo(0.85);
  renderer.sync(world, 10);
  expect(blood.scale.x).toBeCloseTo(0.85);

  world.enemies = [];
  renderer.sync(world, 11);
  expect(scene.getObjectByName('bloodPool')).toBeUndefined();
  renderer.dispose();
});

it('marcador: orelha ao ouvir, exclamacao ao ver ou entrar em alerta', () => {
  const world = createArenaWorld();
  const enemy = addEnemy(world, 5.5, 8.5, Math.PI / 2);
  const scene = new THREE.Scene();
  const renderer = createWorldRenderer(
    scene,
    DEFAULT_LOOK,
    DEFAULT_BLOOD_COLOR,
  );
  const shown = (name: string) => {
    const icon = scene.getObjectByName(name);
    return !!icon?.visible && !!icon.parent?.visible;
  };
  const color = (name: string) => {
    const mesh = scene.getObjectByName(name)?.children[0] as THREE.Mesh;
    return (mesh.material as THREE.MeshBasicMaterial).color.getHex();
  };

  renderer.sync(world, 1);
  expect(shown('earMarker')).toBe(false);
  expect(shown('alarmMarker')).toBe(false);

  enemy.heard = { x: 5.5, y: 2.5 };
  enemy.hearing = enemy.intelligence.hearingThreshold * 0.2;
  enemy.state = 'suspicious';
  renderer.sync(world, 1.1);
  expect(shown('earMarker')).toBe(true);
  expect(shown('alarmMarker')).toBe(false);
  expect(color('earMarker')).toBe(0xffffff);

  enemy.hearing = enemy.intelligence.hearingThreshold * 0.6;
  renderer.sync(world, 1.15);
  expect(color('earMarker')).toBe(0xffd84a);

  enemy.heard = null;
  enemy.state = 'alert';
  renderer.sync(world, 1.2);
  expect(shown('earMarker')).toBe(false);
  expect(shown('alarmMarker')).toBe(true);
  expect(color('alarmMarker')).toBe(0xff3030);

  renderer.dispose();
});

it('coracao e escudo de caixa flutuam acima do chao e somem ao coletar', () => {
  const world = createArenaWorld();
  world.pickups.push(
    { id: 70, kind: 'heart', roomIndex: 0, pos: { x: 3.5, y: 8.5 }, value: 20 },
    {
      id: 71,
      kind: 'shield',
      roomIndex: 0,
      pos: { x: 7.5, y: 8.5 },
      value: 20,
    },
  );
  const scene = new THREE.Scene();
  const renderer = createWorldRenderer(
    scene,
    DEFAULT_LOOK,
    DEFAULT_BLOOD_COLOR,
  );

  renderer.sync(world, 1);
  expect(scene.getObjectByName('heartPickup')?.position.y).toBeGreaterThan(0.4);
  expect(scene.getObjectByName('shieldPickup')?.position.y).toBeGreaterThan(
    0.4,
  );

  world.pickups = [];
  renderer.sync(world, 1.1);
  expect(scene.getObjectByName('heartPickup')).toBeUndefined();
  renderer.dispose();
});
