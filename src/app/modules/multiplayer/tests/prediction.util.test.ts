import { spawnProjectile } from '@/app/modules/combat/systems/combat.system';
import {
  createPrediction,
  predictStep,
  reconcile,
} from '@/app/modules/multiplayer/utils/prediction.util';
import {
  FIXED_DT,
  PLAYER_BULLET_SPEED,
  PLAYER_SPEED,
} from '@/app/modules/world/constants/world.constants';
import { createPlayer } from '@/app/modules/world/systems/world.system';
import type { InputState, World } from '@/app/modules/world/types/world.types';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

const IDLE: InputState = { moveX: 0, moveY: 0, dash: false };
const RIGHT: InputState = { moveX: 1, moveY: 0, dash: false };

// mundo do convidado: ele e o lugar 1, em foco; o host e o lugar 0
function guestWorld(): World {
  const world = createArenaWorld();
  world.mode = 'multi';
  const me = createPlayer(1, 'Ana', '#39d0ff');
  me.pos = { x: 3.5, y: 6.5 };
  world.players.push(me);
  world.player = me;
  return world;
}

function steps(
  world: World,
  input: InputState,
  seconds: number,
  p = createPrediction(),
) {
  const count = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < count; i++) predictStep(world, input, FIXED_DT, p);
  return p;
}

describe('previsao do proprio jogador', () => {
  it('anda na hora pelo input local, sem esperar o host', () => {
    const world = guestWorld();
    steps(world, RIGHT, 0.2);
    expect(world.player.pos.x).toBeCloseTo(3.5 + PLAYER_SPEED * 0.2, 1);
    // o host nao e mexido pela previsao do convidado
    expect(world.players[0].pos).toEqual({ x: 5.5, y: 2.5 });
  });

  it('estado do host corrige a posicao e reaplica o que ele ainda nao viu', () => {
    const world = guestWorld();
    const prediction = steps(world, RIGHT, 0.3);
    // host 100 ms atras: ainda nao recebeu os ultimos 0.1 s de input
    world.player.pos = { x: 3.5 + PLAYER_SPEED * 0.2, y: 6.5 };
    reconcile(world, prediction, 0.1);
    expect(world.player.pos.x).toBeCloseTo(3.5 + PLAYER_SPEED * 0.3, 1);
  });

  it('parado, o estado do host vale como esta', () => {
    const world = guestWorld();
    const prediction = steps(world, IDLE, 0.3);
    world.player.pos = { x: 4, y: 7 };
    reconcile(world, prediction, 0.1);
    expect(world.player.pos).toEqual({ x: 4, y: 7 });
  });

  it('morto ou na loja nao anda na previsao', () => {
    const world = guestWorld();
    world.player.shopping = true;
    steps(world, RIGHT, 0.2);
    expect(world.player.pos.x).toBe(3.5);
    world.player.shopping = false;
    world.player.hp = 0;
    steps(world, RIGHT, 0.2);
    expect(world.player.pos.x).toBe(3.5);
  });
});

describe('extrapolacao dos outros', () => {
  it('colega e inimigo seguem na velocidade em que vinham entre dois estados', () => {
    const world = guestWorld();
    const enemy = addEnemy(world, 8.5, 9.5, 0);
    const prediction = createPrediction();
    reconcile(world, prediction, 0);
    // proximo estado, 50 ms depois: host andou 0.2 para a direita, inimigo 0.1 para cima
    steps(world, IDLE, 0.05, prediction);
    world.players[0].pos = { x: 5.7, y: 2.5 };
    enemy.pos = { x: 8.5, y: 9.6 };
    reconcile(world, prediction, 0);

    steps(world, IDLE, 0.05, prediction);
    expect(world.players[0].pos.x).toBeCloseTo(5.9, 1);
    expect(enemy.pos.y).toBeCloseTo(9.7, 1);
  });

  it('sem estado novo, para de adiantar depois de um instante', () => {
    const world = guestWorld();
    const prediction = createPrediction();
    reconcile(world, prediction, 0);
    steps(world, IDLE, 0.05, prediction);
    world.players[0].pos = { x: 5.7, y: 2.5 };
    reconcile(world, prediction, 0);

    steps(world, IDLE, 1, prediction);
    // andou so durante a janela de extrapolacao, nao o segundo inteiro
    expect(world.players[0].pos.x).toBeLessThan(6.5);
  });

  it('teleporte (revive, puxao de sala) nao vira velocidade', () => {
    const world = guestWorld();
    const prediction = createPrediction();
    reconcile(world, prediction, 0);
    steps(world, IDLE, 0.05, prediction);
    world.players[0].pos = { x: 9.5, y: 11.5 };
    reconcile(world, prediction, 0);
    steps(world, IDLE, 0.05, prediction);
    expect(world.players[0].pos).toEqual({ x: 9.5, y: 11.5 });
  });

  it('bala continua voando na propria velocidade', () => {
    const world = guestWorld();
    spawnProjectile(
      world,
      'player',
      { x: 5.5, y: 3 },
      Math.PI / 2,
      PLAYER_BULLET_SPEED,
      10,
      8,
    );
    steps(world, IDLE, 0.1);
    expect(world.projectiles[0].pos.y).toBeCloseTo(
      3 + PLAYER_BULLET_SPEED * 0.1,
      1,
    );
  });
});
