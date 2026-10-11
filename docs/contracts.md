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
  floaters: Floater[]; // numeros de dano no ar, so visual
  rooms: Room[]; // ordenadas por index, no maximo 3 vivas
  run: {
    money;
    earned;
    roomIndex;
    kills;
    shops;
    seconds;
    attackVariance;
    meleeMissChance;
    nextMeleeChanceAt;
    stats;
    events;
  };
  market: Market;
};
```

Invariantes:

- so `stepWorld` e acoes do store mutam `World`
- `status !== 'playing'` congela a simulacao
- fora das salas vivas tudo e parede
- mesmos `seed`, perfis salvos e sequencia de input = mesmo `World`
- `market` e trocado por um objeto novo a cada mudanca (o store compara por
  referencia)

Transicoes de `status`:

| De        | Para      | Quem                                |
| --------- | --------- | ----------------------------------- |
| `intro`   | `playing` | `beginRun` (botao Comecar ou Enter) |
| `playing` | `paused`  | `togglePause` (tecla P)             |
| `paused`  | `playing` | `togglePause`                       |
| `playing` | `shop`    | `openChest` (tecla B perto do bau)  |
| `shop`    | `playing` | `closeShop` (Continuar ou tecla B)  |
| `playing` | `dead`    | `stepWorld` quando `player.hp <= 0` |

`createWorld` devolve `playing`; quem poe `intro` e o store em `startRun`.

## `InputState`

```ts
type InputState = {
  moveX: number;
  moveY: number;
  dash: boolean;
  crouch?: boolean;
  interact?: boolean;
  open?: boolean;
}; // cada eixo em -1..1
```

`moveY = 1` anda para frente. Teclado e joystick somam no mesmo objeto; a
simulacao normaliza se o vetor passar de 1.
`interact` e um pulso da tecla F: quebra a caixa intacta mais proxima dentro de
`MELEE_RANGE`, vira o player para ela e anima o golpe de espada. Fora de
`playing`, o pulso e ignorado. O F modelado aparece sobre a caixa ao alcance.

`open` e um pulso da tecla B: abre o bau cujo centro esta a ate `CHEST_RANGE`
do player (`openChest`). Com a loja aberta, a mesma tecla chama `closeShop`
pela engine. O B modelado aparece sobre o bau ao alcance.

## Bau da loja

- nasce do tile `C` do template de loja; `Room.chest` guarda o centro
  (`null` em sala sem bau)
- e solido como a caixa (bloqueia passagem e bala) e nao quebra
- pode ser aberto e fechado quantas vezes o player quiser
- `Room.shopVisited` marca a primeira abertura: so ela sorteia precos
  (`rollMarket`) e conta em `run.shops`. Reabrir mostra os mesmos precos
- a engine anima a tampa: aberta enquanto `status === 'shop'`, fechada no
  resto. A janela da loja entra com atraso para a abertura aparecer

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
- `#` parede, `.` chao, `$` dinheiro, `C` bau da loja, `o` caixa destrutivel
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
| `suit`  | 60   | para dentro de `FIRE_RANGE` e dispara `Projectile` |
| `ninja` | 60   | corre ate `NINJA_REACH` e golpeia, sem bala        |

`ninja` so aparece a partir da sala `NINJA_FROM_ROOM`.

Cada contrato de `SHOP_EVERY` salas tem um nivel de inteligencia (a sala inicial
e nivel 1). O primeiro nivel usa multiplicadores 1; os seguintes aumentam
escuta, limiar do alerta por escuta, perseguicao e dash com crescimento
limitado. Do nivel 6 em diante,
cada multiplicador recebe um sorteio de ate +10%, uma vez por nivel. Os perfis
gerados ficam em `world.intelligence` e sao salvos como JSON no `localStorage`
pelo store, para serem reutilizados nas proximas runs.

Estados:

| De           | Para         | Quando                               |
| ------------ | ------------ | ------------------------------------ |
| `patrol`     | `suspicious` | player no cone, com linha de visao   |
| `patrol`     | `suspicious` | primeiro som percebido               |
| `suspicious` | `patrol`     | `searchTimer` zera sem ver o player  |
| `suspicious` | `alert`      | `detection` chega a 1                |
| `suspicious` | `alert`      | `hearing` chega a `hearingThreshold` |
| `suspicious` | `patrol`     | `detection` volta a 0                |
| `alert`      | `patrol`     | `ALERT_DURATION` sem linha de visao  |
| qualquer     | `dead`       | `killEnemy`                          |

