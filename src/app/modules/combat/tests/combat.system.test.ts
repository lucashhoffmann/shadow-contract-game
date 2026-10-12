import {
  collectPickups,
  damagePlayer,
  meleeTarget,
  killEnemy,
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
  DASH_MAX,
  ENEMY_BULLET_DAMAGE,
  ENEMY_BULLET_SPEED,
  ENEMY_KINDS,
  ENEMY_LOOT_CHANCE,
  ENEMY_LOOT_OFFSET,
  FALLOFF_MIN,
  FIXED_DT,
  FLOATER_TIME,
  HEADSHOT_BASE,
  HEADSHOT_MAX,
  HEADSHOT_MULT,
  KILL_MONEY,
  LAUNCH_TIME,
  PLAYER_BULLET_SPEED,
  PLAYER_MAX_HP,
  SHIELD_MAX,
  SHOT_TIME,
  SLASH_TIME,
  SWORD_CRIT_CHANCE,
  SWORD_CRIT_FOCUS,
  SWORD_DAMAGE,
  SWORD_RANGE,
  MELEE_RANGE,
  SHOP_EVERY,
} from '@/app/modules/world/constants/world.constants';
import {
  createEmptyWorld,
  fight,
} from '@/app/modules/world/systems/world.system';
import type { World } from '@/app/modules/world/types/world.types';
import { distance } from '@/shared/utils/math.util';
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
    ITEMS.pistol.damage,
    // alcance longo: os alvos dos testes ficam na faixa de dano cheio
    12,
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
      world.run.attackVariance = { min: 1, max: 1.5 };
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
    expect(low).toBeGreaterThanOrEqual(30);
    expect(high).toBeLessThanOrEqual(45);
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

  it('com arma, a facada so sai no F: mata em silencio e nao gasta municao', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 3 };
    const enemy = addEnemy(world, 5.5, 3.3, UP);

    updateCombat(world, FIXED_DT, true);

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

  it('sem bala a arma continua na mao, mas nao atira', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 1 };
    addEnemy(world, 5.5, 6.5, UP);

    updateCombat(world, FIXED_DT);
    expect(world.player.weapon).toEqual({ id: 'pistol', ammo: 0 });
    expect(world.projectiles).toHaveLength(1);

    updateCombat(world, ATTACK_COOLDOWN + FIXED_DT);
    expect(world.projectiles).toHaveLength(1);
    expect(world.player.weapon).toEqual({ id: 'pistol', ammo: 0 });
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

    expect(world.player.money).toBe(25);
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

  it('invencivel nao perde vida nem escudo; o item renova sem encurtar', () => {
    const world = createArenaWorld();
    world.player.shield = 15;
    world.pickups.push(
      {
        id: 90,
        kind: 'invincibility',
        roomIndex: 0,
        pos: { ...world.player.pos },
        value: 6,
      },
      {
        id: 91,
        kind: 'invincibility',
        roomIndex: 0,
        pos: { ...world.player.pos },
        value: 4,
      },
    );
    collectPickups(world);
    expect(world.pickups).toHaveLength(0);
    expect(world.player).toMatchObject({ invincible: 6, invincibleTotal: 6 });
    damagePlayer(world, 50, world.player.pos);
    expect(world.player).toMatchObject({ shield: 15, hp: PLAYER_MAX_HP });
    expect(world.floaters).toMatchObject([{ amount: 0, blocked: true }]);
    world.player.invincible = 0;
    damagePlayer(world, 50, world.player.pos);
    expect(world.player.hp).toBe(PLAYER_MAX_HP - 35);
  });

  it('escudo absorve o dano antes da vida', () => {
    const world = createArenaWorld();
    world.player.shield = 15;
    damagePlayer(world, 10, world.player.pos);
    expect(world.player).toMatchObject({ shield: 5, hp: PLAYER_MAX_HP });
    damagePlayer(world, 10, world.player.pos);
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

describe('floaters do inimigo', () => {
  it('dano sofrido aparece sobre o inimigo que bateu, com o golpe inteiro', () => {
    const world = createArenaWorld();
    world.player.shield = 5;
    damagePlayer(world, 20, { x: 7.5, y: 6.5 });
    expect(world.floaters).toHaveLength(1);
    expect(world.floaters[0]).toMatchObject({
      pos: { x: 7.5, y: 6.5 },
      amount: 20,
      onPlayer: true,
    });
  });

  // terno em (2.5, 8.5) atira; `angle` decide se acerta o player em (5.5, 2.5)
  function suitShot(angle: number) {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 2.5, 8.5, angle);
    spawnProjectile(
      world,
      'enemy',
      enemy.pos,
      angle,
      ENEMY_BULLET_SPEED,
      ENEMY_BULLET_DAMAGE,
      8,
      'pistol',
      enemy.id,
    );
    fly(world, 2);
    expect(world.projectiles).toHaveLength(0);
    expect(world.floaters).toHaveLength(1);
    return { world, enemy };
  }

  it('bala inimiga que acerta mostra o dano sobre quem atirou', () => {
    const { world, enemy } = suitShot(Math.atan2(2.5 - 8.5, 5.5 - 2.5));
    expect(world.player.hp).toBeLessThan(PLAYER_MAX_HP);
    expect(world.floaters[0]).toMatchObject({ pos: enemy.pos, onPlayer: true });
    expect(world.floaters[0].amount).toBeGreaterThan(0);
  });

  it('bala inimiga que erra avisa o erro sobre quem atirou', () => {
    const { world, enemy } = suitShot(0);
    expect(world.player.hp).toBe(PLAYER_MAX_HP);
    expect(world.floaters[0]).toMatchObject({
      pos: enemy.pos,
      amount: 0,
      onPlayer: true,
    });
  });
});

describe('dano do player', () => {
  // bala de `damage` saindo do player para cima, alvo a `gap` de distancia
  function hitAt(gap: number, damage: number, range: number) {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, world.player.pos.y + gap, UP);
    spawnProjectile(
      world,
      'player',
      world.player.pos,
      UP,
      PLAYER_BULLET_SPEED,
      damage,
      range,
    );
    fly(world, 1);
    return ENEMY_KINDS.suit.hp - enemy.hp;
  }

  it('faixa sorteada nunca fica abaixo do dano base: dois golpes matam', () => {
    for (const seed of [1, 2, 3, 40, 500]) {
      const { min, max } = createEmptyWorld(seed).run.attackVariance;
      expect(min).toBeGreaterThanOrEqual(1);
      expect(min).toBeLessThanOrEqual(1.1);
      expect(max).toBeGreaterThanOrEqual(1.4);
      expect(max).toBeLessThanOrEqual(1.5);
      expect(2 * Math.round(SWORD_DAMAGE * min)).toBeGreaterThanOrEqual(
        ENEMY_KINDS.suit.hp,
      );
    }
  });

  it('cada bala disparada sorteia o proprio dano no disparo', () => {
    const world = createArenaWorld();
    world.run.attackVariance = { min: 1, max: 1.5 };
    world.player.headshot = 0;
    world.player.weapon = { id: 'shotgun', ammo: 2 };
    addEnemy(world, 5.5, 5.5, UP);

    updateCombat(world, FIXED_DT);

    const damages = world.projectiles.map((bullet) => bullet.damage);
    expect(damages).toHaveLength(ITEMS.shotgun.pellets);
    expect(new Set(damages).size).toBeGreaterThan(1);
    for (const damage of damages) {
      expect(damage).toBeGreaterThanOrEqual(ITEMS.shotgun.damage);
      expect(damage).toBeLessThanOrEqual(ITEMS.shotgun.damage * 1.5 + 1);
    }
  });

  it('chumbo da escopeta vale metade da bala da pistola', () => {
    expect(ITEMS.shotgun.damage * 2).toBe(ITEMS.pistol.damage);
    expect(ITEMS.shotgun.damage * 4).toBeGreaterThanOrEqual(
      ENEMY_KINDS.suit.hp,
    );
  });

  it('dano da bala cai com a distancia, ate FALLOFF_MIN no alcance maximo', () => {
    const near = hitAt(2, 30, 6);
    const middle = hitAt(4.6, 30, 6);
    const far = hitAt(6.3, 30, 6);

    expect(near).toBe(30);
    expect(middle).toBeLessThan(near);
    expect(middle).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(Math.round(30 * FALLOFF_MIN));
    expect(far).toBeLessThan(8);
  });
});

