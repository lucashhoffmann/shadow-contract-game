import { COLORS } from '@/shared/colors';
import * as THREE from 'three';

import { SLASH_TIME } from '@/app/modules/world/constants/world.constants';
import type { EnemyKind, Vec2 } from '@/app/modules/world/types/world.types';
import type { PlayerLook } from '@/app/store/game-store/game.store';

// Monta personagens (player e inimigos) com pecas simples, em pose de descanso.
// Nao poe na cena nem anima: isso e de quem usa (jogo ou preview).
// Personagem: +x local e a frente, +z e a direita.

const HEAD_Y = 1.1;
const HIP_Y = 0.36;
const SHOULDER_Y = 0.76;
const TORSO_Y = 0.6;
const SHADOW_Y = 0.02;
// bracos levemente abertos para fora
export const ARM_OPEN = 0.25;
// agachado: fracao da perna que o quadril desce, e a abertura que da isso
const CROUCH_DROP = 0.6;
const CROUCH_SPREAD = Math.acos(1 - CROUCH_DROP);
// agachado o tronco dobra na cintura: gira para frente e encurta, e a cabeca
// e os ombros descem e avancam junto
const CROUCH_FOLD = 0.55;
const CROUCH_SQUASH = 0.25;
const CROUCH_HEAD = [0.16, -0.22];
const CROUCH_SHOULDER = [0.1, -0.13];
const OUTLINE = 0.025;
// [direita, esquerda] em z local
export const SIDES = [1, -1];
// em descanso a lamina aponta para tras e para fora, visivel de cima
export const SWORD_REST_TURN = 0.5;
export const SWORD_REST_TILT = 1.35;

export type CharacterKind = 'player' | EnemyKind;

// peca: geometria, material, posicao local, inclinacao em z e escala.
// Pecas de cabeca usam posicao relativa ao centro da cabeca.
type Part = [
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  tilt?: number,
  scale?: number,
];

export type Character = {
  root: THREE.Group;
  // inclina o corpo todo para frente ao correr
  lean: THREE.Group;
  // torso e membros giram juntos sem alterar a inclinacao da corrida
  body: THREE.Group;
  // perna maior ergue o corpo para o pe continuar no chao
  lift: number;
  head: THREE.Group;
  // altura da cabeca em pe
  headY: number;
  // pecas do tronco, com origem no centro dele: dobra ao agachar
  trunk: THREE.Group;
  shadow: THREE.Mesh;
  // pivos no quadril e no ombro, na ordem de SIDES
  legs: THREE.Group[];
  arms: THREE.Group[];
  // braco direito que segura arma fica nesse angulo em vez de balancar
  hold: number | null;
  sword: THREE.Group | null;
  last: Vec2 | null;
  speed: number;
  idle: number;
};

export type CharacterKit = {
  make: (kind: CharacterKind) => Character;
  dispose: () => void;
};

const size = new THREE.Vector3();

// Cada peca ganha contorno: casca invertida, OUTLINE maior em cada eixo.
// ponytail: 2 draw calls por peca; fundir geometrias se passar de ~30 inimigos
function addParts(
  group: THREE.Group,
  parts: Part[],
  outline: THREE.Material,
): void {
  for (const [geometry, material, x, y, z, tilt = 0, scale = 1] of parts) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.z = tilt;
    mesh.scale.setScalar(scale);
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    geometry.boundingBox?.getSize(size);
    const hull = new THREE.Mesh(geometry, outline);
    hull.scale.set(
      1 + (2 * OUTLINE) / size.x,
      1 + (2 * OUTLINE) / size.y,
      1 + (2 * OUTLINE) / size.z,
    );
    mesh.add(hull);
    group.add(mesh);
  }
}

// Lamina de katana: perfil curvo com ponta, base na origem, crescendo em +y.
// Fio em -z e dorso em +z; fina em x, para aparecer larga vista de cima.
export function katanaBlade(): THREE.BufferGeometry {
  const profile = new THREE.Shape();
  profile.moveTo(-0.035, 0);
  profile.quadraticCurveTo(-0.05, 0.45, 0, 0.78);
  profile.lineTo(0.075, 0.88);
  profile.quadraticCurveTo(0.02, 0.45, 0.035, 0);
  return new THREE.ExtrudeGeometry(profile, {
    depth: 0.02,
    bevelEnabled: false,
  })
    .translate(0, 0, -0.01)
    .rotateY(-Math.PI / 2);
}