- o inimigo ve o player no cone ate `viewRange`, ou em qualquer direcao a ate
  `senseRange(enemy)`: `SENSE_RANGE` mais `SENSE_PER_CONTRACT` por contrato
  (`roomIndex / SHOP_EVERY`), ate `+SENSE_MAX_BONUS`. Os dois pedem linha de
  visao
- `detection` sobe `dt / detectTime` vendo o player e cai `dt * DETECT_DECAY`
  sem ver
- audicao: `player.noise` e o raio do barulho do passo (`NOISE_IDLE` parado,
  `NOISE_WALK` andando, `NOISE_DASH` no salto). O raio cresce
  `HEAR_PER_ROOM` por sala do inimigo, ate `+HEAR_MAX_BONUS`. Dentro dele,
  `hearing` sobe `dt * (1 - distancia / raio) / HEAR_TIME`; fora, cai
  `dt * DETECT_DECAY`. O multiplicador de escuta aumenta raio, velocidade de
  percepcao e tempo de investigacao. Parede nao abafa
- player agachado (`player.crouching`, Ctrl ou C seguro; o salto levanta):
  anda a `CROUCH_SPEED` da velocidade, faz `CROUCH_NOISE` do barulho e
  `hearing` para logo abaixo de `HEARING_YELLOW` do limiar. O inimigo nota
  (orelha branca) e investiga, mas nao entra em alerta pelo ouvido
- no primeiro som, `heard` guarda a posicao do player e a rota muda no mesmo
  passo. O inimigo investiga em `patrolSpeed`; novos sons atualizam o destino
  e renovam `SEARCH_TIME`
- a orelha fica branca no comeco da escuta, amarela apos `HEARING_YELLOW` do
  limiar salvo no perfil, e a exclamacao fica vermelha quando a escuta chega
  a `hearingThreshold`. Nesse ponto, o inimigo persegue o player. Enquanto
  ainda ouve, o tempo de alerta nao expira mesmo sem linha de visao
- perfis antigos no `localStorage` recebem `hearingThreshold: 1` ao carregar
- tiro do player sem silenciador (`weapon.id !== 'silenced'`): todo inimigo
  vivo e fora de alerta a ate `NOISE_SHOT` multiplicado pela escuta do nivel
  recebe `heard` na hora
- levar tiro e sobreviver poe `detection = 1`: alerta no passo seguinte
- `alert` enxerga em 360 graus e persegue por `findPath`; o multiplicador de
  perseguicao aumenta a velocidade, a duracao do alerta e a frequencia de
  recalculo da rota
- a partir da sala `ENEMY_DASH_FROM_ROOM`, `alert` com linha de visao salta
  igual ao player (`DASH_TIME` a `DASH_SPEED`, para na parede) a cada
  `dashEvery` segundos. `dashEvery` e fixado ao nascer: comeca em
  `ENEMY_DASH_INTERVAL` e cai `ENEMY_DASH_PER_ROOM` por sala, ate
  `ENEMY_DASH_MIN_INTERVAL`; `0` = nao salta
  - fora do alcance de ataque: salta na direcao do player; `ninja` pousa ao
    chegar em `NINJA_REACH`
  - `suit` ja no alcance de tiro: salta de lado (lado sorteado por `rngState`)
  - tenta primeiro um lado livre; se ambos estiverem bloqueados, combate sem
    saltar. O multiplicador de dash aumenta velocidade e frequencia
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
- ao quebrar, sorteia (`rngState`) um `Pickup`: `heart` com chance
  `LOOT_HEART_CHANCE`, `shield` com `LOOT_SHIELD_CHANCE`, senao nada

## `Pickup`

```ts
type PickupKind = 'money' | 'heart' | 'shield';
type Pickup = { id; kind: PickupKind; roomIndex; pos: Vec2; value: number };
```

- coletado ao chegar a `PICKUP_RADIUS`; some junto com a sala
- `money`: soma `value` em `run.money` e `run.earned`
- `heart`: cura `value`, ate `maxHp`. `value` nasce entre `HEART_MIN` e
  `HEART_MAX` de `maxHp`, com sorteio ao quadrado (cura pouca e o comum)
- `shield`: soma `value` em `player.shield`, ate `SHIELD_MAX * maxHp`. `value`
  nasce entre `SHIELD_MIN` e `SHIELD_MAX` de `maxHp`
- `heart` com vida cheia e `shield` com escudo no teto ficam no chao
- todo dano no player passa por `damagePlayer`: gasta `shield` antes de `hp`
- some junto com a sala

