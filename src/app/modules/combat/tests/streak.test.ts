import { killEnemy } from '@/app/modules/combat/systems/combat.system';
import {
  STREAK_MAX,
  STREAK_WINDOW,
} from '@/app/modules/world/constants/world.constants';
import { createPlayer } from '@/app/modules/world/systems/world.system';
import { asPlayer } from '@/app/modules/world/utils/players.util';
import type { World } from '@/app/modules/world/types/world.types';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

// mata um inimigo novo, `after` segundos depois da morte anterior
function kill(world: World, after = 0) {
  world.run.seconds += after;
  killEnemy(world, addEnemy(world, 5.5, 8.5, 0));
  return world.player.streak;
}

describe('sequencia de mortes', () => {
  it('mortes em seguida somam: double, triple, quadra, penta', () => {
    const world = createArenaWorld();
    expect(world.player.streak).toBe(0);
    expect(kill(world)).toBe(1);
    expect(kill(world, 1)).toBe(2);
    expect(kill(world, STREAK_WINDOW)).toBe(3);
    expect(kill(world, 0.5)).toBe(4);
    expect(kill(world, 2)).toBe(5);
  });

  it('para no penta', () => {
    const world = createArenaWorld();
    for (let i = 0; i < 8; i++) kill(world, 0.5);
    expect(world.player.streak).toBe(STREAK_MAX);
  });

  it('demorou mais que a janela, a proxima morte recomeca do um', () => {
    const world = createArenaWorld();
    kill(world);
    kill(world, 1);
    expect(kill(world, STREAK_WINDOW + 0.1)).toBe(1);
    expect(world.player.lastKillAt).toBe(world.run.seconds);
  });

  it('no multiplayer a sequencia e de quem matou', () => {
    const world = createArenaWorld();
    const guest = createPlayer(1, 'Ana', '#39d0ff');
    world.players.push(guest);
    kill(world);
    asPlayer(world, guest, () => kill(world, 1));
    asPlayer(world, guest, () => kill(world, 1));
    expect(world.players.map((player) => player.streak)).toEqual([1, 2]);
  });

  it('o momento da ultima morte sobrevive a viagem em JSON', () => {
    const world = createArenaWorld();
    const copy = JSON.parse(JSON.stringify(world.player));
    expect(copy.lastKillAt).toBe(world.player.lastKillAt);
  });
});
