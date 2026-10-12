import { spawnProjectile } from '@/app/modules/combat/systems/combat.system';
import {
  createEnemy,
  enemyDamage,
  enemyStrike,
  updateEnemies,
} from '@/app/modules/enemy/systems/enemy.system';
import {
  ENEMY_BULLET_DAMAGE,
  ENEMY_CRIT_FROM_LEVEL,
  ENEMY_CRIT_MAX,
  ENEMY_CRIT_MULT,
  ENEMY_DAMAGE_SHARE_MAX,
  FIXED_DT,
  NINJA_DAMAGE,
  PACK_CALL_RADIUS,
  PLAYER_BULLET_SPEED,
  PLAYER_MAX_HP,
  RAGE_DETECT,
  RAGE_PURSUIT,
  RAGE_VIEW,
  SHOP_EVERY,
} from '@/app/modules/world/constants/world.constants';
import type { Enemy, World } from '@/app/modules/world/types/world.types';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

// Dificuldade: dano que acompanha o nivel e a vida do jogador, bando e
// esquiva do ninja.

function run(world: World, seconds: number) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) updateEnemies(world, FIXED_DT);
}

// inimigo da arena de teste valendo o nivel pedido
function ofLevel(world: World, level: number, kind: Enemy['kind'] = 'ninja') {
  return createEnemy(world, level * SHOP_EVERY, [{ x: 5.5, y: 8.5 }], kind);
}

describe('dano do inimigo', () => {
  it('no nivel 1, contra a vida inicial, e o dano base', () => {
    const world = createArenaWorld();
    const enemy = ofLevel(world, 1);
    expect(enemyDamage(world, enemy, NINJA_DAMAGE)).toBe(NINJA_DAMAGE);
    expect(enemyDamage(world, enemy, ENEMY_BULLET_DAMAGE)).toBe(
      ENEMY_BULLET_DAMAGE,
    );
  });

  it('cresce com o nivel', () => {
    const world = createArenaWorld();
    const at = (level: number) =>
      enemyDamage(world, ofLevel(world, level), NINJA_DAMAGE);
    expect(at(5)).toBeGreaterThan(at(1));
    expect(at(40)).toBeGreaterThan(at(5) * 2);
  });

  it('acompanha a vida de quem empilhou colete', () => {
    const world = createArenaWorld();
    const enemy = ofLevel(world, 40);
    const normal = enemyDamage(world, enemy, NINJA_DAMAGE);
    world.player.maxHp = 5000;
    const tank = enemyDamage(world, enemy, NINJA_DAMAGE);
    expect(tank).toBeGreaterThan(normal);
    // no teto, poucos golpes de ninja bastam, tenha a vida que tiver
    expect(tank).toBe(5000 * ENEMY_DAMAGE_SHARE_MAX);
    // tiro leva a mesma regra, na proporcao do dano base dele
    expect(enemyDamage(world, enemy, ENEMY_BULLET_DAMAGE)).toBe(
      (tank * ENEMY_BULLET_DAMAGE) / NINJA_DAMAGE,
    );
  });

  it('golpe do ninja de nivel alto tira o dano que cresceu', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 7.8 };
    const enemy = ofLevel(world, 20);
    enemy.dashEvery = 0;
    enemy.detection = 1;
    world.enemies.push(enemy);
    run(world, 1.2);
    expect(PLAYER_MAX_HP - world.player.hp).toBeGreaterThan(NINJA_DAMAGE);
  });
});

describe('bando', () => {
  it('quem entra em alerta chama os colegas por perto, nao os de longe', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 2.5 };
    // todos de costas para o player e longe dele: so o chamado alerta
    const caller = addEnemy(world, 3.5, 9.5, Math.PI / 2);
    const near = addEnemy(
      world,
      3.5 + PACK_CALL_RADIUS - 0.5,
      9.5,
      Math.PI / 2,
    );
    const far = addEnemy(world, 9.5, 4.5, Math.PI / 2);
    for (const enemy of [caller, near, far]) enemy.viewRange = 0;
    caller.detection = 1;

    run(world, 2 * FIXED_DT);
    expect(caller.state).toBe('alert');
    expect(near.state).toBe('alert');
    expect(far.state).not.toBe('alert');
  });

  it('ninjas em alerta cercam: chegam por lados diferentes', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 6.5 };
    // os tres saem do mesmo canto
    const pack = [0, 1, 2].map((i) =>
      addEnemy(world, 2 + i * 0.8, 11, -Math.PI / 2, 'ninja'),
    );
    for (const ninja of pack) {
      ninja.dashEvery = 0;
      ninja.detection = 1;
    }
    world.player.hp = 100000;
    run(world, 2.5);
    const bearings = pack.map((ninja) =>
      Math.atan2(ninja.pos.y - 6.5, ninja.pos.x - 5.5),
    );
    const spread = Math.max(...bearings) - Math.min(...bearings);
    // vindos do mesmo canto, em fila ficariam quase no mesmo angulo
    expect(spread).toBeGreaterThan(1);
  });
});