// `look` vale para o kit inteiro: aparencia nova pede kit novo
export function createCharacterKit(look: PlayerLook): CharacterKit {
  const geo = {
    shadow: new THREE.CircleGeometry(0.38, 20),
    // chibi: cabeca grande, tronco curto com ombros largos em z
    torso: new THREE.CapsuleGeometry(0.2, 0.16, 4, 12).scale(0.85, 1, 1.15),
    head: new THREE.SphereGeometry(0.3, 18, 14),
    leg: new THREE.CapsuleGeometry(0.085, 0.14, 4, 8),
    // sapato arredondado: capsula deitada ao longo de x e achatada, nas
    // mesmas medidas da caixa antiga (0.2 x 0.08 x 0.13)
    foot: new THREE.CapsuleGeometry(0.065, 0.07, 6, 14)
      .rotateZ(Math.PI / 2)
      .scale(1, 0.62, 1),
    arm: new THREE.CapsuleGeometry(0.075, 0.18, 4, 8),
    hand: new THREE.SphereGeometry(0.085, 10, 8),
    band: new THREE.TorusGeometry(0.287, 0.035, 8, 24).rotateX(Math.PI / 2),
    face: new THREE.BoxGeometry(0.12, 0.1, 0.34),
    eye: new THREE.BoxGeometry(0.03, 0.06, 0.05),
    tail: new THREE.BoxGeometry(0.26, 0.05, 0.07),
    blade: katanaBlade(),
    grip: new THREE.CylinderGeometry(0.028, 0.028, 0.26, 8),
    guard: new THREE.CylinderGeometry(0.085, 0.085, 0.025, 12),
    hair: new THREE.SphereGeometry(0.315, 18, 8, 0, Math.PI * 2, 0, 1.4),
    shirt: new THREE.BoxGeometry(0.05, 0.26, 0.16),
    tie: new THREE.BoxGeometry(0.04, 0.22, 0.06),
    gun: new THREE.BoxGeometry(0.09, 0.24, 0.07),
  };
  // rampa de 3 tons: sombra em degraus em vez de gradiente
  const ramp = new THREE.DataTexture(
    new Uint8Array([110, 190, 255]),
    3,
    1,
    THREE.RedFormat,
  );
  ramp.needsUpdate = true;
  const toon = (color: THREE.ColorRepresentation): THREE.Material =>
    new THREE.MeshToonMaterial({ color, gradientMap: ramp });
  const mat = {
    outline: new THREE.MeshBasicMaterial({
      color: COLORS.model.c14141f,
      side: THREE.BackSide,
    }),
    shadow: new THREE.MeshBasicMaterial({
      color: COLORS.model.c000000,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
    playerCloth: toon(look.cloth),
    playerAccent: toon(look.accent),
    playerSkin: toon(look.skin),
    gold: toon(COLORS.model.cd9a441),
    dark: toon(COLORS.model.c1c1c28),
    steel: toon(COLORS.model.cc8ccd8),
    skin: toon(COLORS.model.ce8b796),
    purple: toon(COLORS.model.c5a3f8a),
    red: toon(COLORS.model.cd93636),
    navy: toon(COLORS.model.c2c3e66),
    white: toon(COLORS.model.cf2f2f2),
  };

  const eyes: Part[] = SIDES.map((side) => [
    geo.eye,
    mat.dark,
    0.285,
    -0.03,
    side * 0.085,
  ]);

  // ninja: capuz com rosto a mostra e faixa com pontas soltas atras
  function ninja(
    cloth: THREE.Material,
    accent: THREE.Material,
    skin: THREE.Material,
  ): { body: Part[]; head: Part[] } {
    return {
      body: [[geo.torso, cloth, 0, 0.6, 0]],
      head: [
        [geo.head, cloth, 0, 0, 0],
        [geo.face, skin, 0.22, -0.03, 0],
        ...eyes,
        [geo.band, accent, 0, 0.09, 0],
        [geo.tail, accent, -0.4, 0.09, 0.05, 0.35],
        [geo.tail, accent, -0.4, 0.09, -0.05, -0.35],
      ],
    };
  }

  const CLOTH = { player: mat.playerCloth, ninja: mat.purple, suit: mat.navy };
  // cabo na mao, guarda e lamina; a origem e o ponto de pegada
  const katanaInHand: Part[] = [
    [geo.grip, mat.dark, 0, 0.03, 0],
    [geo.guard, mat.gold, 0, 0.165, 0],
    [geo.blade, mat.steel, 0, 0.175, 0],
  ];
  const enemyNinja = ninja(mat.purple, mat.red, mat.skin);
  const PARTS: Record<CharacterKind, { body: Part[]; head: Part[] }> = {
    // player leva a espada na mao (grupo proprio, para o golpe)
    player: ninja(mat.playerCloth, mat.playerAccent, mat.playerSkin),
    ninja: enemyNinja,
    // terno: camisa e gravata na frente, cabelo; pistola vai no braco
    suit: {
      body: [
        [geo.torso, mat.navy, 0, 0.6, 0],
        [geo.shirt, mat.white, 0.15, 0.64, 0],
        [geo.tie, mat.red, 0.165, 0.64, 0],
      ],
      head: [
        [geo.head, mat.skin, 0, 0, 0],
        [geo.hair, mat.dark, -0.03, 0, 0],
        ...eyes,
      ],
    },
  };
  // angulo do braco direito: ninjas seguram espada, terno aponta a pistola
  const HOLD: Record<CharacterKind, number | null> = {
    player: 0.5,
    ninja: 0.5,
    suit: Math.PI / 2 - 0.1,
  };

  function make(kind: CharacterKind): Character {
    const cloth = CLOTH[kind];
    // so o player e configuravel
    const scale =
      kind === 'player'
        ? look
        : { head: 1, legs: 1, hands: 1, feet: 1, weapon: 1 };
    const lift = HIP_Y * (scale.legs - 1);
    const root = new THREE.Group();
    const lean = new THREE.Group();
    const body = new THREE.Group();
    lean.position.y = lift;
    const head = new THREE.Group();
    // cresce para cima: o queixo quase nao sai do lugar
    head.position.y = HEAD_Y + (scale.head - 1) * 0.25;
    head.scale.setScalar(scale.head);
    const trunk = new THREE.Group();
    trunk.position.y = TORSO_Y;
    addParts(trunk, PARTS[kind].body, mat.outline);
    for (const part of trunk.children) part.position.y -= TORSO_Y;
    body.add(trunk);
    addParts(head, PARTS[kind].head, mat.outline);
    const shadow = new THREE.Mesh(geo.shadow, mat.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = SHADOW_Y;
    body.add(head);
    lean.add(body);
    root.add(lean, shadow);

    const limb = (y: number, z: number, parts: Part[]) => {
      const pivot = new THREE.Group();
      pivot.position.set(0, y, z);
      addParts(pivot, parts, mat.outline);
      body.add(pivot);
      return pivot;
    };
    const legs = SIDES.map((side) => {
      const pivot = limb(HIP_Y, side * 0.11, [
        [geo.leg, cloth, 0, -0.155, 0],
        // cresce a partir do calcanhar e da sola: nao afunda no chao
        [
          geo.foot,
          mat.dark,
          -0.05 + 0.1 * scale.feet,
          -0.34 + 0.04 * scale.feet,
          0,
          0,
          scale.feet,
        ],
      ]);
      pivot.scale.setScalar(scale.legs);
      return pivot;
    });
    const handMat = kind === 'suit' ? mat.skin : cloth;
    const hold = HOLD[kind];
    const arms = SIDES.map((side) => {
      const parts: Part[] = [
        [geo.arm, cloth, 0, -0.13, 0],
        [geo.hand, handMat, 0, -0.3, 0, 0, scale.hands],
      ];
      if (kind === 'suit' && side === 1) {
        parts.push([geo.gun, mat.dark, 0, -0.42, 0]);
      }
      const pivot = limb(SHOULDER_Y, side * 0.26, parts);
      pivot.rotation.x = -side * ARM_OPEN;
      if (side === 1 && hold !== null) pivot.rotation.z = hold;
      return pivot;
    });

    let sword: THREE.Group | null = null;
    if (kind !== 'suit') {
      // A espada acompanha o punho durante a preparacao e o corte.
      sword = new THREE.Group();
      sword.position.set(0, -0.3, 0);
      sword.rotation.set(0, SWORD_REST_TURN, SWORD_REST_TILT);
      sword.scale.setScalar(scale.weapon);
      addParts(sword, katanaInHand, mat.outline);
      arms[0].add(sword);
    }
    return {
      root,
      lean,
      body,
      lift,
      head,
      headY: head.position.y,
      trunk,
      shadow,
      legs,
      arms,
      hold,
      sword,
      last: null,
      speed: 0,
      idle: 0,
    };
  }

  return {
    make,
    dispose() {
      for (const item of [ramp, ...Object.values(geo), ...Object.values(mat)]) {
        item.dispose();
      }
    },
  };
}

// Pose compartilhada pelo player e pelo ninja; o terno usa o mesmo tempo para o recuo.
export function poseAttack(character: Character, remaining: number): void {
  const { body, head, arms, legs, sword } = character;
  const phase = Math.max(0, Math.min(1, 1 - remaining / SLASH_TIME));
  const windup =
    remaining > 0 && phase < 0.5 ? Math.sin(Math.PI * phase * 2) : 0;
  const strike =
    remaining > 0 && phase > 0.2
      ? Math.sin((Math.PI * (phase - 0.2)) / 0.8)
      : 0;
  body.rotation.y = -windup * 0.3 + strike * (sword ? 0.48 : 0.12);
  body.rotation.z = windup * 0.1 - strike * (sword ? 0.16 : -0.08);
  body.position.x = -windup * 0.08 + strike * (sword ? 0.12 : -0.08);
  head.rotation.z = -strike * 0.1;
  arms[0].rotation.y = windup * 0.55 - strike * (sword ? 0.65 : 0.1);
  arms[1].rotation.y = -windup * 0.18;
  if (remaining <= 0) {
    if (sword) sword.rotation.set(0, SWORD_REST_TURN, SWORD_REST_TILT);
    return;
  }
  arms[0].rotation.z =
    (character.hold ?? 0) - windup * 0.6 + strike * (sword ? 0.95 : -0.32);
  arms[1].rotation.z += windup * 0.25 + strike * (sword ? 0.45 : 0.12);
  legs[0].rotation.z -= strike * 0.28;
  legs[1].rotation.z += strike * 0.2;
  if (sword) {
    sword.rotation.y = SWORD_REST_TURN + windup * 0.55 - strike * 1.65;
    sword.rotation.z = SWORD_REST_TILT + windup * 0.25 - strike * 4.15;
  }
}

// Agachado (cobertura, saida e queda do salto): quadril desce, o tronco
// dobra para frente e as pernas abrem em passo, uma a frente e outra atras. `stride` (-1..1) e a fase da
// passada. Devolve quanto o corpo desce.
// ponytail: perna sem joelho; no meio da passada o pe afunda no chao, o que
// nao aparece de cima. Dobrar joelho se a camera baixar.
export function poseCrouch(
  character: Character,
  amount: number,
  stride: number,
): number {
  const { legs, arms, head, trunk } = character;
  trunk.rotation.z = -CROUCH_FOLD * amount;
  trunk.scale.y = 1 - CROUCH_SQUASH * amount;
  head.position.x = CROUCH_HEAD[0] * amount;
  head.position.y = character.headY + CROUCH_HEAD[1] * amount;
  SIDES.forEach((side, i) => {
    arms[i].position.x = CROUCH_SHOULDER[0] * amount;
    arms[i].position.y = SHOULDER_Y + CROUCH_SHOULDER[1] * amount;
    legs[i].rotation.z +=
      (side * CROUCH_SPREAD * stride - legs[i].rotation.z) * amount;
  });
  // braco livre vem a frente apoiar a mira
  arms[1].rotation.z += (0.9 - arms[1].rotation.z) * amount;
  return (HIP_Y + character.lift) * CROUCH_DROP * amount;
}

// Morto: estirado de brucos, bracos e pernas abertos. Supoe o root deitado
// para frente (rotation.z = -PI/2); o tronco fica centrado na origem do root.
export function poseDead(character: Character): void {
  const { lean, body, head, arms, legs, sword } = character;
  // morreu agachado: desfaz a dobra do tronco
  poseCrouch(character, 0, 0);
  lean.rotation.z = 0;
  lean.position.set(0, -TORSO_Y, 0);
  body.rotation.set(0, 0, 0);
  body.position.x = 0;
  // rosto virado de lado
  head.rotation.set(0, 0.9, 0);
  // assimetrico de proposito: corpo caido, nao estrela
  arms[0].rotation.set(-2.2, 0, 0);
  arms[1].rotation.set(1.5, 0, 0);
  legs[0].rotation.set(-0.5, 0, 0);
  legs[1].rotation.set(0.3, 0, 0);
  if (sword) sword.rotation.set(0, SWORD_REST_TURN, SWORD_REST_TILT);
}
