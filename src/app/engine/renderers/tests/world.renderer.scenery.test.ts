import * as THREE from 'three';
import { vi } from 'vitest';

import { createWorldRenderer } from '@/app/engine/renderers/world.renderer';
import { createModelKit, loadModelKit } from '@/app/engine/scenery/model-kit';
import { SCENERY } from '@/app/engine/scenery/scenery.config';
import { ROOM_H, ROOM_W } from '@/app/modules/world/constants/world.constants';
import {
  DEFAULT_BLOOD_COLOR,
  DEFAULT_LOOK,
} from '@/app/store/game-store/game.store';
import { createArenaWorld } from '@/test/world.fixture';

// o carregador de verdade baixa arquivo: aqui o kit e montado na hora, com
// uma caixa no lugar de cada peca
vi.mock('@/app/engine/scenery/model-kit', async (original) => ({
  ...(await original<typeof import('@/app/engine/scenery/model-kit')>()),
  loadModelKit: vi.fn(),
}));

// Cenario de mentira ligado: o teste vale com o jogo usando kit ou nao
// (scenery.config.ts pode estar com `url` em null).
vi.mock('@/app/engine/scenery/scenery.config', () => ({
  SCENERY: {
    url: 'kit',
    floor: { piece: 'tile', scale: 0.5 },
    wall: { piece: 'brick', length: 2, height: 4 },
    props: [
      { piece: 'crate', scale: 0.5 },
      { piece: 'barrel', scale: 0.5 },
    ],
    chest: { piece: 'chest', scale: 0.5, lid: 'chest_lid' },
    goldenChest: { piece: 'chest_gold', scale: 0.5 },
    money: { piece: 'coins', scale: 0.5 },
    door: { piece: 'doorway', leaf: 'doorway_door', width: 2, height: 2.75 },
  },
}));

function fakeKit() {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const piece = (name: string, ...inside: string[]) => {
    const node = new THREE.Group();
    node.name = `piece_${name}`;
    let parent: THREE.Object3D = node;
    for (const part of [name, ...inside]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
      mesh.name = part;
      parent.add(mesh);
      parent = mesh;
    }
    root.add(node);
  };
  piece(SCENERY.floor.piece);
  piece(SCENERY.wall.piece);
  piece(SCENERY.chest.piece, SCENERY.chest.lid);
  piece(SCENERY.goldenChest.piece);
  piece(SCENERY.money.piece);
  piece(SCENERY.door.piece, SCENERY.door.leaf);
  for (const prop of SCENERY.props) piece(prop.piece);
  return createModelKit(root);
}

// deixa a promessa do carregador resolver
const arrive = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(rows: Record<number, string> = {}) {
  vi.mocked(loadModelKit).mockReset().mockResolvedValue(fakeKit());
  const world = createArenaWorld(rows);
  const scene = new THREE.Scene();
  const renderer = createWorldRenderer(
    scene,
    DEFAULT_LOOK,
    DEFAULT_BLOOD_COLOR,
  );
  return { world, scene, renderer };
}
const named = <T extends THREE.Object3D>(scene: THREE.Scene, name: string) =>
  scene.getObjectByName(name) as T;

