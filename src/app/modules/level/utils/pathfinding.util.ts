import {
  isDoorTile,
  isSolidTile,
  tileAt,
} from '@/app/modules/level/utils/grid.util';
import type { Vec2, World } from '@/app/modules/world/types/world.types';

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// BFS em 4 direcoes: no grid de custo uniforme ja devolve o caminho mais
// curto, e sem diagonal nao corta quina de parede.
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

  const queue: [number, number][] = [[Math.floor(from.x), Math.floor(from.y)]];
  const parents = [-1];
  const seen = new Set([`${queue[0][0]},${queue[0][1]}`]);

  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === goalX && y === goalY) {
      const path: Vec2[] = [{ x: to.x, y: to.y }];
      for (let n = parents[i]; n > 0; n = parents[n]) {
        path.unshift({ x: queue[n][0] + 0.5, y: queue[n][1] + 0.5 });
      }
      return path;
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || blocked(nx, ny)) continue;
      seen.add(key);
      parents.push(i);
      queue.push([nx, ny]);
    }
  }
  return [];
}
