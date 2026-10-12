import * as THREE from 'three';

import {
  type Character,
  katanaBlade,
} from '@/app/engine/renderers/character.renderer';
import type { WeaponId } from '@/app/modules/world/types/world.types';

// Modelos das armas: low-poly de cor chapada, sem contorno.
// Cano em +x, y para cima, espessura em z, simetrico em z.
// Os perfis foram tracados sobre as imagens de referencia: cada `Trace`
// converte pixel da imagem em unidade do modelo.
// Usados no preview do HUD (engine/weapon-preview.ts) e na mao do player
// (world.renderer.ts).

// 'ammo' nao e arma: e a foto da municao, usada na recarga da loja
export type WeaponModelId = WeaponId | 'sword' | 'ammo';

export type WeaponModel = { root: THREE.Group; dispose: () => void };

type Pt = [x: number, y: number];
type Trace = (px: number, py: number) => Pt;

type Kit = {
  paint: (color: number) => THREE.Material;
  add: (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x?: number,
    y?: number,
    z?: number,
  ) => void;
};

// frente do ferrolho e eixo do cano da pistola, em unidades do modelo
export const PISTOL_MUZZLE_X = 2.5;
export const PISTOL_BORE_Y = 0.17;

// chapa: perfil lateral com espessura `depth` centrada em z; `bevel` chanfra
// as quinas sem crescer a silhueta
function plate(
  points: Pt[],
  depth: number,
  bevel = 0,
  hole?: Pt[],
): THREE.BufferGeometry {
  const toVectors = (list: Pt[]) =>
    list.map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape(toVectors(points));
  if (hole) shape.holes.push(new THREE.Path(toVectors(hole)));
  const inner = depth - 2 * bevel;
  return new THREE.ExtrudeGeometry(shape, {
    depth: inner,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
  }).translate(0, 0, -inner / 2);
}

// cilindro ao longo de +x, comecando na origem
function rod(
  radius: number,
  length: number,
  segments = 12,
): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius, length, segments)
    .rotateZ(-Math.PI / 2)
    .translate(length / 2, 0, 0);
}

function pistol({ paint, add }: Kit, silenced: boolean): void {
  // origem na traseira do ferrolho, na linha entre ferrolho e armacao
  const p: Trace = (px, py) => [(665 - px) / 250, (105 - py) / 250];
  const black = paint(0x1b1b1f);
  const tan = paint(0x6f6339);
  const tanDark = paint(0x594f2c);
  const brown = paint(0x5a3d34);
  const plateGrey = paint(0x2c2f33);

  // ferrolho
  add(
    plate(
      [p(40, 30), p(48, 25), p(660, 25), p(668, 40), p(665, 105), p(40, 105)],
      0.32,
      0.02,
    ),
    black,
  );
  add(plate([p(68, 17), p(88, 17), p(88, 25), p(68, 25)], 0.08), black);
  add(plate([p(608, 13), p(640, 13), p(640, 25), p(608, 25)], 0.24), black);

  // armacao: trilho, guarda-mato (com o vao) e punho em uma peca so
  add(
    plate(
      [
        p(48, 105),
        p(678, 105),
        p(680, 112),
        p(668, 140),
        p(652, 175),
        p(662, 240),
        p(690, 350),
        p(702, 410),
        p(690, 432),
        p(515, 440),
        // sulcos dos dedos
        p(508, 410),
        p(496, 398),
        p(500, 378),
        p(486, 362),
        p(490, 340),
        p(474, 322),
        p(470, 270),
        p(455, 245),
        p(425, 270),
        p(265, 272),
        p(250, 258),
        p(240, 165),
        p(95, 165),
        p(62, 150),
        p(48, 148),
      ],
      0.3,
      0.02,
      [
        p(283, 175),
        p(425, 175),
        p(440, 215),
        p(415, 247),
        p(290, 250),
        p(280, 240),
      ],
    ),
    tan,
  );
  add(plate([p(50, 128), p(190, 128), p(190, 134), p(50, 134)], 0.32), tanDark);
  add(
    plate(
      [
        p(480, 178),
        p(497, 163),
        p(530, 163),
        p(548, 178),
        p(530, 193),
        p(497, 193),
      ],
      0.33,
    ),
    tanDark,
  );
  add(
    new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6).rotateX(Math.PI / 2),
    brown,
    ...p(335, 135),
  );

  // placas do punho, trava do ferrolho e retem do carregador
  add(
    plate(
      [
        p(510, 255),
        p(585, 232),
        p(635, 250),
        p(672, 330),
        p(690, 395),
        p(560, 418),
        p(530, 400),
        p(503, 300),
      ],
      0.34,
      0.015,
    ),
    brown,
  );
  add(plate([p(470, 108), p(515, 108), p(515, 124), p(470, 124)], 0.34), brown);
  add(plate([p(474, 220), p(500, 220), p(500, 240), p(474, 240)], 0.34), brown);

  add(
    plate(
      [
        p(395, 175),
        p(415, 175),
        p(418, 200),
        p(385, 222),
        p(362, 226),
        p(360, 216),
        p(385, 205),
        p(395, 190),
      ],
      0.07,
    ),
    black,
  );
  // base do carregador
  add(
    plate(
      [
        p(520, 438),
        p(700, 428),
        p(712, 445),
        p(705, 468),
        p(545, 472),
        p(532, 460),
      ],
      0.33,
      0.02,
    ),
    plateGrey,
  );

  if (!silenced) return;
  // silenciador: cano rosqueado saindo do ferrolho e tubo no mesmo eixo
  const tube = paint(0x3a3d44);
  add(rod(0.07, 0.14), black, PISTOL_MUZZLE_X, PISTOL_BORE_Y);
  add(rod(0.16, 0.12), black, PISTOL_MUZZLE_X + 0.1, PISTOL_BORE_Y);
  add(rod(0.145, 1.3), tube, PISTOL_MUZZLE_X + 0.1, PISTOL_BORE_Y);
  add(rod(0.16, 0.06), black, PISTOL_MUZZLE_X + 1.36, PISTOL_BORE_Y);
  add(rod(0.06, 0.01), paint(0x050506), PISTOL_MUZZLE_X + 1.42, PISTOL_BORE_Y);
}

