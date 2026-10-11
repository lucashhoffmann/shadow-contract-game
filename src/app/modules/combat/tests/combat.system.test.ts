import {
  collectPickups,
  updateCombat,
} from '@/app/modules/combat/systems/combat.system';
import {
  ATTACK_COOLDOWN,
  FIXED_DT,
  KILL_MONEY,
} from '@/app/modules/world/constants/world.constants';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

const UP = Math.PI / 2;

describe('updateCombat sem arma', () => {
  it('mata inimigo desavisado no alcance e solta dinheiro', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 3.3, UP);

    updateCombat(world, FIXED_DT);

    expect(enemy.state).toBe('dead');
    expect(world.run.kills).toBe(1);
    expect(world.pickups).toEqual([
      expect.objectContaining({ pos: { x: 5.5, y: 3.3 }, value: KILL_MONEY }),
    ]);
  });

  it('nao mata inimigo em alerta', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 3.3, UP);
    enemy.state = 'alert';

    updateCombat(world, FIXED_DT);

    expect(enemy.state).toBe('alert');
  });

  it('nao alcanca inimigo longe', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 6.5, UP);

    updateCombat(world, FIXED_DT);

    expect(enemy.state).toBe('patrol');
  });

  it('respeita o cooldown entre ataques', () => {
    const world = createArenaWorld();
    const first = addEnemy(world, 5.5, 3.3, UP);
    const second = addEnemy(world, 5.5, 1.8, UP);
    const dead = () => [first, second].filter((e) => e.state === 'dead').length;

    updateCombat(world, FIXED_DT);
    updateCombat(world, FIXED_DT);
    expect(dead()).toBe(1);

    updateCombat(world, ATTACK_COOLDOWN);
    expect(dead()).toBe(2);
  });
});

describe('updateCombat com arma', () => {
  it('pistola mata inimigo em alerta a distancia e gasta municao', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 2 };
    const enemy = addEnemy(world, 5.5, 6.5, UP);
    enemy.state = 'alert';

    updateCombat(world, FIXED_DT);

    expect(enemy.state).toBe('dead');
    expect(world.player.weapon).toEqual({ id: 'pistol', ammo: 1 });
  });

  it('pistola mata so o alvo mais proximo', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 6 };
    const near = addEnemy(world, 5.5, 4.5, UP);
    const far = addEnemy(world, 5.5, 6.5, UP);

    updateCombat(world, FIXED_DT);

    expect(near.state).toBe('dead');
    expect(far.state).toBe('patrol');
  });

  it('remove a arma quando a municao acaba', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 1 };
    addEnemy(world, 5.5, 6.5, UP);

    updateCombat(world, FIXED_DT);

    expect(world.player.weapon).toBeNull();
  });

  it('escopeta mata todos no alcance com um disparo', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'shotgun', ammo: 4 };
    const a = addEnemy(world, 4.5, 4.5, UP);
    const b = addEnemy(world, 6.5, 4.5, UP);

    updateCombat(world, FIXED_DT);

    expect(a.state).toBe('dead');
    expect(b.state).toBe('dead');
    expect(world.player.weapon).toEqual({ id: 'shotgun', ammo: 3 });
  });

  it('nao atira atraves de parede nem gasta municao', () => {
    const world = createArenaWorld({ 8: '###########' });
    world.player.weapon = { id: 'pistol', ammo: 6 };
    const enemy = addEnemy(world, 5.5, 6.5, UP);

    updateCombat(world, FIXED_DT);

    expect(enemy.state).toBe('patrol');
    expect(world.player.weapon).toEqual({ id: 'pistol', ammo: 6 });
  });
});

describe('collectPickups', () => {
  it('soma o dinheiro do pickup proximo e deixa o distante', () => {
    const world = createArenaWorld();
    world.pickups.push(
      { id: 90, roomIndex: 0, pos: { x: 5.5, y: 2.8 }, value: 25 },
      { id: 91, roomIndex: 0, pos: { x: 5.5, y: 9.5 }, value: 25 },
    );

    collectPickups(world);

    expect(world.run.money).toBe(25);
    expect(world.pickups.map((p) => p.id)).toEqual([91]);
  });
});
