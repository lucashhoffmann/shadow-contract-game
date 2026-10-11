import * as THREE from 'three';

import {
  type Character,
  type CharacterKind,
  createCharacterKit,
  SIDES,
  SWORD_REST_TILT,
  SWORD_REST_TURN,
} from '@/app/engine/renderers/character.renderer';
import { castRay, tileCenter } from '@/app/modules/level/utils/grid.util';
import {
  DASH_TIME,
  ROOM_H,
  ROOM_W,
  SLASH_TIME,
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

type EnemyView = { character: Character; marker: THREE.Mesh; cone: THREE.Mesh };

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
    pickup: new THREE.BoxGeometry(0.4, 0.08, 0.22),
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
    marker: new THREE.SphereGeometry(0.11, 10, 10),
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
    pickup: lambert(0x4ade80),
    wood: lambert(0xa8703c),
    woodDark: lambert(0x6e4726),
    brass: lambert(0xd9b84a),
    copper: lambert(0xd98a5a),
    shellRed: lambert(0xc8242c),
    bulletEnemy: flat(0xff4040),
    wind: new THREE.MeshBasicMaterial({
      color: 0xd6f4ff,
      transparent: true,
      opacity: 0,
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
  const pickups = new Map<number, THREE.Mesh>();
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

  function buildEnemy(kind: EnemyKind): EnemyView {
    const character = makeCharacter(kind);
    // bolinha sobre a cabeca: amarela suspeito, vermelha alerta
    const marker = new THREE.Mesh(geo.marker, markerMat.patrol);
    marker.position.y = 1.65;
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
    return { character, marker, cone };
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

  const player = makeCharacter('player');
  // vento do salto, nas costas: arcos cada vez menores e riscos soltos atras.
  // Fica no root, nao no lean: nao gira junto com a cambalhota.
  const wind = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const gust = new THREE.Mesh(geo.gust, mat.wind);
    gust.position.x = -0.1 - i * 0.24;
    gust.scale.setScalar(1 - i * 0.22);
    const streak = new THREE.Mesh(geo.streak, mat.wind);
    streak.position.set(-0.75 - (i % 2) * 0.2, (i - 1) * 0.12, (i - 1) * 0.22);
    wind.add(gust, streak);
  }
  wind.visible = false;
  player.root.add(wind);
  // parte da rotacao do lean que e cambalhota; o resto e a inclinacao de correr
  let flip = 0;
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

      player.lean.rotation.z -= flip;
      animate(
        player,
        world.player.pos,
        world.player.facing,
        dt,
        time,
        world.player.adrenaline > 0 ? ADRENALINE_LEAN : RUN_LEAN,
      );
      // salto: sobe e desce em arco, uma cambalhota para frente em volta do
      // tronco, joelhos e braco livre recolhidos no meio do giro
      const jumping = world.player.dash > 0;
      const air = jumping ? 1 - world.player.dash / DASH_TIME : 0;
      const arc = Math.sin(Math.PI * air);
      flip = -2 * Math.PI * air;
      player.lean.rotation.z += flip;
      player.lean.position.x = Math.sin(flip) * FLIP_PIVOT_Y;
      player.lean.position.y +=
        (1 - Math.cos(flip)) * FLIP_PIVOT_Y + arc * JUMP_HEIGHT;
      player.shadow.scale.setScalar(1 - arc * 0.35);
      if (jumping) {
        for (const leg of player.legs) leg.rotation.z = arc * TUCK;
        player.arms[1].rotation.z = arc * TUCK;
      }
      wind.visible = jumping;
      wind.position.y = FLIP_PIVOT_Y + arc * JUMP_HEIGHT;
      wind.scale.x = 1 + air * 0.8;
      wind.rotation.x = Math.sin(time * 30) * 0.15;
      mat.wind.opacity = arc * 0.75;
      if (player.sword) {
        // golpe: lamina deita para frente e varre da direita para a esquerda
        const swing = world.player.slash / SLASH_TIME;
        player.sword.rotation.set(
          0,
          swing > 0 ? (swing - 0.5) * 3 : SWORD_REST_TURN,
          swing > 0 ? -Math.PI / 2 : SWORD_REST_TILT,
        );
      }

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
          lean.position.y = 0;
          head.rotation.y = 0;
        } else {
          animate(view.character, enemy.pos, enemy.facing, dt, time, RUN_LEAN);
          // inimigo nao fica olhando em volta: o cone mostra para onde ele ve
          head.rotation.y = 0;
          updateCone(world, enemy, view.cone);
        }
        view.marker.material = markerMat[enemy.state];
        view.marker.visible =
          enemy.state === 'suspicious' || enemy.state === 'alert';
        view.cone.material = coneMat[enemy.state];
        view.cone.visible = !dead;
        view.character.shadow.visible = !dead;
      }
      reconcile(enemies, new Set(world.enemies.map((e) => e.id)), removeEnemy);

      for (const pickup of world.pickups) {
        let mesh = pickups.get(pickup.id);
        if (!mesh) {
          mesh = new THREE.Mesh(geo.pickup, mat.pickup);
          pickups.set(pickup.id, mesh);
          scene.add(mesh);
        }
        mesh.position.set(
          pickup.pos.x,
          0.25 + Math.sin(time * 3 + pickup.id) * 0.05,
          -pickup.pos.y,
        );
        mesh.rotation.y = time * 2;
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
