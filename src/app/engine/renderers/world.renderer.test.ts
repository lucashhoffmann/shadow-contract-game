import * as THREE from 'three';

import { createWorldRenderer } from '@/app/engine/renderers/world.renderer';
import {
  FIXED_DT,
  ROOM_H,
  ROOM_W,
} from '@/app/modules/world/constants/world.constants';
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

it('piso tem textura que repete uma vez por tile', () => {
  const world = createArenaWorld();
  const scene = new THREE.Scene();
  const renderer = createWorldRenderer(
    scene,
    DEFAULT_LOOK,
    DEFAULT_BLOOD_COLOR,
  );
  renderer.sync(world, 1);
  const floor = scene.getObjectByName('floor') as THREE.Mesh;
  const { map } = floor.material as THREE.MeshLambertMaterial;
  expect(map?.repeat.toArray()).toEqual([ROOM_W, ROOM_H]);
  renderer.dispose();
});

it('inimigo em furia: marca de raiva sobre a cabeca e contorno do corpo trocado', () => {
  const world = createArenaWorld();
  const enemy = addEnemy(world, 5.5, 8.5, Math.PI / 2);
  const scene = new THREE.Scene();
  const renderer = createWorldRenderer(
    scene,
    DEFAULT_LOOK,
    DEFAULT_BLOOD_COLOR,
  );
  const rage = () => scene.getObjectByName('rageMarker')!;
  // pecas de contorno: malha de costas (BackSide) filha de outra peca
  const outlines = () => {
    const found = new Set<THREE.Material>();
    rage().parent!.parent!.traverse((child) => {
      const material = (child as THREE.Mesh).material as THREE.Material;
      if (material?.side === THREE.BackSide) found.add(material);
    });
    return found;
  };

  renderer.sync(world, 1);
  expect(rage().visible).toBe(false);
  const calm = [...outlines()];
  expect(calm).toHaveLength(1);

  enemy.enraged = true;
  renderer.sync(world, 1.1);
  expect(rage().visible).toBe(true);
  expect(rage().parent!.visible).toBe(true);
  const furious = [...outlines()];
  expect(furious).toHaveLength(1);
  expect(furious[0]).not.toBe(calm[0]);
  // pulsa: o tamanho da marca muda com o tempo
  const size = rage().scale.x;
  renderer.sync(world, 1.3);
  expect(rage().scale.x).not.toBe(size);

  // morto, volta ao contorno normal e a marca some
  enemy.state = 'dead';
  renderer.sync(world, 1.4);
  expect(rage().visible).toBe(false);
  expect([...outlines()][0]).toBe(calm[0]);
  renderer.dispose();
});

it('cada objeto quebrado deixa destrocos de um jeito so dele', () => {
  // tres caixas na mesma linha; ids diferentes
  const world = createArenaWorld({ 9: '#.o.o.o...#' });
  for (const prop of world.props) prop.broken = true;
  const scene = new THREE.Scene();
  const renderer = createWorldRenderer(
    scene,
    DEFAULT_LOOK,
    DEFAULT_BLOOD_COLOR,
  );
  renderer.sync(world, 1);

  // um grupo por objeto, na posicao dele; so pedacos dentro
  const piles = world.props.map((prop) =>
    scene.children.find(
      (child) =>
        child.position.x === prop.pos.x && child.position.z === -prop.pos.y,
    )!,
  );
  const shape = (pile: THREE.Object3D) =>
    pile.children
      .map((piece) =>
        [...piece.position.toArray(), ...piece.scale.toArray()]
          .map((value) => value.toFixed(2))
          .join(),
      )
      .join('|');
  for (const pile of piles) {
    expect(pile.children.length).toBeGreaterThanOrEqual(8);
    // espalhados em volta, nao empilhados num ponto
    const reach = pile.children.map((piece) =>
      Math.hypot(piece.position.x, piece.position.z),
    );
    expect(Math.max(...reach)).toBeGreaterThan(0.25);
    expect(Math.max(...reach)).toBeLessThan(1);
  }
  expect(new Set(piles.map(shape)).size).toBe(3);

  // o mesmo objeto quebra sempre igual: outro desenho da o mesmo monte
  const other = new THREE.Scene();
  const again = createWorldRenderer(other, DEFAULT_LOOK, DEFAULT_BLOOD_COLOR);
  again.sync(world, 1);
  const first = other.children.find(
    (child) =>
      child.position.x === world.props[0].pos.x &&
      child.position.z === -world.props[0].pos.y,
  )!;
  expect(shape(first)).toBe(shape(piles[0]));
  renderer.dispose();
  again.dispose();
});