describe('cenario do kit', () => {
  it('antes do kit chegar a sala e a de sempre; quando chega, e refeita com ele', async () => {
    const { world, scene, renderer } = setup();
    renderer.sync(world, 1);
    expect(named(scene, 'floor')).not.toBeInstanceOf(THREE.InstancedMesh);

    await arrive();
    renderer.sync(world, 1.1);
    const floor = named<THREE.InstancedMesh>(scene, 'floor');
    expect(floor).toBeInstanceOf(THREE.InstancedMesh);
    // um ladrilho por tile, e so um piso em cena
    expect(floor.count).toBe(ROOM_W * ROOM_H);
    expect(scene.getObjectsByProperty('name', 'floor')).toHaveLength(1);
    renderer.dispose();
  });

  it('um bloco de parede por tile de parede, no tamanho de um tile', async () => {
    const { world, scene, renderer } = setup();
    renderer.sync(world, 1);
    await arrive();
    renderer.sync(world, 1.1);
    const walls = named<THREE.InstancedMesh>(scene, 'walls');
    const solid = world.rooms[0].tiles.join('').split('#').length - 1;
    expect(walls.count).toBe(solid);
    const [position, turn, scale] = [
      new THREE.Vector3(),
      new THREE.Quaternion(),
      new THREE.Vector3(),
    ];
    const matrix = new THREE.Matrix4();
    walls.getMatrixAt(0, matrix);
    matrix.decompose(position, turn, scale);
    expect(scale.x * SCENERY.wall.length).toBeCloseTo(1);
    // no chao e no meio do tile
    expect(position.y).toBe(0);
    expect(position.x % 1).toBeCloseTo(0.5);
    renderer.dispose();
  });

  it('parede que corre pela coluna gira o bloco; a que corre pela linha, nao', async () => {
    // coluna de parede solta no meio da sala (linhas 4 a 6, coluna 5)
    const column = '#....#....#';
    const { world, scene, renderer } = setup({
      4: column,
      5: column,
      6: column,
    });
    renderer.sync(world, 1);
    await arrive();
    renderer.sync(world, 1.1);
    const walls = named<THREE.InstancedMesh>(scene, 'walls');
    const turned = (x: number, y: number) => {
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const turn = new THREE.Quaternion();
      for (let i = 0; i < walls.count; i++) {
        walls.getMatrixAt(i, matrix);
        matrix.decompose(position, turn, new THREE.Vector3());
        if (
          Math.abs(position.x - x) < 0.01 &&
          Math.abs(position.z + y) < 0.01
        ) {
          return Math.abs(turn.y) > 0.1;
        }
      }
      throw new Error('sem parede nesse tile');
    };
    // linha 5 do template = y de 7 a 8
    expect(turned(5.5, 7.5)).toBe(true);
    // parede do fundo (linha 12 = y de 0 a 1): corre pela linha
    expect(turned(5.5, 0.5)).toBe(false);
    renderer.dispose();
  });

  it('caixa inteira vem do kit; quebrada, vira destrocos; dourada, o bau dourado', async () => {
    const { world, scene, renderer } = setup({ 9: '#....o....#' });
    renderer.sync(world, 1);
    await arrive();
    renderer.sync(world, 1.1);
    const pieces = SCENERY.props.map((prop) => prop.piece);
    const shown = () =>
      [...pieces, SCENERY.goldenChest.piece].filter((piece) =>
        scene.getObjectByName(piece),
      );
    expect(shown()).toHaveLength(1);
    expect(pieces).toContain(shown()[0]);

    world.props[0].broken = true;
    renderer.sync(world, 1.2);
    expect(shown()).toHaveLength(0);

    world.props[0].broken = false;
    world.props[0].golden = true;
    renderer.sync(world, 1.3);
    expect(shown()).toEqual([SCENERY.goldenChest.piece]);
    expect(scene.getObjectByName('goldenChest')).toBeDefined();
    renderer.dispose();
  });

  it('bau da loja e o do kit, com a tampa dele', async () => {
    const { world, scene, renderer } = setup({ 5: '#....C....#' });
    renderer.sync(world, 1);
    await arrive();
    renderer.sync(world, 1.1);
    const lid = scene.getObjectByName(SCENERY.chest.lid)!;
    expect(lid.parent!.name).toBe(SCENERY.chest.piece);
    renderer.dispose();
  });

  it('dinheiro no chao usa as moedas do kit', async () => {
    const { world, scene, renderer } = setup({ 9: '#....$....#' });
    renderer.sync(world, 1);
    expect(scene.getObjectByName(SCENERY.money.piece)).toBeUndefined();
    await arrive();
    renderer.sync(world, 1.1);
    expect(scene.getObjectByName(SCENERY.money.piece)).toBeDefined();
    renderer.dispose();
  });

  it('porta de correr usa duas folhas do kit', async () => {
    const { world, scene, renderer } = setup();
    renderer.sync(world, 1);
    await arrive();
    renderer.sync(world, 1.1);
    // a sala do teste e a 0, que tem a porta de saida
    expect(scene.getObjectsByProperty('name', SCENERY.door.leaf)).toHaveLength(
      2,
    );
    renderer.dispose();
  });

  it('kit que nao chega nao quebra o jogo: fica o cenario de sempre', async () => {
    const { world, scene, renderer } = setup();
    renderer.dispose();
    vi.mocked(loadModelKit).mockReset().mockRejectedValue(new Error('rede'));
    const again = createWorldRenderer(scene, DEFAULT_LOOK, DEFAULT_BLOOD_COLOR);
    again.sync(world, 1);
    await arrive();
    expect(() => again.sync(world, 1.1)).not.toThrow();
    expect(named(scene, 'floor')).not.toBeInstanceOf(THREE.InstancedMesh);
    again.dispose();
  });
});
