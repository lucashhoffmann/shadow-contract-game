import {
  HEADSHOT_FROM_LEVEL,
  HEADSHOT_LOOT_MAX,
  HEADSHOT_LOOT_MIN,
  HEART_MAX,
  AMMO_LOOT_MAX,
  AMMO_LOOT_MIN,
  DASH_LOOT_MAX,
  DASH_LOOT_MIN,
  DOOR_RANGE,
  HEART_MIN,
  IDLE_WARNING_DELAY,
  LOOT_HEART_CHANCE,
  LOOT_AMMO_CHANCE,
  LOOT_DASH_CHANCE,
  LOOT_REVIVE_CHANCE,
  LOOT_HEADSHOT_CHANCE,
  LOOT_SHIELD_CHANCE,
  MELEE_RANGE,
  ROOM_H,
  ROOM_W,
  SHOP_EVERY,
  SHIELD_MAX,
  SHIELD_MIN,
} from '@/app/modules/world/constants/world.constants';
import type {
  PickupKind,
  Prop,
  Vec2,
  World,
} from '@/app/modules/world/types/world.types';
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

// parede, ou porta fechada: os dois seguram bala e visao
export function isWall(world: World, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return (
    tileAt(world, tx, ty) === '#' ||
    (isDoorTile(tx, ty) && !doorOpen(world, ty))
  );
}

export function roomIndexAt(y: number): number {
  return Math.floor(y / ROOM_H);
}

// (col, row) do template para o centro do tile em coordenadas de mundo
export function tileCenter(roomIndex: number, col: number, row: number): Vec2 {
  return { x: col + 0.5, y: roomIndex * ROOM_H + (ROOM_H - 1 - row) + 0.5 };
}

// Porta de correr: fica no vao de saida (colunas DOOR_COLS da linha do fundo)
// da sala inicial e de cada loja, ou seja, na entrada de cada nivel.
const DOOR_COLS = [4, 6];
export function isDoorTile(tx: number, ty: number): boolean {
  return (
    tx >= DOOR_COLS[0] &&
    tx <= DOOR_COLS[1] &&
    ty % ROOM_H === ROOM_H - 1 &&
    Math.floor(ty / ROOM_H) % SHOP_EVERY === 0
  );
}

// A porta nao abre para inimigo enquanto o player se mexe. Parado por
// IDLE_WARNING_DELAY (a mesma espera que manda inimigos atras dele), ela
// libera; voltou a andar, sela de novo.
export function doorsSealed(world: World): boolean {
  return world.run.seconds - world.run.lastMovedAt < IDLE_WARNING_DELAY;
}

// Porta da linha `ty` aberta: player por perto, ou porta liberada e inimigo
// vivo por perto. Fechada, segura bala e visao (`isWall`); a engine desenha
// as folhas pelo mesmo criterio.
export function doorOpen(world: World, ty: number): boolean {
  const reaches = (pos: Vec2) =>
    Math.abs(pos.y - ty) < DOOR_RANGE &&
    Math.abs(pos.x - ROOM_W / 2) < DOOR_RANGE;
  return (
    reaches(world.player.pos) ||
    (!doorsSealed(world) &&
      world.enemies.some((e) => e.state !== 'dead' && reaches(e.pos)))
  );
}

