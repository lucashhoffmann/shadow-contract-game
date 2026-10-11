// Contratos descritos em docs/contracts.md. Mudou aqui, muda la.

export type Vec2 = { x: number; y: number };

export type InputState = {
  moveX: number;
  moveY: number;
  dash: boolean;
  interact?: boolean;
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
  // segundos restantes do salto no ar
  dash: number;
  dashCooldown: number;
  // segundos entre saltos em alerta; 0 = nao salta
  dashEvery: number;
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

export type Pickup = {
  id: number;
  roomIndex: number;
  pos: Vec2;
  value: number;
};

export type WeaponId = 'pistol' | 'shotgun';

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
  attackCooldown: number;
  // segundos restantes do golpe de espada (so para animacao)
  slash: number;
  // segundos restantes do bonus de velocidade apos uma morte
  adrenaline: number;
  // segundos restantes do salto no ar
  dash: number;
  // segundos ate poder saltar de novo
  dashCooldown: number;
  weapon: { id: WeaponId; ammo: number } | null;
};

export type Run = {
  money: number;
  earned: number;
  roomIndex: number;
  kills: number;
  shops: number;
};

export type WorldStatus = 'intro' | 'playing' | 'paused' | 'shop' | 'dead';

export type World = {
  rngState: number;
  nextId: number;
  status: WorldStatus;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  props: Prop[];
  pickups: Pickup[];
  rooms: Room[];
  run: Run;
  market: Market;
};
