// Contratos descritos em docs/contracts.md. Mudou aqui, muda la.

export type Vec2 = { x: number; y: number };

export type InputState = {
  moveX: number;
  moveY: number;
  dash: boolean;
  // segurando Ctrl ou C: anda agachado
  crouch?: boolean;
  interact?: boolean;
  // pulso da tecla B: abre o bau ao alcance
  open?: boolean;
  // Pulsos so do multiplayer: o que no solo e acao direta do store viaja
  // aqui, junto do input, para o host aplicar no jogador certo.
  // comprar na loja aberta
  buy?: ItemId;
  // fechar a loja ou a escolha do bau de revive
  leaveShop?: boolean;
  // `player.id` de quem reviver no bau de revive
  revive?: number;
  // trocar de arma: uma do arsenal, 'sword', ou 'next' para a proxima
  select?: WeaponId | 'sword' | 'next';
};

export type RoomKind = 'start' | 'combat' | 'shop';

export type RoomTemplate = {
  id: string;
  kind: RoomKind;
  tiles: string[];
  enemies: { path: [col: number, row: number][] }[];
};

export type Room = {
  index: number;
  templateId: string;
  kind: RoomKind;
  tiles: string[];
  // centro do bau da loja (tile 'C'); null = sala sem bau
  chest: Vec2 | null;
  // ja abriu o bau: os precos desta sala ja foram sorteados
  shopVisited: boolean;
  // multiplayer: centro do bau de revive (tile 'R'); null = sala sem ele
  reviveChest: Vec2 | null;
  // o bau ainda tem o revive gratis (para o grupo sem ficha nao travar)
  reviveFree: boolean;
};

// 'fat': gordo de escopeta, raro, sempre em dupla; tambem guarda bau
export type EnemyKind = 'ninja' | 'suit' | 'fat';

export type EnemyStats = {
  hp: number;
  patrolSpeed: number;
  chaseSpeed: number;
  viewRange: number;
  ranged: boolean;
};

export type EnemyState = 'patrol' | 'suspicious' | 'alert' | 'dead';

export type EnemyIntelligence = {
  hearing: number;
  hearingThreshold: number;
  pursuit: number;
  dash: number;
};

export type AttackVariance = { min: number; max: number };

export type Enemy = {
  id: number;
  kind: EnemyKind;
  roomIndex: number;
  pos: Vec2;
  facing: number;
  hp: number;
  state: EnemyState;
  detection: number;
  patrol: Vec2[];
  waypoint: number;
  route: Vec2[];
  repathTimer: number;
  alertTimer: number;
  fireCooldown: number;
  // segundos restantes da pose de ataque; nao altera dano nem alcance
  attack: number;
  viewRange: number;
  detectTime: number;
  intelligence: EnemyIntelligence;
  // segundos restantes do salto no ar
  dash: number;
  dashCooldown: number;
  // segundos entre saltos em alerta; 0 = nao salta
  dashEvery: number;
  // morto de um golpe so: segundos restantes do voo para frente; 0 = parado
  launch: number;
  // segundos ate o ninja poder arremessar outra shuriken
  throwCooldown: number;
  // o salto em curso e esquiva de bala (de lado), nao bote para cima do
  // player: nao corrige o rumo nem golpeia ao pousar
  evading: boolean;
  // viu um colega morto: fica mais esperto pelo resto da vida (enemy.system)
  enraged: boolean;
  // 0..1: quanto ja ouviu do player; cheio, vai investigar
  hearing: number;
  // onde ouviu o player; null = nada a investigar
  heard: Vec2 | null;
  // segundos restantes da investigacao
  searchTimer: number;
};

export type Projectile = {
  id: number;
  owner: 'player' | 'enemy';
  // arma que disparou: so muda o modelo da bala
  weapon: WeaponId;
  pos: Vec2;
  vel: Vec2;
  damage: number;
  life: number;
  // alcance da arma e distancia ja percorrida: o dano cai com a distancia
  range: number;
  travelled: number;
  // id do inimigo que atirou: o aviso de dano ou erro sobe sobre ele
  shooter?: number;
  // `player.id` de quem atirou: a morte conta para ele
  by?: number;
  // estrela arremessada por ninja: so muda o modelo
  shuriken?: boolean;
  // tiro ou shuriken de inimigo que saiu critico: `damage` ja vem
  // multiplicado
  critical?: boolean;
  // bala do player que saiu como headshot: `damage` ja vem multiplicado
  headshot?: boolean;
};

// objeto de cenario destrutivel; ocupa um tile ('o') enquanto inteiro
export type Prop = {
  id: number;
  roomIndex: number;
  pos: Vec2;
  broken: boolean;
  // bau dourado: raro, solta premio proprio em vez da tabela das caixas
  golden?: boolean;
};

// dinheiro, coracao (cura), escudo, salto ou municao; os quatro ultimos saem
// de caixa quebrada
export type PickupKind =
  | 'money'
  | 'heart'
  | 'shield'
  | 'dash'
  | 'ammo'
  // mira: soma pontos percentuais na chance de headshot
  | 'headshot'
  // ficha de revive (cruz): guardada na run, gasta ao morrer
  | 'revive'
  // so saem do bau dourado. `value` segundos sem ser visto nem ouvido
  | 'invisibility'
  // `value` segundos sem levar dano
  | 'invincibility';

export type Pickup = {
  id: number;
  kind: PickupKind;
  roomIndex: number;
  pos: Vec2;
  // dinheiro, pontos de vida, pontos de escudo, saltos ou balas, conforme
  // `kind`
  value: number;
};

