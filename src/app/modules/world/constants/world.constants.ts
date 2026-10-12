import type {
  EnemyKind,
  EnemyStats,
} from '@/app/modules/world/types/world.types';

export const FIXED_DT = 1 / 60;

// sala
// Tamanho da sala, por modo. Solo 11x13; multiplayer 17x19, quase o dobro da
// area. Vale para a partida inteira: `createEmptyWorld` e `createMultiWorld`
// chamam `setRoomSize` antes de gerar a primeira sala.
// ponytail: tamanho global em vez de campo no World. So existe uma partida
// por processo (quem simula e o navegador do jogador); se um dia o servidor
// simular varias partidas, levar o tamanho para dentro do World.
export const ROOM_SIZES = { solo: [11, 13], multi: [17, 19] } as const;
export let ROOM_W: number = ROOM_SIZES.solo[0];
export let ROOM_H: number = ROOM_SIZES.solo[1];
export function setRoomSize(mode: keyof typeof ROOM_SIZES): void {
  [ROOM_W, ROOM_H] = ROOM_SIZES[mode];
}
export const ROOMS_AHEAD = 1;
export const ROOMS_BEHIND = 1;
// um contrato = SHOP_EVERY salas, a ultima e a loja
export const SHOP_EVERY = 5;

// player
export const PLAYER_RADIUS = 0.35;
export const PLAYER_SPEED = 4.5;
export const PLAYER_MAX_HP = 100;
export const IDLE_WARNING_DELAY = 10;
export const IDLE_WARNING_INTERVAL = 5;
export const IDLE_MAX_ENEMIES = 5;
export const MELEE_RANGE = 1.1;
export const ATTACK_COOLDOWN = 0.5;
export const PICKUP_RADIUS = 0.7;
// espada: executa desavisado; em alerta tira SWORD_DAMAGE por golpe
export const SWORD_DAMAGE = 30;
// overkill: execucao agachado e pelas costas. "Costas" e fora deste angulo
// para cada lado da direcao em que o inimigo olha
export const STEALTH_BACK_ANGLE = Math.PI / 2;
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
// saltos guardados: cada salto gasta um; so caixa quebrada repoe
export const DASH_MAX = 6;
// morto de um golpe so (vida cheia): o corpo voa na direcao do golpe,
// freando ate parar; parede segura
export const LAUNCH_TIME = 0.5;
export const LAUNCH_DISTANCE = 2.2;
// quem morre derruba o cenario em volta
export const PROP_BREAK_RADIUS = 1.5;
// distancia em que a porta de correr abre para quem pode passar
export const DOOR_RANGE = 2.4;
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
// Dano do inimigo cresce com o nivel (contrato): cada nivel alem do primeiro
// soma ENEMY_DAMAGE_PER_LEVEL do dano base. E nunca fica irrelevante contra
// quem empilhou vida: um golpe de ninja tira pelo menos ENEMY_DAMAGE_SHARE da
// vida maxima do alvo, fatia que sobe por nivel ate o teto. Tiro e shuriken
// valem a mesma regra, na proporcao do dano base deles.
export const ENEMY_DAMAGE_PER_LEVEL = 0.12;
export const ENEMY_DAMAGE_SHARE = 0.1;
export const ENEMY_DAMAGE_SHARE_PER_LEVEL = 0.01;
export const ENEMY_DAMAGE_SHARE_MAX = 0.4;
// Critico do inimigo: a partir do nivel (contrato) ENEMY_CRIT_FROM_LEVEL,
// cada golpe, tiro ou shuriken tem chance de sair critico e valer
// ENEMY_CRIT_MULT vezes. A chance comeca em ENEMY_CRIT_CHANCE e sobe por
// nivel, ate o teto.
export const ENEMY_CRIT_FROM_LEVEL = 4;
export const ENEMY_CRIT_CHANCE = 0.08;
export const ENEMY_CRIT_PER_LEVEL = 0.01;
export const ENEMY_CRIT_MAX = 0.3;
export const ENEMY_CRIT_MULT = 1.8;
// Furia: inimigo que ve um colega morto fica mais esperto ate morrer. Ouve
// de mais longe e precisa de menos para alertar, persegue mais rapido e por
// mais tempo, salta mais, enxerga mais longe e nota o player mais depressa.
// E vai conferir o corpo.
export const RAGE_HEARING = 1.35;
export const RAGE_THRESHOLD = 0.75;
export const RAGE_PURSUIT = 1.25;
export const RAGE_DASH = 1.25;
export const RAGE_VIEW = 1.5;
export const RAGE_DETECT = 0.6;
// Dupla: inimigos andam juntos desde a primeira sala. A primeira ronda de
// toda sala nasce com um parceiro; as outras, com chance BUDDY_CHANCE. O
// parceiro e do mesmo tipo e faz a mesma ronda, BUDDY_GAP ao lado. A sala
// nunca passa de ROOM_ENEMY_MAX inimigos.
export const BUDDY_CHANCE = 0.5;
export const BUDDY_GAP = 0.8;
export const ROOM_ENEMY_MAX = 12;
// Bando. Quem entra em alerta chama os colegas vivos a ate PACK_CALL_RADIUS
// (cresce por nivel, ate o teto); cada chamado chama tambem. Ninjas em alerta
// cercam: cada um vai para um ponto diferente do aro de raio PACK_RING em
// volta do alvo, e so de perto parte direto para o golpe.
export const PACK_CALL_RADIUS = 3.5;
export const PACK_CALL_PER_LEVEL = 0.4;
export const PACK_CALL_MAX = 9;
export const PACK_RING = 1.6;
// ja esta no proprio lado do alvo (diferenca de angulo, rad): vai ao golpe
export const PACK_ARRIVED = 0.5;
// Esquiva do ninja: bala do player vindo na direcao dele, a menos de
// NINJA_DODGE_RANGE, pode ser desviada com um salto de lado. A chance por
// bala cresce com a inteligencia de salto do nivel, ate o teto. A esquiva
// gasta parte da recarga do salto.
export const NINJA_DODGE_RANGE = 4;
export const NINJA_DODGE_CHANCE = 0.3;
export const NINJA_DODGE_MAX = 0.8;
export const NINJA_DODGE_COST = 0.6;
// tamanho do salto de esquiva, em tiles: curto, so para sair da linha
export const NINJA_DODGE_HOP = 1.8;
// bote do ninja: so salta se o salto alcanca o player, corrige o rumo no ar
// (rad/s) e, ao pousar colado, golpeia quase na hora
export const NINJA_DASH_TURN = 2.5;
export const NINJA_LUNGE_STRIKE = 0.15;
// shuriken: a partir desse nivel (contrato) o ninja em alerta arremessa de
// longe enquanto se aproxima
export const SHURIKEN_FROM_LEVEL = 10;
export const SHURIKEN_INTERVAL = 2.2;
// a primeira sai logo ao entrar em alerta: correndo, ele chega perto antes
// de uma recarga inteira
export const SHURIKEN_FIRST = 0.3;
export const SHURIKEN_SPEED = 9;
export const SHURIKEN_DAMAGE = 15;
export const SHURIKEN_RANGE = 6;
// de perto nao arremessa: parte para o golpe
export const SHURIKEN_MIN_GAP = 2;
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
// dano da bala cai com a distancia: cheio ate FALLOFF_START do alcance da
// arma, depois desce em linha ate FALLOFF_MIN no alcance maximo
export const FALLOFF_START = 0.4;
export const FALLOFF_MIN = 0.12;
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