describe('item de salto', () => {
  function drop(world: World, value: number) {
    world.pickups.push({
      id: world.nextId++,
      kind: 'dash',
      roomIndex: 0,
      pos: { ...world.player.pos },
      value,
    });
  }

  it('repoe saltos ate DASH_MAX', () => {
    const world = createArenaWorld();
    world.player.dashes = 1;

    drop(world, 3);
    collectPickups(world);
    expect(world.player.dashes).toBe(4);
    expect(world.pickups).toHaveLength(0);

    drop(world, 6);
    collectPickups(world);
    expect(world.player.dashes).toBe(DASH_MAX);
  });

  it('fica no chao com os saltos cheios', () => {
    const world = createArenaWorld();
    expect(world.player.dashes).toBe(DASH_MAX);
    drop(world, 2);
    collectPickups(world);
    expect(world.pickups).toHaveLength(1);
  });
});

describe('lancamento de quem morre de um golpe so', () => {
  it('execucao de vida cheia lanca para longe do player', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 3.3, UP);
    updateCombat(world, FIXED_DT);
    expect(enemy.state).toBe('dead');
    expect(enemy.launch).toBe(LAUNCH_TIME);
    expect(enemy.facing).toBeCloseTo(UP);
  });

  it('morte no segundo golpe nao lanca', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 3.3, UP);
    enemy.hp -= 1;
    updateCombat(world, FIXED_DT);
    expect(enemy.state).toBe('dead');
    expect(enemy.launch).toBe(0);
  });
});