## Combate do player

O player comeca com a espada e nunca a perde.

- encostado (`MELEE_RANGE`) em alguem, com ou sem arma de fogo: golpe de
  espada, sem gastar municao
  - a chance de erro e sorteada a cada `MELEE_MISS_INTERVAL` segundos ativos:
    normalmente entre 10% e 30%, com 25% de chance de pico entre 45% e 70%
  - cada erro alerta o alvo; as mudancas de chance entram em `run.events`
  - inimigo que nao esta `alert`: morre na hora
  - inimigo `alert`: leva `SWORD_DAMAGE` com variacao de ataque
- senao, com arma de fogo: mira no inimigo vivo mais proximo dentro de `range`
  e com linha de visao, dispara `pellets` balas abertas em `spread` radianos,
  gasta 1 de municao; municao zerada remove a arma
- inimigo morto solta `Pickup` de `KILL_MONEY`
- cada morte da `ADRENALINE_TIME` segundos de velocidade multiplicada por
  `ADRENALINE_BOOST`
- `player.slash` conta o tempo do golpe; so a engine usa, para animar
- `player.shot` conta o recuo do ultimo tiro (`SHOT_TIME`, menor que
  `ATTACK_COOLDOWN`); so a engine usa, para o coice e o clarao no cano
- `run.stats` registra tentativas/acertos de espada, projeteis disparados e
  acertados, dano causado/sofrido/bloqueado e vida recuperada
- `run.attackVariance` guarda a faixa sorteada para a forca dos ataques:
  minimo entre 75% e 85% e maximo entre 115% e 125% do dano base. Cada
  facada em inimigo alerta e cada projetil disparado sorteiam um dano na
  faixa; execucoes furtivas continuam instantaneas. A faixa fica em
  `localStorage` e os acertos registram o dano efetivo em `run.events`
- `run.events` guarda o registro cronologico da partida; `run.seconds` nao
  avanca durante pausa, loja ou legenda

## `Floater` (dano flutuante)

```ts
type Floater = { id: number; pos: Vec2; amount: number; age: number };
```

- nasce em cada golpe do player: `amount` e o dano causado (a execucao de
  desavisado mostra toda a vida que restava); `amount: 0` e erro
- erro: facada que falha, ou bala do player que acaba ou bate na parede sem
  acertar ninguem. Erros a menos de `FLOATER_MISS_GAP` um do outro viram um
  so (chumbo da escopeta)
- `updateFloaters` soma `age` e remove em `FLOATER_TIME`
- a engine desenha `+N` ou `Errou!` (em claro) na fonte Creepster. Cor do
  numero pelo dano: 30 ou mais vermelho, abaixo de 30 amarelo, abaixo de 5
  verde
- golpe do player tira 30 (`SWORD_DAMAGE`, `PLAYER_BULLET_DAMAGE`) de 60 de
  vida do inimigo: dois golpes matam
- a fonte e carregada no `index.html`; o texto estoura de tamanho, assenta,
  sobe e some

## `ItemDef`

```ts
type ItemDef = {
  id: 'pistol' | 'silenced' | 'shotgun' | 'armor';
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

`WeaponId` e `'pistol' | 'silenced' | 'shotgun'`. `silenced` e a pistola com
silenciador: mesmos numeros da pistola, mas o tiro nao faz barulho (ver
audicao em `Enemy`).

## Economia (`Market`)

```ts
type Market = { inflation: number; prices: Record<ItemId, number> };
```

O preco cobrado e sempre `world.market.prices[id]`, nunca `ItemDef.price`.

- entrada de dinheiro: `KILL_MONEY` por inimigo e `TILE_MONEY` por nota no
  chao. Valores fixos: a recompensa nao cresce com a sala
- `run.earned` soma tudo o que foi coletado; `run.shops` conta lojas abertas
- `rollMarket`, na primeira abertura do bau de cada loja:
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
  shield;
  money;
  room;
  kills;
  weaponId; // null = so a espada
  ammo;
}
market: Market;
best: number; // maior sala alcancada, persistido em localStorage
look: PlayerLook; // aparencia do player, persistida em localStorage
bloodColor: string; // cor das pocas, persistida em localStorage
intelligence: Record<number, EnemyIntelligence>; // perfis por nivel, persistidos em localStorage
attackVariance: AttackVariance | null; // faixa de dano, persistida em localStorage
```

