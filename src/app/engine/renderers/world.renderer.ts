import * as THREE from 'three';

import {
  type Character,
  type CharacterKind,
  createCharacterKit,
  ARM_OPEN,
  poseAttack,
  poseCrouch,
  poseDead,
  SIDES,
} from '@/app/engine/renderers/character.renderer';
import {
  castRay,
  doorOpen,
  isSolidTile,
  nearbyProp,
  tileAt,
  tileCenter,
} from '@/app/modules/level/utils/grid.util';
import {
  createHeldGuns,
  GUNS,
  HAND_Y,
} from '@/app/engine/renderers/weapon.renderer';
import { meleeTarget } from '@/app/modules/combat/systems/combat.system';
import { nearbyChest } from '@/app/modules/shop/systems/shop.system';
import {
  DASH_TIME,
  LAUNCH_TIME,
  FLOATER_TIME,
  HEARING_YELLOW,
  ROOM_H,
  ROOM_W,
  SHOP_EVERY,
  SHOT_TIME,
  VIEW_HALF_ANGLE,
} from '@/app/modules/world/constants/world.constants';
import type {
  Enemy,
  EnemyKind,
  EnemyState,
  PickupKind,
  Projectile,
  Prop,
  Room,
  Vec2,
  WeaponId,
  World,
} from '@/app/modules/world/types/world.types';
import type { PlayerLook } from '@/app/store/game-store/game.store';

// Desenha o World. Nunca muta o World.
// Simulacao (x, y) vira three (x, altura, -y).
// Personagem: +x local e a frente (direcao de `facing`), +z e a direita.
// Animacao (inclinar, olhar, golpe) e so visual: sai daqui, nao da simulacao.

const WALL_HEIGHT = 1.2;
const CONE_SEGMENTS = 24;
const CONE_Y = 0.03;
const BULLET_Y = 0.7;

const MOVING_SPEED = 0.5;
const RUN_LEAN = 0.38;
const ADRENALINE_LEAN = 0.55;
const IDLE_DELAY = 0.8;
const FOLLOW_RATE = 24;
const SNAP_DISTANCE = 2;
const JUMP_HEIGHT = 0.8;
// altura do centro do tronco: o mergulho gira em volta dele, nao dos pes
const FLIP_PIVOT_Y = 0.6;
// no alto do salto o corpo fica quase deitado, em pose de corrida: uma perna
// dobrada com o joelho a frente e a outra esticada atras; braco livre a
// frente e o da arma recolhido atras. Angulos relativos ao tronco inclinado.
const DIVE_TILT = 1.3;
// [direita, esquerda], na ordem de SIDES
const DIVE_LEGS = [1.8, 0];
const DIVE_ARMS = [-0.3, 1.9];
// parede ou caixa a menos disso do centro: agacha em cobertura
const COVER_DISTANCE = 0.75;
const CROUCH_LEAN = 0.35;
// marcador deitado para tras, de frente para a camera (ver game-engine)
const MARKER_TILT = -1;
// ouvido abaixo disso nao mostra a orelha: evita piscar a cada passo longe
const HEARING_SHOWN = 0.1;
// encostado: quanto o corpo recua ate a parede e sai de lado na quina
const HUG_BACK = 0.14;
const PEEK_SHIFT = 0.16;
const PEEK_LOOK = 1.3;
const CARDINALS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
// voltas da shuriken no ar (rad/s)
const SHURIKEN_SPIN = 28;
// F da facada: acima da cabeca e do marcador do inimigo
const KNIFE_PROMPT_Y = 2.2;
// altura maxima do corpo lancado por um golpe so
const LAUNCH_HEIGHT = 0.5;
// altura do root deitado: a cabeca encosta no chao
const DEAD_Y = 0.3;
// recuo no pico: braco sobe, arma volta para o ombro, corpo vai para tras
const RECOIL_RISE = 0.5;
const RECOIL_BACK = 0.07;
const RECOIL_PUSH = 0.05;
// o clarao dura so o comeco do recuo
const FLASH_TIME = 0.07;
// numero de dano flutuante. A fonte vem do index.html (Google Fonts)
const FLOATER_FONT = '76px Creepster';
const FLOATER_CANVAS = [320, 120];
// tamanho do texto no mundo, na mesma proporcao do canvas
const FLOATER_SIZE = [2, 0.75];
const FLOATER_Y = 1.7;
const FLOATER_RISE = 0.8;
// mini zoom: cresce ate FLOATER_POP nesse trecho inicial, depois assenta
const FLOATER_POP = 1.45;
const FLOATER_POP_END = 0.18;
// destaques escritos sobre o numero, e a cor de cada um
const FLOATER_BANNER = { HEADSHOT: '#ff9a1f', OVERKILL: '#d457ff' };
// cor pelo tamanho do golpe: forte em vermelho, medio em amarelo, fraco em
// verde; erro em claro, para nao parecer acerto
const FLOATER_STRONG = 30;
const FLOATER_WEAK = 5;
function floaterColor(amount: number, onPlayer?: boolean): string {
  if (amount <= 0) return '#f4f1e8';
  // dano sofrido e sempre vermelho
  if (onPlayer) return '#ff2b2b';
  if (amount < FLOATER_WEAK) return '#4be06a';
  if (amount < FLOATER_STRONG) return '#ffd21f';
  return '#ff2b2b';
}
// icone de interacao (F da caixa, B do bau)
const LETTER_SIZE = 0.28;
const KEY_BEVEL = 0.025;
// deitado para a camera: em pe, visto de cima, a letra some
const PROMPT_TILT = -0.9;
const PROMPT_SCALE = 1.4;
const PROMPT_HOP = 0.22;
const PROMPT_PULSE = 0.09;
// porta de correr na saida da sala inicial e de cada loja (entrada do nivel)
const DOOR_X = ROOM_W / 2;
// quanto cada folha corre para o lado ao abrir
const DOOR_SLIDE = 1.45;
// giro da tampa do bau aberta, em torno da dobradica
const CHEST_OPEN = -1.9;
const BLOOD_GROW_TIME = 2.5;
// explosao ao matar: notas de dinheiro e gotas de sangue saltam do inimigo,
// caem com gravidade e somem encolhendo. So visual
const BURST = {
  bills: 22,
  drops: 16,
  // velocidade para os lados e para cima, em unidades por segundo
  spread: 3.2,
  lift: 4.6,
  gravity: 13,
  // segundos no ar e no chao antes de sumir; o fim e o encolher
  billLife: 1.7,
  dropLife: 1.1,
  fade: 0.35,
};
// aparencias do objeto destrutivel; so visual (ver buildProp)
const PROP_VARIANTS = ['crate', 'sideboard', 'barrel', 'plant'] as const;
const DEBRIS = [
  [-0.25, -0.2, 0.4],
  [0.28, -0.1, 1.9],
  [-0.05, 0.3, 2.7],
  [0.3, 0.32, 0.9],
  [-0.32, 0.12, 1.3],
];
// visual do dinheiro no chao. amount/height 0 desliga a animacao
const MONEY = {
  color: 0xcfae52,
  aura: { color: 0xffc83a, opacity: 0.16 },
  // pulso: escala vai e volta em torno de 1 (0.06 = +-6%)
  pulse: { amount: 0.06, speed: 4 },
  // pulo: altura maxima do salto, em tiles
  hop: { height: 0.06, speed: 5 },
};
// coracao e escudo soltos por caixa: altura, vai-e-vem e giro
const FLOAT = { height: 0.6, bob: 3, spin: 1.6 };
// pilhas do dinheiro: x, z, quantas moedas
const COIN_STACKS = [
  [0, 0.13, 8],
  [-0.2, 0.05, 3],
  [0.19, 0.03, 5],
  [0.02, -0.12, 9],
  [0.2, -0.17, 4],
];

// quem salta: personagem, vento nas costas, quanto do giro do lean e
// mergulho ou agachamento (o resto e a inclinacao de correr) e quanto esta
// agachado (0..1)
type Jumper = {
  character: Character;
  wind: THREE.Group;
  flip: number;
  crouch: number;
  // quanto esta encostado de costas na parede (0..1)
  hug: number;
};

// Parede ou caixa colada em `pos`. `back`: para onde o corpo olha de costas
// para ela. `peek`: lado (1 direita, -1 esquerda) em que ela acaba em quina;
// 0 se continua ou acaba dos dois lados.
function coverAt(
  world: World,
  pos: Vec2,
): { back: number; peek: number } | null {
  const solid = (x: number, y: number) =>
    isSolidTile(tileAt(world, Math.floor(x), Math.floor(y)));
  for (const [dx, dy] of CARDINALS) {
    const x = pos.x + dx * COVER_DISTANCE;
    const y = pos.y + dy * COVER_DISTANCE;
    if (!solid(x, y)) continue;
    const open = [1, -1].filter((side) => !solid(x - dy * side, y + dx * side));
    return {
      back: Math.atan2(-dy, -dx),
      peek: open.length === 1 ? open[0] : 0,
    };
  }
  return null;
}
type EnemyView = Jumper & {
  marker: THREE.Group;
  markerParts: THREE.Mesh[];
  // icones do marcador: exclamacao (viu) e orelha (ouviu)
  alarm: THREE.Group;
  ear: THREE.Group;
  cone: THREE.Mesh;
  blood: THREE.Mesh;
  deathAt: number | null;
  // ja soltou a explosao de notas e sangue da morte
  burst: boolean;
};