it('com arma e sem F, nao esfaqueia nem atira em quem esta encostado', () => {
  const world = createArenaWorld();
  world.player.weapon = { id: 'pistol', ammo: 3 };
  const enemy = addEnemy(world, 5.5, 3.3, UP);

  for (let i = 0; i < 60; i++) updateCombat(world, FIXED_DT);

  expect(enemy.state).not.toBe('dead');
  expect(world.player.slash).toBe(0);
  expect(world.projectiles).toHaveLength(0);
  expect(world.player.weapon?.ammo).toBe(3);
});

describe('item de municao', () => {
  function drop(world: World, value: number) {
    world.pickups.push({
      id: world.nextId++,
      kind: 'ammo',
      roomIndex: 0,
      pos: { ...world.player.pos },
      value,
    });
  }

  it('toda arma de fogo vem com 30 balas', () => {
    for (const id of ['pistol', 'silenced', 'shotgun'] as const) {
      expect(ITEMS[id].ammo).toBe(30);
    }
  });

  it('completa a arma na mao, ate o que ela traz de fabrica', () => {
    const world = createArenaWorld();
    world.player.weapon = { id: 'pistol', ammo: 5 };

    drop(world, 8);
    collectPickups(world);
    expect(world.player.weapon.ammo).toBe(13);
    expect(world.pickups).toHaveLength(0);

    drop(world, 100);
    collectPickups(world);
    expect(world.player.weapon.ammo).toBe(ITEMS.pistol.ammo);
  });

  it('com a espada na mao, vai para a arma do arsenal que tem espaco', () => {
    const world = createArenaWorld();
    const full = { id: 'pistol' as const, ammo: ITEMS.pistol.ammo };
    const empty = { id: 'shotgun' as const, ammo: 0 };
    world.player.arsenal = [full, empty];
    world.player.weapon = null;

    drop(world, 7);
    collectPickups(world);

    expect(empty.ammo).toBe(7);
    expect(full.ammo).toBe(ITEMS.pistol.ammo);
    expect(world.pickups).toHaveLength(0);
  });

  it('fica no chao sem arma ou com a arma cheia', () => {
    const world = createArenaWorld();
    drop(world, 8);
    collectPickups(world);
    expect(world.pickups).toHaveLength(1);

    world.player.weapon = { id: 'pistol', ammo: ITEMS.pistol.ammo };
    collectPickups(world);
    expect(world.pickups).toHaveLength(1);
  });
});

describe('headshot', () => {
  function fire(chance: number) {
    const world = createArenaWorld();
    world.run.attackVariance = { min: 1, max: 1 };
    world.player.headshot = chance;
    world.player.weapon = { id: 'pistol', ammo: 5 };
    const enemy = addEnemy(world, 5.5, 4.5, UP);
    updateCombat(world, FIXED_DT);
    return { world, enemy, bullet: world.projectiles[0] };
  }

  it('comeca com a chance base', () => {
    expect(createArenaWorld().player.headshot).toBe(HEADSHOT_BASE);
  });

  it('bala headshot sai com o dano multiplicado e marca o aviso', () => {
    const { world, enemy, bullet } = fire(1);
    expect(bullet.headshot).toBe(true);
    expect(bullet.damage).toBe(ITEMS.pistol.damage * HEADSHOT_MULT);

    // ja ferido: o headshot mata, mas nao e vida cheia a zero de uma vez
    enemy.hp = ENEMY_KINDS.suit.hp / 2;
    fly(world, 1);
    expect(enemy.state).toBe('dead');
    expect(world.floaters.at(-1)).toMatchObject({
      amount: ENEMY_KINDS.suit.hp / 2,
      headshot: true,
    });
    expect(
      world.run.events.some((event) => event.text.startsWith('Headshot')),
    ).toBe(true);
  });

  it('sem chance, a bala sai normal e o aviso nao marca headshot', () => {
    const { world, bullet } = fire(0);
    expect(bullet.headshot).toBeUndefined();
    expect(bullet.damage).toBe(ITEMS.pistol.damage);

    fly(world, 1);
    expect(world.floaters.at(-1)?.headshot).toBeUndefined();
  });

  it('item de mira soma pontos percentuais ate o teto e depois fica no chao', () => {
    const world = createArenaWorld();
    const drop = (value: number) =>
      world.pickups.push({
        id: world.nextId++,
        kind: 'headshot',
        roomIndex: 0,
        pos: { ...world.player.pos },
        value,
      });

    drop(5);
    collectPickups(world);
    expect(world.player.headshot).toBeCloseTo(HEADSHOT_BASE + 0.05);
    expect(world.pickups).toHaveLength(0);

    drop(90);
    collectPickups(world);
    expect(world.player.headshot).toBe(HEADSHOT_MAX);

    drop(5);
    collectPickups(world);
    expect(world.pickups).toHaveLength(1);
  });
});

