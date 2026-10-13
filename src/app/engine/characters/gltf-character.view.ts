import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

import type {
  CharacterPose,
  CharacterView,
} from '@/app/engine/characters/character-view.types';
import {
  clipNames,
  driveClips,
  splitClipNames,
  type ClipSet,
} from '@/app/engine/characters/clip-driver.util';

// Corpo de personagem feito de um modelo com esqueleto (glTF) e clipes de
// animacao. Serve a qualquer esqueleto: o que muda de um para outro esta no
// `RigSpec` (ver kaykit.rig.ts).

export type RigSpec = {
  // altura do modelo para a do jogo
  scale: number;
  // giro (rad, em torno de y) que poe a frente do modelo em +x
  turn: number;
  // nome que o jogo usa -> nome do osso no arquivo
  slots: Record<string, string>;
  // Como cada estilo de arma de alcance e segurado (`pose.style`; '' e o
  // padrao): em que ponto do corpo, e para onde apontam a frente e o topo da
  // arma, nos eixos desse ponto, quando o personagem esta em pose de mira
  grips?: Record<string, { slot: string; forward: number[]; up: number[] }>;
  // ossos da cintura para baixo. Com isto, apontar e atirar pegam so o
  // tronco e as pernas continuam andando; sem, o tiro toma o corpo inteiro
  lower?: string[];
  clips: ClipSet;
  // Cambalhota no salto: o corpo da `turns` voltas para frente em torno de
  // `pivot` (altura do centro do corpo, no tamanho do jogo) e sobe `height`
  // no meio do caminho. Sem isto, o salto e so o clipe `dash`.
  roll?: { turns: number; height: number; pivot: number };
};

// sombra em 3 degraus, como a dos personagens de pecas
const ramp = new THREE.DataTexture(
  new Uint8Array([110, 190, 255]),
  3,
  1,
  THREE.RedFormat,
);
ramp.needsUpdate = true;

const BLACK = 0x000000;

// `model` e `clips` podem ser compartilhados: cada view copia o esqueleto e
// os materiais, e so le os clipes.
export function createGltfCharacterView(
  model: THREE.Object3D,
  clips: THREE.AnimationClip[],
  rig: RigSpec,
): CharacterView {
  const body = clone(model);
  body.scale.setScalar(rig.scale);
  body.rotation.y = rig.turn;
  // o corpo gira em volta do proprio centro, nao dos pes
  const pivot = rig.roll?.pivot ?? 0;
  body.position.y = -pivot;
  const tumble = new THREE.Group();
  tumble.position.y = pivot;
  tumble.add(body);
  const object = new THREE.Group();
  object.name = 'gltfCharacter';
  object.add(tumble);

  // material proprio por view: o destaque de um nao pinta os outros
  const materials = new Map<THREE.Material, THREE.MeshToonMaterial>();
  body.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const source = child.material as THREE.MeshStandardMaterial;
    let toon = materials.get(source);
    if (!toon) {
      toon = new THREE.MeshToonMaterial({
        map: source.map ?? null,
        color: source.color,
        gradientMap: ramp,
      });
      materials.set(source, toon);
    }
    child.material = toon;
  });

  const mixer = new THREE.AnimationMixer(body);
  // chave: nome do clipe e a metade do corpo ('all' = inteiro)
  const actions = new Map<string, THREE.AnimationAction>();
  const key = (name: string, part = 'all') => `${name}|${part}`;
  // o carregador de glTF tira ponto e espaco do nome dos nos
  const lower = new Set(
    (rig.lower ?? []).map((bone) =>
      THREE.PropertyBinding.sanitizeNodeName(bone),
    ),
  );
  const split = lower.size > 0;
  const add = (name: string, part?: 'upper' | 'lower') => {
    const whole = THREE.AnimationClip.findByName(clips, name);
    // clipe que falta no arquivo: a acao so nao aparece
    if (!whole) return;
    // metade do corpo: o mesmo clipe, so com as curvas dos ossos dela
    const clip = part
      ? new THREE.AnimationClip(
          key(name, part),
          whole.duration,
          whole.tracks.filter(
            (track) =>
              lower.has(track.name.slice(0, track.name.lastIndexOf('.'))) ===
              (part === 'lower'),
          ),
        )
      : whole;
    const action = mixer.clipAction(clip);
    action.setEffectiveWeight(0);
    action.play();
    actions.set(key(name, part), action);
  };
  for (const name of clipNames(rig.clips)) add(name);
  if (split) {
    const halves = splitClipNames(rig.clips);
    for (const name of halves.upper) add(name, 'upper');
    for (const name of halves.lower) add(name, 'lower');
  }
  const duration = (name: string) =>
    actions.get(key(name))?.getClip().duration ?? 0;

  let deadFor = 0;

  return {
    object,
    pose(pose: CharacterPose, dt: number) {
      deadFor = pose.dead ? deadFor + dt : 0;
      const commands = driveClips(rig.clips, pose, deadFor, duration, split);
      for (const [id, action] of actions) {
        const command = commands.find((c) => key(c.name, c.part) === id);
        action.setEffectiveWeight(command?.weight ?? 0);
        if (!command || command.time === null) {
          // ciclo: anda sozinho
          action.setEffectiveTimeScale(1);
          continue;
        }
        // acao pontual: o ponto do clipe e o que a simulacao manda
        action.setEffectiveTimeScale(0);
        action.time = command.time;
      }
      mixer.update(dt);
      const rolling = rig.roll && pose.dash !== null && !pose.dead;
      const air = rolling ? Math.min(1, Math.max(0, pose.dash!)) : 0;
      // sai e chega devagar: a volta fecha junto com o pouso
      const turned = air * air * (3 - 2 * air);
      tumble.rotation.z = rolling ? -turned * Math.PI * 2 * rig.roll!.turns : 0;
      tumble.position.y =
        pivot + (rolling ? Math.sin(Math.PI * air) * rig.roll!.height : 0);
    },
    slot(name: string) {
      const bone = rig.slots[name];
      if (!bone) return null;
      // o carregador de glTF tira ponto e espaco do nome dos nos
      return (
        body.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(bone)) ??
        null
      );
    },
    highlight(color: number | null) {
      for (const material of materials.values()) {
        material.emissive.setHex(color ?? BLACK);
      }
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(body);
      object.removeFromParent();
      for (const material of materials.values()) material.dispose();
    },
  };
}
