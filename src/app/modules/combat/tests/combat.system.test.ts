import {
  collectPickups,
  damagePlayer,
  spawnProjectile,
  updateCombat,
  updateFloaters,
  updateProjectiles,
} from '@/app/modules/combat/systems/combat.system';
import {
  createEnemy,
  updateEnemies,
} from '@/app/modules/enemy/systems/enemy.system';
import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  ATTACK_COOLDOWN,
  ENEMY_BULLET_DAMAGE,
  ENEMY_BULLET_SPEED,
  FIXED_DT,
  FLOATER_TIME,
  KILL_MONEY,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  PLAYER_MAX_HP,
  SHIELD_MAX,
  SHOT_TIME,
  SWORD_DAMAGE,
  SHOP_EVERY,
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

  it('espada causa dano variavel em inimigo alerta e termina o combate', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 3.3, UP);
    enemy.state = 'alert';

    updateCombat(world, FIXED_DT);
    expect(enemy.state).toBe('alert');
    const firstDamage = 60 - enemy.hp;
    expect(firstDamage).toBeGreaterThanOrEqual(
      Math.round(SWORD_DAMAGE * world.run.attackVariance.min),
    );
    expect(firstDamage).toBeLessThanOrEqual(
      Math.round(SWORD_DAMAGE * world.run.attackVariance.max),
    );
    expect(world.run.events.at(-1)?.text).toBe(
      `Facada acertou: ${firstDamage} de dano.`,
    );
    expect(world.player.slash).toBeGreaterThan(0);

    for (let i = 0; i < 3 && enemy.hp > 0; i++) {
      world.rngState = 1;
      updateCombat(world, ATTACK_COOLDOWN);
    }
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

    world.rngState = 1;
    updateCombat(world, ATTACK_COOLDOWN);
    expect(dead()).toBe(2);
  });

  it('facada pode errar e deixa o ninja vivo para contra-atacar', () => {
    const world = createArenaWorld();
    const ninja = addEnemy(world, 5.5, 3.3, UP, 'ninja');
    world.rngState = 8;

    updateCombat(world, FIXED_DT);

    expect(ninja.hp).toBe(60);
    expect(ninja.detection).toBe(1);
    expect(world.run.stats).toMatchObject({ meleeAttempts: 1, meleeHits: 0 });
    expect(world.run.events.at(-1)?.text).toBe('Facada errou.');

    updateEnemies(world, 0.5);
    expect(ninja.state).toBe('alert');
    expect(world.player.hp).toBe(PLAYER_MAX_HP - 25);
  });

  it('sorteia o dano de cada acerto dentro da faixa da run', () => {
    const attack = (seed: number) => {
      const world = createArenaWorld();
      world.run.attackVariance = { min: 0.75, max: 1.25 };
      world.run.meleeMissChance = 0;
      world.run.nextMeleeChanceAt = Infinity;
      world.rngState = seed;
      const enemy = addEnemy(world, 5.5, 3.3, UP);
      enemy.state = 'alert';
      updateCombat(world, FIXED_DT);
      return 60 - enemy.hp;
    };

    const low = attack(0);
    const high = attack(9);
    expect(low).toBeGreaterThanOrEqual(23);
    expect(high).toBeLessThanOrEqual(38);
    expect(low).not.toBe(high);
  });

  it('sorteia nova chance a cada cinco segundos, incluindo picos', () => {
    const world = createArenaWorld();
    world.rngState = 1;
    updateCombat(world, FIXED_DT);
    const initial = world.run.meleeMissChance;
    expect(initial).toBeGreaterThanOrEqual(0.1);
    expect(initial).toBeLessThan(0.3);

    world.run.seconds = 4.9;
    world.rngState = 8;
    updateCombat(world, FIXED_DT);
    expect(world.run.meleeMissChance).toBe(initial);

    world.run.seconds = 5;
    updateCombat(world, FIXED_DT);
    expect(world.run.meleeMissChance).toBeGreaterThanOrEqual(0.45);
    expect(world.run.meleeMissChance).toBeLessThan(0.7);
    expect(world.run.events.at(-1)?.text).toContain('pico');

    world.run.seconds = 10;
    world.rngState = 1;
    updateCombat(world, FIXED_DT);
    expect(world.run.meleeMissChance).toBeLessThan(0.3);
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
    expect(world.run.stats.projectilesFired).toBe(1);
    expect(enemy.state).toBe('patrol');
  });

  it('tiro marca o recuo, que acaba antes do proximo tiro; espada nao marca', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 2 };
    addEnemy(world, 5.5, 6.5, UP);

    updateCombat(world, FIXED_DT);
    expect(world.player.shot).toBe(SHOT_TIME);

    updateCombat(world, SHOT_TIME / 2);
    expect(world.player.shot).toBeCloseTo(SHOT_TIME / 2);
    updateCombat(world, SHOT_TIME);
    expect(world.player.shot).toBe(0);
    expect(SHOT_TIME).toBeLessThan(ATTACK_COOLDOWN);

    const melee = createArenaWorld();
    addEnemy(melee, 5.5, 3.2, UP);
    updateCombat(melee, FIXED_DT);
    expect(melee.player.slash).toBeGreaterThan(0);
    expect(melee.player.shot).toBe(0);
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
    expect(
      new Set(world.projectiles.map((b) => b.damage)).size,
    ).toBeGreaterThan(1);
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
    expect(enemy.hp).toBe(30);
    expect(enemy.detection).toBe(1);
    expect(world.run.stats.projectilesHit).toBe(1);
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
    expect(enemy.hp).toBe(60);

    shootUp(world);
    fly(world, 1);
    expect(enemy.hp).toBe(30);
  });

  it('bala para na parede e nao acerta quem esta atras', () => {
    const world = createArenaWorld({ 8: '###########' });
    const enemy = addEnemy(world, 5.5, 6.5, UP);

    shootUp(world);
    fly(world, 1);

    expect(world.projectiles).toHaveLength(0);
    expect(enemy.hp).toBe(60);
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

    expect(enemy.hp).toBe(60);
    expect(world.player.hp).toBe(PLAYER_MAX_HP - ENEMY_BULLET_DAMAGE);
  });
});

