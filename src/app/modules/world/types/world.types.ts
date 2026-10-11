// Contratos descritos em docs/contracts.md. Mudou aqui, muda la.

export type Vec2 = { x: number; y: number };

export type InputState = { moveX: number; moveY: number };

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

export type EnemyState = 'patrol' | 'suspicious' | 'alert' | 'dead';

export type Enemy = {
  id: number;
  roomIndex: number;
  pos: Vec2;
  facing: number;
  state: EnemyState;
  detection: number;
  patrol: Vec2[];
  waypoint: number;
  route: Vec2[];
  repathTimer: number;
  alertTimer: number;
  fireCooldown: number;
  viewRange: number;
  detectTime: number;
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
  area: boolean;
  bonusHp: number;
};

export type Player = {
  pos: Vec2;
  facing: number;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  weapon: { id: WeaponId; ammo: number } | null;
};

export type Run = { money: number; roomIndex: number; kills: number };

export type WorldStatus = 'playing' | 'shop' | 'dead';

export type World = {
  rngState: number;
  nextId: number;
  status: WorldStatus;
  player: Player;
  enemies: Enemy[];
  pickups: Pickup[];
  rooms: Room[];
  run: Run;
};
