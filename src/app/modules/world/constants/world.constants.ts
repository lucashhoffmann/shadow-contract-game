import type {
  EnemyKind,
  EnemyStats,
} from '@/app/modules/world/types/world.types';

export const FIXED_DT = 1 / 60;

// sala
export const ROOM_W = 11;
export const ROOM_H = 13;
export const ROOMS_AHEAD = 1;
export const ROOMS_BEHIND = 1;
// um contrato = SHOP_EVERY salas, a ultima e a loja
export const SHOP_EVERY = 5;

// player
export const PLAYER_RADIUS = 0.35;
export const PLAYER_SPEED = 4.5;
export const PLAYER_MAX_HP = 100;
export const MELEE_RANGE = 1.1;
export const ATTACK_COOLDOWN = 0.5;
export const PICKUP_RADIUS = 0.7;
// espada: executa desavisado; em alerta tira SWORD_DAMAGE por golpe
export const SWORD_DAMAGE = 30;
export const MELEE_MISS_INTERVAL = 5;
export const MELEE_MISS_PEAK_RATE = 0.25;
export const MELEE_MISS_BASE = 0.1;
export const MELEE_MISS_BASE_SWING = 0.2;
export const MELEE_MISS_PEAK_BASE = 0.45;
export const MELEE_MISS_PEAK_SWING = 0.25;
export const SLASH_TIME = 0.36;
// quanto tempo o numero de dano (ou "Errou!") fica no ar
export const FLOATER_TIME = 0.9;
// erros seguidos nesse intervalo viram um so aviso (ex.: chumbo da escopeta)
export const FLOATER_MISS_GAP = 0.25;
// duracao do recuo da arma de fogo depois do tiro (so animacao)
export const SHOT_TIME = 0.22;
// adrenalina: bonus de velocidade apos cada morte
export const ADRENALINE_TIME = 1.5;
export const ADRENALINE_BOOST = 1.35;
// salto de esquiva: avanca reto para onde olha, sem controle no ar
export const DASH_TIME = 0.4;
export const DASH_SPEED = 9;
export const DASH_COOLDOWN = 0.9;
// quem morre derruba o cenario em volta
export const PROP_BREAK_RADIUS = 1.5;
// distancia do centro do bau em que a tecla B abre a loja
export const CHEST_RANGE = 1.4;

// inimigo
export const ENEMY_RADIUS = 0.35;
export const ENEMY_KINDS: Record<EnemyKind, EnemyStats> = {
  // atira de longe, aguenta dois tiros
  suit: {
    hp: 60,
    patrolSpeed: 1.6,
    chaseSpeed: 2.4,
    viewRange: 5,
    ranged: true,
  },
  // corre e ataca de perto
  ninja: {
    hp: 60,
    patrolSpeed: 2,
    chaseSpeed: 3.6,
    viewRange: 3.8,
    ranged: false,
  },
};
export const NINJA_FROM_ROOM = 2;
export const NINJA_CHANCE = 0.4;
export const NINJA_REACH = 0.9;
export const NINJA_DAMAGE = 25;
export const VIEW_HALF_ANGLE = Math.PI / 5;
export const DETECT_TIME = 0.6;
export const DETECT_DECAY = 0.5;
export const ALERT_DURATION = 4;
export const REPATH_INTERVAL = 0.3;
export const WAYPOINT_REACH = 0.15;
export const FIRE_RANGE = 6;
export const FIRE_DELAY = 0.5;
export const FIRE_INTERVAL = 0.8;

// balas
export const BULLET_RADIUS = 0.12;
export const PLAYER_BULLET_SPEED = 12;
export const PLAYER_BULLET_DAMAGE = 30;
export const ENEMY_BULLET_SPEED = 8;
export const ENEMY_BULLET_DAMAGE = 20;
// a bala voa um pouco alem do alcance de mira
export const BULLET_RANGE_MARGIN = 1.2;

// dificuldade por indice de sala
export const ROOMS_PER_EXTRA_ENEMY = 3;
export const VIEW_RANGE_PER_ROOM = 0.1;
export const VIEW_RANGE_MAX_BONUS = 2;
export const DETECT_TIME_PER_ROOM = 0.02;
export const DETECT_TIME_MIN = 0.3;
// inimigo em alerta salta como o player: mais vezes a cada sala
export const ENEMY_DASH_FROM_ROOM = 2;
export const ENEMY_DASH_INTERVAL = 4;
export const ENEMY_DASH_PER_ROOM = 0.25;
export const ENEMY_DASH_MIN_INTERVAL = 1.2;

// percepcao de perto: a menos disso o inimigo nota o player mesmo fora do
// cone (ainda precisa de linha de visao). Cresce por contrato, com teto:
// acima dele nao daria tempo de chegar para o golpe furtivo.
export const SENSE_RANGE = 1.5;
export const SENSE_PER_CONTRACT = 0.25;
export const SENSE_MAX_BONUS = 1;

// audicao: raio do barulho de andar e de saltar. O inimigo ouve mais rapido
// quanto mais perto; colado levaria HEAR_TIME. Fora do raio nao ouve nada:
// e a folga que deixa chegar por tras andando.
// parado ainda se ouve de bem perto (presenca), devagar
export const NOISE_IDLE = 2;
export const NOISE_WALK = 3;
export const NOISE_DASH = 5;
// tiro sem silenciador: todo inimigo nesse raio ouve na hora
export const NOISE_SHOT = 8;
// agachado: fracao da velocidade e do raio de barulho. O ouvido do inimigo
// para antes do amarelo (HEARING_YELLOW): nota, mas nao entra em alerta
export const CROUCH_SPEED = 0.5;
export const CROUCH_NOISE = 0.5;
export const HEAR_TIME = 0.5;
export const HEARING_YELLOW = 0.4;
// ouvido afina por sala: raio cresce ate +HEAR_MAX_BONUS (fracao)
export const HEAR_PER_ROOM = 0.05;
export const HEAR_MAX_BONUS = 0.5;
// quanto tempo investiga o barulho antes de voltar a patrulha
export const SEARCH_TIME = 4;

// caixa quebrada: chance de soltar coracao ou escudo (senao, nada).
// Valores em fracao de `maxHp`.
export const LOOT_HEART_CHANCE = 0.25;
export const LOOT_SHIELD_CHANCE = 0.2;
// coracao cura pouco na maioria das vezes (sorteio ao quadrado), ate 60%
export const HEART_MIN = 0.1;
export const HEART_MAX = 0.6;
// escudo: cada um da de 10% a 30%; o total nunca passa de 30%
export const SHIELD_MIN = 0.1;
export const SHIELD_MAX = 0.3;

// economia: recompensa fixa por sala; quem sobe e o preco (shop.constants)
export const KILL_MONEY = 40;
export const TILE_MONEY = 25;
