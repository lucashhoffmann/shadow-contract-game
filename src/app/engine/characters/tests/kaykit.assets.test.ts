/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';

import { ENEMY_MODELS } from '@/app/engine/characters/character-models.config';
import { clipNames } from '@/app/engine/characters/clip-driver.util';
import {
  KAYKIT_CLIPS_URL,
  KAYKIT_MEDIUM,
} from '@/app/engine/characters/kaykit.rig';

// Le o JSON de dentro de um GLB publicado, sem carregador nem WebGL.
function glb(url: string) {
  const file = readFileSync(`public${url}`);
  expect(file.subarray(0, 4).toString()).toBe('glTF');
  return JSON.parse(
    file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8'),
  ) as {
    nodes: { name: string }[];
    animations?: { name: string }[];
    meshes?: unknown[];
  };
}

// So vale no jogo que publica os arquivos do KayKit; onde os modelos estao
// desligados (sem public/models/kaykit) nao ha o que conferir.
const published = existsSync(`public${KAYKIT_CLIPS_URL}`);
describe.skipIf(!published)('arquivos do KayKit em public/models', () => {
  // pulado: o corpo ainda roda para listar os testes, mas nao ha o que ler
  if (!published) return it('sem arquivos do KayKit', () => {});
  const clips = glb(KAYKIT_CLIPS_URL);

  it('o arquivo de clipes tem todos os que o esqueleto usa', () => {
    const packed = clips.animations!.map((animation) => animation.name);
    for (const name of clipNames(KAYKIT_MEDIUM.clips)) {
      expect(packed).toContain(name);
    }
  });

  it('o arquivo de clipes nao carrega malha: so esqueleto e curvas', () => {
    expect(clips.meshes).toBeUndefined();
  });

  it('cada modelo de inimigo existe, tem os ossos dos clipes e os pontos de mao', () => {
    const animated = clips.nodes.map((node) => node.name);
    for (const model of Object.values(ENEMY_MODELS)) {
      const bones = glb(model.url).nodes.map((node) => node.name);
      for (const slot of Object.values(model.rig.slots)) {
        expect(bones).toContain(slot);
      }
      for (const hold of model.holds ?? []) {
        expect(Object.keys(model.rig.slots)).toContain(hold.slot);
        expect(() => readFileSync(`public${hold.url}`)).not.toThrow();
      }
      // osso do esqueleto dos clipes que o modelo nao tem ficaria parado
      for (const bone of ['hips', 'chest', 'head', 'handslot.r', 'foot.l']) {
        expect(animated).toContain(bone);
        expect(bones).toContain(bone);
      }
    }
  });
});