```ts
type PlayerLook = {
  cloth: string; // cores em '#rrggbb'
  accent: string;
  skin: string;
  head: number; // escalas de LOOK_SCALE.min a LOOK_SCALE.max, 1 = padrao
  legs: number;
  hands: number;
  feet: number;
  weapon: number; // espada e armas na mao, de WEAPON_SCALE.min a .max
};
```

`look` e so visual: nao entra no `World` nem muda colisao. A engine le uma vez,
ao criar o renderer; por isso `setLook` so vale antes da run (telas `menu` e
`character`).
`bloodColor` e uma cor `#rrggbb` escolhida nas configuracoes da home. O
renderer a le ao abrir a run; a poca sob cada inimigo morto cresce suavemente
por `BLOOD_GROW_TIME` segundos ate um tamanho fixo.

Acoes:

| Acao                   | Quem chama | Efeito                                  |
| ---------------------- | ---------- | --------------------------------------- |
| `startRun(seed?)`      | UI         | cria `World` em `intro`                 |
| `begin()`              | UI, engine | `intro` -> `playing`                    |
| `togglePause()`        | UI, engine | `playing` <-> `paused`                  |
| `tick(input, dt)`      | engine     | `stepWorld` e sincroniza `hud`/`screen` |
| `buy(itemId)`          | UI         | `buyItem` e sincroniza                  |
| `closeShop()`          | UI, engine | volta para `playing`                    |
| `backToMenu()`         | UI         | descarta `World`, `screen = 'menu'`     |
| `openCharacter()`      | UI (menu)  | `screen = 'character'`; em run, nada    |
| `setLook(patch)`       | UI         | valida e grava `look`; em run, nada     |
| `setBloodColor(color)` | UI         | valida e grava a cor do sangue          |

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
- teclas: WASD/setas movem, `P` chama `togglePause`, `Enter` chama `begin`,
  `F` pulsa `interact`, `B` pulsa `open` ou chama `closeShop`
- nunca muta `World`
- parede muda a cada contrato (nivel): tom e papel de parede derivados so do
  indice do nivel (`wallpaper` em `world.renderer.ts`), sem campo no `World`
- animacao so visual, derivada do `World` a cada frame: inclinar ao andar,
  cabeca olhando para os lados quando parado, golpe de espada, zoom com blur
  quando `run.kills` sobe
- `dispose` cancela o loop, remove listeners e libera geometrias e materiais

### Modelos e preview de arma

```ts
type WeaponModelId = WeaponId | 'sword';
function createWeaponModel(id: WeaponModelId): {
  root: THREE.Group;
  dispose(): void;
};
function renderWeaponPreviews(): Record<WeaponModelId, string>;
```

- `createWeaponModel` (`renderers/weapon.renderer.ts`): cano em `+x`, `y` para
  cima, simetrico em `z`. O silenciador fica no eixo do cano
  (`PISTOL_BORE_Y`), a partir de `PISTOL_MUZZLE_X`
- `renderWeaponPreviews` (`weapon-preview.ts`): desenha cada modelo uma vez
  fora da tela e devolve data URLs. `use-game.page.ts` chama uma vez e passa
  para o `Hud`, que mostra a foto de `hud.weaponId ?? 'sword'`
- o HUD mostra balas restantes sobre `ItemDef.ammo`; com a espada, nao mostra
- na run, o player com arma de fogo leva o modelo dela na mao direita, braco
  estendido; a espada some e so volta durante o golpe (`player.slash > 0`)
- enquanto `player.shot > 0` a arma da o coice; no comeco dele aparece o
  clarao na boca do cano. Escopeta recua e clareia mais; silenciada, menos
- o ultimo tiro tira a arma do `World`; a engine segura o modelo ate o recuo
  acabar

### Preview de personagem

```ts
function createCharacterPreview(canvas: HTMLCanvasElement): {
  setLook(look: PlayerLook): void;
  setWeapon(id: WeaponId | null): void; // null = espada
  dispose(): void;
};
```

- usado so pela tela `character`; mostra o player parado, sem `World`
- arrastar gira a camera em volta do personagem, roda do mouse aproxima
- `setLook` remonta o personagem; desenha so quando algo muda, sem loop
- `setWeapon` troca o que o player segura no preview (espada, pistola,
  silenciada, escopeta). E so do preview: nao grava no store nem vale na run
- jogo e preview prendem a arma na mao pelo mesmo `createHeldGuns`
  (`renderers/weapon.renderer.ts`)
- jogo e preview montam o personagem pelo mesmo `createCharacterKit`
  (`renderers/character.renderer.ts`), entao o preview e o que aparece na run