// 'silenced' e a pistola com silenciador
export type WeaponId = 'pistol' | 'silenced' | 'shotgun';

// 'dash' repoe os saltos guardados
export type ItemId = WeaponId | 'armor' | 'dash';

export type ItemDef = {
  id: ItemId;
  kind: 'weapon' | 'armor' | 'dash';
  price: number;
  // dano base de cada bala, antes do sorteio e da distancia
  damage: number;
  range: number;
  ammo: number;
  pellets: number;
  spread: number;
  bonusHp: number;
};

export type Market = {
  inflation: number;
  prices: Record<ItemId, number>;
};

export type Weapon = { id: WeaponId; ammo: number };

export type Player = {
  // posicao em `world.players`
  id: number;
  // multiplayer: nome sobre a cabeca e cor do jogador; solo: '' e null
  name: string;
  color: string | null;
  // carteira: cada jogador pega e gasta o proprio dinheiro
  money: number;
  // multiplayer: esta com a loja aberta, ou escolhendo quem reviver no bau.
  // Parado enquanto isso; o jogo dos outros continua
  shopping: boolean;
  reviving: boolean;
  // placar: inimigos que matou e vezes que morreu nesta partida
  kills: number;
  deaths: number;
  // sequencia de mortes seguidas (cada uma a menos de STREAK_WINDOW da
  // anterior), de 0 a STREAK_MAX, e quando foi a ultima (`run.seconds`)
  streak: number;
  lastKillAt: number;
  pos: Vec2;
  facing: number;
  hp: number;
  maxHp: number;
  // pontos que absorvem dano antes da vida; teto de SHIELD_MAX * maxHp
  shield: number;
  attackCooldown: number;
  // segundos restantes do golpe de espada (so para animacao)
  slash: number;
  // segundos restantes do recuo do ultimo tiro (so para animacao)
  shot: number;
  // segundos restantes do bonus de velocidade apos uma morte
  adrenaline: number;
  // segundos restantes de invisibilidade: inimigo nao ve nem ouve
  invisible: number;
  // duracao cheia da invisibilidade em curso: o HUD mostra o que falta dela
  invisibleTotal: number;
  // segundos restantes de invencibilidade: nenhum dano entra
  invincible: number;
  invincibleTotal: number;
  // segundos restantes do salto no ar
  dash: number;
  // segundos ate poder saltar de novo
  dashCooldown: number;
  // saltos guardados, de 0 a DASH_MAX
  dashes: number;
  // raio do barulho feito neste passo (parado, andando, saltando)
  noise: number;
  // agachado neste passo: mais lento, menos barulho e so e ouvido ate o
  // nivel branco
  crouching: boolean;
  // chance (0 a 1) de cada bala disparada ser headshot
  headshot: number;
  // arma de fogo na mao; null = espada. Sem bala continua na mao, so nao
  // atira
  weapon: Weapon | null;
  // armas de fogo que o player tem nesta run, na ordem em que comprou;
  // `weapon`, quando nao e null, e uma delas
  arsenal: Weapon[];
};

export type Run = {
  // total coletado pelo grupo (a carteira de cada um e `player.money`)
  earned: number;
  roomIndex: number;
  kills: number;
  shops: number;
  // fichas de revive guardadas, de 0 a REVIVE_MAX
  revives: number;
  // onde o player renasce: o ponto em que entrou na sala atual
  checkpoint: Vec2;
  seconds: number;
  lastMovedAt: number;
  lastIdleWarningAt: number;
  idleWarnings: number;
  attackVariance: AttackVariance;
  meleeMissChance: number;
  nextMeleeChanceAt: number;
  stats: {
    meleeAttempts: number;
    meleeHits: number;
    damageDealt: number;
    projectilesFired: number;
    projectilesHit: number;
    damageTaken: number;
    damageBlocked: number;
    healthRecovered: number;
  };
  events: { at: number; text: string; en?: string }[];
};

// solo: um jogador, regras de `stepWorld`. multi: ate 4, `stepMultiWorld`
export type WorldMode = 'solo' | 'multi';

export type WorldStatus = 'intro' | 'playing' | 'paused' | 'shop' | 'dead';

// texto que sobe do ponto do golpe: dano causado ou sofrido, ou "Errou!".
// So visual
export type Floater = {
  id: number;
  pos: Vec2;
  // pontos de dano; 0 = errou
  amount: number;
  // golpe do inimigo contra o player, mostrado sobre o inimigo que bateu
  // (senao, golpe do player, sobre o inimigo que apanhou)
  onPlayer?: boolean;
  // tiro do player que foi headshot
  headshot?: boolean;
  // execucao furtiva: agachado e pelas costas
  overkill?: boolean;
  // golpe critico do inimigo contra o player
  critical?: boolean;
  // golpe que bateu em player invencivel: `amount` 0, texto proprio
  blocked?: boolean;
  // segundos desde que apareceu; some em FLOATER_TIME
  age: number;
};

export type World = {
  rngState: number;
  nextId: number;
  status: WorldStatus;
  mode: WorldMode;
  // todos os jogadores, vivos ou mortos (`hp <= 0`); solo tem um so
  players: Player[];
  // Jogador em foco, sempre um de `players`. Fora do passo e o jogador local
  // (o que a camera e o HUD seguem). Durante o passo e quem esta agindo ou
  // sendo alvo no momento (ver players.util): os sistemas leem `world.player`
  // e servem para um ou varios jogadores sem mudar.
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  props: Prop[];
  pickups: Pickup[];
  floaters: Floater[];
  rooms: Room[];
  run: Run;
  market: Market;
  intelligence: Record<number, EnemyIntelligence>;
};
