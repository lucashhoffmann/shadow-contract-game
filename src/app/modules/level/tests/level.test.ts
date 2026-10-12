import { createEnemy } from '@/app/modules/enemy/systems/enemy.system';
import {
  spawnRoom,
  updateRooms,
} from '@/app/modules/level/systems/level.system';
import {
  COMBAT_TEMPLATES,
  SHOP_TEMPLATE,
  START_TEMPLATE,
} from '@/app/modules/level/templates/room.template';
import {
  breakProp,
  breakPropAt,
  doorOpen,
  doorsSealed,
  hasLineOfSight,
  isDoorTile,
  isWall,
  moveCircle,
  tileCenter,
} from '@/app/modules/level/utils/grid.util';
import { findPath } from '@/app/modules/level/utils/pathfinding.util';
import {
  AMMO_LOOT_MAX,
  AMMO_LOOT_MIN,
  HEART_MAX,
  HEART_MIN,
  IDLE_WARNING_DELAY,
  PLAYER_MAX_HP,
  ROOM_H,
  ROOM_W,
  SHIELD_MAX,
  SHIELD_MIN,
  SHOP_EVERY,
} from '@/app/modules/world/constants/world.constants';
import {
  createEmptyWorld,
  createWorld,
} from '@/app/modules/world/systems/world.system';
import { createArenaWorld } from '@/test/world.fixture';

const ALL_TEMPLATES = [START_TEMPLATE, SHOP_TEMPLATE, ...COMBAT_TEMPLATES];
const DOOR = '####...####';

describe.each(ALL_TEMPLATES)('template $id', (template) => {
  const world = createEmptyWorld(1);
  spawnRoom(world, 0, template);

  it('tem ROOM_H linhas de ROOM_W tiles validos', () => {
    expect(template.tiles).toHaveLength(ROOM_H);
    for (const line of template.tiles) {
      expect(line).toMatch(new RegExp(`^[#.$Co]{${ROOM_W}}$`));
    }
  });

  it('abre saida e entrada no centro e fecha as laterais', () => {
    expect(template.tiles[0]).toBe(DOOR);
    expect(template.tiles[ROOM_H - 1]).toBe(
      template.kind === 'start' ? '#'.repeat(ROOM_W) : DOOR,
    );
    for (const line of template.tiles) {
      expect(line[0]).toBe('#');
      expect(line[ROOM_W - 1]).toBe('#');
    }
  });

  it('liga a entrada a saida', () => {
    const path = findPath(
      world,
      tileCenter(0, 5, ROOM_H - 2),
      tileCenter(0, 5, 0),
    );
    expect(path.length).toBeGreaterThan(0);
  });

  it('tem patrulhas em chao e conectadas', () => {
    for (const { path } of template.enemies) {
      path.forEach(([col, row], i) => {
        expect(template.tiles[row][col]).not.toBe('#');
        const [nextCol, nextRow] = path[(i + 1) % path.length];
        const route = findPath(
          world,
          tileCenter(0, col, row),
          tileCenter(0, nextCol, nextRow),
        );
        expect(route.length).toBeGreaterThan(0);
      });
    }
  });
});

// anda sala por sala e devolve o template de cada uma
function roomSequence(seed: number, count: number): string[] {
  const world = createWorld(seed);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    world.player.pos.y = i * ROOM_H + 1.5;
    updateRooms(world);
    ids.push(world.rooms.find((r) => r.index === i)!.templateId);
  }
  return ids;
}

describe('geracao de salas', () => {
  it('e deterministica por seed', () => {
    expect(roomSequence(7, 12)).toEqual(roomSequence(7, 12));
    expect(roomSequence(7, 12)).not.toEqual(roomSequence(8, 12));
  });

  it('comeca na sala inicial e poe loja a cada SHOP_EVERY salas', () => {
    const ids = roomSequence(3, SHOP_EVERY * 2 + 1);
    ids.forEach((id, i) => {
      if (i === 0) expect(id).toBe('start');
      else if (i % SHOP_EVERY === 0) expect(id).toBe('shop');
      else expect(id).not.toBe('shop');
    });
  });

  it('mantem so as salas vizinhas e descarta entidades das outras', () => {
    const world = createWorld(5);
    for (let i = 0; i < 6; i++) {
      world.player.pos.y = i * ROOM_H + 1.5;
      updateRooms(world);
    }
    expect(world.rooms.map((r) => r.index)).toEqual([4, 5, 6]);
    expect(world.enemies.every((e) => e.roomIndex >= 4)).toBe(true);
    expect(world.pickups.every((p) => p.roomIndex >= 4)).toBe(true);
    expect(world.run.roomIndex).toBe(5);
  });

  it('cria uma caixa por tile o e copia os tiles do template', () => {
    const open = COMBAT_TEMPLATES.find((t) => t.id === 'open')!;
    const world = createEmptyWorld(1);
    spawnRoom(world, 1, open);
    const crates = open.tiles.join('').split('o').length - 1;
    expect(world.props).toHaveLength(crates);
    expect(world.props.every((p) => !p.broken)).toBe(true);
    expect(world.rooms[0].tiles).not.toBe(open.tiles);
  });

  it('poe mais inimigos em salas avancadas', () => {
    const plaza = COMBAT_TEMPLATES.find((t) => t.id === 'plaza')!;
    const world = createEmptyWorld(1);
    spawnRoom(world, 1, plaza);
    expect(world.enemies).toHaveLength(1);
    spawnRoom(world, 6, plaza);
    expect(world.enemies).toHaveLength(1 + 3);
  });
});

