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
  isSolidTile,
  nearbyProp,
  tileAt,
  tileCenter,
} from '@/app/modules/level/utils/grid.util';
import { nearbyChest } from '@/app/modules/shop/systems/shop.system';
import {
  DASH_TIME,
  ROOM_H,
  ROOM_W,
  VIEW_HALF_ANGLE,
} from '@/app/modules/world/constants/world.constants';
import type {
  Enemy,
  EnemyKind,
  EnemyState,
  Projectile,
  Prop,
  Room,
  Vec2,
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
// no alto do salto o corpo fica quase deitado, bracos esticados a frente
const DIVE_TILT = 1.3;
const DIVE_REACH = 2.8;
// parede ou caixa a menos disso do centro: agacha em cobertura
const COVER_DISTANCE = 0.75;
const CROUCH_LEAN = 0.35;
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
// altura do root deitado: a cabeca encosta no chao
const DEAD_Y = 0.3;
// giro da tampa do bau aberta, em torno da dobradica
const CHEST_OPEN = -1.9;
const BLOOD_GROW_TIME = 2.5;
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
  cone: THREE.Mesh;
  blood: THREE.Mesh;
  deathAt: number | null;
};

export type WorldRenderer = {
  sync: (world: World, time: number) => void;
  dispose: () => void;
};

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
    // municao ao longo de +x, ponta na frente
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
    markerStem: new THREE.BoxGeometry(0.07, 0.24, 0.07),
    markerDot: new THREE.SphereGeometry(0.075, 10, 10),
    prompt: new THREE.BoxGeometry(1, 1, 0.08),
    box: new THREE.BoxGeometry(1, 1, 1),
    blood: new THREE.CircleGeometry(1, 16),
    crate: new THREE.BoxGeometry(0.78, 0.62, 0.78),
    plank: new THREE.BoxGeometry(0.34, 0.06, 0.2),
    // meio aro deitado, aberto para frente (+x)
    gust: new THREE.TorusGeometry(0.42, 0.035, 6, 14, Math.PI)
      .rotateX(Math.PI / 2)
      .rotateY(-Math.PI / 2),
    streak: new THREE.BoxGeometry(0.5, 0.02, 0.03),
  };
  const mat = {
    floor: lambert(0x4a4f6a),
    wall: lambert(0x8a8fb0),
    chestLight: lambert(0xdcb980),
    chestLock: lambert(0x9aa0aa),
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
    prompt: flat(0xffe477),
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
    part(lid, mat.woodDark, [0.84, 0.16, 0.64], [0, 0.08, 0.3]);
    part(lid, mat.chestLight, [0.64, 0.02, 0.44], [0, -0.005, 0.3]);
    part(lid, mat.chestLight, [0.6, 0.08, 0.02], [0, 0.09, 0.62]);
    part(lid, mat.chestLock, [0.12, 0.16, 0.05], [0, 0.03, 0.63]);
    group.add(lid);
    return { group, lid };
  }

  function buildRoom(room: Room): THREE.Group {
    const group = new THREE.Group();
    const floor = new THREE.Mesh(geo.floor, mat.floor);
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
    if (room.chest) {
      const chest = buildChest();
      chest.group.position.set(room.chest.x, 0, -room.chest.y);
      group.add(chest.group);
      chestLids.set(room.index, chest.lid);
    }

    const instanced = new THREE.InstancedMesh(geo.wall, mat.wall, walls.length);
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

  // pilhas de moedas levemente tortas, com aura dourada em volta
  function buildPickup(): THREE.Group {
    const group = new THREE.Group();
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
  function buildProp(prop: Prop): THREE.Group {
    const group = new THREE.Group();
    group.position.set(prop.pos.x, 0, -prop.pos.y);
    if (prop.broken) {
      DEBRIS.forEach(([x, z, turn], i) => {
        const plank = new THREE.Mesh(
          geo.plank,
          i % 2 ? mat.wood : mat.woodDark,
        );
        plank.position.set(x, 0.04 + i * 0.012, z);
        plank.rotation.y = turn + prop.id;
        group.add(plank);
      });
    } else {
      const crate = new THREE.Mesh(geo.crate, mat.wood);
      crate.position.y = 0.31;
      const lid = new THREE.Mesh(geo.plank, mat.woodDark);
      lid.scale.set(2.3, 1, 0.9);
      lid.position.y = 0.64;
      group.add(crate, lid);
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
  // mergulhando de frente em volta do tronco, bracos esticados e pernas
  // soltas atras; sai e cai agachado. Perto de parede ou caixa: agacha.
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
    jumper.crouch += ((jumping || wall ? 1 : 0) - jumper.crouch) * ease;
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
    SIDES.forEach((side, i) => {
      arms[i].rotation.z += (DIVE_REACH - arms[i].rotation.z) * arc;
      legs[i].rotation.z += (-side * 0.45 - legs[i].rotation.z) * arc;
    });
    // vento cresce e some com o arco
    wind.visible = jumping;
    wind.position.y = FLIP_PIVOT_Y + arc * JUMP_HEIGHT;
    wind.scale.setScalar(0.3 + arc * 0.7);
    wind.scale.x *= 1 + air * 0.8;
    wind.rotation.x = Math.sin(time * 30) * 0.15;
  }

  // morto: estirado de brucos, centrado em `pos`, sem giro nem vento
  function layDead(jumper: Jumper, pos: Vec2, facing: number) {
    const { character } = jumper;
    character.root.position.set(pos.x, DEAD_Y * character.head.scale.x, -pos.y);
    character.root.rotation.set(0, facing, -Math.PI / 2);
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
    // exclamação sobre a cabeca: amarelo ao notar, vermelho em alerta
    const marker = new THREE.Group();
    const stem = new THREE.Mesh(geo.markerStem, markerMat.patrol);
    stem.position.y = 0.08;
    const dot = new THREE.Mesh(geo.markerDot, markerMat.patrol);
    dot.position.y = -0.12;
    marker.add(stem, dot);
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
      markerParts: [stem, dot],
      cone,
      blood,
      deathAt: null,
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
  // letra modelada com barras [x, y, largura, altura], amarela com contorno
  function buildPrompt(name: string, bars: number[][]): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    group.visible = false;
    for (const [x, y, width, height] of bars) {
      const border = new THREE.Mesh(geo.prompt, mat.promptBorder);
      border.position.set(x, y, -0.05);
      border.scale.set(width + 0.08, height + 0.08, 1);
      const bar = new THREE.Mesh(geo.prompt, mat.prompt);
      bar.position.set(x, y, 0.05);
      bar.scale.set(width, height, 1);
      group.add(border, bar);
    }
    return group;
  }
  // F sobre a caixa ao alcance
  const prompt = buildPrompt('interactionPrompt', [
    [-0.11, 0, 0.07, 0.38],
    [0, 0.155, 0.29, 0.07],
    [-0.015, 0.02, 0.26, 0.07],
  ]);
  // B sobre o bau ao alcance
  const chestPrompt = buildPrompt('chestPrompt', [
    [-0.11, 0, 0.07, 0.38],
    [-0.02, 0.155, 0.2, 0.07],
    [-0.02, 0, 0.2, 0.07],
    [-0.02, -0.155, 0.2, 0.07],
    [0.1, 0.078, 0.07, 0.12],
    [0.1, -0.078, 0.07, 0.12],
  ]);
  scene.add(chestPrompt);
  let lastTime = 0;

  return {
    sync(world, time) {
      const dt = lastTime ? Math.min(0.1, time - lastTime) : 0;
      lastTime = time;

      for (const room of world.rooms) {
        if (!rooms.has(room.index)) rooms.set(room.index, buildRoom(room));
      }
      reconcile(rooms, new Set(world.rooms.map((r) => r.index)), removeRoom);
      for (const index of chestLids.keys()) {
        if (!rooms.has(index)) chestLids.delete(index);
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

      const prop = world.status === 'playing' && nearbyProp(world);
      prompt.visible = !!prop;
      if (prop) {
        props.get(prop.id)?.group.add(prompt);
        prompt.position.set(0, 1.03 + Math.sin(time * 5) * 0.06, 0);
      }

      // bau: B flutua em cima quando da para abrir; a tampa abre com a loja
      const chestRoom =
        world.status === 'playing' || world.status === 'shop'
          ? nearbyChest(world)
          : undefined;
      chestPrompt.visible = world.status === 'playing' && !!chestRoom?.chest;
      if (chestRoom?.chest) {
        chestPrompt.position.set(
          chestRoom.chest.x,
          1.05 + Math.sin(time * 5) * 0.06,
          -chestRoom.chest.y,
        );
      }
      const opened = world.status === 'shop' ? chestRoom?.index : undefined;
      for (const [index, lid] of chestLids) {
        const target = index === opened ? CHEST_OPEN : 0;
        lid.rotation.x += (target - lid.rotation.x) * Math.min(1, dt * 9);
      }

      const lost = world.status === 'dead';
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
        );
        poseAttack(player, world.player.slash);
      }
      player.shadow.visible = !lost;

      for (const enemy of world.enemies) {
        let view = enemies.get(enemy.id);
        if (!view) {
          view = buildEnemy(enemy.kind);
          enemies.set(enemy.id, view);
        }
        const dead = enemy.state === 'dead';
        if (dead) {
          if (view.deathAt === null) view.deathAt = time;
          const progress = Math.min(1, (time - view.deathAt) / BLOOD_GROW_TIME);
          const eased = progress * progress * (3 - 2 * progress);
          const radius = 0.05 + 0.8 * eased;
          view.blood.position.set(enemy.pos.x, 0.015, -enemy.pos.y);
          view.blood.scale.set(radius, radius * 0.78, 1);
          layDead(view, enemy.pos, enemy.facing);
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
        for (const part of view.markerParts)
          part.material = markerMat[enemy.state];
        view.marker.visible =
          enemy.state === 'suspicious' || enemy.state === 'alert';
        view.marker.position.y =
          1.7 +
          Math.sin(time * 14 + enemy.id) * (view.marker.visible ? 0.04 : 0);
        view.cone.material = coneMat[enemy.state];
        view.cone.visible = !dead;
        view.blood.visible = dead;
        view.character.shadow.visible = !dead;
      }
      reconcile(enemies, new Set(world.enemies.map((e) => e.id)), removeEnemy);

      for (const pickup of world.pickups) {
        let mesh = pickups.get(pickup.id);
        if (!mesh) {
          mesh = buildPickup();
          mesh.rotation.y = pickup.id;
          pickups.set(pickup.id, mesh);
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
      kit.dispose();
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