describe('esquiva do ninja', () => {
  // ninja em alerta, com salto pronto, e bala do player vindo reto nele
  function shotAt(dash: number) {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 2.5 };
    const ninja = addEnemy(world, 5.5, 7.5, -Math.PI / 2, 'ninja');
    ninja.state = 'alert';
    ninja.alertTimer = 5;
    ninja.dashEvery = 2;
    ninja.dashCooldown = 0;
    ninja.intelligence = { ...ninja.intelligence, dash };
    return { world, ninja };
  }

  // quantas de `shots` balas o ninja desvia
  function dodged(dash: number, shots = 40) {
    let count = 0;
    for (let i = 0; i < shots; i++) {
      const { world, ninja } = shotAt(dash);
      world.nextId += i;
      spawnProjectile(
        world,
        'player',
        { x: 5.5, y: 4.5 },
        Math.PI / 2,
        PLAYER_BULLET_SPEED,
        10,
        8,
      );
      updateEnemies(world, FIXED_DT);
      if (ninja.evading) {
        count++;
        // salta de lado, atravessado ao tiro
        expect(Math.abs(Math.cos(ninja.facing))).toBeGreaterThan(0.9);
      }
    }
    return count;
  }

  it('desvia de parte dos tiros, e mais quanto mais esperto', () => {
    const low = dodged(1);
    const high = dodged(1.6);
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(40);
    expect(high).toBeGreaterThan(low);
  });

  it('a esquiva tira o ninja da linha do tiro', () => {
    const { world, ninja } = shotAt(5);
    spawnProjectile(
      world,
      'player',
      { x: 5.5, y: 4.5 },
      Math.PI / 2,
      PLAYER_BULLET_SPEED,
      10,
      8,
    );
    run(world, 0.2);
    expect(Math.abs(ninja.pos.x - 5.5)).toBeGreaterThan(1);
  });

  it('nao desvia de bala que nao vem nele nem sem salto pronto', () => {
    const aside = shotAt(5);
    spawnProjectile(
      aside.world,
      'player',
      { x: 8.5, y: 4.5 },
      Math.PI / 2,
      PLAYER_BULLET_SPEED,
      10,
      8,
    );
    updateEnemies(aside.world, FIXED_DT);
    expect(aside.ninja.evading).toBe(false);

    const tired = shotAt(5);
    tired.ninja.dashCooldown = 2;
    spawnProjectile(
      tired.world,
      'player',
      { x: 5.5, y: 4.5 },
      Math.PI / 2,
      PLAYER_BULLET_SPEED,
      10,
      8,
    );
    updateEnemies(tired.world, FIXED_DT);
    expect(tired.ninja.evading).toBe(false);
  });
});

