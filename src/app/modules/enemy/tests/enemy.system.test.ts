import {
  canSee,
  createEnemy,
  updateEnemies,
} from '@/app/modules/enemy/systems/enemy.system';
import {
  ALERT_DURATION,
  DETECT_TIME,
  FIXED_DT,
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
});
