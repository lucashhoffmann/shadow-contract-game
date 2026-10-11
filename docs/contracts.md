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
  status: 'intro' | 'playing' | 'paused' | 'shop' | 'dead';
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  props: Prop[];
  pickups: Pickup[];
  rooms: Room[]; // ordenadas por index, no maximo 3 vivas
  run: { money; earned; roomIndex; kills; shops };
  market: Market;
};
```

Invariantes:

- so `stepWorld` e acoes do store mutam `World`
- `status !== 'playing'` congela a simulacao
- fora das salas vivas tudo e parede
- mesmo `seed` + mesma sequencia de input = mesmo `World`
- `market` e trocado por um objeto novo a cada mudanca (o store compara por
  referencia)

Transicoes de `status`:

| De        | Para      | Quem                                 |
| --------- | --------- | ------------------------------------ |
| `intro`   | `playing` | `beginRun` (botao Comecar ou Enter)  |
| `playing` | `paused`  | `togglePause` (tecla P)              |
| `paused`  | `playing` | `togglePause`                        |
| `playing` | `shop`    | `updateShopTrigger` ao pisar na zona |
| `shop`    | `playing` | `closeShop`                          |
| `playing` | `dead`    | `stepWorld` quando `player.hp <= 0`  |

`createWorld` devolve `playing`; quem poe `intro` e o store em `startRun`.

## `InputState`

```ts
type InputState = { moveX: number; moveY: number; dash: boolean }; // cada eixo em -1..1
```

`moveY = 1` anda para frente. Teclado e joystick somam no mesmo objeto; a
simulacao normaliza se o vetor passar de 1.

`dash` (espaco) dispara o salto de esquiva: `DASH_TIME` segundos a `DASH_SPEED`
em linha reta, para onde o input aponta ou, sem input, para `facing`. No ar o
input de movimento e ignorado; parede e caixa param o salto como param o andar.
So repete depois de `DASH_COOLDOWN`. Ainda e so movimento: nao da
invulnerabilidade nem passa por cima de nada. `player.dash` conta o tempo no
ar; a engine usa para animar a cambalhota e o vento.

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
- `#` parede, `.` chao, `$` dinheiro, `S` zona de loja, `o` caixa destrutivel
- nenhum waypoint de patrulha cai em caixa
- entrada e saida: colunas 4 a 6 abertas na ultima e na primeira linha
- sala `start` tem a ultima linha fechada
- todo waypoint de `path` cai em chao e alcanca o proximo
- `tests/level.test.ts` valida tudo isso para cada template

Um contrato sao `SHOP_EVERY` salas; a ultima e sempre a loja.

## `Enemy`

```ts
type EnemyKind = 'ninja' | 'suit';
type EnemyState = 'patrol' | 'suspicious' | 'alert' | 'dead';
```

Tipos (numeros em `ENEMY_KINDS`):

| Tipo    | Vida | Em alerta                                          |
| ------- | ---- | -------------------------------------------------- |
| `suit`  | 2    | para dentro de `FIRE_RANGE` e dispara `Projectile` |
| `ninja` | 1    | corre ate `NINJA_REACH` e golpeia, sem bala        |

`ninja` so aparece a partir da sala `NINJA_FROM_ROOM`.

Estados:

| De           | Para         | Quando                              |
| ------------ | ------------ | ----------------------------------- |
| `patrol`     | `suspicious` | player no cone, com linha de visao  |
| `suspicious` | `alert`      | `detection` chega a 1               |
| `suspicious` | `patrol`     | `detection` volta a 0               |
| `alert`      | `patrol`     | `ALERT_DURATION` sem linha de visao |
| qualquer     | `dead`       | `killEnemy`                         |

- `detection` sobe `dt / detectTime` vendo o player e cai `dt * DETECT_DECAY`
  sem ver
