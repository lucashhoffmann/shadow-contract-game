import {
  canSee,
  createEnemy,
  senseRange,
  updateEnemies,
} from '@/app/modules/enemy/systems/enemy.system';
import {
  ALERT_DURATION,
  DASH_TIME,
  DETECT_TIME,
  ENEMY_DASH_FROM_ROOM,
  ENEMY_DASH_MIN_INTERVAL,
  FAT_PELLETS,
  FAT_SPREAD,
  FIRE_DELAY,
  FIXED_DT,
  HEARING_YELLOW,
  LAUNCH_DISTANCE,
  LAUNCH_TIME,
  NOISE_DASH,
  NOISE_WALK,
  SENSE_MAX_BONUS,
  SENSE_RANGE,
  SHURIKEN_DAMAGE,
  SHURIKEN_FROM_LEVEL,
  SHURIKEN_FROM_ROOM,
  SHURIKEN_INTERVAL,
  SHOP_EVERY,
  PLAYER_MAX_HP,
} from '@/app/modules/world/constants/world.constants';
import type { World } from '@/app/modules/world/types/world.types';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

// parede vertical inteira na coluna 7: separa x < 7 de x > 8
const SPLIT = Object.fromEntries(
  Array.from({ length: 11 }, (_, i) => [i + 1, '#......#..#']),
);

function run(world: World, seconds: number) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) updateEnemies(world, FIXED_DT);
}

describe('canSee', () => {
  it('ve alvo dentro do cone e do alcance', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, 0);
    expect(canSee(world, enemy, { x: 8.5, y: 5.5 })).toBe(true);
  });

  it('nao ve atras, fora do angulo nem fora do alcance', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 3.5, 5.5, 0);
    expect(canSee(world, enemy, { x: 1.5, y: 5.5 })).toBe(false);
    expect(canSee(world, enemy, { x: 4.5, y: 8.5 })).toBe(false);
    expect(canSee(world, enemy, { x: 9.5, y: 5.5 })).toBe(false);
  });

  it('nao ve atraves de parede', () => {
    const world = createArenaWorld(SPLIT);
    const enemy = addEnemy(world, 5.5, 5.5, 0);
    expect(canSee(world, enemy, { x: 8.5, y: 5.5 })).toBe(false);
  });
});

