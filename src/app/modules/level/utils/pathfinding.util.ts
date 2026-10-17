import { searchGrid, tileCenterOf } from 'three-hex-engine/kit';

import {
  isDoorTile,
  isSolidTile,
  tileAt,
} from '@/app/modules/level/utils/grid.util';
import type { Vec2, World } from '@/app/modules/world/types/world.types';

// Caminho em 4 direcoes pela grade (BFS do kit da engine): mais curto, e sem
// diagonal nao corta quina de parede.
// Devolve os centros dos tiles depois do inicial, terminando em `to`.
// Vazio quando nao ha caminho.
// `sealed`: porta conta como parede (rota de inimigo com a porta selada).
export function findPath(
  world: World,
  from: Vec2,
  to: Vec2,
  sealed = false,
): Vec2[] {
  const blocked = (x: number, y: number) =>
    isSolidTile(tileAt(world, x, y)) || (sealed && isDoorTile(x, y));
  const goalX = Math.floor(to.x);
  const goalY = Math.floor(to.y);
  if (blocked(goalX, goalY)) return [];
  const tiles = searchGrid(from, (x, y) => x === goalX && y === goalY, blocked);
  if (!tiles) return [];
  return [...tiles.slice(0, -1).map(tileCenterOf), { x: to.x, y: to.y }];
}