- levar tiro e sobreviver poe `detection = 1`: alerta no passo seguinte
- `alert` enxerga em 360 graus e persegue por `findPath`
- a partir da sala `ENEMY_DASH_FROM_ROOM`, `alert` com linha de visao salta
  igual ao player (`DASH_TIME` a `DASH_SPEED`, para na parede) a cada
  `dashEvery` segundos. `dashEvery` e fixado ao nascer: comeca em
  `ENEMY_DASH_INTERVAL` e cai `ENEMY_DASH_PER_ROOM` por sala, ate
  `ENEMY_DASH_MIN_INTERVAL`; `0` = nao salta
  - fora do alcance de ataque: salta na direcao do player; `ninja` pousa ao
    chegar em `NINJA_REACH`
  - `suit` ja no alcance de tiro: salta de lado (lado sorteado por `rngState`)
  - no ar nao atira nem golpeia; `enemy.dash` conta o tempo no ar, para a
    engine animar

## `Projectile`

```ts
type Projectile = {
  id: number;
  owner: 'player' | 'enemy';
  weapon: WeaponId; // arma que disparou: so muda o modelo da bala
  pos: Vec2;
  vel: Vec2; // unidades por segundo
  damage: number;
  life: number; // segundos restantes
};
```

`updateProjectiles`, a cada passo:

- anda `vel * dt` e desconta `life`
- some se `life <= 0` ou se entrou em parede
- `owner: 'enemy'`: contato com o player (`PLAYER_RADIUS + BULLET_RADIUS`)
  tira `damage` de `hp` e a bala some
- `owner: 'player'`: contato com inimigo vivo chama `damageEnemy` e a bala some
- bala de inimigo nao fere inimigo

Velocidade por passo fica abaixo do diametro de colisao, entao nao atravessa
personagem.

## `Prop` (cenario destrutivel)

```ts
type Prop = { id: number; roomIndex: number; pos: Vec2; broken: boolean };
```

- nasce de cada tile `o` do template; a sala guarda copia propria de `tiles`
- inteira: bloqueia passagem, caminho (`findPath`) e bala; nao bloqueia visao
  nem mira
- quebra quando uma bala (de qualquer dono) entra no tile, ou quando alguem
  morre a ate `PROP_BREAK_RADIUS`
- quebrar troca o tile por `.` e marca `broken`; a engine desenha destrocos
- some junto com a sala

## Combate do player

O player comeca com a espada e nunca a perde.

- encostado (`MELEE_RANGE`) em alguem, com ou sem arma de fogo: golpe de
  espada, sem gastar municao
  - inimigo que nao esta `alert`: morre na hora
  - inimigo `alert`: leva `SWORD_DAMAGE`
- senao, com arma de fogo: mira no inimigo vivo mais proximo dentro de `range`
  e com linha de visao, dispara `pellets` balas abertas em `spread` radianos,
  gasta 1 de municao; municao zerada remove a arma
- inimigo morto solta `Pickup` de `KILL_MONEY`
- cada morte da `ADRENALINE_TIME` segundos de velocidade multiplicada por
  `ADRENALINE_BOOST`
- `player.slash` conta o tempo do golpe; so a engine usa, para animar

## `ItemDef`

```ts
type ItemDef = {
  id: 'pistol' | 'shotgun' | 'armor';
  name: string;
  kind: 'weapon' | 'armor';
  price: number; // preco base
  range: number;
  ammo: number;
  pellets: number;
  spread: number;
  bonusHp: number;
};
```

Equipamento vale so para a run atual; `startRun` cria `World` novo.

## Economia (`Market`)

```ts
type Market = { inflation: number; prices: Record<ItemId, number> };
```

O preco cobrado e sempre `world.market.prices[id]`, nunca `ItemDef.price`.

- entrada de dinheiro: `KILL_MONEY` por inimigo e `TILE_MONEY` por nota no
  chao. Valores fixos: a recompensa nao cresce com a sala
- `run.earned` soma tudo o que foi coletado; `run.shops` conta lojas abertas
- `rollMarket`, ao abrir cada loja:
  - inflacao: `min(MAX_INFLATION, 1 + INFLATION_PER_SHOP * run.shops)`. A
    primeira loja tem indice 1
  - instabilidade: cada item recebe `base * inflacao * (1 +- PRICE_VOLATILITY)`,
    sorteado pelo rng do `World`, arredondado a `PRICE_STEP`
