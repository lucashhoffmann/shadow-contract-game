import * as THREE from 'three';

import {
  type Character,
  type CharacterKind,
  createCharacterKit,
  poseAttack,
  SIDES,
} from '@/app/engine/renderers/character.renderer';
import { castRay, tileCenter } from '@/app/modules/level/utils/grid.util';
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
// altura do centro do tronco: a cambalhota gira em volta dele, nao dos pes
const FLIP_PIVOT_Y = 0.6;
const TUCK = 1.4;
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

// quem salta: personagem, vento nas costas e quanto do giro do lean e
// cambalhota (o resto e a inclinacao de correr)
type Jumper = { character: Character; wind: THREE.Group; flip: number };
type EnemyView = Jumper & {
  marker: THREE.Group;
  markerParts: THREE.Mesh[];
  cone: THREE.Mesh;
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
): WorldRenderer {
  const geo = {
    wall: new THREE.BoxGeometry(1, WALL_HEIGHT, 1),
    floor: new THREE.PlaneGeometry(ROOM_W, ROOM_H),
    tile: new THREE.PlaneGeometry(1, 1),
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
    shop: lambert(0x3d9a6a),
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
  // senao o corpo trava e a inclinacao pisca.
  function animate(
    character: Character,
    pos: Vec2,
    facing: number,
    dt: number,
    time: number,
    maxLean: number,
  ) {
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
      character.legs[i].rotation.z = side * swing * 0.8;
      character.arms[i].rotation.z =
        i === 0 && character.hold !== null
          ? character.hold
          : -side * swing * 0.6;
    });

    const look =
      character.idle > IDLE_DELAY
        ? Math.sin((character.idle - IDLE_DELAY) * 2.2) * 0.9
        : 0;
    head.rotation.y += (look - head.rotation.y) * ease;
  }

  const rooms = new Map<number, THREE.Group>();
  const enemies = new Map<number, EnemyView>();
  const props = new Map<number, { group: THREE.Group; broken: boolean }>();
  const pickups = new Map<number, THREE.Group>();
  const bullets = new Map<number, THREE.Group>();
  const removeMesh = (mesh: THREE.Object3D) => scene.remove(mesh);

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
        } else if (line[col] === 'S') {
          const tile = new THREE.Mesh(geo.tile, mat.shop);
          tile.rotation.x = -Math.PI / 2;
          tile.position.set(center.x, 0.01, -center.y);
          group.add(tile);
        }
      }
    });

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
  // Fica no root, nao no lean: nao gira junto com a cambalhota.
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
    return { character, wind, flip: 0 };
  }

  // `animate` mais o salto: sobe e desce em arco, uma cambalhota para frente
  // em volta do tronco, joelhos e braco livre recolhidos no meio do giro.
  // `dash` e o tempo que falta no ar.
  function animateJumper(
    jumper: Jumper,
    pos: Vec2,
    facing: number,
    dash: number,
    dt: number,
    time: number,
    maxLean: number,
  ) {
    const { character, wind } = jumper;
    const { lean } = character;
    lean.rotation.z -= jumper.flip;
    animate(character, pos, facing, dt, time, maxLean);
    const jumping = dash > 0;
    const air = jumping ? 1 - dash / DASH_TIME : 0;
    const arc = Math.sin(Math.PI * air);
    jumper.flip = -2 * Math.PI * air;
    lean.rotation.z += jumper.flip;
    lean.position.x = Math.sin(jumper.flip) * FLIP_PIVOT_Y;
    lean.position.y +=
      (1 - Math.cos(jumper.flip)) * FLIP_PIVOT_Y + arc * JUMP_HEIGHT;
    character.shadow.scale.setScalar(1 - arc * 0.35);
    if (jumping) {
      for (const leg of character.legs) leg.rotation.z = arc * TUCK;
      character.arms[1].rotation.z = arc * TUCK;
    }
    // vento cresce e some com o arco
    wind.visible = jumping;
    wind.position.y = FLIP_PIVOT_Y + arc * JUMP_HEIGHT;
    wind.scale.setScalar(0.3 + arc * 0.7);
    wind.scale.x *= 1 + air * 0.8;
    wind.rotation.x = Math.sin(time * 30) * 0.15;
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
    return { ...jumper, marker, markerParts: [stem, dot], cone };
  }

  function removeEnemy(view: EnemyView) {
    scene.remove(view.character.root, view.cone);
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
  let lastTime = 0;

  return {
    sync(world, time) {
      const dt = lastTime ? Math.min(0.1, time - lastTime) : 0;
      lastTime = time;

      for (const room of world.rooms) {
        if (!rooms.has(room.index)) rooms.set(room.index, buildRoom(room));
      }
      reconcile(rooms, new Set(world.rooms.map((r) => r.index)), removeRoom);

      for (const prop of world.props) {
        const view = props.get(prop.id);
        if (view && view.broken === prop.broken) continue;
        if (view) scene.remove(view.group);
        props.set(prop.id, { group: buildProp(prop), broken: prop.broken });
      }
      reconcile(props, new Set(world.props.map((p) => p.id)), (view) =>
        scene.remove(view.group),
      );

      animateJumper(
        hero,
        world.player.pos,
        world.player.facing,
        world.player.dash,
        dt,
        time,
        world.player.adrenaline > 0 ? ADRENALINE_LEAN : RUN_LEAN,
      );
      poseAttack(player, world.player.slash);

      for (const enemy of world.enemies) {
        let view = enemies.get(enemy.id);
        if (!view) {
          view = buildEnemy(enemy.kind);
          enemies.set(enemy.id, view);
        }
        const dead = enemy.state === 'dead';
        const { root, lean, head } = view.character;
        if (dead) {
          root.position.set(enemy.pos.x, 0.3, -enemy.pos.y);
          root.rotation.set(0, enemy.facing, Math.PI / 2);
          lean.rotation.z = 0;
          lean.position.set(0, 0, 0);
          head.rotation.y = 0;
          // morreu no ar: cai sem giro nem vento
          view.flip = 0;
          view.wind.visible = false;
        } else {
          animateJumper(
            view,
            enemy.pos,
            enemy.facing,
            enemy.dash,
            dt,
            time,
            RUN_LEAN,
          );
          // inimigo nao fica olhando em volta: o cone mostra para onde ele ve
          head.rotation.y = 0;
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