describe('critico do inimigo', () => {
  // fracao de `tries` golpes que sai critica; confere o dano de cada um
  function crits(level: number, tries = 400) {
    const world = createArenaWorld();
    const enemy = ofLevel(world, level);
    const normal = enemyDamage(world, enemy, NINJA_DAMAGE);
    let count = 0;
    for (let i = 0; i < tries; i++) {
      const strike = enemyStrike(world, enemy, NINJA_DAMAGE);
      if (!strike.critical) {
        expect(strike.damage).toBe(normal);
        continue;
      }
      count++;
      expect(strike.damage).toBe(Math.round(normal * ENEMY_CRIT_MULT));
    }
    return count / tries;
  }

  it('antes do nivel de critico nao acontece nem gasta sorteio', () => {
    const world = createArenaWorld();
    const enemy = ofLevel(world, ENEMY_CRIT_FROM_LEVEL - 1);
    const rng = world.rngState;
    expect(enemyStrike(world, enemy, NINJA_DAMAGE).critical).toBe(false);
    expect(world.rngState).toBe(rng);
  });

  it('a partir do nivel acontece as vezes, mais em nivel alto, ate o teto', () => {
    const early = crits(ENEMY_CRIT_FROM_LEVEL);
    const late = crits(ENEMY_CRIT_FROM_LEVEL + 15);
    expect(early).toBeGreaterThan(0.02);
    expect(early).toBeLessThan(0.2);
    expect(late).toBeGreaterThan(early);
    expect(crits(200)).toBeLessThan(ENEMY_CRIT_MAX + 0.08);
  });

  it('golpe critico de ninja avisa CRITICO sobre ele', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 7.8 };
    world.player.hp = 1e9;
    const enemy = ofLevel(world, 60);
    enemy.dashEvery = 0;
    enemy.detection = 1;
    world.enemies.push(enemy);
    run(world, 12);
    // floaters so somem em updateFloaters: aqui ficam todos os golpes
    const hits = world.floaters.length;
    expect(hits).toBeGreaterThan(5);
    const critical = world.floaters.filter((f) => f.critical);
    expect(critical.length).toBeGreaterThan(0);
    expect(critical.length).toBeLessThan(hits);
    expect(critical[0].onPlayer).toBe(true);
  });

  it('tiro critico leva a marca e o dano multiplicado', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 4.5 };
    const enemy = ofLevel(world, 60, 'suit');
    enemy.dashEvery = 0;
    enemy.detection = 1;
    world.enemies.push(enemy);
    run(world, 20);
    // as balas so andam em updateProjectiles: aqui ficam todas no ar
    const bullets = world.projectiles;
    expect(bullets.some((b) => b.critical)).toBe(true);
    expect(bullets.some((b) => !b.critical)).toBe(true);
    const base = bullets.find((b) => !b.critical)!.damage;
    expect(bullets.find((b) => b.critical)!.damage).toBe(
      Math.round(base * ENEMY_CRIT_MULT),
    );
  });
});

describe('furia ao ver um colega morto', () => {
  // vivo em (3.5, 9.5) olhando para a direita; morto na frente dele
  function scene(deadAt = { x: 6.5, y: 9.5 }) {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 1.5 };
    const alive = addEnemy(world, 3.5, 9.5, 0);
    const other = addEnemy(world, 9.5, 2.5, 0);
    const dead = addEnemy(world, deadAt.x, deadAt.y, 0);
    dead.state = 'dead';
    return { world, alive, other, dead };
  }

  it('fica mais esperto, para sempre, e vai conferir o corpo', () => {
    const { world, alive, dead } = scene();
    const before = {
      view: alive.viewRange,
      detect: alive.detectTime,
      pursuit: alive.intelligence.pursuit,
      hearing: alive.intelligence.hearing,
      dash: alive.intelligence.dash,
      threshold: alive.intelligence.hearingThreshold,
    };
    updateEnemies(world, FIXED_DT);

    expect(alive.enraged).toBe(true);
    expect(alive.viewRange).toBe(before.view + RAGE_VIEW);
    expect(alive.detectTime).toBeCloseTo(before.detect * RAGE_DETECT);
    expect(alive.intelligence.pursuit).toBeCloseTo(
      before.pursuit * RAGE_PURSUIT,
    );
    expect(alive.intelligence.hearing).toBeGreaterThan(before.hearing);
    expect(alive.intelligence.dash).toBeGreaterThan(before.dash);
    expect(alive.intelligence.hearingThreshold).toBeLessThan(before.threshold);
    expect(alive.heard).toEqual(dead.pos);

    // nao soma de novo a cada passo
    run(world, 0.5);
    expect(alive.viewRange).toBe(before.view + RAGE_VIEW);
    expect(alive.pos.x).toBeGreaterThan(3.5);
  });

  it('a furia e so de quem viu: o perfil do nivel nao muda para os outros', () => {
    const { world, alive, other } = scene();
    const shared = other.intelligence.pursuit;
    updateEnemies(world, FIXED_DT);
    expect(alive.enraged).toBe(true);
    expect(other.enraged).toBe(false);
    expect(other.intelligence.pursuit).toBe(shared);
  });

  it('corpo atras dele ou longe demais nao conta', () => {
    const behind = scene({ x: 1.5, y: 9.5 });
    updateEnemies(behind.world, FIXED_DT);
    expect(behind.alive.enraged).toBe(false);

    const far = scene({ x: 9.5, y: 9.5 });
    far.alive.viewRange = 3;
    updateEnemies(far.world, FIXED_DT);
    expect(far.alive.enraged).toBe(false);
  });

  it('em alerta tambem se enfurece, sem largar o player', () => {
    const { world, alive } = scene();
    alive.state = 'alert';
    alive.alertTimer = 5;
    updateEnemies(world, FIXED_DT);
    expect(alive.enraged).toBe(true);
    expect(alive.state).toBe('alert');
    expect(alive.heard).toBeNull();
  });
});