describe('overkill', () => {
  // inimigo desavisado colado no player; `facing` diz para onde ele olha
  function execute(crouching: boolean, facing: number, hp?: number) {
    const world = createArenaWorld();
    world.run.meleeMissChance = 0;
    world.run.nextMeleeChanceAt = Infinity;
    world.player.crouching = crouching;
    const enemy = addEnemy(world, 5.5, 3.3, facing);
    if (hp !== undefined) enemy.hp = hp;
    updateCombat(world, FIXED_DT);
    return { world, enemy, floater: world.floaters.at(-1) };
  }
  const DOWN_AT_PLAYER = -Math.PI / 2;

  it('execucao agachado e pelas costas marca overkill', () => {
    const { world, enemy, floater } = execute(true, UP);
    expect(enemy.state).toBe('dead');
    expect(floater).toMatchObject({
      amount: ENEMY_KINDS.suit.hp,
      overkill: true,
    });
    expect(
      world.run.events.some((event) => event.text.startsWith('Overkill')),
    ).toBe(true);
  });

  it('inimigo ja ferido: em pe, ou de frente, e execucao comum', () => {
    for (const { enemy, floater } of [
      execute(false, UP, 30),
      execute(true, DOWN_AT_PLAYER, 30),
    ]) {
      expect(enemy.state).toBe('dead');
      expect(floater).toMatchObject({ amount: 30 });
      expect(floater?.overkill).toBeUndefined();
    }
  });

  it('inimigo ja ferido: agachado e pelas costas ainda e overkill', () => {
    const { floater } = execute(true, UP, 30);
    expect(floater).toMatchObject({ amount: 30, overkill: true });
  });

  it('qualquer golpe que tira a vida cheia de uma vez e overkill', () => {
    // execucao em pe e de frente: +60
    for (const { floater } of [
      execute(false, UP),
      execute(false, DOWN_AT_PLAYER),
    ]) {
      expect(floater).toMatchObject({
        amount: ENEMY_KINDS.suit.hp,
        overkill: true,
      });
    }

    // headshot que mata de uma vez mostra overkill, nao headshot
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 4.5, UP);
    spawnProjectile(
      world,
      'player',
      world.player.pos,
      UP,
      PLAYER_BULLET_SPEED,
      ENEMY_KINDS.suit.hp,
      12,
      'pistol',
      undefined,
      true,
    );
    fly(world, 1);
    expect(enemy.state).toBe('dead');
    expect(world.floaters.at(-1)).toMatchObject({ overkill: true });
    expect(world.floaters.at(-1)?.headshot).toBeUndefined();
  });

  it('inimigo em alerta nao e executado, entao nao ha overkill', () => {
    const world = createArenaWorld();
    world.run.meleeMissChance = 0;
    world.run.nextMeleeChanceAt = Infinity;
    world.player.crouching = true;
    const enemy = addEnemy(world, 5.5, 3.3, UP);
    enemy.state = 'alert';

    updateCombat(world, FIXED_DT);

    expect(enemy.state).toBe('alert');
    expect(world.floaters.at(-1)?.overkill).toBeUndefined();
  });
});