describe('updateEnemies', () => {
  it('gordo em alerta dispara a escopeta: FAT_PELLETS balas em leque', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, -Math.PI / 2, 'fat');
    enemy.detection = 1;
    run(world, FIRE_DELAY + 0.1);
    expect(world.projectiles).toHaveLength(FAT_PELLETS);
    expect(world.projectiles.every((p) => p.weapon === 'shotgun')).toBe(true);
    const angles = world.projectiles.map((p) => Math.atan2(p.vel.y, p.vel.x));
    expect(Math.max(...angles) - Math.min(...angles)).toBeCloseTo(FAT_SPREAD);
    expect(enemy.dashEvery).toBe(0);
  });

  it('nao ve nem ouve player invisivel, e em alerta perde o rastro', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, -Math.PI / 2);
    world.player.noise = NOISE_DASH;
    world.player.invisible = 60;

    run(world, DETECT_TIME * 3);
    expect(enemy.state).toBe('patrol');
    expect(enemy.detection).toBe(0);

    enemy.detection = 1;
    const hp = world.player.hp;
    run(world, ALERT_DURATION * 3);
    expect(enemy.state).toBe('patrol');
    expect(world.player.hp).toBe(hp);
    expect(world.projectiles).toHaveLength(0);
  });

  it('fica suspeito ao ver o player e entra em alerta apos DETECT_TIME', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, -Math.PI / 2);

    run(world, DETECT_TIME / 2);
    expect(enemy.state).toBe('suspicious');
    expect(enemy.detection).toBeGreaterThan(0.4);
    expect(enemy.detection).toBeLessThan(0.6);

    run(world, DETECT_TIME);
    expect(enemy.state).toBe('alert');
  });

  it('volta a patrulhar quando perde o player antes de alertar', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, -Math.PI / 2);
    run(world, DETECT_TIME / 2);

    world.player.pos = { x: 5.5, y: 9.5 };
    run(world, 0.2);
    expect(enemy.state).toBe('suspicious');
    run(world, 2);
    expect(enemy.state).toBe('patrol');
    expect(enemy.detection).toBe(0);
  });

  it('terno em alerta dispara balas na direcao do player', () => {
    const world = createArenaWorld();
    addEnemy(world, 5.5, 5.5, -Math.PI / 2, 'suit');
    run(world, 2);
    expect(world.projectiles.length).toBeGreaterThan(0);
    expect(world.projectiles[0].owner).toBe('enemy');
    expect(world.projectiles[0].vel.y).toBeLessThan(0);
    expect(world.player.hp).toBe(PLAYER_MAX_HP);
  });

  it('ninja em alerta corre ate o player e golpeia de perto, sem balas', () => {
    const world = createArenaWorld();
    const ninja = addEnemy(world, 5.5, 5.5, -Math.PI / 2, 'ninja');
    run(world, 3);
    expect(ninja.pos.y).toBeLessThan(4);
    expect(world.projectiles).toHaveLength(0);
    expect(world.player.hp).toBeLessThan(PLAYER_MAX_HP);
  });

  it('inicia a pose de ataque quando dispara ou golpeia', () => {
    const world = createArenaWorld();
    const suit = addEnemy(world, 5.5, 5.5, -Math.PI / 2, 'suit');
    const ninja = addEnemy(world, 5.5, 3.3, -Math.PI / 2, 'ninja');
    for (const enemy of [suit, ninja]) {
      enemy.state = 'alert';
      enemy.alertTimer = ALERT_DURATION;
      enemy.fireCooldown = 0;
    }

    updateEnemies(world, FIXED_DT);

    expect(suit.attack).toBeGreaterThan(0);
    expect(ninja.attack).toBeGreaterThan(0);
  });

  it('entra em alerta ao levar tiro, mesmo sem ver o player', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, Math.PI / 2);
    enemy.detection = 1;
    run(world, FIXED_DT);
    expect(enemy.state).toBe('alert');
  });

  it('desiste do alerta apos ALERT_DURATION sem linha de visao', () => {
    const world = createArenaWorld(SPLIT);
    const enemy = addEnemy(world, 8.5, 5.5, 0);
    enemy.state = 'alert';
    enemy.alertTimer = ALERT_DURATION;

    run(world, ALERT_DURATION - 0.5);
    expect(enemy.state).toBe('alert');
    run(world, 1);
    expect(enemy.state).toBe('patrol');
    expect(world.player.hp).toBe(PLAYER_MAX_HP);
  });

  it('persegue o player contornando parede quando em alerta', () => {
    const world = createArenaWorld({ 6: '########..#' });
    world.player.pos = { x: 2.5, y: 10.5 };
    const enemy = addEnemy(world, 2.5, 2.5, 0);
    enemy.state = 'alert';
    enemy.alertTimer = ALERT_DURATION;

    run(world, 3);
    expect(enemy.pos.x).toBeGreaterThan(4);
  });

  it('patrulha entre os waypoints', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 11.5 };
    const enemy = createEnemy(world, 0, [
      { x: 2.5, y: 5.5 },
      { x: 8.5, y: 5.5 },
    ]);
    world.enemies.push(enemy);

    run(world, 3);
    expect(enemy.waypoint).toBe(1);
    expect(enemy.pos.x).toBeGreaterThan(5);

    run(world, 3);
    expect(enemy.waypoint).toBe(0);
    expect(enemy.pos.x).toBeLessThan(8.5);
  });

  it('ignora inimigo morto', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, -Math.PI / 2);
    enemy.state = 'dead';
    run(world, 2);
    expect(enemy.state).toBe('dead');
    expect(world.player.hp).toBe(PLAYER_MAX_HP);
  });

  it('salta mais vezes a cada sala, e nunca nas primeiras', () => {
    const world = createArenaWorld();
    const at = (room: number) => createEnemy(world, room, [{ x: 5.5, y: 5.5 }]);
    expect(at(ENEMY_DASH_FROM_ROOM - 1).dashEvery).toBe(0);
    expect(at(ENEMY_DASH_FROM_ROOM + 1).dashEvery).toBeLessThan(
      at(ENEMY_DASH_FROM_ROOM).dashEvery,
    );
    const late = at(999);
    expect(late.dashEvery * late.intelligence.dash).toBeCloseTo(
      ENEMY_DASH_MIN_INTERVAL,
    );
  });

  it('inteligencia cresce por contrato e sorteia perfis a partir do nivel 6', () => {
    const world = createArenaWorld();
    const at = (level: number) =>
      createEnemy(world, (level - 1) * SHOP_EVERY + 1, [{ x: 5.5, y: 5.5 }])
        .intelligence;
    const first = at(1);
    const fifth = at(5);
    const sixth = at(6);

    expect(first).toEqual({
      hearing: 1,
      hearingThreshold: 1,
      pursuit: 1,
      dash: 1,
    });
    expect(fifth.hearing).toBeGreaterThan(first.hearing);
    expect(fifth.hearingThreshold).toBeLessThan(first.hearingThreshold);
    expect(fifth.pursuit).toBeGreaterThan(first.pursuit);
    expect(fifth.dash).toBeGreaterThan(first.dash);
    expect(sixth.hearing).toBeGreaterThan(fifth.hearing);
    expect(at(6)).toBe(sixth);

    const varied = createArenaWorld();
    varied.rngState = 2;
    expect(
      createEnemy(varied, 5 * SHOP_EVERY + 1, [{ x: 5.5, y: 5.5 }])
        .intelligence,
    ).not.toEqual(sixth);

    const another = createArenaWorld();
    another.intelligence = { ...world.intelligence };
    expect(
      createEnemy(another, 5 * SHOP_EVERY + 1, [{ x: 5.5, y: 5.5 }])
        .intelligence,
    ).toEqual(sixth);
  });

  it('nivel alto ouve, persegue e salta mais rapido', () => {
    const lowWorld = createArenaWorld();
    const highWorld = createArenaWorld();
    const make = (world: World, room: number) => {
      world.player.pos = { x: 5.5, y: 2.5 };
      world.player.noise = NOISE_WALK;
      const enemy = createEnemy(world, room, [{ x: 5.5, y: 5.3 }]);
      world.enemies.push(enemy);
      return enemy;
    };
    const low = make(lowWorld, 1);
    const high = make(highWorld, 4 * SHOP_EVERY + 1);

    updateEnemies(lowWorld, FIXED_DT);
    updateEnemies(highWorld, FIXED_DT);
    expect(high.hearing).toBeGreaterThan(low.hearing);

    for (const [world, enemy] of [
      [lowWorld, low],
      [highWorld, high],
    ] as const) {
      world.player.pos = { x: 9.5, y: 5.5 };
      enemy.pos = { x: 2.5, y: 5.5 };
      enemy.state = 'alert';
      enemy.alertTimer = ALERT_DURATION;
      enemy.dashEvery = 0;
    }
    run(lowWorld, 0.3);
    run(highWorld, 0.3);
    expect(high.pos.x).toBeGreaterThan(low.pos.x);

    for (const enemy of [low, high]) {
      enemy.pos = { x: 2.5, y: 5.5 };
      enemy.facing = 0;
      enemy.dash = DASH_TIME;
    }
    updateEnemies(lowWorld, 0.1);
    updateEnemies(highWorld, 0.1);
    expect(high.pos.x).toBeGreaterThan(low.pos.x);
  });

  it('terno escolhe o lado livre para o dash de combate', () => {
    const world = createArenaWorld(SPLIT);
    world.player.pos = { x: 5.5, y: 9.5 };
    const enemy = addEnemy(world, 5.5, 5.5, Math.PI / 2);
    enemy.state = 'alert';
    enemy.alertTimer = ALERT_DURATION;
    enemy.dashEvery = 1;

    updateEnemies(world, FIXED_DT);

    expect(enemy.dash).toBeGreaterThan(0);
    expect(Math.cos(enemy.facing)).toBeLessThan(-0.9);
  });

  it('ninja da o bote quando o salto alcanca, pousa colado e golpeia logo', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 6 };
    const enemy = addEnemy(world, 5.5, 2.5, Math.PI / 2, 'ninja');
    enemy.dashEvery = 1;
    enemy.detection = 1;

    let jumped = false;
    for (let i = 0; i < 90 && world.player.hp === PLAYER_MAX_HP; i++) {
      updateEnemies(world, FIXED_DT);
      if (enemy.dash > 0) jumped = true;
    }
    expect(jumped).toBe(true);
    expect(world.player.hp).toBeLessThan(PLAYER_MAX_HP);
    // nao atravessou o player
    expect(enemy.pos.y).toBeLessThan(world.player.pos.y);
  });

  it('ninja longe demais para o salto alcancar corre em vez de saltar', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 11.5 };
    const enemy = addEnemy(world, 5.5, 1.5, Math.PI / 2, 'ninja');
    enemy.dashEvery = 0.2;
    enemy.detection = 1;
    run(world, 0.6);
    expect(enemy.dash).toBe(0);
    expect(enemy.pos.y).toBeGreaterThan(2.5);
  });

  it('bote do ninja corrige o rumo para o player que saiu da frente', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 3, Math.PI / 2, 'ninja');
    enemy.state = 'alert';
    enemy.alertTimer = 5;
    enemy.dash = DASH_TIME;
    world.player.pos = { x: 8.5, y: 6 };
    run(world, DASH_TIME / 2);
    expect(enemy.facing).toBeLessThan(Math.PI / 2);
    expect(enemy.pos.x).toBeGreaterThan(5.5);
  });

  it('ninja de nivel alto arremessa shuriken de longe; de nivel baixo nao', () => {
    const thrown = (roomIndex: number) => {
      const world = createArenaWorld();
      world.player.pos = { x: 5.5, y: 7.5 };
      // posicao da arena de teste, nivel da sala pedida
      const enemy = createEnemy(
        world,
        roomIndex,
        [{ x: 5.5, y: 2.5 }],
        'ninja',
      );
      world.enemies.push(enemy);
      enemy.dashEvery = 0;
      enemy.detection = 1;
      run(world, SHURIKEN_INTERVAL);
      return world.projectiles.filter((p) => p.shuriken);
    };
    // primeira sala com shuriken: contrato e sala dentro dele
    const first = SHOP_EVERY * (SHURIKEN_FROM_LEVEL - 1) + SHURIKEN_FROM_ROOM;
    const stars = thrown(first);
    expect(stars.length).toBeGreaterThan(0);
    expect(stars[0].owner).toBe('enemy');
    // nesse nivel o dano ja cresceu acima do base
    expect(stars[0].damage).toBeGreaterThan(SHURIKEN_DAMAGE);
    expect(stars[0].vel.y).toBeGreaterThan(0);
    expect(thrown(first - 1)).toHaveLength(0);
  });

  it('ninja nao salta com caixa ou bau no trajeto, e nunca entra no tile', () => {
    // linha 9 do template = y 3: bau em (5, 3), entre o ninja e o player
    for (const tile of ['C', 'o']) {
      const world = createArenaWorld({ 9: `#....${tile}....#` });
      world.player.pos = { x: 5.5, y: 6.5 };
      const enemy = addEnemy(world, 5.5, 1.5, Math.PI / 2, 'ninja');
      enemy.dashEvery = 1;
      enemy.detection = 1;

      let jumped = false;
      for (let i = 0; i < 240; i++) {
        updateEnemies(world, FIXED_DT);
        // ainda do lado de la do obstaculo: so pode contornar andando
        if (enemy.pos.y < 3 && enemy.dash > 0) jumped = true;
        expect(
          Math.floor(enemy.pos.x) === 5 && Math.floor(enemy.pos.y) === 3,
        ).toBe(false);
      }
      expect(jumped).toBe(false);
      // deu a volta e chegou perto do player
      expect(enemy.pos.y).toBeGreaterThan(4);
    }
  });

  it('terno no alcance salta de lado e continua atirando', () => {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 9.5 };
    const enemy = addEnemy(world, 5.5, 5.5, Math.PI / 2);
    enemy.dashEvery = 1;
    enemy.detection = 1;
    run(world, 0.5 + DASH_TIME + 4 * FIXED_DT);
    expect(Math.abs(enemy.pos.x - 5.5)).toBeGreaterThan(2);
    expect(enemy.pos.y).toBeCloseTo(5.5, 1);

    run(world, 1);
    expect(world.projectiles.length).toBeGreaterThan(0);
  });
});

