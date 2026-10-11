import * as THREE from 'three';

import { castRay, tileCenter } from '@/app/modules/level/utils/grid.util';
import {
  ROOM_H,
  ROOM_W,
  VIEW_HALF_ANGLE,
} from '@/app/modules/world/constants/world.constants';
import type {
  Enemy,
  EnemyState,
  Room,
  Vec2,
  World,
} from '@/app/modules/world/types/world.types';

// Desenha o World. Nunca muta o World.
// Simulacao (x, y) vira three (x, altura, -y).

const WALL_HEIGHT = 1.2;
const CONE_SEGMENTS = 24;
const CONE_Y = 0.03;

type EnemyView = { group: THREE.Group; body: THREE.Mesh; cone: THREE.Mesh };

export type WorldRenderer = {
  sync: (world: World, time: number) => void;
  dispose: () => void;
};

function lambert(color: number): THREE.Material {
  return new THREE.MeshLambertMaterial({ color });
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

export function createWorldRenderer(scene: THREE.Scene): WorldRenderer {
  const geo = {
    wall: new THREE.BoxGeometry(1, WALL_HEIGHT, 1),
    floor: new THREE.PlaneGeometry(ROOM_W, ROOM_H),
    tile: new THREE.PlaneGeometry(1, 1),
    body: new THREE.CapsuleGeometry(0.28, 0.5, 4, 12),
    head: new THREE.SphereGeometry(0.2, 12, 12),
    nose: new THREE.BoxGeometry(0.25, 0.08, 0.08),
    pickup: new THREE.BoxGeometry(0.4, 0.08, 0.22),
  };
  const mat = {
    floor: lambert(0x4a4f6a),
    wall: lambert(0x8a8fb0),
    shop: lambert(0x3d9a6a),
    player: lambert(0xff8a3c),
    head: lambert(0x22222e),
    pickup: lambert(0x4ade80),
  };
  const bodyMat: Record<EnemyState, THREE.Material> = {
    patrol: lambert(0xb04a6a),
    suspicious: lambert(0xe8c14a),
    alert: lambert(0xff3030),
    dead: lambert(0x33333f),
  };
  const coneMat: Record<EnemyState, THREE.Material> = {
    patrol: coneMaterial(0xffffff),
    suspicious: coneMaterial(0xffd84a),
    alert: coneMaterial(0xff4040),
    dead: coneMaterial(0x000000),
  };

  const rooms = new Map<number, THREE.Group>();
  const enemies = new Map<number, EnemyView>();
  const pickups = new Map<number, THREE.Mesh>();

  function makeCharacter(material: THREE.Material) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(geo.body, material);
    body.position.y = 0.53;
    const head = new THREE.Mesh(geo.head, mat.head);
    head.position.y = 1.15;
    // nariz aponta para +x local, que e a direcao de `facing`
    const nose = new THREE.Mesh(geo.nose, mat.head);
    nose.position.set(0.25, 1.15, 0);
    group.add(body, head, nose);
    scene.add(group);
    return { group, body };
  }

  function place(object: THREE.Object3D, pos: Vec2, facing: number) {
    object.position.set(pos.x, 0, -pos.y);
    object.rotation.set(0, facing, 0);
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

  function buildEnemy(): EnemyView {
    const { group, body } = makeCharacter(bodyMat.patrol);
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
    return { group, body, cone };
  }

  function removeEnemy(view: EnemyView) {
    scene.remove(view.group, view.cone);
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

  const player = makeCharacter(mat.player);

  return {
    sync(world, time) {
      for (const room of world.rooms) {
        if (!rooms.has(room.index)) rooms.set(room.index, buildRoom(room));
      }
      reconcile(rooms, new Set(world.rooms.map((r) => r.index)), removeRoom);

      place(player.group, world.player.pos, world.player.facing);

      for (const enemy of world.enemies) {
        let view = enemies.get(enemy.id);
        if (!view) {
          view = buildEnemy();
          enemies.set(enemy.id, view);
        }
        const dead = enemy.state === 'dead';
        place(view.group, enemy.pos, enemy.facing);
        if (dead) {
          view.group.position.y = 0.3;
          view.group.rotation.z = Math.PI / 2;
        }
        view.body.material = bodyMat[enemy.state];
        view.cone.material = coneMat[enemy.state];
        view.cone.visible = !dead;
        if (!dead) updateCone(world, enemy, view.cone);
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
      reconcile(pickups, new Set(world.pickups.map((p) => p.id)), (mesh) =>
        scene.remove(mesh),
      );
    },

    dispose() {
      reconcile(rooms, new Set(), removeRoom);
      reconcile(enemies, new Set(), removeEnemy);
      reconcile(pickups, new Set(), (mesh) => scene.remove(mesh));
      scene.remove(player.group);
      for (const item of [
        ...Object.values(geo),
        ...Object.values(mat),
        ...Object.values(bodyMat),
        ...Object.values(coneMat),
      ]) {
        item.dispose();
      }
    },
  };
}
