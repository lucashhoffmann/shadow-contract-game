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
export const SWORD_DAMAGE = 1;
export const SLASH_TIME = 0.25;
// adrenalina: bonus de velocidade apos cada morte
export const ADRENALINE_TIME = 1.5;
export const ADRENALINE_BOOST = 1.35;
// salto de esquiva: avanca reto para onde olha, sem controle no ar
export const DASH_TIME = 0.4;
export const DASH_SPEED = 9;
export const DASH_COOLDOWN = 0.9;
// quem morre derruba o cenario em volta
export const PROP_BREAK_RADIUS = 1.5;

// inimigo
export const ENEMY_RADIUS = 0.35;
export const ENEMY_KINDS: Record<EnemyKind, EnemyStats> = {
  // atira de longe, aguenta dois tiros
  suit: {
    hp: 2,
    patrolSpeed: 1.6,
    chaseSpeed: 2.4,
    viewRange: 5,
    ranged: true,
  },
  // corre e ataca de perto
  ninja: {
    hp: 2,
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
export const PLAYER_BULLET_DAMAGE = 1;
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

// economia: recompensa fixa por sala; quem sobe e o preco (shop.constants)
export const KILL_MONEY = 40;
export const TILE_MONEY = 25;