export type WorldRenderer = {
  sync: (world: World, time: number) => void;
  // icones de interacao a vista agora, e o que cada um faz: F (caixa ou
  // facada) pulsa `interact`, B (bau) pulsa `open`. A engine usa para o toque
  prompts: () => { action: 'interact' | 'open'; object: THREE.Object3D }[];
  dispose: () => void;
};

// perfis das letras do icone de interacao, em um quadrado de altura 1
const LETTER_F = new THREE.Shape(
  [
    [0, 0],
    [0, 1],
    [0.62, 1],
    [0.62, 0.8],
    [0.22, 0.8],
    [0.22, 0.6],
    [0.52, 0.6],
    [0.52, 0.41],
    [0.22, 0.41],
    [0.22, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
);
const LETTER_B = new THREE.Shape()
  .moveTo(0, 0)
  .lineTo(0, 1)
  .lineTo(0.38, 1)
  .absarc(0.38, 0.75, 0.25, Math.PI / 2, -Math.PI / 2, true)
  .absarc(0.38, 0.25, 0.25, Math.PI / 2, -Math.PI / 2, true)
  .lineTo(0, 0);
for (const y of [0.16, 0.6]) {
  LETTER_B.holes.push(
    new THREE.Path()
      .moveTo(0.2, y)
      .lineTo(0.2, y + 0.24)
      .lineTo(0.36, y + 0.24)
      .absarc(0.36, y + 0.12, 0.12, Math.PI / 2, -Math.PI / 2, true)
      .lineTo(0.2, y),
  );
}

// retangulo de cantos redondos, para montar o icone de toque
function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): THREE.Shape {
  return new THREE.Shape()
    .absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
    .absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
    .absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
    .absarc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI * 2, false);
}

// Icone de toque (aparelho sem teclado): mao com o indicador para cima e um
// arco de onda sobre a ponta do dedo. Mesma caixa de altura 1 das letras.
const TAP_ICON = [
  // indicador, palma e polegar
  roundedRect(0.36, 0.34, 0.17, 0.46, 0.085),
  roundedRect(0.24, 0, 0.5, 0.46, 0.13),
  roundedRect(0.08, 0.12, 0.24, 0.15, 0.075),
  // onda do toque
  new THREE.Shape()
    .absarc(0.445, 0.74, 0.3, Math.PI * 0.2, Math.PI * 0.8, false)
    .absarc(0.445, 0.74, 0.23, Math.PI * 0.8, Math.PI * 0.2, true),
];

// letra ou icone em relevo, centrado, com LETTER_SIZE de altura
function letter(shape: THREE.Shape | THREE.Shape[]): THREE.BufferGeometry {
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: false,
    curveSegments: 6,
  })
    .center()
    .scale(LETTER_SIZE, LETTER_SIZE, 0.3);
}

// placa quadrada de cantos redondos e quina chanfrada, de pe em z
function keySlab(
  size: number,
  radius: number,
  depth: number,
): THREE.BufferGeometry {
  const half = size / 2;
  const inner = half - radius;
  const shape = new THREE.Shape()
    .absarc(inner, inner, radius, 0, Math.PI / 2, false)
    .absarc(-inner, inner, radius, Math.PI / 2, Math.PI, false)
    .absarc(-inner, -inner, radius, Math.PI, Math.PI * 1.5, false)
    .absarc(inner, -inner, radius, Math.PI * 1.5, Math.PI * 2, false);
  return new THREE.ExtrudeGeometry(shape, {
    depth: depth - KEY_BEVEL,
    bevelEnabled: true,
    bevelSize: KEY_BEVEL,
    bevelOffset: -KEY_BEVEL,
    bevelThickness: KEY_BEVEL,
    bevelSegments: 1,
    curveSegments: 4,
  });
}

// papel de parede: desenhos de WALLPAPER_SIZE px que se repetem lado a lado;
// true = cor do desenho, false = cor de fundo
const WALLPAPER_SIZE = 16;
const WALLPAPERS: ((x: number, y: number) => boolean)[] = [
  // listras
  (x) => x % 8 < 3,
  // bolinhas
  (x, y) => ((x % 8) - 4) ** 2 + ((y % 8) - 4) ** 2 < 5,
  // tijolos
  (x, y) => y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 4) % 8 === 0,
  // losangos
  (x, y) => Math.abs((x % 8) - 4) + Math.abs((y % 8) - 4) < 3,
  // ziguezague
  (x, y) => (y + Math.abs((x % 8) - 4)) % 8 < 2,
];
// passo aureo: cada nivel cai num tom bem longe do anterior, sem repetir cedo
const HUE_START = 0.65;
const HUE_STEP = 0.618034;

