// Monta os arquivos de public/models/kaykit a partir dos pacotes KayKit
// (CC0, Kay Lousberg) baixados em kaylousberg.itch.io. Roda uma vez, quando
// muda a lista de clipes ou de personagens:
//
//   node scripts/pack-kaykit.mjs <pasta Character_Animations> <pasta Adventurers>
//
// O pacote de animacoes traz um GLB por tema, cada um com o manequim inteiro
// dentro. Aqui sai um GLB so, com o esqueleto e os clipes de CLIPS, sem malha:
// e o que o jogo baixa. Sem dependencia: GLB e um JSON e um bloco binario.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'public/models/kaykit';

// arquivo de origem (Rig_Medium_<tema>.glb) e os clipes que saem dele
const CLIPS = {
  General: ['Idle_A', 'Death_A', 'Hit_A', 'Throw'],
  MovementBasic: ['Walking_A', 'Running_A'],
  MovementAdvanced: ['Sneaking', 'Crouching', 'Dodge_Forward'],
  CombatMelee: [
    'Melee_1H_Attack_Chop',
    'Melee_1H_Attack_Slice_Diagonal',
    'Melee_1H_Attack_Slice_Horizontal',
    'Melee_1H_Attack_Stab',
    'Melee_2H_Attack_Spin',
  ],
  CombatRanged: ['Ranged_1H_Shoot', 'Ranged_2H_Shoot'],
};
// personagens copiados inteiros (a textura ja vem dentro do GLB)
const CHARACTERS = ['Rogue_Hooded', 'Knight', 'Ranger', 'Barbarian'];
// o que vai na mao: .gltf com .bin e textura ao lado
const PROPS = ['sword_1handed.gltf', 'sword_1handed.bin', 'knight_texture.png'];

const FLOAT = 5126;
const SIZE = { SCALAR: 1, VEC3: 3, VEC4: 4 };

function readGlb(path) {
  const file = readFileSync(path);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 20 + jsonLength + 8;
  const bin = file.subarray(
    binStart,
    binStart + file.readUInt32LE(20 + jsonLength),
  );
  return { json, bin };
}

// numeros de um accessor float, sem intercalacao (e como o KayKit exporta)
function floats({ json, bin }, index) {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  if (accessor.componentType !== FLOAT || view.byteStride) {
    throw new Error(`accessor ${index}: formato nao suportado`);
  }
  const width = SIZE[accessor.type];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values = new Float32Array(accessor.count * width);
  for (let i = 0; i < values.length; i++) {
    values[i] = bin.readFloatLE(start + i * 4);
  }
  return { values, width, type: accessor.type };
}

function pack(animations) {
  const [first] = Object.keys(CLIPS);
  const base = readGlb(join(animations, `Rig_Medium_${first}.glb`));
  // so o esqueleto: os nos, sem malha nem skin
  const nodes = base.json.nodes.map(({ mesh, skin, ...node }) => node);
  const byName = new Map(nodes.map((node, index) => [node.name, index]));

  const chunks = [];
  let offset = 0;
  const out = { accessors: [], bufferViews: [], animations: [] };
  // tempos e curvas iguais viram um accessor so
  const seen = new Map();
  const store = (values, type, minMax) => {
    const key = `${type}:${Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString('base64')}`;
    if (seen.has(key)) return seen.get(key);
    const data = Buffer.from(
      values.buffer,
      values.byteOffset,
      values.byteLength,
    );
    out.bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: data.length,
    });
    chunks.push(data);
    offset += data.length;
    out.accessors.push({
      bufferView: out.bufferViews.length - 1,
      componentType: FLOAT,
      count: values.length / SIZE[type],
      type,
      ...(minMax && { min: [Math.min(...values)], max: [Math.max(...values)] }),
    });
    seen.set(key, out.accessors.length - 1);
    return out.accessors.length - 1;
  };

  for (const [theme, names] of Object.entries(CLIPS)) {
    const source = readGlb(join(animations, `Rig_Medium_${theme}.glb`));
    for (const name of names) {
      const animation = source.json.animations.find((a) => a.name === name);
      if (!animation) throw new Error(`clipe ${name} nao existe em ${theme}`);
      const samplers = [];
      const channels = [];
      for (const channel of animation.channels) {
        // escala nunca muda nesses clipes: fora
        if (channel.target.path === 'scale') continue;
        const node = byName.get(source.json.nodes[channel.target.node].name);
        if (node === undefined) continue;
        const sampler = animation.samplers[channel.sampler];
        let times = floats(source, sampler.input).values;
        let { values, width, type } = floats(source, sampler.output);
        // curva parada: basta o primeiro quadro
        const still = values.every(
          (v, i) => Math.abs(v - values[i % width]) < 1e-6,
        );
        if (still) {
          times = times.slice(0, 1);
          values = values.slice(0, width);
        }
        samplers.push({
          input: store(times, 'SCALAR', true),
          output: store(values, type),
          interpolation: sampler.interpolation ?? 'LINEAR',
        });
        channels.push({
          sampler: samplers.length - 1,
          target: { node, path: channel.target.path },
        });
      }
      out.animations.push({ name, samplers, channels });
    }
  }

  const json = {
    asset: { version: '2.0', generator: 'scripts/pack-kaykit.mjs' },
    scene: 0,
    scenes: [{ nodes: base.json.scenes[base.json.scene ?? 0].nodes }],
    nodes,
    ...out,
    buffers: [{ byteLength: offset }],
  };
  const pad = (buffer, fill) =>
    Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4, fill)]);
  const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad(Buffer.concat(chunks), 0);
  const header = Buffer.alloc(12);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunkHeader = (length, type) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(length, 0);
    head.write(type, 4);
    return head;
  };
  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, 'JSON'),
    jsonChunk,
    chunkHeader(binChunk.length, 'BIN\0'),
    binChunk,
  ]);
}

const [animations, adventurers] = process.argv.slice(2);
if (!animations || !adventurers) {
  console.error(
    'uso: node scripts/pack-kaykit.mjs <Character_Animations> <Adventurers>',
  );
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const clips = pack(join(animations, 'Animations/gltf/Rig_Medium'));
writeFileSync(join(OUT, 'medium.anims.glb'), clips);
console.log(`medium.anims.glb ${(clips.length / 1024).toFixed(0)} KB`);
for (const name of CHARACTERS) {
  copyFileSync(
    join(adventurers, 'Characters/gltf', `${name}.glb`),
    join(OUT, `${name.toLowerCase().replace('_', '-')}.glb`),
  );
}
for (const name of PROPS) {
  copyFileSync(join(adventurers, 'Assets/gltf', name), join(OUT, name));
}
