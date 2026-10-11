import {
  HEART_MAX,
  HEART_MIN,
  LOOT_HEART_CHANCE,
  LOOT_SHIELD_CHANCE,
  MELEE_RANGE,
  ROOM_H,
  ROOM_W,
  SHIELD_MAX,
  SHIELD_MIN,
} from '@/app/modules/world/constants/world.constants';
import type { Prop, Vec2, World } from '@/app/modules/world/types/world.types';
import { angleTo, clamp, distance } from '@/shared/utils/math.util';
import { nextRandom } from '@/shared/utils/rng.util';

const RAY_STEP = 0.1;

function roomAt(world: World, ty: number) {
  const index = Math.floor(ty / ROOM_H);
  return world.rooms.find((r) => r.index === index);
}

// fora das salas vivas tudo e parede
export function tileAt(world: World, tx: number, ty: number): string {
  if (tx < 0 || tx >= ROOM_W) return '#';
  const room = roomAt(world, ty);
  if (!room) return '#';
  return room.tiles[ROOM_H - 1 - (ty - room.index * ROOM_H)][tx];
}

// parede ('#') bloqueia tudo. Caixa ('o') bloqueia passagem e bala, mas e
// baixa: nao bloqueia visao. Bau ('C') bloqueia igual a caixa e nao quebra.
export function isSolidTile(tile: string): boolean {
  return tile === '#' || tile === 'o' || tile === 'C';
}

export function isWall(world: World, x: number, y: number): boolean {
  return tileAt(world, Math.floor(x), Math.floor(y)) === '#';
}

export function roomIndexAt(y: number): number {
  return Math.floor(y / ROOM_H);
}

// (col, row) do template para o centro do tile em coordenadas de mundo
export function tileCenter(roomIndex: number, col: number, row: number): Vec2 {
  return { x: col + 0.5, y: roomIndex * ROOM_H + (ROOM_H - 1 - row) + 0.5 };
}

export function circleHitsWall(
  world: World,
  x: number,
  y: number,
  radius: number,
): boolean {
  for (let ty = Math.floor(y - radius); ty <= Math.floor(y + radius); ty++) {
    for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++) {
      if (!isSolidTile(tileAt(world, tx, ty))) continue;
      const dx = x - clamp(x, tx, tx + 1);
      const dy = y - clamp(y, ty, ty + 1);
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

// eixos separados: bater na parede em um eixo ainda desliza no outro
export function moveCircle(
  world: World,
  pos: Vec2,
  dx: number,
  dy: number,
  radius: number,
): void {
  if (!circleHitsWall(world, pos.x + dx, pos.y, radius)) pos.x += dx;
  if (!circleHitsWall(world, pos.x, pos.y + dy, radius)) pos.y += dy;
}

// ponytail: marcha em passos de RAY_STEP em vez de DDA; erro maximo de 0.1
// tile. Trocar por DDA se o numero de raios por frame crescer.
export function castRay(
  world: World,
  from: Vec2,
  angle: number,
  maxDist: number,
): number {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let d = RAY_STEP; d < maxDist; d += RAY_STEP) {
    if (isWall(world, from.x + cos * d, from.y + sin * d)) return d;
  }
  return maxDist;
}

export function hasLineOfSight(world: World, a: Vec2, b: Vec2): boolean {
  const d = distance(a, b);
  return castRay(world, a, angleTo(a, b), d) >= d;
}

export function nearbyProp(world: World): Prop | undefined {
  const from = world.player.pos;
  let nearest: Prop | undefined;
  let nearestDistance = MELEE_RANGE;
  for (const prop of world.props) {
    if (prop.broken) continue;
    const d = distance(from, prop.pos);
    if (d <= nearestDistance && hasLineOfSight(world, from, prop.pos)) {
      nearest = prop;
      nearestDistance = d;
    }
  }
  return nearest;
}

// caixa quebrada as vezes solta coracao (cura pouca na maioria das vezes) ou
// escudo; sorteio pelo `rngState`, entao reproduzivel por seed
function dropLoot(world: World, prop: Prop): void {
  const roll = nextRandom(world);
  if (roll >= LOOT_HEART_CHANCE + LOOT_SHIELD_CHANCE) return;
  const heart = roll < LOOT_HEART_CHANCE;
  const amount = nextRandom(world);
  const fraction = heart
    ? HEART_MIN + (HEART_MAX - HEART_MIN) * amount * amount
    : SHIELD_MIN + (SHIELD_MAX - SHIELD_MIN) * amount;
  world.pickups.push({
    id: world.nextId++,
    kind: heart ? 'heart' : 'shield',
    roomIndex: prop.roomIndex,
    pos: { ...prop.pos },
    value: Math.round(world.player.maxHp * fraction),
  });
}

// quebrar libera o tile: a sala guarda a propria copia de `tiles`
export function breakProp(world: World, prop: Prop): void {
  if (prop.broken) return;
  prop.broken = true;
  dropLoot(world, prop);
  const tx = Math.floor(prop.pos.x);
  const ty = Math.floor(prop.pos.y);
  const room = roomAt(world, ty);
  if (!room) return;
  const row = ROOM_H - 1 - (ty - room.index * ROOM_H);
  const line = room.tiles[row];
  room.tiles[row] = line.slice(0, tx) + '.' + line.slice(tx + 1);
}

// devolve true se havia caixa inteira no ponto (e ela quebrou)
export function breakPropAt(world: World, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tileAt(world, tx, ty) !== 'o') return false;
  const prop = world.props.find(
    (p) =>
      !p.broken && Math.floor(p.pos.x) === tx && Math.floor(p.pos.y) === ty,
  );
  if (prop) breakProp(world, prop);
  return true;
}

export function breakPropsNear(world: World, pos: Vec2, radius: number): void {
  for (const prop of world.props) {
    if (distance(prop.pos, pos) <= radius) breakProp(world, prop);
  }
}
