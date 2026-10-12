import { createEnemy } from '@/app/modules/enemy/systems/enemy.system';
import {
  COMBAT_TEMPLATES,
  SHOP_TEMPLATE,
  START_TEMPLATE,
} from '@/app/modules/level/templates/room.template';
import {
  MULTI_COMBAT_TEMPLATES,
  MULTI_SHOP_TEMPLATE,
  MULTI_START_TEMPLATE,
} from '@/app/modules/multiplayer/templates/room.template';
import {
  enemyMultiplier,
  threatBoost,
} from '@/app/modules/world/utils/players.util';
import { roomIndexAt, tileCenter } from '@/app/modules/level/utils/grid.util';
import {
  NINJA_CHANCE,
  NINJA_FROM_ROOM,
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
import { eventText } from '@/shared/i18n';

// cada modo tem as proprias salas, no tamanho dele
const TEMPLATES = {
  solo: {
    start: START_TEMPLATE,
    shop: SHOP_TEMPLATE,
    combat: COMBAT_TEMPLATES,
  },
  multi: {
    start: MULTI_START_TEMPLATE,
    shop: MULTI_SHOP_TEMPLATE,
    combat: MULTI_COMBAT_TEMPLATES,
  },
};

export function pickTemplate(world: World, index: number): RoomTemplate {
  const { start, shop, combat } = TEMPLATES[world.mode];
  if (index === 0) return start;
  if (index % SHOP_EVERY === 0) return shop;
  return combat[Math.floor(nextRandom(world) * combat.length)];
}

export function spawnRoom(
  world: World,
  index: number,
  template: RoomTemplate = pickTemplate(world, index),
): void {
  const chestRow = template.tiles.findIndex((line) => line.includes('C'));
  world.rooms.push({
    index,
    templateId: template.id,
    kind: template.kind,
    // copia: quebrar caixa edita os tiles desta sala, nao do template
    tiles: [...template.tiles],
    chest:
      chestRow < 0
        ? null
        : tileCenter(index, template.tiles[chestRow].indexOf('C'), chestRow),
    shopVisited: false,
  });

  // multiplayer: mais inimigos por sala e dificuldade adiantada
  const threat = index + threatBoost(world);
  const enemyCount = Math.min(
    template.enemies.length,
    Math.round(
      (1 + Math.floor(threat / ROOMS_PER_EXTRA_ENEMY)) * enemyMultiplier(world),
    ),
  );
  for (let i = 0; i < enemyCount; i++) {
    const patrol = template.enemies[i].path.map(([col, row]) =>
      tileCenter(index, col, row),
    );
    const kind =
      threat >= NINJA_FROM_ROOM && nextRandom(world) < NINJA_CHANCE
        ? 'ninja'
        : 'suit';
    world.enemies.push(createEnemy(world, index, patrol, kind));
  }

  template.tiles.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      if (line[col] === 'o') {
        world.props.push({
          id: world.nextId++,
          roomIndex: index,
          pos: tileCenter(index, col, row),
          broken: false,
        });
      }
      if (line[col] !== '$') continue;
      world.pickups.push({
        id: world.nextId++,
        kind: 'money',
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
  if (current > world.run.roomIndex) {
    // entrada da sala nova: e onde renasce quem morrer nela com ficha
    world.run.checkpoint = { ...world.player.pos };
    world.run.events.push({
      at: world.run.seconds,
      ...eventText((t) => t.events.roomReached(current)),
    });
  }
  world.run.roomIndex = Math.max(world.run.roomIndex, current);

  let last = world.rooms[world.rooms.length - 1].index;
  while (last < current + ROOMS_AHEAD) spawnRoom(world, ++last);

  const min = current - ROOMS_BEHIND;
  if (world.rooms[0].index >= min) return;
  world.rooms = world.rooms.filter((r) => r.index >= min);
  world.enemies = world.enemies.filter((e) => e.roomIndex >= min);
  world.pickups = world.pickups.filter((p) => p.roomIndex >= min);
  world.props = world.props.filter((p) => p.roomIndex >= min);
}