// escopeta de dois canos lado a lado, serrada
function shotgun({ paint, add }: Kit): void {
  // origem na culatra, na base dos canos
  const s: Trace = (px, py) => [(px - 235) / 160, (140 - py) / 160];
  const barrel = paint(0x3a3d42);
  const receiver = paint(0x464a50);
  const dark = paint(0x2a2c30);
  const wood = paint(0x5c3b2e);
  const BARREL_R = 0.125;
  const BARREL_Z = 0.12;
  const [barrelX, barrelY] = s(228, 121);
  const length = s(650, 0)[0] - barrelX;

  for (const side of [1, -1]) {
    const z = side * BARREL_Z;
    add(rod(BARREL_R, length), barrel, barrelX, barrelY, z);
    add(rod(0.085, 0.01), paint(0x050506), barrelX + length, barrelY, z);
    // caes
    add(
      plate(
        [s(168, 112), s(165, 97), s(175, 92), s(190, 100), s(192, 112)],
        0.08,
      ),
      dark,
      0,
      0,
      z,
    );
  }
  add(
    plate(
      [
        s(225, 102),
        s(240, 97),
        s(345, 97),
        s(365, 105),
        s(365, 150),
        s(360, 180),
        s(235, 188),
        s(222, 182),
      ],
      0.5,
      0.03,
    ),
    receiver,
  );
  // telha
  add(
    plate([s(362, 132), s(590, 132), s(588, 150), s(362, 178)], 0.42, 0.03),
    wood,
  );
  // coronha serrada em punho
  add(
    plate(
      [
        s(232, 104),
        s(200, 108),
        s(165, 120),
        s(110, 152),
        s(30, 238),
        s(28, 252),
        s(45, 268),
        s(98, 264),
        s(118, 240),
        s(150, 205),
        s(190, 190),
        s(232, 188),
      ],
      0.4,
      0.04,
    ),
    wood,
  );
  add(
    plate(
      [
        s(170, 188),
        s(238, 188),
        s(240, 205),
        s(226, 222),
        s(186, 222),
        s(172, 208),
      ],
      0.08,
      0,
      [
        s(180, 192),
        s(230, 192),
        s(231, 203),
        s(222, 214),
        s(190, 214),
        s(181, 205),
      ],
    ),
    receiver,
  );
  // um gatilho por cano
  for (const [dx, z] of [
    [0, 0.02],
    [-14, -0.02],
  ]) {
    add(
      plate(
        [
          s(212 + dx, 190),
          s(220 + dx, 190),
          s(218 + dx, 208),
          s(211 + dx, 206),
        ],
        0.025,
      ),
      dark,
      0,
      0,
      z,
    );
  }
}

// mesma katana que o player leva na mao, deitada com a ponta em +x
function sword({ paint, add }: Kit): void {
  add(rod(0.028, 0.26, 8), paint(0x1c1c28), -0.1);
  add(rod(0.085, 0.025), paint(0xd9a441), 0.16);
  add(
    // fio para baixo: a ponta curva para cima
    katanaBlade()
      .rotateY(Math.PI / 2)
      .rotateZ(-Math.PI / 2)
      .rotateX(Math.PI),
    paint(0xc8ccd8),
    0.185,
  );
}