describe('grid e caminho', () => {
  const from = { x: 2.5, y: 2.5 };
  const to = { x: 2.5, y: 10.5 };

  it('ve e anda em linha reta na arena aberta', () => {
    const world = createArenaWorld();
    expect(hasLineOfSight(world, from, to)).toBe(true);
    const path = findPath(world, from, to);
    expect(path).toHaveLength(8);
    expect(path[path.length - 1]).toEqual(to);
  });

  it('contorna parede com abertura', () => {
    const world = createArenaWorld({ 6: '########..#' });
    expect(hasLineOfSight(world, from, to)).toBe(false);
    const path = findPath(world, from, to);
    expect(path.some((p) => p.x > 8)).toBe(true);
    expect(path[path.length - 1]).toEqual(to);
  });

  it('caixa bloqueia caminho mas nao visao; quebrada, libera', () => {
    const world = createArenaWorld({ 6: '#ooooooooo#' });
    expect(hasLineOfSight(world, from, to)).toBe(true);
    expect(findPath(world, from, to)).toEqual([]);

    expect(breakPropAt(world, 2.5, 6.5)).toBe(true);
    expect(breakPropAt(world, 2.5, 6.5)).toBe(false);
    expect(findPath(world, from, to)).toHaveLength(8);
  });

  it('devolve vazio sem caminho', () => {
    const world = createArenaWorld({ 6: '###########' });
    expect(findPath(world, from, to)).toEqual([]);
  });
});

it('caixa quebrada as vezes solta coracao ou escudo, dentro das faixas', () => {
  const world = createArenaWorld();
  for (let i = 0; i < 400; i++) {
    breakProp(world, {
      id: i,
      roomIndex: 0,
      pos: { x: 5.5, y: 5.5 },
      broken: false,
    });
  }
  const values = (kind: string) =>
    world.pickups.filter((p) => p.kind === kind).map((p) => p.value);
  const hearts = values('heart');
  const shields = values('shield');
  // nem toda caixa da algo, e sai dos dois tipos
  expect(world.pickups.length).toBeLessThan(300);
  expect(hearts.length).toBeGreaterThan(40);
  expect(shields.length).toBeGreaterThan(40);
  expect(Math.min(...hearts)).toBeGreaterThanOrEqual(PLAYER_MAX_HP * HEART_MIN);
  expect(Math.max(...hearts)).toBeLessThanOrEqual(PLAYER_MAX_HP * HEART_MAX);
  expect(Math.min(...shields)).toBeGreaterThanOrEqual(
    PLAYER_MAX_HP * SHIELD_MIN,
  );
  expect(Math.max(...shields)).toBeLessThanOrEqual(PLAYER_MAX_HP * SHIELD_MAX);
  // cura pouca na maioria das vezes
  const median = [...hearts].sort((a, b) => a - b)[hearts.length >> 1];
  expect(median).toBeLessThan(PLAYER_MAX_HP * 0.3);
});