describe('collectPickups', () => {
  it('soma o dinheiro do pickup proximo e deixa o distante', () => {
    const world = createArenaWorld();
    world.pickups.push(
      {
        id: 90,
        kind: 'money',
        roomIndex: 0,
        pos: { x: 5.5, y: 2.8 },
        value: 25,
      },
      {
        id: 91,
        kind: 'money',
        roomIndex: 0,
        pos: { x: 5.5, y: 9.5 },
        value: 25,
      },
    );

    collectPickups(world);

    expect(world.run.money).toBe(25);
    expect(world.run.earned).toBe(25);
    expect(world.pickups.map((p) => p.id)).toEqual([91]);
  });
});

describe('barulho do tiro', () => {
  // alvo na frente; outro inimigo de costas, fora do alcance da arma
  function shoot(id: 'pistol' | 'silenced', otherY: number) {
    const world = createArenaWorld();
    world.player.weapon = { id, ammo: 3 };
    addEnemy(world, 5.5, 5.5, UP);
    const other = addEnemy(world, 9.5, otherY, UP);
    updateCombat(world, FIXED_DT);
    expect(world.projectiles).toHaveLength(1);
    return { world, other };
  }

  it('tiro sem silenciador chama os inimigos proximos ao lugar do disparo', () => {
    const { world, other } = shoot('pistol', 8.5);
    expect(other.heard).toEqual(world.player.pos);
  });

  it('pistola silenciada nao chama ninguem', () => {
    expect(shoot('silenced', 8.5).other.heard).toBeNull();
  });

  it('inimigo fora do raio do tiro nao ouve', () => {
    expect(shoot('pistol', 11.5).other.heard).toBeNull();
  });

  it('ouvido de nivel alto alcanca tiro mais distante', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 3 };
    addEnemy(world, 5.5, 5.5, UP);
    const other = createEnemy(world, 4 * SHOP_EVERY + 1, [{ x: 9.5, y: 11.5 }]);
    world.enemies.push(other);

    updateCombat(world, FIXED_DT);

    expect(other.heard).toEqual(world.player.pos);
  });
});