// Inimigo morto: chance de sortear um item na mesma tabela das caixas (alem
// do dinheiro, que cai sempre). 0 = nunca solta item; 1 = sempre sorteia.
// Mesmo sorteando, a tabela ainda pode dar "nada", como numa caixa vazia.
export const ENEMY_LOOT_CHANCE = 0.35;
// distancia do corpo em que o item cai, para nao ficar em cima do dinheiro
export const ENEMY_LOOT_OFFSET = 0.45;

// caixa quebrada: chance de soltar coracao ou escudo (senao, nada).
// Valores em fracao de `maxHp`.
export const LOOT_HEART_CHANCE = 0.25;
export const LOOT_SHIELD_CHANCE = 0.2;
export const LOOT_DASH_CHANCE = 0.2;
// ficha de revive: rara. Guarda ate REVIVE_MAX; ao morrer gasta uma e
// renasce na entrada da sala com REVIVE_HP da vida maxima
export const LOOT_REVIVE_CHANCE = 0.015;
export const REVIVE_MAX = 3;
export const REVIVE_HP = 0.5;
// quantos saltos um item de salto repoe
export const DASH_LOOT_MIN = 1;
export const DASH_LOOT_MAX = 6;
// headshot: chance de cada bala do player dar dano multiplicado. Comeca em
// HEADSHOT_BASE; o item de mira (caixa, a partir do nivel HEADSHOT_FROM_LEVEL,
// com arma de fogo) soma pontos percentuais ate HEADSHOT_MAX
export const HEADSHOT_BASE = 0.1;
export const HEADSHOT_MAX = 0.5;
export const HEADSHOT_MULT = 2;
export const HEADSHOT_FROM_LEVEL = 3;
export const LOOT_HEADSHOT_CHANCE = 0.06;
export const HEADSHOT_LOOT_MIN = 3;
export const HEADSHOT_LOOT_MAX = 8;
// municao: so sai de caixa com o player armado
export const LOOT_AMMO_CHANCE = 0.15;
export const AMMO_LOOT_MIN = 4;
export const AMMO_LOOT_MAX = 12;
// coracao cura pouco na maioria das vezes (sorteio ao quadrado), ate 60%
export const HEART_MIN = 0.1;
export const HEART_MAX = 0.6;
// escudo: cada um da de 10% a 30%; o total nunca passa de 30%
export const SHIELD_MIN = 0.1;
export const SHIELD_MAX = 0.3;

// multiplayer: mais dificil que o solo, e mais quanto mais gente. Cada
// jogador alem do primeiro multiplica os inimigos da sala e adianta a
// dificuldade em MULTI_THREAT_ROOMS salas (visao, deteccao, saltos, ninjas,
// inteligencia)
export const MULTI_ENEMIES_PER_PLAYER = 0.6;
export const MULTI_THREAT_ROOMS = 4;

// economia: recompensa fixa por sala; quem sobe e o preco (shop.constants)
export const KILL_MONEY = 40;
export const TILE_MONEY = 25;
