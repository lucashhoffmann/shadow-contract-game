import {
  collectPickups,
  spawnProjectile,
  updateCombat,
  updateProjectiles,
} from '@/app/modules/combat/systems/combat.system';
import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  ATTACK_COOLDOWN,
  ENEMY_BULLET_DAMAGE,
  ENEMY_BULLET_SPEED,
  FIXED_DT,
  KILL_MONEY,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  PLAYER_MAX_HP,
} from '@/app/modules/world/constants/world.constants';
import type { World } from '@/app/modules/world/types/world.types';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

const UP = Math.PI / 2;
const DOWN = -Math.PI / 2;

function fly(world: World, seconds: number) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) updateProjectiles(world, FIXED_DT);
}

// bala do player saindo de onde ele esta, para cima
function shootUp(world: World) {
  spawnProjectile(
    world,
    'player',
    world.player.pos,
    UP,
    PLAYER_BULLET_SPEED,
    PLAYER_BULLET_DAMAGE,
    8,
  );
}

// bala inimiga descendo de (x, 8.5)
function enemyShot(world: World, x: number, range = 8) {
  spawnProjectile(
    world,
    'enemy',
    { x, y: 8.5 },
    DOWN,
    ENEMY_BULLET_SPEED,
    ENEMY_BULLET_DAMAGE,
    range,
  );
}

describe('updateCombat corpo a corpo', () => {
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

  it('espada tira 1 de vida de inimigo em alerta; o segundo golpe mata', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 3.3, UP);
    enemy.state = 'alert';

    updateCombat(world, FIXED_DT);
    expect(enemy.state).toBe('alert');
    expect(enemy.hp).toBe(1);
    expect(world.player.slash).toBeGreaterThan(0);

    updateCombat(world, ATTACK_COOLDOWN);
    expect(enemy.state).toBe('dead');
  });

  it('cada morte da adrenalina e derruba caixas em volta do corpo', () => {
    const world = createArenaWorld({ 8: '#...o....o#' });
    const enemy = addEnemy(world, 5.5, 3.6, UP);

    updateCombat(world, FIXED_DT);

    expect(enemy.state).toBe('dead');
    expect(world.player.adrenaline).toBeGreaterThan(0);
    expect(world.props.map((p) => p.broken)).toEqual([true, false]);
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

  it('com arma, ainda mata em silencio e nao gasta municao', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 3 };
    const enemy = addEnemy(world, 5.5, 3.3, UP);

    updateCombat(world, FIXED_DT);

    expect(enemy.state).toBe('dead');
    expect(world.projectiles).toHaveLength(0);
    expect(world.player.weapon).toEqual({ id: 'pistol', ammo: 3 });
  });
});

