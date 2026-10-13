/// <reference types="node" />
import { readFileSync } from 'node:fs';

import { SCENERY } from '@/app/engine/scenery/scenery.config';

// So vale com o kit ligado (`SCENERY.url`); desligado, nao ha arquivo.
describe.skipIf(!SCENERY.url)('kit de cenario em public/models', () => {
  // pulado: o corpo ainda roda para listar os testes, mas nao ha o que ler
  if (!SCENERY.url) return it('kit desligado', () => {});
  // Le o JSON de dentro do GLB publicado, sem carregador nem WebGL.
  const file = readFileSync(`public${SCENERY.url}`);
  const kit = JSON.parse(
    file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8'),
  ) as {
    nodes: { name: string; mesh?: number; children?: number[] }[];
    materials: unknown[];
    images: unknown[];
  };
  const names = kit.nodes.map((node) => node.name);
  // quantas malhas ha debaixo do no da peca
  const meshes = (piece: string) => {
    const count = (index: number): number => {
      const node = kit.nodes[index];
      return (
        (node.mesh === undefined ? 0 : 1) +
        (node.children ?? []).reduce((sum, child) => sum + count(child), 0)
      );
    };
    return count(names.indexOf(`piece_${piece}`));
  };

  it('tem toda peca que o cenario do jogo pede', () => {
    const pieces = [
      SCENERY.floor,
      SCENERY.wall,
      SCENERY.chest,
      SCENERY.goldenChest,
      SCENERY.money,
      ...SCENERY.props,
    ].map((placed) => placed.piece);
    for (const piece of pieces) expect(names).toContain(`piece_${piece}`);
  });

  it('piso e parede sao de uma malha so: da para desenhar em lote', () => {
    expect(meshes(SCENERY.floor.piece)).toBe(1);
    expect(meshes(SCENERY.wall.piece)).toBe(1);
  });

  it('o bau tem o no da tampa, e a porta o da folha', () => {
    expect(names).toContain(SCENERY.chest.lid);
    expect(names).toContain(`piece_${SCENERY.door.piece}`);
    expect(names).toContain(SCENERY.door.leaf);
  });

  it('uma textura e um material para o kit inteiro', () => {
    expect(kit.images).toHaveLength(1);
    expect(kit.materials).toHaveLength(1);
  });
});