describe('coracao e escudo', () => {
  function drop(world: World, kind: 'heart' | 'shield', value: number) {
    world.pickups.push({
      id: world.nextId++,
      kind,
      roomIndex: 0,
      pos: { ...world.player.pos },
      value,
    });
    collectPickups(world);
  }

  it('coracao cura ate a vida cheia; com vida cheia fica no chao', () => {
    const world = createArenaWorld();
    world.player.hp = 90;
    drop(world, 'heart', 30);
    expect(world.player.hp).toBe(PLAYER_MAX_HP);
    expect(world.run.stats.healthRecovered).toBe(10);
    expect(world.pickups).toHaveLength(0);

    drop(world, 'heart', 30);
    expect(world.pickups).toHaveLength(1);
  });

  it('escudo soma ate SHIELD_MAX da vida maxima', () => {
    const world = createArenaWorld();
    const cap = PLAYER_MAX_HP * SHIELD_MAX;
    drop(world, 'shield', 20);
    expect(world.player.shield).toBe(20);
    drop(world, 'shield', 20);
    expect(world.player.shield).toBe(cap);
    drop(world, 'shield', 20);
    expect(world.pickups).toHaveLength(1);
  });

  it('escudo absorve o dano antes da vida', () => {
    const world = createArenaWorld();
    world.player.shield = 15;
    damagePlayer(world, 10);
    expect(world.player).toMatchObject({ shield: 5, hp: PLAYER_MAX_HP });
    damagePlayer(world, 10);
    expect(world.player).toMatchObject({ shield: 0, hp: PLAYER_MAX_HP - 5 });
    expect(world.run.stats).toMatchObject({
      damageBlocked: 15,
      damageTaken: 5,
    });
  });
});

describe('floaters', () => {
  it('acerto mostra o dano causado sobre o inimigo', () => {
    const world = createArenaWorld();
    world.run.meleeMissChance = 0;
    world.run.nextMeleeChanceAt = Infinity;
    const enemy = addEnemy(world, 5.5, 3.3, UP);
    enemy.state = 'alert';

    updateCombat(world, FIXED_DT);

    expect(world.floaters).toHaveLength(1);
    expect(world.floaters[0]).toMatchObject({
      pos: enemy.pos,
      amount: 60 - enemy.hp,
      age: 0,
    });
  });

  it('execucao mostra toda a vida que o inimigo tinha', () => {
    const world = createArenaWorld();
    world.run.meleeMissChance = 0;
    world.run.nextMeleeChanceAt = Infinity;
    const enemy = addEnemy(world, 5.5, 3.3, UP);
    const hp = enemy.hp;

    updateCombat(world, FIXED_DT);

    expect(enemy.state).toBe('dead');
    expect(world.floaters[0].amount).toBe(hp);
  });

  it('facada que erra mostra Errou (amount 0)', () => {
    const world = createArenaWorld();
    world.run.meleeMissChance = 1;
    world.run.nextMeleeChanceAt = Infinity;
    addEnemy(world, 5.5, 3.3, UP);

    updateCombat(world, FIXED_DT);

    expect(world.floaters.map((f) => f.amount)).toEqual([0]);
  });

  it('bala do player que nao acerta ninguem mostra um Errou so por rajada', () => {
    const world = createArenaWorld();
    for (const angle of [UP - 0.1, UP, UP + 0.1]) {
      spawnProjectile(world, 'player', world.player.pos, angle, 20, 1, 1);
    }
    spawnProjectile(world, 'enemy', { x: 2.5, y: 2.5 }, UP, 20, 1, 1);

    for (let i = 0; i < 30; i++) updateProjectiles(world, FIXED_DT);

    expect(world.projectiles).toHaveLength(0);
    expect(world.floaters.map((f) => f.amount)).toEqual([0]);
  });

  it('some depois de FLOATER_TIME', () => {
    const world = createArenaWorld();
    world.floaters.push({ id: 1, pos: { x: 1, y: 1 }, amount: 1, age: 0 });

    updateFloaters(world, FLOATER_TIME / 2);
    expect(world.floaters[0].age).toBeCloseTo(FLOATER_TIME / 2);

    updateFloaters(world, FLOATER_TIME / 2);
    expect(world.floaters).toHaveLength(0);
  });
});
