import { createEnemy } from '@/app/modules/enemy/systems/enemy.system';
import {
  COMBAT_TEMPLATES,
  SHOP_TEMPLATE,
  START_TEMPLATE,
} from '@/app/modules/level/templates/room.template';
import { roomIndexAt, tileCenter } from '@/app/modules/level/utils/grid.util';
import {
  ROOMS_AHEAD,
  ROOMS_BEHIND,
  ROOMS_PER_EXTRA_ENEMY,
  SHOP_EVERY,
  TILE_MONEY,
} from '@/app/modules/world/constants/world.constants';
import type {
  RoomTemplate,
  World,
} from '@/app/modules/world/types/world.types';
import { nextRandom } from '@/shared/utils/rng.util';

export function pickTemplate(world: World, index: number): RoomTemplate {
  if (index === 0) return START_TEMPLATE;
  if (index % SHOP_EVERY === 0) return SHOP_TEMPLATE;
  return COMBAT_TEMPLATES[
    Math.floor(nextRandom(world) * COMBAT_TEMPLATES.length)
  ];
}

export function spawnRoom(
  world: World,
  index: number,
  template: RoomTemplate = pickTemplate(world, index),
): void {
  world.rooms.push({
    index,
    templateId: template.id,
    kind: template.kind,
    tiles: template.tiles,
    shopVisited: false,
  });

  const enemyCount = Math.min(
    template.enemies.length,
    1 + Math.floor(index / ROOMS_PER_EXTRA_ENEMY),
  );
  for (let i = 0; i < enemyCount; i++) {
    const patrol = template.enemies[i].path.map(([col, row]) =>
      tileCenter(index, col, row),
    );
    world.enemies.push(createEnemy(world, index, patrol));
  }

  template.tiles.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== '$') continue;
      world.pickups.push({
        id: world.nextId++,
        roomIndex: index,
        pos: tileCenter(index, col, row),
        value: TILE_MONEY,
      });
    }
  });
}

// mantem vivas so as salas ao redor do player; o resto vira parede
export function updateRooms(world: World): void {
  const current = roomIndexAt(world.player.pos.y);
  world.run.roomIndex = Math.max(world.run.roomIndex, current);

  let last = world.rooms[world.rooms.length - 1].index;
  while (last < current + ROOMS_AHEAD) spawnRoom(world, ++last);

  const min = current - ROOMS_BEHIND;
  if (world.rooms[0].index >= min) return;
  world.rooms = world.rooms.filter((r) => r.index >= min);
  world.enemies = world.enemies.filter((e) => e.roomIndex >= min);
  world.pickups = world.pickups.filter((p) => p.roomIndex >= min);
}
