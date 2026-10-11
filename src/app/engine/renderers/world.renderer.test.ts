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