// tres cartuchos em pe, levemente tortos: estojo de latao e ponta de cobre
function ammo({ paint, add }: Kit): void {
  const brass = paint(0xd9b84a);
  const copper = paint(0xd98a5a);
  const rim = paint(0xa8862c);
  for (const [x, z, lean] of [
    [-0.34, 0.06, 0.1],
    [0, -0.1, -0.04],
    [0.34, 0.08, -0.12],
  ]) {
    add(
      new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10)
        .translate(0, 0.025, 0)
        .rotateZ(lean),
      rim,
      x,
      0,
      z,
    );
    add(
      new THREE.CylinderGeometry(0.13, 0.13, 0.55, 10)
        .translate(0, 0.325, 0)
        .rotateZ(lean),
      brass,
      x,
      0,
      z,
    );
    add(
      new THREE.SphereGeometry(0.125, 10, 8)
        .scale(1, 2.2, 1)
        .translate(0, 0.62, 0)
        .rotateZ(lean),
      copper,
      x,
      0,
      z,
    );
  }
}

export function createWeaponModel(id: WeaponModelId): WeaponModel {
  const root = new THREE.Group();
  const owned: { dispose: () => void }[] = [];
  const kit: Kit = {
    paint(color) {
      const material = new THREE.MeshLambertMaterial({
        color,
        flatShading: true,
      });
      owned.push(material);
      return material;
    },
    add(geometry, material, x = 0, y = 0, z = 0) {
      owned.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      root.add(mesh);
    },
  };
  if (id === 'ammo') ammo(kit);
  else if (id === 'sword') sword(kit);
  else if (id === 'shotgun') shotgun(kit);
  else pistol(kit, id === 'silenced');
  return {
    root,
    dispose() {
      for (const item of owned) item.dispose();
    },
  };
}

// Arma de fogo na mao de um personagem. Medidas em unidades do modelo:
// `grip` e onde a mao segura, `muzzle` a boca do cano. `kick` e `flash`
// escalam o recuo e o clarao de cada arma (world.renderer).
export const GUNS: Record<
  WeaponId,
  {
    scale: number;
    grip: number[];
    muzzle: number[];
    kick: number;
    flash: number;
  }
> = {
  pistol: {
    scale: 0.22,
    grip: [0.3, -0.78],
    muzzle: [PISTOL_MUZZLE_X, PISTOL_BORE_Y],
    kick: 1,
    flash: 1,
  },
  // silenciador segura o recuo e quase esconde o clarao
  silenced: {
    scale: 0.22,
    grip: [0.3, -0.78],
    muzzle: [PISTOL_MUZZLE_X + 1.43, PISTOL_BORE_Y],
    kick: 0.75,
    flash: 0.4,
  },
  shotgun: {
    scale: 0.22,
    grip: [-0.72, -0.44],
    muzzle: [2.6, 0.12],
    kick: 1.9,
    flash: 1.7,
  },
};
const GUN_IDS = Object.keys(GUNS) as WeaponId[];
// braco direito estendido para frente, apontando a arma
const GUN_AIM = Math.PI / 2 - 0.1;
// altura da mao no braco
export const HAND_Y = -0.3;

export type HeldGuns = {
  // suporte na mao direita; o recuo desloca ele ao longo do braco
  mount: THREE.Group;
  roots: Record<WeaponId, THREE.Group>;
  // troca o que o personagem segura e a pose do braco; null = espada
  hold: (id: WeaponId | null) => void;
  dispose: () => void;
};

// Um modelo por arma preso a mao direita, todos escondidos ate `hold`. O
// cano (+x do modelo) fica ao longo do braco. Jogo e preview usam o mesmo.
// `size` escala as armas em torno da mao (look.weapon do player).
export function createHeldGuns(character: Character, size = 1): HeldGuns {
  const swordHold = character.hold;
  const mount = new THREE.Group();
  mount.position.y = HAND_Y;
  mount.rotation.z = -Math.PI / 2;
  mount.scale.setScalar(size);
  character.arms[0].add(mount);
  const models = GUN_IDS.map((id) => {
    const model = createWeaponModel(id);
    const { scale, grip } = GUNS[id];
    model.root.scale.setScalar(scale);
    model.root.position.set(-grip[0] * scale, -grip[1] * scale, 0);
    model.root.visible = false;
    mount.add(model.root);
    return model;
  });
  const roots = Object.fromEntries(
    GUN_IDS.map((id, i) => [id, models[i].root]),
  ) as Record<WeaponId, THREE.Group>;
  return {
    mount,
    roots,
    hold(id) {
      character.hold = id ? GUN_AIM : swordHold;
      character.arms[0].rotation.z = character.hold ?? 0;
      if (character.sword) character.sword.visible = !id;
      for (const gun of GUN_IDS) roots[gun].visible = gun === id;
    },
    dispose() {
      mount.removeFromParent();
      for (const model of models) model.dispose();
    },
  };
}