describe('updateCombat com arma', () => {
  it('pistola dispara uma bala na direcao do alvo e gasta municao', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 2 };
    const enemy = addEnemy(world, 5.5, 6.5, UP);

    updateCombat(world, FIXED_DT);

    expect(world.projectiles).toHaveLength(1);
    expect(world.projectiles[0].owner).toBe('player');
    expect(world.projectiles[0].vel.x).toBeCloseTo(0);
    expect(world.projectiles[0].vel.y).toBeCloseTo(PLAYER_BULLET_SPEED);
    expect(world.player.weapon).toEqual({ id: 'pistol', ammo: 1 });
    expect(enemy.state).toBe('patrol');
  });

  it('mira no alvo mais proximo', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 6 };
    addEnemy(world, 5.5, 7.5, UP);
    addEnemy(world, 8.5, 2.5, UP);

    updateCombat(world, FIXED_DT);

    expect(world.projectiles[0].vel.x).toBeCloseTo(PLAYER_BULLET_SPEED);
  });

  it('escopeta dispara um leque de balas com um cartucho', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'shotgun', ammo: 4 };
    addEnemy(world, 5.5, 5.5, UP);

    updateCombat(world, FIXED_DT);

    expect(world.projectiles).toHaveLength(ITEMS.shotgun.pellets);
    const directions = new Set(world.projectiles.map((b) => b.vel.x));
    expect(directions.size).toBe(ITEMS.shotgun.pellets);
    expect(world.player.weapon).toEqual({ id: 'shotgun', ammo: 3 });
  });

  it('remove a arma quando a municao acaba', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 1 };
    addEnemy(world, 5.5, 6.5, UP);

    updateCombat(world, FIXED_DT);

    expect(world.player.weapon).toBeNull();
  });

  it('nao atira sem linha de visao nem fora do alcance', () => {
    const walled = createArenaWorld({ 8: '###########' });
    walled.player.weapon = { id: 'pistol', ammo: 6 };
    addEnemy(walled, 5.5, 6.5, UP);
    updateCombat(walled, FIXED_DT);
    expect(walled.projectiles).toHaveLength(0);

    const far = createArenaWorld();
    far.player.weapon = { id: 'pistol', ammo: 6 };
    addEnemy(far, 5.5, 11.5, UP);
    updateCombat(far, FIXED_DT);
    expect(far.projectiles).toHaveLength(0);
    expect(far.player.weapon).toEqual({ id: 'pistol', ammo: 6 });
  });
});

describe('updateProjectiles', () => {
  it('terno aguenta um tiro, fica com detection cheia e morre no segundo', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 6.5, UP, 'suit');

    shootUp(world);
    fly(world, 1);
    expect(enemy.state).toBe('patrol');
    expect(enemy.hp).toBe(1);
    expect(enemy.detection).toBe(1);
    expect(world.projectiles).toHaveLength(0);

    shootUp(world);
    fly(world, 1);
    expect(enemy.state).toBe('dead');
    expect(world.pickups).toHaveLength(1);
  });

  it('caixa segura a bala e quebra; a bala seguinte passa', () => {
    const world = createArenaWorld({ 8: '#....o....#' });
    const enemy = addEnemy(world, 5.5, 6.5, UP);

    shootUp(world);
    fly(world, 1);
    expect(world.props[0].broken).toBe(true);
    expect(enemy.hp).toBe(2);

    shootUp(world);
    fly(world, 1);
    expect(enemy.hp).toBe(1);
  });

  it('bala para na parede e nao acerta quem esta atras', () => {
    const world = createArenaWorld({ 8: '###########' });
    const enemy = addEnemy(world, 5.5, 6.5, UP);

    shootUp(world);
    fly(world, 1);

    expect(world.projectiles).toHaveLength(0);
    expect(enemy.hp).toBe(2);
  });

  it('bala inimiga tira vida do player no contato e some', () => {
    const world = createArenaWorld();

    enemyShot(world, 5.5);
    fly(world, 1);

    expect(world.player.hp).toBe(PLAYER_MAX_HP - ENEMY_BULLET_DAMAGE);
    expect(world.projectiles).toHaveLength(0);
  });

  it('bala inimiga erra quem saiu da frente', () => {
    const world = createArenaWorld();

    enemyShot(world, 7.5);
    fly(world, 2);

    expect(world.player.hp).toBe(PLAYER_MAX_HP);
    expect(world.projectiles).toHaveLength(0);
  });

  it('bala some ao fim do alcance', () => {
    const world = createArenaWorld();

    enemyShot(world, 5.5, 2);
    fly(world, 1);

    expect(world.player.hp).toBe(PLAYER_MAX_HP);
    expect(world.projectiles).toHaveLength(0);
  });

  it('bala inimiga nao fere outro inimigo', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, UP);

    enemyShot(world, 5.5);
    fly(world, 1);

    expect(enemy.hp).toBe(2);
    expect(world.player.hp).toBe(PLAYER_MAX_HP - ENEMY_BULLET_DAMAGE);
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
    expect(world.run.earned).toBe(25);
    expect(world.pickups.map((p) => p.id)).toEqual([91]);
  });
});
