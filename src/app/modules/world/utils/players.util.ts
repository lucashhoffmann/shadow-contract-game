import type {
  Player,
  Vec2,
  World,
} from '@/app/modules/world/types/world.types';
import {
  MULTI_ENEMIES_PER_PLAYER,
  MULTI_THREAT_ROOMS,
} from '@/app/modules/world/constants/world.constants';
import { distance } from 'three-hex-engine/kit';

// Varios jogadores sobre sistemas escritos para um: os sistemas leem
// `world.player`, e quem chama aponta esse campo para o jogador da vez.
// ponytail: foco trocado em vez de passar `player` em toda funcao. Serve
// enquanto o passo for sequencial; se algum sistema precisar de dois
// jogadores ao mesmo tempo, passar o jogador por parametro nele.

export function alivePlayers(world: World): Player[] {
  return world.players.filter((player) => player.hp > 0);
}

// vivo mais perto de `pos`; undefined se todos morreram. Invisivel so e
// escolhido se nao sobrou ninguem a vista
export function nearestPlayer(world: World, pos: Vec2): Player | undefined {
  const alive = alivePlayers(world);
  const seen = alive.filter((player) => player.invisible <= 0);
  let nearest: Player | undefined;
  for (const player of seen.length ? seen : alive) {
    if (!nearest || distance(player.pos, pos) < distance(nearest.pos, pos)) {
      nearest = player;
    }
  }
  return nearest;
}

// roda `act` com `player` em foco e devolve o foco a quem estava
export function asPlayer<T>(world: World, player: Player, act: () => T): T {
  const focus = world.player;
  world.player = player;
  try {
    return act();
  } finally {
    world.player = focus;
  }
}

// quantas salas a dificuldade esta adiantada em relacao ao solo
export function threatBoost(world: World): number {
  return world.mode === 'multi'
    ? (world.players.length - 1) * MULTI_THREAT_ROOMS
    : 0;
}

// por quanto multiplicar os inimigos da sala
export function enemyMultiplier(world: World): number {
  return world.mode === 'multi'
    ? 1 + (world.players.length - 1) * MULTI_ENEMIES_PER_PLAYER
    : 1;
}