- demanda: comprar um item multiplica o preco dele por `DEMAND_MARKUP` ate a
  proxima loja
- teto garantido por teste: nenhum preco passa de
  `base * MAX_INFLATION * (1 + PRICE_VOLATILITY)`

Numeros em `shop.constants.ts`.

## Store (`useGameStore`)

Lido pela UI:

```ts
screen: 'menu' |
  'character' |
  'intro' |
  'playing' |
  'paused' |
  'shop' |
  'gameover';
hud: {
  hp;
  maxHp;
  money;
  room;
  kills;
  weaponId;
  ammo;
}
market: Market;
best: number; // maior sala alcancada, persistido em localStorage
look: PlayerLook; // aparencia do player, persistida em localStorage
```

```ts
type PlayerLook = {
  cloth: string; // cores em '#rrggbb'
  accent: string;
  skin: string;
  head: number; // escalas de LOOK_SCALE.min a LOOK_SCALE.max, 1 = padrao
  legs: number;
  hands: number;
};
```

`look` e so visual: nao entra no `World` nem muda colisao. A engine le uma vez,
ao criar o renderer; por isso `setLook` so vale antes da run (telas `menu` e
`character`).

Acoes:

| Acao              | Quem chama | Efeito                                  |
| ----------------- | ---------- | --------------------------------------- |
| `startRun(seed?)` | UI         | cria `World` em `intro`                 |
| `begin()`         | UI, engine | `intro` -> `playing`                    |
| `togglePause()`   | UI, engine | `playing` <-> `paused`                  |
| `tick(input, dt)` | engine     | `stepWorld` e sincroniza `hud`/`screen` |
| `buy(itemId)`     | UI         | `buyItem` e sincroniza                  |
| `closeShop()`     | UI         | volta para `playing`                    |
| `backToMenu()`    | UI         | descarta `World`, `screen = 'menu'`     |
| `openCharacter()` | UI (menu)  | `screen = 'character'`; em run, nada    |
| `setLook(patch)`  | UI         | valida e grava `look`; em run, nada     |

Fora do estado reativo:

- `getWorld()`: engine le o `World` atual para desenhar
- `setJoystickInput(x, y)` / `joystickInput`: joystick escreve, engine le

O store so chama `set` quando `hud`, `screen` ou `market` mudam, para a UI nao
renderizar a 60 Hz.

A barra de contrato do HUD e derivada de `hud.room` e `SHOP_EVERY`; nao tem
campo proprio.

## Engine

```ts
function createGameEngine(canvas: HTMLCanvasElement): { dispose(): void };
```

- dono do loop `requestAnimationFrame`, do teclado e do `WebGLRenderer`
- a cada frame: acumula tempo, chama `tick` em passos de `FIXED_DT`, depois
  `renderer.sync(world)` e desenha (inclusive em `intro` e `paused`)
- teclas: WASD/setas movem, `P` chama `togglePause`, `Enter` chama `begin`
- nunca muta `World`
- animacao so visual, derivada do `World` a cada frame: inclinar ao andar,
  cabeca olhando para os lados quando parado, golpe de espada, zoom com blur
  quando `run.kills` sobe
- `dispose` cancela o loop, remove listeners e libera geometrias e materiais

### Preview de personagem

```ts
function createCharacterPreview(canvas: HTMLCanvasElement): {
  setLook(look: PlayerLook): void;
  dispose(): void;
};
```

- usado so pela tela `character`; mostra o player parado, sem `World`
- arrastar gira a camera em volta do personagem, roda do mouse aproxima
- `setLook` remonta o personagem; desenha so quando algo muda, sem loop
- jogo e preview montam o personagem pelo mesmo `createCharacterKit`
  (`renderers/character.renderer.ts`), entao o preview e o que aparece na run
