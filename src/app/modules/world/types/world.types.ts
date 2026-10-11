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
};

export type EnemyKind = 'ninja' | 'suit';

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
};

// objeto de cenario destrutivel; ocupa um tile ('o') enquanto inteiro
export type Prop = {
  id: number;
  roomIndex: number;
  pos: Vec2;
  broken: boolean;
};

// dinheiro, coracao (cura) ou escudo; os dois ultimos saem de caixa quebrada
export type PickupKind = 'money' | 'heart' | 'shield';

export type Pickup = {
  id: number;
  kind: PickupKind;
  roomIndex: number;
  pos: Vec2;
  // dinheiro, pontos de vida ou pontos de escudo, conforme `kind`
  value: number;
};

// 'silenced' e a pistola com silenciador
export type WeaponId = 'pistol' | 'silenced' | 'shotgun';

export type ItemId = WeaponId | 'armor';

export type ItemDef = {
  id: ItemId;
  name: string;
  kind: 'weapon' | 'armor';
  price: number;
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

export type Player = {
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
  // segundos restantes do salto no ar
  dash: number;
  // segundos ate poder saltar de novo
  dashCooldown: number;
  // raio do barulho feito neste passo (parado, andando, saltando)
  noise: number;
  // agachado neste passo: mais lento, menos barulho e so e ouvido ate o
  // nivel branco
  crouching: boolean;
  weapon: { id: WeaponId; ammo: number } | null;
};

export type Run = {
  money: number;
  earned: number;
  roomIndex: number;
  kills: number;
  shops: number;
  seconds: number;
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
  events: { at: number; text: string }[];
};

export type WorldStatus = 'intro' | 'playing' | 'paused' | 'shop' | 'dead';

// texto que sobe do ponto do golpe: dano causado, ou "Errou!". So visual
export type Floater = {
  id: number;
  pos: Vec2;
  // pontos de dano; 0 = errou
  amount: number;
  // segundos desde que apareceu; some em FLOATER_TIME
  age: number;
};

export type World = {
  rngState: number;
  nextId: number;
  status: WorldStatus;
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