// `sealed`: porta conta como parede (movimento de inimigo com a porta selada)
export function circleHitsWall(
  world: World,
  x: number,
  y: number,
  radius: number,
  sealed = false,
): boolean {
  for (let ty = Math.floor(y - radius); ty <= Math.floor(y + radius); ty++) {
    for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++) {
      if (
        !isSolidTile(tileAt(world, tx, ty)) &&
        !(sealed && isDoorTile(tx, ty))
      ) {
        continue;
      }
      const dx = x - clamp(x, tx, tx + 1);
      const dy = y - clamp(y, ty, ty + 1);
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

// Tira o circulo de dentro de cada tile solido que ele invade, pelo caminho
// mais curto: o ponto do tile mais perto do centro empurra para fora. Em
// parede reta o empurrao e perpendicular (desliza); em quina sai na diagonal
// (contorna).
// `corners` falso resolve so contato de face (centro de frente para o lado
// do tile). Faces vem antes: numa parede feita de varios tiles, a quina do
// tile vizinho empurraria de lado na emenda e o deslize ficaria aos trancos.
function pushOut(
  world: World,
  pos: Vec2,
  radius: number,
  sealed: boolean,
  corners: boolean,
): void {
  for (let ty = Math.floor(pos.y - radius); ty <= pos.y + radius; ty++) {
    for (let tx = Math.floor(pos.x - radius); tx <= pos.x + radius; tx++) {
      if (
        !isSolidTile(tileAt(world, tx, ty)) &&
        !(sealed && isDoorTile(tx, ty))
      ) {
        continue;
      }
      const dx = pos.x - clamp(pos.x, tx, tx + 1);
      const dy = pos.y - clamp(pos.y, ty, ty + 1);
      const gap = Math.hypot(dx, dy);
      // gap 0: centro dentro do tile, sem direcao para sair
      if (gap >= radius || gap === 0) continue;
      if (!corners && dx !== 0 && dy !== 0) continue;
      const push = (radius - gap) / gap;
      pos.x += dx * push;
      pos.y += dy * push;
    }
  }
}

// Anda e depois resolve a colisao: encosta na parede, desliza nela e contorna
// quina, em vez de travar quando o passo inteiro nao cabe.
export function moveCircle(
  world: World,
  pos: Vec2,
  dx: number,
  dy: number,
  radius: number,
  sealed = false,
): void {
  // quem ja esta no vao quando a porta sela nao fica preso: pode sair
  const blocked = sealed && !isDoorTile(Math.floor(pos.x), Math.floor(pos.y));
  // passo nunca maior que meio raio: o centro nao chega a entrar num tile
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (radius / 2)));
  for (let i = 0; i < steps; i++) {
    pos.x += dx / steps;
    pos.y += dy / steps;
    pushOut(world, pos, radius, blocked, false);
    pushOut(world, pos, radius, blocked, true);
  }
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

// Tabela de saque da caixa. Um sorteio escolhe a faixa (cada item ocupa
// `chance` da reta de 0 a 1; o que sobra e caixa vazia) e outro, `roll`, define
// o valor. Tudo pelo `rngState`: reproduzivel por seed.
// Item novo entra no fim, para nao trocar o que as faixas anteriores soltam.
const LOOT: {
  kind: PickupKind;
  chance: number;
  value: (world: World, roll: number) => number;
  // so sai quando isso vale; senao a faixa dele conta como caixa vazia
  when?: (world: World, prop: Prop) => boolean;
}[] = [
  {
    // cura pouca na maioria das vezes: `roll` ao quadrado puxa para baixo
    kind: 'heart',
    chance: LOOT_HEART_CHANCE,
    value: (world, roll) =>
      Math.round(
        world.player.maxHp *
          (HEART_MIN + (HEART_MAX - HEART_MIN) * roll * roll),
      ),
  },
  {
    kind: 'shield',
    chance: LOOT_SHIELD_CHANCE,
    value: (world, roll) =>
      Math.round(
        world.player.maxHp * (SHIELD_MIN + (SHIELD_MAX - SHIELD_MIN) * roll),
      ),
  },
  {
    // inteiro de DASH_LOOT_MIN a DASH_LOOT_MAX, todos com a mesma chance
    kind: 'dash',
    chance: LOOT_DASH_CHANCE,
    value: (_world, roll) =>
      DASH_LOOT_MIN + Math.floor(roll * (DASH_LOOT_MAX - DASH_LOOT_MIN + 1)),
  },
  {
    kind: 'revive',
    chance: LOOT_REVIVE_CHANCE,
    value: () => 1,
  },
  {
    // bala so serve para quem tem arma de fogo
    kind: 'ammo',
    chance: LOOT_AMMO_CHANCE,
    when: (world) =>
      world.player.weapon !== null || world.player.arsenal.length > 0,
    value: (_world, roll) =>
      AMMO_LOOT_MIN + Math.floor(roll * (AMMO_LOOT_MAX - AMMO_LOOT_MIN + 1)),
  },
  {
    // mira: so para quem tem arma de fogo, em caixa do nivel
    // HEADSHOT_FROM_LEVEL em diante (nivel = contrato)
    kind: 'headshot',
    chance: LOOT_HEADSHOT_CHANCE,
    when: (world, prop) =>
      (world.player.weapon !== null || world.player.arsenal.length > 0) &&
      Math.floor((prop.roomIndex - 1) / SHOP_EVERY) + 1 >= HEADSHOT_FROM_LEVEL,
    value: (_world, roll) =>
      HEADSHOT_LOOT_MIN +
      Math.floor(roll * (HEADSHOT_LOOT_MAX - HEADSHOT_LOOT_MIN + 1)),
  },
];

function dropLoot(world: World, prop: Prop): void {
  let roll = nextRandom(world);
  for (const loot of LOOT) {
    if (roll < loot.chance) {
      if (loot.when && !loot.when(world, prop)) return;
      world.pickups.push({
        id: world.nextId++,
        kind: loot.kind,
        roomIndex: prop.roomIndex,
        pos: { ...prop.pos },
        value: loot.value(world, nextRandom(world)),
      });
      return;
    }
    roll -= loot.chance;
  }
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