// piso: um desenho por tile (a textura repete uma vez por unidade de mundo)
const FLOORPAPERS: ((x: number, y: number) => boolean)[] = [
  // ladrilho: rejunte na borda de cada tile
  (x, y) => x === 0 || y === 0,
  // xadrez
  (x, y) => (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0,
  // tabuas corridas, emendas desencontradas
  (x, y) => y % 4 === 0 || (x + Math.floor(y / 4) * 5) % 16 === 0,
  // losango no centro de cada tile
  (x, y) => Math.abs(x - 8) + Math.abs(y - 8) < 5,
  // pastilhas
  (x, y) => x % 4 === 0 || y % 4 === 0,
];

type Paper = { material: THREE.Material; texture: THREE.Texture };

// textura de WALLPAPER_SIZE px com duas cores, repetindo nos dois eixos
function paper(
  draw: (x: number, y: number) => boolean,
  hue: number,
  saturation: number,
  lights: number[],
): Paper {
  const colors = lights.map((light) =>
    new THREE.Color().setHSL(hue, saturation, light).convertLinearToSRGB(),
  );
  const data = new Uint8Array(WALLPAPER_SIZE * WALLPAPER_SIZE * 4);
  for (let y = 0; y < WALLPAPER_SIZE; y++) {
    for (let x = 0; x < WALLPAPER_SIZE; x++) {
      const { r, g, b } = colors[draw(x, y) ? 1 : 0];
      data.set([r * 255, g * 255, b * 255, 255], (y * WALLPAPER_SIZE + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, WALLPAPER_SIZE, WALLPAPER_SIZE);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return { material: new THREE.MeshLambertMaterial({ map: texture }), texture };
}

// parede e piso de um nivel (contrato): tom e desenhos proprios. So visual e
// fixo por nivel, entao a mesma run mostra sempre a mesma sequencia.
function wallpaper(level: number): { wall: Paper; floor: Paper } {
  const hue = (HUE_START + level * HUE_STEP) % 1;
  // piso no tom da parede, mas escuro, pouco saturado e de pouco contraste:
  // personagens, cones e sangue continuam se destacando
  const floor = paper(
    FLOORPAPERS[level % FLOORPAPERS.length],
    hue,
    0.22,
    [0.3, 0.36],
  );
  floor.texture.repeat.set(ROOM_W, ROOM_H);
  return {
    wall: paper(WALLPAPERS[level % WALLPAPERS.length], hue, 0.5, [0.4, 0.52]),
    floor,
  };
}

// shuriken: estrela de 4 pontas com furo no meio, fina e deitada
function shurikenGeometry(): THREE.BufferGeometry {
  const star = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 ? 0.07 : 0.22;
    const angle = (i * Math.PI) / 4;
    star[i ? 'lineTo' : 'moveTo'](
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  }
  star.holes.push(new THREE.Path().absarc(0, 0, 0.03, 0, Math.PI * 2, true));
  return new THREE.ExtrudeGeometry(star, {
    depth: 0.03,
    bevelEnabled: false,
    curveSegments: 6,
  })
    .translate(0, 0, -0.015)
    .rotateX(-Math.PI / 2);
}

// coracao gordinho de poucas faces: contorno extrudado com chanfro largo
function heartGeometry(): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  outline.moveTo(25, 25);
  outline.bezierCurveTo(25, 25, 20, 0, 0, 0);
  outline.bezierCurveTo(-30, 0, -30, 35, -30, 35);
  outline.bezierCurveTo(-30, 55, -10, 77, 25, 95);
  outline.bezierCurveTo(60, 77, 80, 55, 80, 35);
  outline.bezierCurveTo(80, 35, 80, 0, 50, 0);
  outline.bezierCurveTo(35, 0, 25, 25, 25, 25);
  // o contorno nasce de ponta para cima: centra, vira e reduz
  return new THREE.ExtrudeGeometry(outline, {
    depth: 14,
    curveSegments: 4,
    bevelThickness: 16,
    bevelSize: 12,
    bevelSegments: 2,
  })
    .center()
    .rotateZ(Math.PI)
    .scale(0.004, 0.004, 0.004);
}

// escudo: topo com dois recortes e um bico no meio, lados fechando em ponta
function shieldGeometry(): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  outline.moveTo(-0.2, 0.24);
  outline.quadraticCurveTo(-0.1, 0.15, 0, 0.23);
  outline.quadraticCurveTo(0.1, 0.15, 0.2, 0.24);
  outline.quadraticCurveTo(0.21, -0.1, 0, -0.3);
  outline.quadraticCurveTo(-0.21, -0.1, -0.2, 0.24);
  return new THREE.ExtrudeGeometry(outline, {
    depth: 0.07,
    curveSegments: 6,
    bevelEnabled: false,
  }).translate(0, 0, -0.035);
}

// salto: duas setas (>>) lado a lado, extrudadas com chanfro
function dashGeometry(): THREE.BufferGeometry {
  const chevron = (x: number) =>
    new THREE.Shape(
      [
        [0, 0.22],
        [0.13, 0.22],
        [0.31, 0],
        [0.13, -0.22],
        [0, -0.22],
        [0.18, 0],
      ].map(([px, py]) => new THREE.Vector2(x + px, py)),
    );
  return (
    new THREE.ExtrudeGeometry([chevron(0), chevron(0.25)], {
      depth: 0.12,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 1,
    })
      .center()
      .scale(1.5, 1.5, 1.5)
      // deitado para tras: de cima, em pe, as setas viram um risco
      .rotateX(-0.75)
  );
}

// mira (item de headshot): aro com cruz, extrudado e deitado para a camera
function crosshairGeometry(): THREE.BufferGeometry {
  const ring = new THREE.Shape().absarc(0, 0, 0.26, 0, Math.PI * 2, false);
  ring.holes.push(new THREE.Path().absarc(0, 0, 0.19, 0, Math.PI * 2, true));
  const bar = (w: number, h: number) =>
    new THREE.Shape(
      [
        [-w, -h],
        [w, -h],
        [w, h],
        [-w, h],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    );
  return new THREE.ExtrudeGeometry([ring, bar(0.36, 0.035), bar(0.035, 0.36)], {
    depth: 0.08,
    bevelEnabled: false,
    curveSegments: 10,
  })
    .center()
    .rotateX(-0.75);
}

function lambert(color: number): THREE.Material {
  return new THREE.MeshLambertMaterial({ color });
}

function flat(color: number): THREE.Material {
  return new THREE.MeshBasicMaterial({ color });
}

function coneMaterial(color: number): THREE.Material {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function reconcile<V>(
  views: Map<number, V>,
  alive: Set<number>,
  remove: (view: V) => void,
): void {
  for (const [id, view] of views) {
    if (alive.has(id)) continue;
    remove(view);
    views.delete(id);
  }
}

// `look` e lido uma vez: aparencia do player nao muda durante a run
export function createWorldRenderer(
  scene: THREE.Scene,
  look: PlayerLook,
  bloodColor: string,
): WorldRenderer {
  const geo = {
    wall: new THREE.BoxGeometry(1, WALL_HEIGHT, 1),
    floor: new THREE.PlaneGeometry(ROOM_W, ROOM_H),
    // moeda octogonal, base no y=0
    coin: new THREE.CylinderGeometry(0.1, 0.1, 0.032, 8).translate(0, 0.016, 0),
    aura: new THREE.SphereGeometry(0.45, 12, 8),
    heart: heartGeometry(),
    shield: shieldGeometry(),
    dash: dashGeometry(),
    headshot: crosshairGeometry(),
    // municao ao longo de +x, ponta na frente
    shuriken: shurikenGeometry(),
    bulletCase: new THREE.CylinderGeometry(0.05, 0.05, 0.17, 8)
      .rotateZ(-Math.PI / 2)
      .translate(-0.045, 0, 0),
    bulletTip: new THREE.SphereGeometry(0.046, 8, 6)
      .scale(2.4, 1, 1)
      .translate(0.04, 0, 0),
    shellHull: new THREE.CylinderGeometry(0.055, 0.055, 0.22, 8)
      .rotateZ(-Math.PI / 2)
      .translate(0.05, 0, 0),
    shellBase: new THREE.CylinderGeometry(0.062, 0.062, 0.1, 8)
      .rotateZ(-Math.PI / 2)
      .translate(-0.11, 0, 0),
    // exclamacao: haste que afina para baixo e ponto
    markerStem: new THREE.CylinderGeometry(0.085, 0.04, 0.3, 12),
    markerDot: new THREE.SphereGeometry(0.07, 12, 10),
    // orelha vista de frente: aro de fora aberto embaixo a esquerda, dobra
    // de dentro e lobulo
    earOuter: new THREE.TorusGeometry(0.15, 0.04, 8, 20, Math.PI * 1.5).rotateZ(
      -Math.PI / 2,
    ),
    earInner: new THREE.TorusGeometry(0.065, 0.03, 8, 12, Math.PI).rotateZ(
      -Math.PI / 2,
    ),
    earLobe: new THREE.SphereGeometry(0.06, 10, 8),
    // onda de som chegando pela esquerda
    earWave: new THREE.TorusGeometry(0.3, 0.025, 6, 12, Math.PI / 2).rotateZ(
      (Math.PI * 3) / 4,
    ),
    // tecla do icone de interacao: placa de contorno, corpo e topo
    keyPlate: keySlab(0.6, 0.12, 0.04),
    keyBody: keySlab(0.52, 0.1, 0.14),
    keyTop: keySlab(0.42, 0.09, 0.08),
    letterF: letter(LETTER_F),
    letterB: letter(LETTER_B),
    tapIcon: letter(TAP_ICON),
    box: new THREE.BoxGeometry(1, 1, 1),
    // clarao do tiro: lingua de fogo com a base na boca do cano, para +x
    flashTongue: new THREE.ConeGeometry(0.42, 1.6, 6)
      .rotateZ(-Math.PI / 2)
      .translate(0.8, 0, 0),
    flashCore: new THREE.SphereGeometry(0.3, 8, 6),
    blood: new THREE.CircleGeometry(1, 16),
    crate: new THREE.BoxGeometry(0.78, 0.62, 0.78),
    plank: new THREE.BoxGeometry(0.34, 0.06, 0.2),
    // nota de dinheiro e a faixa clara do meio
    bill: new THREE.BoxGeometry(0.36, 0.02, 0.18),
    billBand: new THREE.BoxGeometry(0.13, 0.025, 0.185),
    // cilindro de raio 1 e altura 1, escalado por quem usa (barril, vaso)
    drum: new THREE.CylinderGeometry(1, 1, 1, 10),
    // folha: lamina pontuda saindo da origem para cima
    leaf: new THREE.ConeGeometry(0.07, 0.44, 4)
      .scale(1, 1, 0.35)
      .translate(0, 0.22, 0),
    // meio aro deitado, aberto para frente (+x)
    gust: new THREE.TorusGeometry(0.42, 0.035, 6, 14, Math.PI)
      .rotateX(Math.PI / 2)
      .rotateY(-Math.PI / 2),
    streak: new THREE.BoxGeometry(0.5, 0.02, 0.03),
  };
  const mat = {
    chestLight: lambert(0xdcb980),
    chestLock: lambert(0x9aa0aa),
    doorFrame: lambert(0xd4d6da),
    doorPanel: lambert(0x1d2028),
    doorSeam: lambert(0x2c303b),
    doorAccent: flat(0xf08a24),
    doorLight: flat(0x7df3ee),
    flash: new THREE.MeshBasicMaterial({
      color: 0xffc94a,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    flashCore: flat(0xfff6d8),
    heart: new THREE.MeshLambertMaterial({
      color: 0xe8527a,
      flatShading: true,
    }),
    shield: new THREE.MeshLambertMaterial({
      color: 0xd9dce3,
      flatShading: true,
    }),
    dash: new THREE.MeshLambertMaterial({
      color: 0x39d0ff,
      flatShading: true,
    }),
    headshot: new THREE.MeshLambertMaterial({
      color: 0xff3b3b,
      flatShading: true,
    }),
    coin: new THREE.MeshLambertMaterial({
      color: MONEY.color,
      flatShading: true,
    }),
    aura: new THREE.MeshBasicMaterial({
      color: MONEY.aura.color,
      transparent: true,
      opacity: MONEY.aura.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    wood: lambert(0xa8703c),
    woodDark: lambert(0x6e4726),
    bill: flat(0x35d267),
    billBand: flat(0xb8f5c6),
    cabinet: lambert(0xe8734f),
    cabinetDark: lambert(0xa94f33),
    barrel: lambert(0x8b2f3a),
    pot: lambert(0x9c4a2a),
    leaf: new THREE.MeshLambertMaterial({ color: 0x3f9a4a, flatShading: true }),
    prompt: lambert(0xffe066),
    promptSide: lambert(0xd9931f),
    promptBorder: flat(0x1b1d3a),
    blood: new THREE.MeshBasicMaterial({
      color: bloodColor,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
    brass: lambert(0xd9b84a),
    copper: lambert(0xd98a5a),
    shellRed: lambert(0xc8242c),
    bulletEnemy: flat(0xff4040),
    shuriken: new THREE.MeshLambertMaterial({
      color: 0xc8ccd8,
      flatShading: true,
    }),
    wind: new THREE.MeshBasicMaterial({
      color: 0xd6f4ff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  };
  const markerMat: Record<EnemyState, THREE.Material> = {
    patrol: flat(0xffffff),
    suspicious: flat(0xffd84a),
    alert: flat(0xff3030),
    dead: flat(0x000000),
  };
  const coneMat: Record<EnemyState, THREE.Material> = {
    patrol: coneMaterial(0xffffff),
    suspicious: coneMaterial(0xffd84a),
    alert: coneMaterial(0xff4040),
    dead: coneMaterial(0x000000),
  };

  const kit = createCharacterKit(look);

  function makeCharacter(kind: CharacterKind): Character {
    const character = kit.make(kind);
    scene.add(character.root);
    return character;
  }

  // Anda: inclina para frente e balanca. Parado: cabeca olha para os lados.
  // A simulacao anda em passo fixo e o render nao: num frame sem passo a
  // posicao nao muda. Por isso posicao, giro e velocidade sao suavizados aqui,
  // senao o corpo trava e a inclinacao pisca. `gaze` fixa para onde a cabeca
  // olha; null deixa olhar em volta quando parado. Devolve o quanto esta
  // andando (0..1).
  function animate(
    character: Character,
    pos: Vec2,
    facing: number,
    dt: number,
    time: number,
    maxLean: number,
    gaze: number | null,
  ): number {
    const { root, lean, head, last } = character;
    // primeiro frame ou teleporte (run nova): encaixa sem deslizar
    const jumped =
      !last ||
      Math.hypot(pos.x - root.position.x, pos.y + root.position.z) >
        SNAP_DISTANCE;
    const follow = jumped ? 1 : Math.min(1, dt * FOLLOW_RATE);
    root.position.x += (pos.x - root.position.x) * follow;
    root.position.z += (-pos.y - root.position.z) * follow;
    root.position.y = 0;
    const turn = Math.atan2(
      Math.sin(facing - root.rotation.y),
      Math.cos(facing - root.rotation.y),
    );
    root.rotation.set(0, root.rotation.y + turn * (jumped ? 1 : follow), 0);

    const raw =
      last && dt > 0 ? Math.hypot(pos.x - last.x, pos.y - last.y) / dt : 0;
    character.last = { x: pos.x, y: pos.y };
    character.speed += (raw - character.speed) * Math.min(1, dt * 8);
    const moving = character.speed > MOVING_SPEED;
    character.idle = moving ? 0 : character.idle + dt;

    const ease = Math.min(1, dt * 7);
    const targetLean = moving ? -maxLean : 0;
    lean.rotation.z += (targetLean - lean.rotation.z) * ease;
    // balanco proporcional a inclinacao: entra e sai junto com ela
    const sway = Math.min(1, Math.max(0, -lean.rotation.z / 0.3));
    lean.position.y = character.lift + (1 + Math.sin(time * 11)) * 0.03 * sway;
    // passada: pernas alternadas, bracos no contratempo
    const swing = Math.sin(time * 11) * sway;
    SIDES.forEach((side, i) => {
      // morto abre os membros; vivo volta ao repouso
      character.legs[i].rotation.x = 0;
      character.arms[i].rotation.x = -side * ARM_OPEN;
      character.legs[i].rotation.z = side * swing * 0.8;
      character.arms[i].rotation.z =
        i === 0 && character.hold !== null
          ? character.hold
          : -side * swing * 0.6;
    });

    const look =
      gaze !== null
        ? gaze
        : character.idle > IDLE_DELAY
          ? Math.sin((character.idle - IDLE_DELAY) * 2.2) * 0.9
          : 0;
    head.rotation.y += (look - head.rotation.y) * ease;
    return sway;
  }

  const rooms = new Map<number, THREE.Group>();
  const enemies = new Map<number, EnemyView>();
  const props = new Map<number, { group: THREE.Group; broken: boolean }>();
  const pickups = new Map<number, THREE.Group>();
  const bullets = new Map<number, THREE.Group>();
  const removeMesh = (mesh: THREE.Object3D) => scene.remove(mesh);

  // particulas da explosao ao matar
  const particles: {
    mesh: THREE.Object3D;
    velocity: THREE.Vector3;
    spin: THREE.Vector3;
    life: number;
  }[] = [];

  function burst(pos: Vec2) {
    const launch = (mesh: THREE.Object3D, life: number, speed: number) => {
      const angle = Math.random() * Math.PI * 2;
      const out = (0.35 + Math.random() * 0.65) * BURST.spread * speed;
      mesh.position.set(pos.x, 0.7 + Math.random() * 0.3, -pos.y);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      scene.add(mesh);
      particles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * out,
          (0.5 + Math.random() * 0.5) * BURST.lift,
          Math.sin(angle) * out,
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16,
        ),
        // some um pouco fora de sincronia com as outras
        life: life * (0.75 + Math.random() * 0.25),
      });
    };
    for (let i = 0; i < BURST.bills; i++) {
      const bill = new THREE.Group();
      bill.add(
        new THREE.Mesh(geo.bill, mat.bill),
        new THREE.Mesh(geo.billBand, mat.billBand),
      );
      launch(bill, BURST.billLife, 1);
    }
    for (let i = 0; i < BURST.drops; i++) {
      const drop = new THREE.Mesh(geo.box, mat.blood);
      drop.userData.size = 0.05 + Math.random() * 0.07;
      launch(drop, BURST.dropLife, 1.3);
    }
  }

  function updateParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      const { mesh, velocity, spin } = particle;
      particle.life -= dt;
      if (particle.life <= 0) {
        scene.remove(mesh);
        particles.splice(i, 1);
        continue;
      }
      if (mesh.position.y > 0.03) {
        velocity.y -= BURST.gravity * dt;
        mesh.position.addScaledVector(velocity, dt);
        mesh.rotation.x += spin.x * dt;
        mesh.rotation.y += spin.y * dt;
        mesh.rotation.z += spin.z * dt;
      }
      if (mesh.position.y <= 0.03) {
        // pousou: deita no chao e para
        mesh.position.y = 0.03;
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
      }
      mesh.scale.setScalar(
        (mesh.userData.size ?? 1) * Math.min(1, particle.life / BURST.fade),
      );
    }
  }

  // texto de dano: uma textura por texto ("+1", "Errou!"), um sprite por aviso
  const floaterTextures = new Map<string, THREE.Texture>();
  const floaters = new Map<number, THREE.Sprite>();
  // a fonte pode chegar depois do primeiro numero: joga fora o que foi
  // desenhado com a fonte reserva
  void document.fonts?.load(FLOATER_FONT).then(() => {
    for (const texture of floaterTextures.values()) texture.dispose();
    floaterTextures.clear();
  });

  function floaterTexture(
    amount: number,
    onPlayer?: boolean,
    // destaque em cima do numero: 'HEADSHOT' ou 'OVERKILL'
    banner?: keyof typeof FLOATER_BANNER,
  ): THREE.Texture | null {
    const text = amount > 0 ? `${onPlayer ? '-' : '+'}${amount}` : 'Errou!';
    const key = banner ? `${banner}${text}` : text;
    const cached = floaterTextures.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = FLOATER_CANVAS;
    const context = canvas.getContext('2d');
    // sem canvas 2D (jsdom) nao ha como desenhar texto
    if (!context) return null;
    context.font = FLOATER_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = 12;
    context.strokeStyle = '#1b0508';
    context.fillStyle = floaterColor(amount, onPlayer);
    const [x, y] = [canvas.width / 2, canvas.height / 2 + 4];
    if (banner) {
      // duas linhas: o destaque em cima e o numero menor embaixo
      context.font = FLOATER_FONT.replace(/^\d+/, '50');
      context.strokeText(text, x, y + 30);
      context.fillText(text, x, y + 30);
      context.font = FLOATER_FONT.replace(/^\d+/, '46');
      context.fillStyle = FLOATER_BANNER[banner];
      context.strokeText(banner, x, y - 28);
      context.fillText(banner, x, y - 28);
    } else {
      context.strokeText(text, x, y);
      context.fillText(text, x, y);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    floaterTextures.set(key, texture);
    return texture;
  }

  function removeFloater(sprite: THREE.Sprite) {
    scene.remove(sprite);
    sprite.material.dispose();
  }

  // parede e piso de cada nivel ja visto, por indice do nivel
  const wallpapers = new Map<number, ReturnType<typeof wallpaper>>();
  // folhas da porta de cada sala que tem porta, por indice da sala; `y` e a
  // face da parede onde ela fica
  const doors = new Map<number, { leaves: THREE.Group[]; y: number }>();

  // Porta de correr futurista: moldura clara com cantos chanfrados, duas
  // folhas escuras com faixa de luz ciano e puxador laranja, base com friso
  // laranja. Origem no chao, no meio do vao; a frente e +z (para a camera).
  // So visual: nao bloqueia passagem nem bala.
  function buildDoor(): { group: THREE.Group; leaves: THREE.Group[] } {
    const group = new THREE.Group();
    const part = (
      parent: THREE.Group,
      material: THREE.Material,
      [w, h, d]: number[],
      [x, y, z]: number[],
      turn = 0,
    ) => {
      const mesh = new THREE.Mesh(geo.box, material);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.rotation.z = turn;
      parent.add(mesh);
    };
    // verga com o visor escuro
    part(group, mat.doorFrame, [3.56, 0.36, 0.26], [0, 1.38, 0.1]);
    part(group, mat.doorPanel, [1.9, 0.12, 0.04], [0, 1.44, 0.24]);
    for (const side of [1, -1]) {
      // poste, canto chanfrado, pe com friso laranja e luz na borda de dentro
      part(group, mat.doorFrame, [0.28, 1.5, 0.26], [side * 1.64, 0.75, 0.1]);
      part(
        group,
        mat.doorFrame,
        [0.34, 0.34, 0.26],
        [side * 1.47, 1.17, 0.1],
        Math.PI / 4,
      );
      part(group, mat.doorFrame, [0.46, 0.26, 0.32], [side * 1.57, 0.13, 0.1]);
      part(group, mat.doorPanel, [0.47, 0.05, 0.33], [side * 1.57, 0.025, 0.1]);
      part(group, mat.doorAccent, [0.47, 0.05, 0.33], [side * 1.57, 0.1, 0.1]);
      part(
        group,
        mat.doorLight,
        [0.03, 0.78, 0.02],
        [side * 1.49, 0.66, 0.235],
      );
    }
    // folhas: [esquerda, direita]; cada uma corre para o seu lado
    const leaves = [-1, 1].map((side) => {
      const leaf = new THREE.Group();
      // recuada para dentro da parede: aberta, some dentro dela
      leaf.position.z = -0.1;
      // mais baixa que a parede: aberta, o topo nao disputa o plano com ela
      part(leaf, mat.doorPanel, [1.5, 1.16, 0.08], [side * 0.75, 0.58, 0]);
      // divisoes do painel
      part(leaf, mat.doorSeam, [1.5, 0.015, 0.085], [side * 0.75, 0.86, 0]);
      part(leaf, mat.doorSeam, [1.5, 0.015, 0.085], [side * 0.75, 0.36, 0]);
      part(leaf, mat.doorLight, [0.62, 0.05, 0.02], [side * 0.98, 0.62, 0.045]);
      part(leaf, mat.doorSeam, [0.2, 0.56, 0.02], [side * 0.14, 0.62, 0.045]);
      part(leaf, mat.doorAccent, [0.07, 0.4, 0.03], [side * 0.14, 0.62, 0.055]);
      part(
        leaf,
        mat.doorLight,
        [0.015, 1.14, 0.02],
        [side * 0.012, 0.57, 0.045],
      );
      group.add(leaf);
      return leaf;
    });
    return { group, leaves };
  }

  // tampa do bau de cada sala de loja, por indice da sala
  const chestLids = new Map<number, THREE.Group>();

  // bau da loja: caixa de madeira oca com paineis claros e tampa com fecho.
  // A frente e +z (para a camera); a tampa gira na dobradica de tras.
  function buildChest(): { group: THREE.Group; lid: THREE.Group } {
    const group = new THREE.Group();
    const lid = new THREE.Group();
    lid.position.set(0, 0.42, -0.3);
    const part = (
      parent: THREE.Group,
      material: THREE.Material,
      [w, h, d]: number[],
      [x, y, z]: number[],
    ) => {
      const mesh = new THREE.Mesh(geo.box, material);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      parent.add(mesh);
    };
    // corpo, fundo claro la dentro e borda em volta da abertura
    part(group, mat.wood, [0.8, 0.3, 0.6], [0, 0.15, 0]);
    part(group, mat.chestLight, [0.64, 0.02, 0.44], [0, 0.31, 0]);
    for (const side of [1, -1]) {
      part(group, mat.wood, [0.08, 0.12, 0.6], [side * 0.36, 0.36, 0]);
      part(group, mat.wood, [0.64, 0.12, 0.08], [0, 0.36, side * 0.26]);
      part(group, mat.chestLight, [0.02, 0.18, 0.4], [side * 0.4, 0.17, 0]);
    }
    part(group, mat.chestLight, [0.6, 0.18, 0.02], [0, 0.17, 0.3]);
    // tampa: origem na dobradica; forro claro por dentro e fecho na frente
    part(lid, mat.wood, [0.84, 0.16, 0.64], [0, 0.08, 0.3]);
    part(lid, mat.chestLight, [0.64, 0.02, 0.44], [0, 0.165, 0.3]);
    part(lid, mat.chestLight, [0.64, 0.02, 0.44], [0, -0.005, 0.3]);
    part(lid, mat.chestLight, [0.6, 0.08, 0.02], [0, 0.09, 0.62]);
    part(lid, mat.chestLock, [0.12, 0.16, 0.05], [0, 0.03, 0.63]);
    group.add(lid);
    group.scale.setScalar(1.15);
    return { group, lid };
  }

  function buildRoom(room: Room): THREE.Group {
    const group = new THREE.Group();
    // um contrato = um nivel: SHOP_EVERY salas com a mesma parede e piso
    const level = Math.max(0, Math.floor((room.index - 1) / SHOP_EVERY));
    let papers = wallpapers.get(level);
    if (!papers) {
      papers = wallpaper(level);
      wallpapers.set(level, papers);
    }
    const floor = new THREE.Mesh(geo.floor, papers.floor.material);
    floor.name = 'floor';
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(ROOM_W / 2, 0, -(room.index + 0.5) * ROOM_H);
    group.add(floor);

    const walls: Vec2[] = [];
    room.tiles.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        const center = tileCenter(room.index, col, row);
        if (line[col] === '#') {
          walls.push(center);
        }
      }
    });
    // saida da sala inicial e de cada loja: porta na face de dentro da parede
    if (room.index % SHOP_EVERY === 0) {
      const y = (room.index + 1) * ROOM_H - 1;
      const door = buildDoor();
      door.group.position.set(DOOR_X, 0, -y);
      group.add(door.group);
      doors.set(room.index, { leaves: door.leaves, y });
    }
    if (room.chest) {
      const chest = buildChest();
      chest.group.position.set(room.chest.x, 0, -room.chest.y);
      group.add(chest.group);
      chestLids.set(room.index, chest.lid);
    }

    const instanced = new THREE.InstancedMesh(
      geo.wall,
      papers.wall.material,
      walls.length,
    );
    const matrix = new THREE.Matrix4();
    walls.forEach((center, i) => {
      matrix.setPosition(center.x, WALL_HEIGHT / 2, -center.y);
      instanced.setMatrixAt(i, matrix);
    });
    group.add(instanced);
    scene.add(group);
    return group;
  }

  function removeRoom(group: THREE.Group) {
    scene.remove(group);
    group.traverse((child) => {
      if (child instanceof THREE.InstancedMesh) child.dispose();
    });
  }

  // pistola: estojo de latao e ponta de cobre (vermelha se for do inimigo);
  // escopeta: cartucho vermelho com base de latao
  function buildBullet(bullet: Projectile): THREE.Group {
    const group = new THREE.Group();
    if (bullet.shuriken) {
      // gira no proprio eixo enquanto voa (sync)
      group.name = 'shuriken';
      group.add(new THREE.Mesh(geo.shuriken, mat.shuriken));
      scene.add(group);
      return group;
    }
    if (bullet.weapon === 'shotgun') {
      group.add(
        new THREE.Mesh(geo.shellHull, mat.shellRed),
        new THREE.Mesh(geo.shellBase, mat.brass),
      );
    } else {
      group.add(
        new THREE.Mesh(geo.bulletCase, mat.brass),
        new THREE.Mesh(
          geo.bulletTip,
          bullet.owner === 'player' ? mat.copper : mat.bulletEnemy,
        ),
      );
    }
    group.rotation.y = Math.atan2(bullet.vel.y, bullet.vel.x);
    scene.add(group);
    return group;
  }

  // municao: tres cartuchos; coracao, escudo ou salto: uma peca so; todos
  // flutuando; dinheiro: pilhas de moedas
  // levemente tortas, com aura dourada em volta
  function buildPickup(kind: PickupKind): THREE.Group {
    const group = new THREE.Group();
    if (kind === 'ammo') {
      // tres cartuchos em pe: o mesmo estojo e ponta da bala disparada, maior
      group.name = 'ammoPickup';
      for (const [x, z, lean] of [
        [-0.2, 0.04, 0.12],
        [0.02, -0.08, -0.06],
        [0.22, 0.06, -0.16],
      ]) {
        const round = new THREE.Group();
        round.add(
          new THREE.Mesh(geo.bulletCase, mat.brass),
          new THREE.Mesh(geo.bulletTip, mat.copper),
        );
        round.scale.setScalar(3);
        round.rotation.z = Math.PI / 2 + lean;
        round.position.set(x, 0, z);
        group.add(round);
      }
      scene.add(group);
      return group;
    }
    if (kind !== 'money') {
      group.name = `${kind}Pickup`;
      group.add(new THREE.Mesh(geo[kind], mat[kind]));
      scene.add(group);
      return group;
    }
    COIN_STACKS.forEach(([x, z, count], s) => {
      for (let i = 0; i < count; i++) {
        const coin = new THREE.Mesh(geo.coin, mat.coin);
        coin.position.set(
          x + Math.sin(i * 12.9 + s * 78.2) * 0.012,
          i * 0.034,
          z + Math.cos(i * 37.7 + s * 11.1) * 0.012,
        );
        coin.rotation.y = i * 0.9 + s;
        group.add(coin);
      }
    });
    const aura = new THREE.Mesh(geo.aura, mat.aura);
    aura.position.y = 0.14;
    group.add(aura);
    scene.add(group);
    return group;
  }

  // caixa inteira, ou tabuas espalhadas no chao depois de quebrar
  // Objeto destrutivel do cenario. A aparencia e so visual e sai do id: a
  // simulacao trata todos igual (ocupa o tile, quebra, pode soltar item).
  function buildProp(prop: Prop): THREE.Group {
    const group = new THREE.Group();
    group.position.set(prop.pos.x, 0, -prop.pos.y);
    // sorteio fixo por id: o mesmo objeto tem sempre a mesma cara
    const pick = Math.abs(Math.sin(prop.id * 12.9898) * 43758.5453) % 1;
    const variant = PROP_VARIANTS[Math.floor(pick * PROP_VARIANTS.length)];
    const [main, trim] = {
      crate: [mat.wood, mat.woodDark],
      sideboard: [mat.cabinet, mat.cabinetDark],
      barrel: [mat.barrel, mat.chestLock],
      plant: [mat.pot, mat.leaf],
    }[variant];
    if (prop.broken) {
      // destrocos na cor do que quebrou
      DEBRIS.forEach(([x, z, turn], i) => {
        const plank = new THREE.Mesh(geo.plank, i % 2 ? main : trim);
        plank.position.set(x, 0.04 + i * 0.012, z);
        plank.rotation.y = turn + prop.id;
        group.add(plank);
      });
      scene.add(group);
      return group;
    }
    const part = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      [w, h, d]: number[],
      [x, y, z]: number[],
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    // folhas abertas em leque, saindo de (x, y, z)
    const leaves = (x: number, y: number, z: number, size: number) => {
      for (let i = 0; i < 5; i++) {
        const leaf = part(geo.leaf, mat.leaf, [size, size, size], [x, y, z]);
        leaf.rotation.set(0.55, (i / 5) * Math.PI * 2 + prop.id, 0, 'YXZ');
      }
    };
    if (variant === 'crate') {
      const crate = new THREE.Mesh(geo.crate, mat.wood);
      crate.position.y = 0.31;
      const lid = new THREE.Mesh(geo.plank, mat.woodDark);
      lid.scale.set(2.3, 1, 0.9);
      lid.position.y = 0.64;
      group.add(crate, lid);
    } else if (variant === 'sideboard') {
      // aparador com tampo, pes e um vaso de planta em cima
      part(geo.box, mat.cabinet, [0.9, 0.46, 0.5], [0, 0.31, 0]);
      part(geo.box, mat.cabinetDark, [0.94, 0.05, 0.54], [0, 0.565, 0]);
      for (const [x, z] of [
        [-0.38, -0.19],
        [0.38, -0.19],
        [-0.38, 0.19],
        [0.38, 0.19],
      ]) {
        part(geo.box, mat.cabinetDark, [0.07, 0.08, 0.07], [x, 0.04, z]);
      }
      part(geo.drum, mat.pot, [0.14, 0.16, 0.14], [-0.2, 0.67, 0]);
      leaves(-0.2, 0.74, 0, 1.1);
      // de lado em metade dos casos
      group.rotation.y = prop.id % 2 ? Math.PI / 2 : 0;
    } else if (variant === 'barrel') {
      part(geo.drum, mat.barrel, [0.33, 0.72, 0.33], [0, 0.36, 0]);
      for (const y of [0.16, 0.56]) {
        part(geo.drum, mat.chestLock, [0.345, 0.05, 0.345], [0, y, 0]);
      }
      part(geo.drum, mat.cabinetDark, [0.28, 0.02, 0.28], [0, 0.725, 0]);
    } else {
      // vaso grande de chao
      part(geo.drum, mat.pot, [0.26, 0.34, 0.26], [0, 0.17, 0]);
      part(geo.drum, mat.cabinetDark, [0.29, 0.05, 0.29], [0, 0.34, 0]);
      leaves(0, 0.36, 0, 1.5);
    }
    scene.add(group);
    return group;
  }

  // vento do salto, nas costas: arcos cada vez menores e riscos soltos atras.
  // Fica no root, nao no lean: nao gira junto com o mergulho.
  function makeJumper(kind: CharacterKind): Jumper {
    const character = makeCharacter(kind);
    const wind = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const gust = new THREE.Mesh(geo.gust, mat.wind);
      gust.position.x = -0.1 - i * 0.24;
      gust.scale.setScalar(1 - i * 0.22);
      const streak = new THREE.Mesh(geo.streak, mat.wind);
      streak.position.set(
        -0.75 - (i % 2) * 0.2,
        (i - 1) * 0.12,
        (i - 1) * 0.22,
      );
      wind.add(gust, streak);
    }
    wind.visible = false;
    character.root.add(wind);
    return { character, wind, flip: 0, crouch: 0, hug: 0 };
  }

  // `animate` mais o salto e a cobertura. Salto: sobe e desce em arco,
  // mergulhando de frente em volta do tronco, em pose de corrida (uma perna
  // dobrada, braco livre a frente); sai e cai agachado. Perto de parede ou
  // caixa: agacha.
  // Parado nela (`canHug`): encosta de costas, olhando para os lados; na
  // quina, sai de lado e espia para alem dela.
  // `dash` e o tempo que falta no ar. `lookAround`: cabeca passeia parado.
  function animateJumper(
    jumper: Jumper,
    world: World,
    pos: Vec2,
    facing: number,
    dash: number,
    dt: number,
    time: number,
    maxLean: number,
    canHug: boolean,
    lookAround: boolean,
    crouching = false,
  ) {
    const { character, wind } = jumper;
    const { lean, legs, arms } = character;
    const jumping = dash > 0;
    const wall = jumping ? null : coverAt(world, pos);
    const hugging = !!wall && canHug && character.speed < MOVING_SPEED;
    const peek = hugging ? wall.peek : 0;
    lean.rotation.z -= jumper.flip;
    const sway = animate(
      character,
      pos,
      hugging ? wall.back : facing,
      dt,
      time,
      maxLean,
      hugging
        ? peek
          ? -peek * PEEK_LOOK + Math.sin(time * 2) * 0.15
          : Math.sin(time * 1.6) * 1.1
        : lookAround
          ? null
          : 0,
    );
    const air = jumping ? 1 - dash / DASH_TIME : 0;
    const arc = Math.sin(Math.PI * air);
    const ease = Math.min(1, dt * 7);
    jumper.crouch +=
      ((jumping || wall || crouching ? 1 : 0) - jumper.crouch) * ease;
    jumper.hug += ((hugging ? 1 : 0) - jumper.hug) * ease;
    const crouch = jumper.crouch * (1 - arc);
    // passada agachada segue a da corrida; parado, perna esquerda a frente
    const drop = poseCrouch(
      character,
      crouch,
      -1 + (Math.sin(time * 11) + 1) * sway,
    );
    // encostado fica de tronco reto, nao inclinado para frente
    jumper.flip = -arc * DIVE_TILT - crouch * CROUCH_LEAN * (1 - jumper.hug);
    lean.rotation.z += jumper.flip;
    lean.position.x =
      Math.sin(jumper.flip) * FLIP_PIVOT_Y - jumper.hug * HUG_BACK;
    lean.position.z += (peek * PEEK_SHIFT - lean.position.z) * ease;
    lean.position.y +=
      (1 - Math.cos(jumper.flip)) * FLIP_PIVOT_Y + arc * JUMP_HEIGHT - drop;
    character.shadow.scale.setScalar(1 - arc * 0.35);
    SIDES.forEach((_, i) => {
      arms[i].rotation.z += (DIVE_ARMS[i] - arms[i].rotation.z) * arc;
      legs[i].rotation.z += (DIVE_LEGS[i] - legs[i].rotation.z) * arc;
    });
    // vento cresce e some com o arco
    wind.visible = jumping;
    wind.position.y = FLIP_PIVOT_Y + arc * JUMP_HEIGHT;
    wind.scale.setScalar(0.3 + arc * 0.7);
    wind.scale.x *= 1 + air * 0.8;
    wind.rotation.x = Math.sin(time * 30) * 0.15;
  }

  // morto: estirado de brucos, centrado em `pos`, sem giro nem vento
  // `launch`: tempo que falta do voo de quem morreu de um golpe so. O corpo
  // sai de pe, sobe em arco e vai tombando de frente ate deitar.
  function layDead(jumper: Jumper, pos: Vec2, facing: number, launch = 0) {
    const { character } = jumper;
    const t = 1 - launch / LAUNCH_TIME;
    const fall = t * t * (3 - 2 * t);
    const rest = DEAD_Y * character.head.scale.x;
    character.root.position.set(
      pos.x,
      // de pe o tronco fica na propria altura; deitado, rente ao chao
      FLIP_PIVOT_Y +
        (rest - FLIP_PIVOT_Y) * fall +
        Math.sin(Math.PI * t) * LAUNCH_HEIGHT,
      -pos.y,
    );
    character.root.rotation.set(0, facing, (-Math.PI / 2) * fall);
    poseDead(character);
    // se voltar a viver (run nova), encaixa sem deslizar
    character.last = null;
    jumper.flip = 0;
    jumper.crouch = 0;
    jumper.hug = 0;
    character.lean.position.z = 0;
    jumper.wind.visible = false;
  }

  function buildEnemy(kind: EnemyKind): EnemyView {
    const jumper = makeJumper(kind);
    const { character } = jumper;
    // sobre a cabeca, de frente para a camera. Exclamacao: amarela ao
    // notar, vermelha em alerta. Orelha: branca ouvindo, amarela ao ouvir.
    const marker = new THREE.Group();
    marker.rotation.order = 'YXZ';
    const alarm = new THREE.Group();
    alarm.name = 'alarmMarker';
    const ear = new THREE.Group();
    ear.name = 'earMarker';
    const part = (
      group: THREE.Group,
      geometry: THREE.BufferGeometry,
      x: number,
      y: number,
      scale = 1,
    ) => {
      const mesh = new THREE.Mesh(geometry, markerMat.patrol);
      mesh.position.set(x, y, 0);
      mesh.scale.setScalar(scale);
      group.add(mesh);
      return mesh;
    };
    const markerParts = [
      part(alarm, geo.markerStem, 0, 0.1),
      part(alarm, geo.markerDot, 0, -0.14),
      part(ear, geo.earOuter, 0.06, 0.03),
      part(ear, geo.earInner, 0.05, 0.02),
      part(ear, geo.earLobe, 0.06, -0.13),
      part(ear, geo.earWave, 0.06, 0.03),
      part(ear, geo.earWave, 0.06, 0.03, 1.4),
    ];
    marker.add(alarm, ear);
    marker.position.y = 1.7;
    character.root.add(marker);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((CONE_SEGMENTS + 2) * 3), 3),
    );
    const index: number[] = [];
    for (let i = 0; i < CONE_SEGMENTS; i++) index.push(0, i + 1, i + 2);
    geometry.setIndex(index);
    const cone = new THREE.Mesh(geometry, coneMat.patrol);
    // vertices mudam todo frame; o bounding do three ficaria velho
    cone.frustumCulled = false;
    scene.add(cone);
    const blood = new THREE.Mesh(geo.blood, mat.blood);
    blood.name = 'bloodPool';
    blood.rotation.x = -Math.PI / 2;
    blood.visible = false;
    scene.add(blood);
    return {
      ...jumper,
      marker,
      markerParts,
      alarm,
      ear,
      cone,
      blood,
      deathAt: null,
      burst: false,
    };
  }

  function removeEnemy(view: EnemyView) {
    scene.remove(view.character.root, view.cone, view.blood);
    view.cone.geometry.dispose();
  }

  // leque de raios: cada raio para na primeira parede
  function updateCone(world: World, enemy: Enemy, cone: THREE.Mesh) {
    const position = cone.geometry.getAttribute('position');
    position.setXYZ(0, enemy.pos.x, CONE_Y, -enemy.pos.y);
    for (let i = 0; i <= CONE_SEGMENTS; i++) {
      const angle =
        enemy.facing -
        VIEW_HALF_ANGLE +
        (2 * VIEW_HALF_ANGLE * i) / CONE_SEGMENTS;
      const d = castRay(world, enemy.pos, angle, enemy.viewRange);
      position.setXYZ(
        i + 1,
        enemy.pos.x + Math.cos(angle) * d,
        CONE_Y,
        -(enemy.pos.y + Math.sin(angle) * d),
      );
    }
    position.needsUpdate = true;
  }

  const hero = makeJumper('player');
  const player = hero.character;
  // arma de fogo na mao direita (weapon.renderer)
  const held = createHeldGuns(player, look.weapon);
  // clarao: lingua central e duas menores abertas para os lados
  const flash = new THREE.Group();
  flash.visible = false;
  for (const [turn, size] of [
    [0, 1],
    [0.9, 0.55],
    [-0.9, 0.55],
  ]) {
    const tongue = new THREE.Mesh(geo.flashTongue, mat.flash);
    tongue.rotation.y = turn;
    tongue.scale.setScalar(size);
    flash.add(tongue);
  }
  flash.add(new THREE.Mesh(geo.flashCore, mat.flashCore));
  // ultima arma na mao: o ultimo tiro zera a municao e tira a arma do World,
  // mas o recuo e o clarao dele ainda precisam do modelo
  let lastGun: WeaponId | null = null;

  // icone de interacao: tecla 3D amarela com a letra em relevo, deitada para
  // a camera. `animatePrompt` faz pular e pulsar.
  function buildPrompt(name: string, glyph: THREE.BufferGeometry): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    group.visible = false;
    group.rotation.x = PROMPT_TILT;
    const layers: [THREE.BufferGeometry, THREE.Material, number][] = [
      [geo.keyPlate, mat.promptBorder, -0.04],
      [geo.keyBody, mat.promptSide, 0],
      [geo.keyTop, mat.prompt, 0.14],
      [glyph, mat.promptBorder, 0.22],
    ];
    for (const [geometry, material, z] of layers) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = z;
      group.add(mesh);
    }
    return group;
  }
  // pulo com quique no chao e pulso de tamanho, fora de fase com o pulo
  function animatePrompt(icon: THREE.Group, baseY: number, time: number) {
    icon.position.y = baseY + Math.abs(Math.sin(time * 4.5)) * PROMPT_HOP;
    icon.scale.setScalar(
      PROMPT_SCALE * (1 + Math.sin(time * 9) * PROMPT_PULSE),
    );
  }
  // F sobre a caixa ao alcance
  // Sem teclado (aparelho de toque) a letra nao diz nada: no lugar dela vai
  // o icone de toque, ja que ali a interacao e tocar em cima do icone.
  const touch =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const glyphF = touch ? geo.tapIcon : geo.letterF;
  const glyphB = touch ? geo.tapIcon : geo.letterB;
  const prompt = buildPrompt('interactionPrompt', glyphF);
  // B sobre o bau ao alcance
  const chestPrompt = buildPrompt('chestPrompt', glyphB);
  scene.add(chestPrompt);
  const knifePrompt = buildPrompt('knifePrompt', glyphF);
  knifePrompt.visible = false;
  scene.add(knifePrompt);
  let lastTime = 0;

  return {
    prompts() {
      const visible: ReturnType<WorldRenderer['prompts']> = [];
      // o F da caixa mora dentro do grupo dela: sem pai, nao esta em cena
      if (prompt.visible && prompt.parent) {
        visible.push({ action: 'interact', object: prompt });
      }
      if (knifePrompt.visible) {
        visible.push({ action: 'interact', object: knifePrompt });
      }
      if (chestPrompt.visible) {
        visible.push({ action: 'open', object: chestPrompt });
      }
      return visible;
    },

    sync(world, time) {
      const dt = lastTime ? Math.min(0.1, time - lastTime) : 0;
      lastTime = time;
      // congela junto com o jogo: pausado ou na loja, nada cai
      if (world.status === 'playing' || world.status === 'dead') {
        updateParticles(dt);
      }

      for (const room of world.rooms) {
        if (!rooms.has(room.index)) rooms.set(room.index, buildRoom(room));
      }
      reconcile(rooms, new Set(world.rooms.map((r) => r.index)), removeRoom);
      for (const index of chestLids.keys()) {
        if (!rooms.has(index)) chestLids.delete(index);
      }
      // porta abre sozinha com o player por perto e fecha quando ele se afasta
      for (const [index, door] of doors) {
        if (!rooms.has(index)) {
          doors.delete(index);
          continue;
        }
        // mesmo criterio que segura bala e visao na simulacao
        const near = doorOpen(world, door.y);
        const ease = Math.min(1, dt * 7);
        door.leaves.forEach((leaf, i) => {
          const target = near ? (i ? 1 : -1) * DOOR_SLIDE : 0;
          leaf.position.x += (target - leaf.position.x) * ease;
        });
      }

      for (const prop of world.props) {
        const view = props.get(prop.id);
        if (view && view.broken === prop.broken) continue;
        if (view) scene.remove(view.group);
        props.set(prop.id, { group: buildProp(prop), broken: prop.broken });
      }
      reconcile(props, new Set(world.props.map((p) => p.id)), (view) =>
        scene.remove(view.group),
      );

      // com arma na mao a espada so sai no F: avisa sobre quem ela pegaria
      const foe =
        world.status === 'playing' && world.player.weapon
          ? meleeTarget(world)
          : undefined;
      knifePrompt.visible = !!foe;
      if (foe) {
        knifePrompt.position.set(foe.pos.x, 0, -foe.pos.y);
        animatePrompt(knifePrompt, KNIFE_PROMPT_Y, time);
      }

      const prop = world.status === 'playing' && !foe && nearbyProp(world);
      prompt.visible = !!prop;
      if (prop) {
        props.get(prop.id)?.group.add(prompt);
        prompt.position.set(0, 0, 0);
        animatePrompt(prompt, 1.15, time);
      }

      for (const floater of world.floaters) {
        let sprite = floaters.get(floater.id);
        if (!sprite) {
          const map = floaterTexture(
            floater.amount,
            floater.onPlayer,
            floater.headshot
              ? 'HEADSHOT'
              : floater.overkill
                ? 'OVERKILL'
                : undefined,
          );
          if (!map) continue;
          sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map,
              transparent: true,
              depthTest: false,
            }),
          );
          sprite.renderOrder = 10;
          scene.add(sprite);
          floaters.set(floater.id, sprite);
        }
        const t = floater.age / FLOATER_TIME;
        // estoura maior que o normal, assenta e some de leve, subindo
        const pop =
          t < FLOATER_POP_END
            ? 0.5 + (t / FLOATER_POP_END) * (FLOATER_POP - 0.5)
            : Math.max(1, FLOATER_POP - (t - FLOATER_POP_END) * 2.5);
        // golpe com destaque aparece maior que golpe comum
        const size = pop * (floater.headshot || floater.overkill ? 1.5 : 1);
        sprite.scale.set(FLOATER_SIZE[0] * size, FLOATER_SIZE[1] * size, 1);
        sprite.position.set(
          floater.pos.x,
          FLOATER_Y + t * FLOATER_RISE,
          -floater.pos.y,
        );
        sprite.material.opacity = Math.min(1, (1 - t) * 2.2);
      }
      reconcile(
        floaters,
        new Set(world.floaters.map((f) => f.id)),
        removeFloater,
      );

      // bau: B flutua em cima quando da para abrir; a tampa abre com a loja
      const chestRoom =
        world.status === 'playing' || world.status === 'shop'
          ? nearbyChest(world)
          : undefined;
      chestPrompt.visible = world.status === 'playing' && !!chestRoom?.chest;
      if (chestRoom?.chest) {
        chestPrompt.position.set(chestRoom.chest.x, 0, -chestRoom.chest.y);
        animatePrompt(chestPrompt, 1.3, time);
      }
      const opened = world.status === 'shop' ? chestRoom?.index : undefined;
      for (const [index, lid] of chestLids) {
        const target = index === opened ? CHEST_OPEN : 0;
        lid.rotation.x += (target - lid.rotation.x) * Math.min(1, dt * 9);
      }

      const lost = world.status === 'dead';
      const shot = world.player.shot;
      const gunId = lost
        ? null
        : (world.player.weapon?.id ?? (shot > 0 ? lastGun : null));
      lastGun = gunId;
      // encostado no inimigo o golpe e de espada, mesmo com arma de fogo
      const armed = gunId !== null && world.player.slash <= 0;
      held.hold(armed ? gunId : null);
      if (lost) {
        layDead(hero, world.player.pos, world.player.facing);
      } else {
        animateJumper(
          hero,
          world,
          world.player.pos,
          world.player.facing,
          world.player.dash,
          dt,
          time,
          world.player.adrenaline > 0 ? ADRENALINE_LEAN : RUN_LEAN,
          world.player.slash <= 0,
          true,
          world.player.crouching,
        );
        poseAttack(player, world.player.slash);
      }
      player.shadow.visible = !lost;

      flash.visible = false;
      held.mount.position.y = HAND_Y;
      if (armed) {
        const { muzzle, kick, flash: flashSize } = GUNS[gunId];
        // coice seco: forte no instante do tiro, some rapido
        const recoil = (shot / SHOT_TIME) ** 2 * kick;
        player.arms[0].rotation.z += recoil * RECOIL_RISE;
        held.mount.position.y += recoil * RECOIL_BACK;
        player.body.position.x -= recoil * RECOIL_PUSH;
        if (shot > SHOT_TIME - FLASH_TIME) {
          held.roots[gunId].add(flash);
          flash.position.set(muzzle[0], muzzle[1], 0);
          // tremula: tamanho e giro mudam a cada frame
          flash.scale.setScalar(
            flashSize * (0.8 + Math.abs(Math.sin(time * 90)) * 0.4),
          );
          flash.rotation.x = time * 40;
          flash.visible = true;
        }
      }

      for (const enemy of world.enemies) {
        let view = enemies.get(enemy.id);
        const dead = enemy.state === 'dead';
        if (!view) {
          view = buildEnemy(enemy.kind);
          // quem ja aparece morto nao explode de novo
          view.burst = dead;
          enemies.set(enemy.id, view);
        }
        if (dead && !view.burst) {
          view.burst = true;
          burst(enemy.pos);
        }
        if (dead) {
          // a poca so comeca quando o corpo pousa
          if (view.deathAt === null && enemy.launch === 0) view.deathAt = time;
          const progress = Math.min(
            1,
            (time - (view.deathAt ?? time)) / BLOOD_GROW_TIME,
          );
          const eased = progress * progress * (3 - 2 * progress);
          const radius = 0.05 + 0.8 * eased;
          view.blood.position.set(enemy.pos.x, 0.015, -enemy.pos.y);
          view.blood.scale.set(radius, radius * 0.78, 1);
          layDead(view, enemy.pos, enemy.facing, enemy.launch);
        } else {
          view.deathAt = null;
          animateJumper(
            view,
            world,
            enemy.pos,
            enemy.facing,
            enemy.dash,
            dt,
            time,
            RUN_LEAN,
            enemy.state === 'patrol' && enemy.attack <= 0,
            // sem encostar nao olha em volta: o cone mostra para onde ele ve
            false,
          );
          poseAttack(view.character, enemy.attack);
          updateCone(world, enemy, view.cone);
        }
        // orelha: ouvido enchendo (cresce junto) ou indo atras do barulho.
        // Ver o player troca pela exclamacao.
        const listening =
          enemy.state !== 'alert' &&
          enemy.state !== 'dead' &&
          enemy.detection === 0 &&
          (enemy.heard !== null || enemy.hearing > HEARING_SHOWN);
        const yellowHearing =
          enemy.hearing >=
            enemy.intelligence.hearingThreshold * HEARING_YELLOW ||
          (enemy.heard !== null && enemy.hearing === 0);
        const markerState = listening
          ? yellowHearing
            ? 'suspicious'
            : 'patrol'
          : enemy.state;
        for (const part of view.markerParts)
          part.material = markerMat[markerState];
        view.ear.visible = listening;
        view.ear.scale.setScalar(
          enemy.hearing
            ? 0.5 +
                0.5 *
                  Math.min(
                    1,
                    enemy.hearing / enemy.intelligence.hearingThreshold,
                  )
            : 1,
        );
        view.alarm.visible = !listening;
        view.marker.visible =
          listening || enemy.state === 'suspicious' || enemy.state === 'alert';
        view.marker.position.y =
          1.7 +
          Math.sin(time * 14 + enemy.id) * (view.marker.visible ? 0.04 : 0);
        // o root gira com o inimigo; o marcador nao
        view.marker.rotation.set(
          MARKER_TILT,
          -view.character.root.rotation.y,
          0,
        );
        view.cone.material = coneMat[enemy.state];
        view.cone.visible = !dead;
        view.blood.visible = dead && enemy.launch === 0;
        view.character.shadow.visible = !dead;
      }
      reconcile(enemies, new Set(world.enemies.map((e) => e.id)), removeEnemy);

      for (const pickup of world.pickups) {
        let mesh = pickups.get(pickup.id);
        if (!mesh) {
          mesh = buildPickup(pickup.kind);
          mesh.rotation.y = pickup.id;
          pickups.set(pickup.id, mesh);
        }
        if (pickup.kind !== 'money') {
          // flutua sobre os destrocos da caixa, girando devagar
          mesh.position.set(
            pickup.pos.x,
            FLOAT.height + Math.sin(time * FLOAT.bob + pickup.id) * 0.08,
            -pickup.pos.y,
          );
          mesh.rotation.y = time * FLOAT.spin + pickup.id;
          continue;
        }
        const { pulse, hop } = MONEY;
        mesh.position.set(
          pickup.pos.x,
          0.02 + Math.abs(Math.sin(time * hop.speed + pickup.id)) * hop.height,
          -pickup.pos.y,
        );
        mesh.scale.setScalar(
          1 + Math.sin(time * pulse.speed + pickup.id) * pulse.amount,
        );
      }
      reconcile(pickups, new Set(world.pickups.map((p) => p.id)), removeMesh);

      for (const bullet of world.projectiles) {
        let mesh = bullets.get(bullet.id);
        if (!mesh) {
          mesh = buildBullet(bullet);
          bullets.set(bullet.id, mesh);
        }
        mesh.position.set(bullet.pos.x, BULLET_Y, -bullet.pos.y);
        if (bullet.shuriken) mesh.rotation.y = time * SHURIKEN_SPIN;
      }
      reconcile(
        bullets,
        new Set(world.projectiles.map((b) => b.id)),
        removeMesh,
      );
    },

    dispose() {
      reconcile(rooms, new Set(), removeRoom);
      reconcile(enemies, new Set(), removeEnemy);
      reconcile(props, new Set(), (view) => scene.remove(view.group));
      reconcile(pickups, new Set(), removeMesh);
      reconcile(bullets, new Set(), removeMesh);
      scene.remove(player.root);
      prompt.removeFromParent();
      chestPrompt.removeFromParent();
      knifePrompt.removeFromParent();
      held.dispose();
      reconcile(floaters, new Set(), removeFloater);
      for (const particle of particles) scene.remove(particle.mesh);
      particles.length = 0;
      for (const texture of floaterTextures.values()) texture.dispose();
      kit.dispose();
      for (const papers of wallpapers.values()) {
        for (const { material, texture } of [papers.wall, papers.floor]) {
          material.dispose();
          texture.dispose();
        }
      }
      for (const item of [
        ...Object.values(geo),
        ...Object.values(mat),
        ...Object.values(markerMat),
        ...Object.values(coneMat),
      ]) {
        item.dispose();
      }
    },
  };
}
