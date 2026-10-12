import { spawnRoom } from '@/app/modules/level/systems/level.system';
import {
  isDoorTile,
  tileAt,
  tileCenter,
} from '@/app/modules/level/utils/grid.util';
import { findPath } from '@/app/modules/level/utils/pathfinding.util';
import { createMultiWorld } from '@/app/modules/multiplayer/systems/multiplayer.system';
import {
  MULTI_COMBAT_TEMPLATES,
  MULTI_SHOP_TEMPLATE,
  MULTI_START_TEMPLATE,
} from '@/app/modules/multiplayer/templates/room.template';
import {
  MULTI_ENEMIES_PER_PLAYER,
  ROOM_ENEMY_MAX,
  ROOM_H,
  ROOM_SIZES,
  ROOM_W,
} from '@/app/modules/world/constants/world.constants';
import {
  createEmptyWorld,
  createWorld,
} from '@/app/modules/world/systems/world.system';

const [W, H] = ROOM_SIZES.multi;
const DOOR = `${'#'.repeat(7)}...${'#'.repeat(7)}`;
const SEATS = ['A', 'B', 'C', 'D'].map((name) => ({ name, color: '#fff' }));
const ALL = [
  MULTI_START_TEMPLATE,
  MULTI_SHOP_TEMPLATE,
  ...MULTI_COMBAT_TEMPLATES,
];

describe.each(ALL)('template $id', (template) => {
  // sala montada no tamanho do multiplayer
  const room = () => {
    const world = createEmptyWorld(1, {}, null, 'multi');
    spawnRoom(world, 0, template);
    return world;
  };

  it('tem 19 linhas de 17 tiles validos, com portas no centro', () => {
    expect(template.tiles).toHaveLength(H);
    for (const line of template.tiles) {
      expect(line).toMatch(new RegExp(`^[#.$CoR]{${W}}$`));
      expect(line[0]).toBe('#');
      expect(line[W - 1]).toBe('#');
    }
    expect(template.tiles[0]).toBe(DOOR);
    expect(template.tiles[H - 1]).toBe(
      template.kind === 'start' ? '#'.repeat(W) : DOOR,
    );
  });

  it('liga a entrada a saida e toda ronda pisa em chao alcancavel', () => {
    const world = room();
    const entrance = tileCenter(0, 8, H - 2);
    expect(
      findPath(world, entrance, tileCenter(0, 8, 0)).length,
    ).toBeGreaterThan(0);
    for (const { path } of template.enemies) {
      for (const [col, row] of path) {
        const spot = tileCenter(0, col, row);
        expect(tileAt(world, col, Math.floor(spot.y))).toBe('.');
        expect(findPath(world, entrance, spot).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('sala do multiplayer', () => {
  it('partida multi usa 17x19; voltar ao solo volta a 11x13', () => {
    const multi = createMultiWorld(1, SEATS.slice(0, 2));
    expect([ROOM_W, ROOM_H]).toEqual([17, 19]);
    expect(multi.rooms[0].tiles).toHaveLength(19);
    expect(multi.rooms[0].tiles[0]).toHaveLength(17);
    // nascem dentro da sala, lado a lado
    for (const player of multi.players) {
      expect(
        tileAt(multi, Math.floor(player.pos.x), Math.floor(player.pos.y)),
      ).toBe('.');
    }

    const solo = createWorld(1);
    expect([ROOM_W, ROOM_H]).toEqual([11, 13]);
    expect(solo.rooms[0].tiles).toHaveLength(13);
  });

  it('porta de correr acompanha o vao no meio da sala maior', () => {
    createMultiWorld(1, SEATS.slice(0, 2));
    // linha do fundo da sala inicial: vao nas colunas 7 a 9
    expect([6, 7, 8, 9, 10].map((tx) => isDoorTile(tx, ROOM_H - 1))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it('mais jogadores, mais inimigos por sala, e mais que no solo', () => {
    // mesma sala e mesmo seed: so muda quantos jogam
    const count = (players: number) => {
      const world = createMultiWorld(7, SEATS.slice(0, players));
      world.enemies = [];
      spawnRoom(world, 1, MULTI_COMBAT_TEMPLATES[0]);
      return world.enemies.length;
    };
    expect(MULTI_ENEMIES_PER_PLAYER).toBeGreaterThan(0);
    expect(count(2)).toBeGreaterThan(1);
    expect(count(4)).toBeGreaterThan(count(2));
    expect(count(4)).toBeLessThanOrEqual(ROOM_ENEMY_MAX);
  });

  it('inimigo do multi nasce mais esperto que o da mesma sala no solo', () => {
    const multi = createMultiWorld(3, SEATS);
    multi.enemies = [];
    spawnRoom(multi, 1, MULTI_COMBAT_TEMPLATES[0]);
    const hard = multi.enemies[0];

    const solo = createWorld(3);
    const easy = solo.enemies.find((e) => e.roomIndex === 1)!;
    expect(hard.detectTime).toBeLessThan(easy.detectTime);
    expect(hard.viewRange - (hard.kind === 'suit' ? 5 : 3.8)).toBeGreaterThan(
      easy.viewRange - (easy.kind === 'suit' ? 5 : 3.8),
    );
    // dificuldade adiantada: ja salta, onde no solo ainda nao
    expect(hard.dashEvery).toBeGreaterThan(0);
    expect(easy.dashEvery).toBe(0);
  });
});