describe('percepcao de perto', () => {
  it('nota o player colado mesmo de costas, mas nao atraves de parede', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, 0);
    expect(canSee(world, enemy, { x: 5.5 - SENSE_RANGE + 0.1, y: 5.5 })).toBe(
      true,
    );
    expect(canSee(world, enemy, { x: 5.5 - SENSE_RANGE - 0.1, y: 5.5 })).toBe(
      false,
    );

    const split = createArenaWorld(SPLIT);
    const blocked = addEnemy(split, 8.5, 5.5, 0);
    expect(canSee(split, blocked, { x: 6.9, y: 5.5 })).toBe(false);
  });

  it('raio cresce a cada contrato, ate o teto', () => {
    const world = createArenaWorld();
    const at = (roomIndex: number) =>
      senseRange(createEnemy(world, roomIndex, [{ x: 5.5, y: 5.5 }]));
    expect(at(SHOP_EVERY - 1)).toBe(SENSE_RANGE);
    expect(at(SHOP_EVERY)).toBeGreaterThan(SENSE_RANGE);
    expect(at(SHOP_EVERY * 2)).toBeGreaterThan(at(SHOP_EVERY));
    expect(at(SHOP_EVERY * 100)).toBe(SENSE_RANGE + SENSE_MAX_BONUS);
  });
});