it('caixa quebrada tambem solta saltos, de 1 a 6, todos os valores saem', () => {
  const world = createArenaWorld();
  for (let i = 0; i < 600; i++) {
    breakProp(world, {
      id: i,
      roomIndex: 0,
      pos: { x: 5.5, y: 5.5 },
      broken: false,
    });
  }
  const dashes = world.pickups
    .filter((p) => p.kind === 'dash')
    .map((p) => p.value);
  expect(dashes.length).toBeGreaterThan(60);
  expect([...new Set(dashes)].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  // ainda sobra caixa vazia
  expect(world.pickups.length).toBeLessThan(600);
});

describe('porta da sala inicial', () => {
  // sala inicial (0) e a seguinte (1): a porta fica no vao do fundo da sala 0
  function doorWorld() {
    const world = createWorld(7);
    world.enemies = [];
    return world;
  }
  const inside = { x: 5.5, y: ROOM_H - 2.5 };
  // tile de entrada da sala 1: sempre aberto
  const beyond = { x: 5.5, y: ROOM_H + 0.5 };

  it('fica no vao de saida da sala inicial e de cada loja', () => {
    for (const col of [4, 5, 6]) {
      expect(isDoorTile(col, ROOM_H - 1)).toBe(true);
      expect(isDoorTile(col, (SHOP_EVERY + 1) * ROOM_H - 1)).toBe(true);
      // sala de combate nao tem porta
      expect(isDoorTile(col, 2 * ROOM_H - 1)).toBe(false);
    }
    expect(isDoorTile(3, ROOM_H - 1)).toBe(false);
    expect(isDoorTile(5, ROOM_H - 2)).toBe(false);
  });

  it('sela enquanto o player se mexe e libera depois de parado demais', () => {
    const world = doorWorld();
    expect(doorsSealed(world)).toBe(true);

    world.run.seconds = IDLE_WARNING_DELAY;
    expect(doorsSealed(world)).toBe(false);

    world.run.lastMovedAt = world.run.seconds;
    expect(doorsSealed(world)).toBe(true);
  });

  it('selada, nao ha rota nem passagem; liberada, ha', () => {
    const world = doorWorld();
    expect(findPath(world, beyond, inside, true)).toEqual([]);
    expect(findPath(world, beyond, inside).length).toBeGreaterThan(0);

    const walker = { ...beyond };
    for (let i = 0; i < 200; i++)
      moveCircle(world, walker, 0, -0.05, 0.35, true);
    expect(walker.y).toBeGreaterThan(ROOM_H);

    for (let i = 0; i < 200; i++) moveCircle(world, walker, 0, -0.05, 0.35);
    expect(walker.y).toBeLessThan(ROOM_H - 1);
  });

  it('fechada segura bala e visao; aberta para o player, deixa passar', () => {
    const world = doorWorld();
    const door = { x: 5.5, y: ROOM_H - 0.5 };
    // player longe: porta fechada
    world.player.pos = { x: 5.5, y: 2.5 };
    expect(doorOpen(world, ROOM_H - 1)).toBe(false);
    expect(isWall(world, door.x, door.y)).toBe(true);
    expect(hasLineOfSight(world, inside, beyond)).toBe(false);

    // player chegou perto: abre
    world.player.pos = { ...inside };
    expect(doorOpen(world, ROOM_H - 1)).toBe(true);
    expect(isWall(world, door.x, door.y)).toBe(false);
    expect(hasLineOfSight(world, inside, beyond)).toBe(true);
  });

  it('so abre para inimigo com a porta liberada', () => {
    const world = doorWorld();
    world.player.pos = { x: 5.5, y: 2.5 };
    world.enemies.push(createEnemy(world, 1, [beyond], 'suit'));
    world.enemies[0].pos = { ...beyond };
    expect(doorOpen(world, ROOM_H - 1)).toBe(false);

    world.run.seconds = IDLE_WARNING_DELAY;
    expect(doorOpen(world, ROOM_H - 1)).toBe(true);
  });

  it('quem ja esta no vao quando a porta sela consegue sair', () => {
    const world = doorWorld();
    const stuck = { x: 5.5, y: ROOM_H - 0.5 };
    moveCircle(world, stuck, 0, 0.2, 0.35, true);
    expect(stuck.y).toBeCloseTo(ROOM_H - 0.3);
  });
});

describe('moveCircle', () => {
  const RADIUS = 0.35;

  it('encosta na parede e desliza nela, sem sobrar vao', () => {
    const world = createArenaWorld({ 6: '###########' });
    const pos = { x: 3.5, y: 4.5 };
    for (let i = 0; i < 60; i++) moveCircle(world, pos, 0.04, 0.05, RADIUS);
    // parede ocupa y de 6 a 7
    expect(pos.y).toBeCloseTo(6 - RADIUS);
    expect(pos.x).toBeCloseTo(3.5 + 60 * 0.04);
  });

  it('contorna a quina e entra em corredor de 1 tile mesmo desalinhado', () => {
    const world = createArenaWorld({ 6: '#####.#####' });
    // vao em x de 5 a 6; o circulo so cabe com o centro entre 5.35 e 5.65
    for (const x of [5.1, 5.85]) {
      const pos = { x, y: 4.5 };
      for (let i = 0; i < 80; i++) moveCircle(world, pos, 0, 0.05, RADIUS);
      expect(pos.y).toBeGreaterThan(7.4);
      expect(pos.x).toBeGreaterThanOrEqual(5 + RADIUS - 1e-6);
      expect(pos.x).toBeLessThanOrEqual(6 - RADIUS + 1e-6);
    }
  });

  it('nao atravessa parede nem em passo grande', () => {
    const world = createArenaWorld({ 6: '###########' });
    const pos = { x: 5.5, y: 4.5 };
    moveCircle(world, pos, 0, 5, RADIUS);
    expect(pos.y).toBeCloseTo(6 - RADIUS);
  });
});

describe('municao em caixa', () => {
  function loot(armed: boolean) {
    const world = createArenaWorld();
    if (armed) world.player.weapon = { id: 'pistol', ammo: 1 };
    for (let i = 0; i < 800; i++) {
      breakProp(world, {
        id: i,
        roomIndex: 0,
        pos: { x: 5.5, y: 5.5 },
        broken: false,
      });
    }
    return world.pickups.filter((p) => p.kind === 'ammo').map((p) => p.value);
  }

  it('so sai com o player armado', () => {
    expect(loot(false)).toHaveLength(0);
    expect(loot(true).length).toBeGreaterThan(60);
  });

  it('vem de AMMO_LOOT_MIN a AMMO_LOOT_MAX balas', () => {
    const values = loot(true);
    expect(Math.min(...values)).toBe(AMMO_LOOT_MIN);
    expect(Math.max(...values)).toBe(AMMO_LOOT_MAX);
  });
});