describe('saque do inimigo morto', () => {
  // mata `count` inimigos no meio da arena, um por mundo, cada um com seu
  // sorteio; devolve o que cada morte deixou no chao
  function kills(count: number) {
    return Array.from({ length: count }, (_, i) => {
      const world = createArenaWorld();
      world.rngState = 1000 + i * 7919;
      const enemy = addEnemy(world, 5.5, 6.5, UP);
      killEnemy(world, enemy);
      return { enemy, pickups: world.pickups };
    });
  }

  it('dinheiro cai sempre; item da tabela das caixas so as vezes', () => {
    const drops = kills(600);
    for (const { pickups } of drops) {
      expect(pickups[0]).toMatchObject({ kind: 'money', value: KILL_MONEY });
      expect(pickups.length).toBeLessThanOrEqual(2);
    }
    const withItem = drops.filter(({ pickups }) => pickups.length === 2);
    const share = withItem.length / drops.length;
    // nunca mais que a chance de sortear; menos, porque a tabela tambem da nada
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(ENEMY_LOOT_CHANCE);
    // vem da tabela das caixas, com as mesmas condicoes: sem arma de fogo
    // nao sai municao nem mira, e sai mais de um tipo de item
    const kinds = new Set(withItem.map(({ pickups }) => pickups[1].kind));
    expect(kinds.size).toBeGreaterThan(1);
    for (const kind of ['money', 'ammo', 'headshot'] as const) {
      expect(kinds.has(kind)).toBe(false);
    }
  });

  it('o item cai ao lado do corpo, nunca dentro de parede ou caixa', () => {
    for (const { enemy, pickups } of kills(300)) {
      const item = pickups[1];
      if (!item) continue;
      expect(distance(item.pos, enemy.pos)).toBeLessThanOrEqual(
        ENEMY_LOOT_OFFSET + 1e-9,
      );
      expect(item.roomIndex).toBe(enemy.roomIndex);
    }

    // encurralado num corredor de 1 tile: se o lado e parede, cai no corpo
    const world = createArenaWorld({
      5: '#####.#####',
      6: '#####.#####',
      7: '#####.#####',
    });
    for (let i = 0; i < 200; i++) {
      world.rngState = 50 + i * 104729;
      world.pickups = [];
      const enemy = addEnemy(world, 5.2, 6.5, UP);
      killEnemy(world, enemy);
      const item = world.pickups[1];
      if (item) expect(Math.floor(item.pos.x)).toBe(5);
    }
  });
});

describe('critico da espada', () => {
  // golpes em inimigo em alerta colado no player, com ou sem F a cada golpe
  function crits(press: boolean) {
    let critical = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const world = createArenaWorld();
      world.rngState = seed;
      world.run.meleeMissChance = 0;
      world.run.nextMeleeChanceAt = Infinity;
      const enemy = addEnemy(world, 5.5, 3.3, -Math.PI / 2);
      enemy.state = 'alert';
      fight(world, { moveX: 0, moveY: 0, dash: false, interact: press }, 0);
      const hit = world.floaters[0];
      if (hit.critical) critical++;
      // critico dobra: mata de uma vez quem tem a vida cheia
      expect(enemy.hp <= 0).toBe(!!hit.critical);
      expect(world.player.focus).toBe(0);
    }
    return critical / 300;
  }

  it('F no corpo a corpo sobe a chance de SWORD_CRIT_CHANCE para SWORD_CRIT_FOCUS', () => {
    expect(crits(false)).toBeCloseTo(SWORD_CRIT_CHANCE, 1);
    expect(crits(true)).toBeCloseTo(SWORD_CRIT_FOCUS, 1);
  });
});

describe('F no vazio', () => {
  it('golpeia de espada no ar, sem atrasar o proximo golpe', () => {
    const world = createArenaWorld();
    fight(world, { moveX: 0, moveY: 0, dash: false, interact: true }, 0);
    expect(world.player.slash).toBe(SLASH_TIME);
    expect(world.player.attackCooldown).toBe(0);
    expect(world.floaters).toHaveLength(0);
  });
});

describe('alcance da espada', () => {
  it('espada pega ate SWORD_RANGE; facada com arma na mao, so ate MELEE_RANGE', () => {
    const gap = (MELEE_RANGE + SWORD_RANGE) / 2;
    const sword = createArenaWorld();
    addEnemy(sword, 5.5, 2.5 + gap, -Math.PI / 2);
    expect(meleeTarget(sword)).toBeDefined();
    addEnemy(sword, 5.5, 2.5 + SWORD_RANGE + 0.1, -Math.PI / 2);
    expect(meleeTarget(sword)).toBe(sword.enemies[0]);

    const armed = createArenaWorld();
    armed.player.weapon = { id: 'pistol', ammo: 5 };
    addEnemy(armed, 5.5, 2.5 + gap, -Math.PI / 2);
    expect(meleeTarget(armed)).toBeUndefined();
  });
});
