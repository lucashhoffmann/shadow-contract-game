# Contratos

Interfaces entre camadas. Fonte de verdade dos tipos:
`src/app/modules/world/types/world.types.ts`. Mudou la, muda aqui na mesma
mudanca.

## Coordenadas

- simulacao em 2D: `Vec2 { x, y }`, 1 unidade = 1 tile
- `x` de `0` a `ROOM_W` (11); `y` cresce para frente, sem limite
- sala `i` ocupa `y` de `i * ROOM_H` a `(i + 1) * ROOM_H` (`ROOM_H` = 13)
- `facing` em radianos, `atan2(dy, dx)`
- engine converte `(x, y)` para three como `(x, altura, -y)`

## `World`

```ts
type World = {
  rngState: number; // estado do mulberry32
  nextId: number; // gerador de id de entidade
  status: 'playing' | 'shop' | 'dead';
  player: Player;
  enemies: Enemy[];
  pickups: Pickup[];
  rooms: Room[]; // ordenadas por index, no maximo 3 vivas
  run: { money: number; roomIndex: number; kills: number };
};
```

Invariantes:

- so `stepWorld` e acoes do store mutam `World`
- `status !== 'playing'` congela a simulacao
- fora das salas vivas tudo e parede
- mesmo `seed` + mesma sequencia de input = mesmo `World`

## `InputState`

```ts
type InputState = { moveX: number; moveY: number }; // cada eixo em -1..1
```

`moveY = 1` anda para frente. Teclado e joystick somam no mesmo objeto; a
simulacao normaliza se o vetor passar de 1.

## `RoomTemplate`

```ts
type RoomTemplate = {
  id: string;
  kind: 'start' | 'combat' | 'shop';
  tiles: string[]; // ROOM_H linhas de ROOM_W caracteres
  enemies: { path: [col: number, row: number][] }[];
};
```

- linha `0` de `tiles` e o fundo da sala (saida); a ultima e a entrada
- `#` parede, `.` chao, `$` dinheiro, `S` zona de loja
- entrada e saida: colunas 4 a 6 abertas na ultima e na primeira linha
- sala `start` tem a ultima linha fechada
- todo waypoint de `path` cai em chao e alcanca o proximo
- `tests/level.test.ts` valida tudo isso para cada template

## `Enemy`

```ts
type EnemyState = 'patrol' | 'suspicious' | 'alert' | 'dead';
```

| De           | Para         | Quando                              |
| ------------ | ------------ | ----------------------------------- |
| `patrol`     | `suspicious` | player no cone, com linha de visao  |
| `suspicious` | `alert`      | `detection` chega a 1               |
| `suspicious` | `patrol`     | `detection` volta a 0               |
| `alert`      | `patrol`     | `ALERT_DURATION` sem linha de visao |
| qualquer     | `dead`       | `killEnemy`                         |

- `detection` sobe `dt / detectTime` vendo o player e cai `dt * DETECT_DECAY`
  sem ver
- `alert` enxerga em 360 graus, persegue por `findPath` e atira dentro de
  `FIRE_RANGE`

## Combate

- sem arma: mata no alcance `MELEE_RANGE` apenas inimigo que nao esta `alert`
- com arma: mata qualquer inimigo vivo no alcance e com linha de visao; cada
  disparo gasta 1 de municao; municao zerada remove a arma
- arma `area: true` mata todos os alvos no alcance
- inimigo morto solta `Pickup` de `KILL_MONEY`

## `ItemDef`

```ts
type ItemDef = {
  id: 'pistol' | 'shotgun' | 'armor';
  name: string;
  kind: 'weapon' | 'armor';
  price: number;
  range: number;
  ammo: number;
  area: boolean;
  bonusHp: number;
};
```

Equipamento vale so para a run atual; `startRun` cria `World` novo.

## Store (`useGameStore`)

Lido pela UI:

```ts
screen: 'menu' | 'playing' | 'shop' | 'gameover';
hud: {
  hp;
  maxHp;
  money;
  room;
  kills;
  weaponId;
  ammo;
}
best: number; // maior sala alcancada, persistido em localStorage
```

Acoes:

| Acao              | Quem chama | Efeito                                  |
| ----------------- | ---------- | --------------------------------------- |
| `startRun(seed?)` | UI         | cria `World`, `screen = 'playing'`      |
| `tick(input, dt)` | engine     | `stepWorld` e sincroniza `hud`/`screen` |
| `buy(itemId)`     | UI         | `buyItem` e sincroniza                  |
| `closeShop()`     | UI         | volta para `playing`                    |
| `backToMenu()`    | UI         | descarta `World`, `screen = 'menu'`     |

Fora do estado reativo:

- `getWorld()`: engine le o `World` atual para desenhar
- `setJoystickInput(x, y)` / `joystickInput`: joystick escreve, engine le

O store so chama `set` quando `hud` ou `screen` mudam, para a UI nao renderizar
a 60 Hz.

## Engine

```ts
function createGameEngine(canvas: HTMLCanvasElement): { dispose(): void };
```

- dono do loop `requestAnimationFrame`, do teclado e do `WebGLRenderer`
- a cada frame: acumula tempo, chama `tick` em passos de `FIXED_DT`, depois
  `renderer.sync(world)` e desenha
- nunca muta `World`
- `dispose` cancela o loop, remove listeners e libera geometrias e materiais
