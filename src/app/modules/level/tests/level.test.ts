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
  breakPropAt,
  hasLineOfSight,
  tileCenter,
} from '@/app/modules/level/utils/grid.util';
import { findPath } from '@/app/modules/level/utils/pathfinding.util';
import {
  ROOM_H,
  ROOM_W,
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