describe('audicao', () => {
  // inimigo de costas para o player: so pode notar pelo ouvido
  function behind(gap: number, noise: number) {
    const world = createArenaWorld();
    world.player.pos = { x: 5.5, y: 2.5 };
    world.player.noise = noise;
    const enemy = addEnemy(world, 5.5, 2.5 + gap, Math.PI / 2);
    return { world, enemy };
  }

  it('ouve passos por perto, larga a patrulha e vai ate o barulho', () => {
    const { world, enemy } = behind(1.8, NOISE_WALK);
    const startingPos = { ...enemy.pos };
    updateEnemies(world, FIXED_DT);
    expect(enemy.heard).toEqual(world.player.pos);
    expect(enemy.state).toBe('suspicious');
    expect(enemy.route.length).toBeGreaterThan(0);
    expect(enemy.pos).not.toEqual(startingPos);

    world.player.pos = { x: 7, y: 2.5 };
    updateEnemies(world, FIXED_DT);
    expect(enemy.route.at(-1)).toEqual(world.player.pos);

    world.player.noise = 0;
    world.player.pos = { x: 9.5, y: 11.5 };
    run(world, 0.5);
    expect(enemy.state).toBe('suspicious');
  });

  it('escuta progride de branco a amarelo e vermelho, mesmo sem visao', () => {
    const world = createArenaWorld(SPLIT);
    world.player.pos = { x: 5.5, y: 5.5 };
    world.player.noise = NOISE_DASH;
    const enemy = addEnemy(world, 8.5, 5.5, 0);

    run(world, 0.2);
    expect(enemy.state).toBe('suspicious');
    expect(enemy.hearing).toBeLessThan(
      enemy.intelligence.hearingThreshold * HEARING_YELLOW,
    );

    run(world, 0.5);
    expect(enemy.state).toBe('suspicious');
    expect(enemy.hearing).toBeGreaterThanOrEqual(
      enemy.intelligence.hearingThreshold * HEARING_YELLOW,
    );

    run(world, 0.8);
    expect(enemy.state).toBe('alert');
    expect(enemy.heard).toBeNull();
    run(world, ALERT_DURATION + 0.5);
    expect(enemy.state).toBe('alert');
  });

  it('quanto mais perto, mais rapido ouve', () => {
    const near = behind(1, NOISE_WALK);
    const far = behind(2.5, NOISE_WALK);
    run(near.world, 0.2);
    run(far.world, 0.2);
    expect(near.enemy.hearing).toBeGreaterThan(far.enemy.hearing * 2);
  });

  it('fora do raio do barulho ou com o player parado nao ouve', () => {
    const quiet = behind(1, 0);
    const far = behind(NOISE_WALK + 0.1, NOISE_WALK);
    run(quiet.world, 2);
    run(far.world, 2);
    expect(quiet.enemy.heard).toBeNull();
    expect(far.enemy.heard).toBeNull();
    expect(far.enemy.state).toBe('patrol');
  });

  it('salto e ouvido de mais longe que passo', () => {
    const { world, enemy } = behind(NOISE_WALK + 0.5, NOISE_DASH);
    run(world, 0.2);
    expect(enemy.heard).not.toBeNull();
  });

  it('sem novo barulho desiste e volta a patrulha', () => {
    // fora da percepcao de perto: so o ouvido nota
    const { world, enemy } = behind(1.8, NOISE_WALK);
    run(world, 0.2);
    world.player.noise = 0;
    world.player.pos = { x: 9.5, y: 11.5 };
    run(world, 5);
    expect(enemy.heard).toBeNull();
    expect(enemy.state).toBe('patrol');
  });
});

