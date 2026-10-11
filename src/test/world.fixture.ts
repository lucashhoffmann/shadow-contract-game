import { createEnemy } from '@/app/modules/enemy/systems/enemy.system';
import { spawnRoom } from '@/app/modules/level/systems/level.system';
import { createEmptyWorld } from '@/app/modules/world/systems/world.system';
import type {
  Enemy,
  EnemyKind,
  RoomTemplate,
  World,
} from '@/app/modules/world/types/world.types';

const ARENA: RoomTemplate = {
  id: 'arena',
  kind: 'combat',
  tiles: [
    '###########',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '###########',
  ],
  enemies: [],
};

// Uma sala aberta e fechada nas bordas, player em (5.5, 2.5), sem inimigos.
// Area livre: x de 1 a 10, y de 1 a 12.
// `rows` troca linhas do template para erguer paredes: a linha `r` cobre
// y de `12 - r` a `13 - r`.
export function createArenaWorld(rows: Record<number, string> = {}): World {
  const world = createEmptyWorld(1);
  const tiles = ARENA.tiles.map((line, row) => rows[row] ?? line);
  spawnRoom(world, 0, { ...ARENA, tiles });
  world.player.pos = { x: 5.5, y: 2.5 };
  return world;
}

// inimigo parado em (x, y) olhando para `facing`
export function addEnemy(
  world: World,
  x: number,
  y: number,
  facing: number,
  kind: EnemyKind = 'suit',
): Enemy {
  const enemy = createEnemy(world, 0, [{ x, y }], kind);
  enemy.facing = facing;
  world.enemies.push(enemy);
  return enemy;
}