it('player agachado e ouvido so ate o branco: investiga, nunca alerta', () => {
  const world = createArenaWorld();
  world.player.pos = { x: 5.5, y: 2.5 };
  world.player.noise = NOISE_WALK;
  world.player.crouching = true;
  // de costas e fora da percepcao de perto: so o ouvido nota
  const enemy = addEnemy(world, 5.5, 4.5, Math.PI / 2);
  for (let i = 0; i < 600; i++) {
    updateEnemies(world, FIXED_DT);
    // segura no lugar e de costas: o teste e so do ouvido
    enemy.facing = Math.PI / 2;
    enemy.pos = { x: 5.5, y: 4.5 };
    enemy.detection = 0;
  }
  expect(enemy.heard).not.toBeNull();
  expect(enemy.hearing).toBeLessThan(
    enemy.intelligence.hearingThreshold * HEARING_YELLOW,
  );
  expect(enemy.state).not.toBe('alert');

  world.player.crouching = false;
  for (let i = 0; i < 600 && enemy.state !== 'alert'; i++) {
    updateEnemies(world, FIXED_DT);
  }
  expect(enemy.state).toBe('alert');
});

describe('corpo lancado', () => {
  it('anda LAUNCH_DISTANCE na direcao do golpe e para', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 5.5, Math.PI / 2);
    enemy.state = 'dead';
    enemy.launch = LAUNCH_TIME;
    run(world, LAUNCH_TIME / 2);
    // freando: mais da metade do caminho na primeira metade do tempo
    expect(enemy.pos.y - 5.5).toBeGreaterThan(LAUNCH_DISTANCE * 0.6);
    run(world, LAUNCH_TIME);
    expect(enemy.launch).toBe(0);
    expect(enemy.pos.y).toBeCloseTo(5.5 + LAUNCH_DISTANCE, 1);
    expect(enemy.pos.x).toBeCloseTo(5.5);
  });

  it('parede segura o corpo', () => {
    const world = createArenaWorld();
    const enemy = addEnemy(world, 5.5, 11, Math.PI / 2);
    enemy.state = 'dead';
    enemy.launch = LAUNCH_TIME;
    run(world, LAUNCH_TIME * 2);
    expect(enemy.pos.y).toBeLessThan(12);
  });
});
