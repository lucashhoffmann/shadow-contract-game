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
  mode: 'solo' | 'multi';
  players: Player[]; // todos, vivos ou mortos; solo tem um so
  player: Player; // jogador em foco, sempre um de `players`
  enemies: Enemy[];
  projectiles: Projectile[];
  props: Prop[];
  pickups: Pickup[];
  floaters: Floater[]; // numeros de dano no ar, so visual
  rooms: Room[]; // ordenadas por index, no maximo 3 vivas
  run: {
    earned; // total do grupo; a carteira de cada um e `player.money`
    roomIndex;
    kills;
    shops;
    seconds;
    lastMovedAt;
    lastIdleWarningAt;
    idleWarnings;
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

- so `stepWorld` (solo), `stepMultiWorld` (multi) e acoes do store mutam
  `World`
- `world.player` e o jogador em foco. Fora do passo e o jogador local, o que
  a camera e o HUD seguem. Durante o passo, quem chama um sistema aponta
  `world.player` para o jogador da vez (`asPlayer`, em
  `world/utils/players.util.ts`): por isso os sistemas leem `world.player` e
  valem para um ou varios jogadores. Cada inimigo usa como foco o jogador
  vivo mais perto dele; a bala usa quem ela acertou ou quem atirou
  (`Projectile.by`)
- jogador com `hp <= 0` esta morto: nao age, nao e alvo, nao abre porta
- `Player` tem `id` (posicao em `players`), `name` e `color` (multi; solo usa
  `''` e `null`) e `money`
- `status !== 'playing'` congela a simulacao
- apos 10 segundos sem deslocamento real, `idleWarnings` sobe e a UI pulsa
  bordas azuis; a cada 5 segundos parado, outro inimigo e alertado ou criado
  na sala atual (ate 5 inimigos vivos)
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
Em tela de toque ou janela estreita, o joystick aparece no centro inferior durante o
jogo; tocar e arrastar no disco move o personagem, soltar zera o movimento.
`interact` e um pulso da tecla F: quebra a caixa intacta mais proxima dentro de
`MELEE_RANGE`, vira o player para ela e anima o golpe de espada. Fora de
`playing`, o pulso e ignorado. O F modelado aparece sobre a caixa ao alcance.
Com arma de fogo na mao e inimigo em `MELEE_RANGE`, o mesmo pulso vira facada
nele (tem prioridade sobre a caixa) e o F aparece sobre o inimigo.

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
Cada salto gasta um de `player.dashes` (comeca em `DASH_MAX`, 6); com zero nao
salta, e so o item `dash` das caixas repoe. Na sala inicial o salto e livre:
so passa a gastar quando `run.roomIndex > 0`, e nao volta a ser livre. So repete depois de
`DASH_COOLDOWN`. Ainda e so movimento: nao da
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

`ninja` aparece normalmente a partir da sala `NINJA_FROM_ROOM`; a pressao por
inatividade tambem pode chama-lo antes.

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

- morte de um golpe so (vida cheia a zero num `damageEnemy`): `launch` recebe
  `LAUNCH_TIME` e `facing` vira a direcao do golpe (do player para o
  inimigo). `updateEnemies` anda o corpo `LAUNCH_DISTANCE` nesse tempo,
  freando ate parar; parede segura. Morte em mais de um golpe nao lanca. A
  engine anima o voo e o tombo por `enemy.launch`
- dano: todo ataque de inimigo passa por `enemyDamage(world, enemy, base)`.
  Cresce `ENEMY_DAMAGE_PER_LEVEL` do dano base por nivel alem do primeiro, e
  nunca fica abaixo de uma fatia da vida maxima do alvo: `ENEMY_DAMAGE_SHARE`
  mais `ENEMY_DAMAGE_SHARE_PER_LEVEL` por nivel, ate `ENEMY_DAMAGE_SHARE_MAX`
  (para o golpe de ninja; tiro e shuriken, na proporcao do dano base). No
  nivel 1 contra a vida inicial, vale o dano base
- critico: a partir do nivel `ENEMY_CRIT_FROM_LEVEL`, cada golpe, tiro ou
  shuriken sorteia (`enemyStrike`) a chance de valer `ENEMY_CRIT_MULT` vezes:
  `ENEMY_CRIT_CHANCE` mais `ENEMY_CRIT_PER_LEVEL` por nivel, ate
  `ENEMY_CRIT_MAX`. Antes desse nivel nao sorteia nada. O tiro leva
  `Projectile.critical` ate acertar; o aviso sai com `Floater.critical`, que a
  engine escreve como "CRITICO" sobre o numero, como o headshot
- duplas: em `spawnRoom`, a primeira ronda de toda sala nasce com um parceiro
  e as outras com chance `BUDDY_CHANCE`. O parceiro e do mesmo tipo e faz a
  mesma ronda deslocada `BUDDY_GAP` para um lado livre (`buddyPatrol`); sem
  lado livre, a ronda fica sozinha. A sala nunca passa de `ROOM_ENEMY_MAX`
- conversa: so visual, na engine. Dois inimigos em `patrol`, sem furia, a
  menos de `TALK_RANGE` um do outro se revezam com um balao de fala sobre a
  cabeca (`chatter`, em `world.renderer.ts`)
- furia (`enraged`): inimigo vivo que ve um colega morto (`canSee` no corpo)
  fica mais esperto ate morrer (`witness`): `intelligence` propria (copia;
  o perfil do nivel nao muda) com escuta, perseguicao e salto multiplicados
  por `RAGE_HEARING`, `RAGE_PURSUIT` e `RAGE_DASH` e limiar de escuta por
  `RAGE_THRESHOLD`; `viewRange` soma `RAGE_VIEW` e `detectTime` cai para
  `RAGE_DETECT`. Fora de alerta, `heard` vira o corpo e ele vai conferir. A
  engine troca o contorno do corpo por um vermelho que pulsa e mostra a marca
  de raiva flutuando sobre a cabeca
- bando: ao entrar em alerta o inimigo chama (`rally`) os colegas vivos a ate
  `PACK_CALL_RADIUS` mais `PACK_CALL_PER_LEVEL` por nivel (teto
  `PACK_CALL_MAX`), que alertam no passo seguinte e chamam tambem. Ninjas em
  alerta cercam (`packTarget`): cada um tem um lado do alvo, repartido por
  igual pela ordem de id, corre para o ponto do aro de raio `PACK_RING` desse
  lado e, a menos de `PACK_ARRIVED` rad dele, parte para o golpe. Ninja
  sozinho e terno vao direto
- esquiva: ninja em alerta com o salto ao menos `NINJA_DODGE_COST` recarregado
  desvia de bala do player que vem nele a ate `NINJA_DODGE_RANGE`: salto de
  `NINJA_DODGE_HOP` tiles de lado (`evading`), sem corrigir o rumo nem golpear
  ao pousar. Chance por bala `NINJA_DODGE_CHANCE` vezes o quadrado da
  inteligencia de salto, ate `NINJA_DODGE_MAX`; fixa por par bala/ninja
- shuriken: `ninja` de nivel (contrato) `SHURIKEN_FROM_LEVEL` em diante, em
  `alert` com linha de visao e entre `SHURIKEN_MIN_GAP` e `SHURIKEN_RANGE` do
  player, arremessa um `Projectile` com `shuriken: true` a cada
  `SHURIKEN_INTERVAL` (`throwCooldown`; a primeira sai `SHURIKEN_FIRST` apos
  o alerta), sem parar de se aproximar. Vale como
  bala inimiga: `SHURIKEN_DAMAGE`, para em parede e caixa
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
  - so salta com o trajeto inteiro livre: parede, caixa, bau ou porta selada
    no caminho cancelam o salto, e ele contorna andando
  - `suit` fora do alcance de tiro: salta na direcao do player
  - `ninja` (bote): so salta se o salto alcanca o player (de mais longe,
    corre); no ar vira para o player ate `NINJA_DASH_TURN` rad/s; pousa ao
    chegar em `NINJA_REACH` e golpeia em ate `NINJA_LUNGE_STRIKE` segundos
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
  range: number; // alcance da arma
  travelled: number; // distancia ja percorrida
  shooter?: number; // id do inimigo que atirou
  shuriken?: boolean; // estrela de ninja: so muda o modelo
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
- a aparencia varia (caixa, aparador com planta, barril, vaso), escolhida
  pela engine a partir do `id`. E so visual: a simulacao trata todos igual
- ao quebrar, sorteia (`rngState`) um `Pickup` pela tabela `LOOT`
  (`level/utils/grid.util.ts`): cada item ocupa a sua `chance` da reta de 0 a
  1, em ordem (`heart` `LOOT_HEART_CHANCE`, `shield` `LOOT_SHIELD_CHANCE`,
  `dash` `LOOT_DASH_CHANCE`, `ammo` `LOOT_AMMO_CHANCE`, `headshot`
  `LOOT_HEADSHOT_CHANCE`); o que sobra e caixa
  vazia. Item com `when` (municao: so com o player armado) que nao vale no
  momento tambem vira caixa vazia. Um segundo sorteio
  define o valor. Item novo entra no fim da tabela, para nao mudar o que as
  faixas anteriores soltam

## `Pickup`

```ts
type PickupKind =
  'money' | 'heart' | 'shield' | 'dash' | 'ammo' | 'headshot' | 'revive';
type Pickup = { id; kind: PickupKind; roomIndex; pos: Vec2; value: number };
```

- coletado ao chegar a `PICKUP_RADIUS`; some junto com a sala
- `money`: soma `value` em `run.money` e `run.earned`
- `heart`: cura `value`, ate `maxHp`. `value` nasce entre `HEART_MIN` e
  `HEART_MAX` de `maxHp`, com sorteio ao quadrado (cura pouca e o comum)
- `shield`: soma `value` em `player.shield`, ate `SHIELD_MAX * maxHp`. `value`
  nasce entre `SHIELD_MIN` e `SHIELD_MAX` de `maxHp`
- `dash`: repoe `value` saltos em `player.dashes`, ate `DASH_MAX`. `value` e
  um inteiro de `DASH_LOOT_MIN` a `DASH_LOOT_MAX`, todos com a mesma chance
- `ammo`: soma `value` balas na arma na mao ou, se ela esta cheia ou a mao
  esta com a espada, na primeira do arsenal com espaco, ate `ItemDef.ammo` (30 em
  toda arma de fogo). `value` e um inteiro de `AMMO_LOOT_MIN` a
  `AMMO_LOOT_MAX`. So sai de caixa com alguma arma de fogo no arsenal
- `headshot` (mira): soma `value` pontos percentuais em `player.headshot`,
  ate `HEADSHOT_MAX`; no teto fica no chao. `value` vai de
  `HEADSHOT_LOOT_MIN` a `HEADSHOT_LOOT_MAX`. So sai com arma de fogo no
  arsenal e em caixa do nivel (contrato) `HEADSHOT_FROM_LEVEL` em diante
- `revive` (ficha, cruz flutuante): soma 1 em `run.revives`, ate
  `REVIVE_MAX`; no teto fica no chao. Sai de caixa com `LOOT_REVIVE_CHANCE`.
  Quando `player.hp` chega a zero com ficha guardada, `stepWorld` gasta uma:
  o player volta em `run.checkpoint` (ponto em que entrou na sala atual) com
  `REVIVE_HP` da vida maxima, os inimigos vivos voltam a `patrol` e as balas
  inimigas somem. Sem ficha, `status` vira `dead`
- `heart` com vida cheia, `shield` com escudo no teto, `dash` com os saltos
  cheios e `ammo` sem arma ou com todas cheias ficam no chao
- todo dano no player passa por `damagePlayer`: gasta `shield` antes de `hp`
- some junto com a sala

## Combate do player

O player comeca com a espada e nunca a perde.

- sem arma de fogo, encostado (`MELEE_RANGE`) em alguem: golpe de espada
  automatico. Com arma de fogo, a espada so sai no pulso `interact` (F) com
  alguem ao alcance (`meleeTarget`), sem gastar municao; sem o F, nada
  acontece: nao atira em quem esta ao alcance da espada
  - a chance de erro e sorteada a cada `MELEE_MISS_INTERVAL` segundos ativos:
    normalmente entre 10% e 30%, com 25% de chance de pico entre 45% e 70%
  - cada erro alerta o alvo; as mudancas de chance entram em `run.events`
  - inimigo que nao esta `alert`: morre na hora
  - overkill: marca `Floater.overkill` (desenhado como "OVERKILL" sobre o
    numero) em dois casos: execucao com `player.crouching` e pelas costas
    (fora de `STEALTH_BACK_ANGLE` para cada lado de `enemy.facing`), ou
    qualquer golpe que leva a vida cheia do inimigo a zero de uma vez (+60),
    inclusive headshot, que nesse caso mostra overkill. Nao muda dano nem
    recompensa
  - inimigo `alert`: leva `SWORD_DAMAGE` com variacao de ataque
- senao, com arma de fogo: mira no inimigo vivo mais proximo dentro de `range`
  e com linha de visao, dispara `pellets` balas abertas em `spread` radianos,
  gasta 1 de municao; municao zerada nao remove a arma: ela fica na mao e
  no arsenal, so nao atira
- inimigo morto solta `Pickup` de `KILL_MONEY`. Alem disso, com chance
  `ENEMY_LOOT_CHANCE`, sorteia a mesma tabela `LOOT` das caixas (`dropLoot`),
  que ainda pode dar nada; o item cai a `ENEMY_LOOT_OFFSET` do corpo
- cada morte da `ADRENALINE_TIME` segundos de velocidade multiplicada por
  `ADRENALINE_BOOST`
- `player.slash` conta o tempo do golpe; so a engine usa, para animar
- `player.shot` conta o recuo do ultimo tiro (`SHOT_TIME`, menor que
  `ATTACK_COOLDOWN`); so a engine usa, para o coice e o clarao no cano
- `run.stats` registra tentativas/acertos de espada, projeteis disparados e
  acertados, dano causado/sofrido/bloqueado e vida recuperada
- `run.attackVariance` guarda a faixa sorteada para a forca dos ataques:
  minimo entre 100% e 110% e maximo entre 140% e 150% do dano base (nunca
  abaixo do base: dois golpes de 30 sempre matam 60 de vida). Cada facada em
  inimigo alerta e cada projetil sorteiam o proprio dano na faixa quando o
  ataque comeca (o projetil no disparo, nao no impacto); execucoes furtivas continuam instantaneas. A faixa fica em
  `localStorage` e os acertos registram o dano efetivo em `run.events`
- `run.events` guarda o registro cronologico da partida; `run.seconds` nao
  avanca durante pausa, loja ou legenda

## `Floater` (dano flutuante)

```ts
type Floater = {
  id: number;
  pos: Vec2;
  amount: number;
  age: number;
  onPlayer?: boolean;
  headshot?: boolean;
  overkill?: boolean;
  critical?: boolean; // golpe critico do inimigo
};
```

- nasce em cada golpe do player: `amount` e o dano causado (a execucao de
  desavisado mostra toda a vida que restava); `amount: 0` e erro
- erro: facada que falha, ou bala do player que acaba ou bate na parede sem
  acertar ninguem. Erros a menos de `FLOATER_MISS_GAP` um do outro viram um
  so (chumbo da escopeta)
- golpe do inimigo (`onPlayer`): aparece sobre o inimigo que bateu, nao
  sobre o player. Todo `damagePlayer(world, dano, from)` poe em `from` o dano
  do golpe inteiro, incluindo o que o escudo segurou; bala inimiga que acaba
  ou bate na parede sem acertar poe um erro sobre quem atirou
  (`Projectile.shooter`). A engine desenha `-N` sempre em vermelho
- `updateFloaters` soma `age` e remove em `FLOATER_TIME`
- a engine desenha `+N` ou `Errou!` (em claro) na fonte Creepster. Cor do
  numero pelo dano: 30 ou mais vermelho, abaixo de 30 amarelo, abaixo de 5
  verde
- dano base: espada `SWORD_DAMAGE` (30); bala `ItemDef.damage` (pistolas
  30, chumbo da escopeta 15). Inimigo tem 60 de vida
- headshot: cada bala do player sorteia, no disparo, `player.headshot`
  (comeca em `HEADSHOT_BASE`) de sair com o dano vezes `HEADSHOT_MULT`
  (`Projectile.headshot`). O acerto gera `Floater.headshot`, desenhado como
  "HEADSHOT" sobre o numero; `hud.headshot` mostra a chance em %. Espada e
  execucao nao tem headshot
- dano da bala cai com a distancia: cheio ate `FALLOFF_START` do alcance da
  arma, depois desce em linha ate `FALLOFF_MIN` no alcance maximo
  (`Projectile.travelled / range`). Bala inimiga nao perde dano
- a fonte e carregada no `index.html`; o texto estoura de tamanho, assenta,
  sobe e some

## `ItemDef`

```ts
type ItemDef = {
  id: 'pistol' | 'silenced' | 'shotgun' | 'armor';
  name: string;
  kind: 'weapon' | 'armor';
  price: number; // preco base
  damage: number; // dano base de cada bala
  range: number;
  ammo: number;
  pellets: number;
  spread: number;
  bonusHp: number;
};
```

Equipamento vale so para a run atual; `startRun` cria `World` novo.

### Arsenal

```ts
type Weapon = { id: WeaponId; ammo: number };
player.weapon: Weapon | null; // arma de fogo na mao; null = espada
player.arsenal: Weapon[]; // armas de fogo da run, na ordem de compra
```

- `player.weapon`, quando nao e null, e um dos objetos de `player.arsenal`
- comprar arma nova poe ela no arsenal e na mao; as outras ficam guardadas
- comprar arma que ja esta no arsenal e recarga: custa `refillPrice` do
  preco de mercado (`AMMO_REFILL_PRICE`), enche a municao e poe na mao.
  `itemPrice(world, id)` devolve o preco cobrado; arma cheia nao se compra
- `selectWeapon(world, id | null)` troca o que esta na mao (arma que o
  player nao tem e ignorada); `cycleWeapon` roda espada, cada arma, e volta
- arma sem bala pode ser escolhida; o HUD mostra ela cinza e opaca

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
  dashes; // saltos guardados, de 0 a DASH_MAX
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
idleWarnings: number; // pulsos azuis da run atual, nao persistido
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
| `selectWeapon(id)`     | UI         | troca a arma na mao; null = espada      |
| `cycleWeapon()`        | engine (Q) | proxima arma; so em `playing`           |
| `closeShop()`          | UI, engine | volta para `playing`                    |
| `backToMenu()`         | UI         | descarta `World`, `screen = 'menu'`     |
| `openCharacter()`      | UI (menu)  | `screen = 'character'`; em run, nada    |
| `setLook(patch)`       | UI         | valida e grava `look`; em run, nada     |
| `setBloodColor(color)` | UI         | valida e grava a cor do sangue          |

Fora do estado reativo:

- `getWorld()`: engine le o `World` atual para desenhar
- `setJoystickInput(x, y)` / `joystickInput`: joystick escreve, engine le
- `setJoystickCrouch(on)`: botao de agachar do toque, liga/desliga; a engine
  soma em `input.crouch` como se fosse o C seguro

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
  `F` pulsa `interact`, `B` pulsa `open` ou chama `closeShop`, `Q` chama
  `cycleWeapon`
- em aparelho de toque (`pointer: coarse`) os icones de interacao mostram
  uma mao tocando no lugar das letras F e B
- toque ou clique a ate `PROMPT_TAP_RADIUS` px de um icone de interacao a
  vista (`WorldRenderer.prompts()`) pulsa a acao dele: F da caixa ou da
  facada, `interact`; B do bau, `open`. O toque e consumido: nao chega ao
  joystick
- nunca muta `World`
- porta de correr na saida da sala inicial e de cada loja (entrada de cada
  nivel), nos tiles `isDoorTile` (`level/utils/grid.util.ts`)
  - player passa sempre
  - inimigo nao passa nem a porta abre para ele enquanto `doorsSealed(world)`:
    movimento, salto e rota (`moveCircle`, `circleHitsWall`, `findPath` com
    `sealed`) tratam a porta como parede
  - `doorsSealed` vira falso com o player parado ha `IDLE_WARNING_DELAY` (a
    mesma inatividade que manda inimigos atras dele); voltou a andar, sela de
    novo. Inimigo que ficou no vao pode sair
  - aberta ou fechada e decidido por `doorOpen(world, ty)`: player a ate
    `DOOR_RANGE`, ou porta liberada e inimigo vivo a ate `DOOR_RANGE`. A
    engine desenha as folhas pelo mesmo criterio
  - fechada, segura bala (de qualquer dono) e visao: `isWall` conta porta
    fechada como parede, entao cone, linha de visao e mira param nela
- parede e piso mudam a cada contrato (nivel): tom, papel de parede e
  desenho do piso (uma repeticao por tile) derivados so do
  indice do nivel (`wallpaper` em `world.renderer.ts`), sem campo no `World`
- ao matar (inimigo passa a `dead`), a engine solta uma explosao de notas de
  dinheiro e gotas de sangue, junto com o zoom e o blur da camera. So
  visual: nao da dinheiro (quem da e o `Pickup` da morte)
- animacao so visual, derivada do `World` a cada frame: inclinar ao andar,
  cabeca olhando para os lados quando parado, golpe de espada, zoom com blur
  quando `run.kills` sobe
- `dispose` cancela o loop, remove listeners e libera geometrias e materiais

### Modelos e preview de arma

```ts
type WeaponModelId = WeaponId | 'sword' | 'ammo'; // 'ammo': foto da municao
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

## App instalavel (PWA)

- `vite-plugin-pwa` (em `vite.config.ts`) gera `manifest.webmanifest` e o
  service worker no build; icones em `public/` (`icon.png`, `icon-192.png`,
  `icon-maskable.png`)
- o service worker guarda os arquivos do jogo e as fontes do Google Fonts no
  aparelho: depois da primeira visita o jogo abre sem internet
- `src/resources/pwa.ts` registra o service worker e mantem a versao em dia:
  procura versao nova ao abrir, ao voltar para o app e de hora em hora, e
  aplica sozinho (recarregando) so com `screen === 'menu'`, para nao derrubar
  uma partida
- a tela inicial oferece a instalacao em aparelho de toque
  (`home/components/install-app`): botao quando o navegador avisa
  (`beforeinstallprompt`), instrucao manual no iPhone, nada se ja instalado

## Multiplayer (`modules/multiplayer`)

O nucleo de regras e o mesmo do solo. Este modulo guarda so o que muda com
varios jogadores. Quem simula e o host; o servidor de salas
(`shadow-contract-server`) so junta jogadores e repassa mensagens.

```ts
type Seat = { name: string; color: string };
function createMultiWorld(seed: number, seats: Seat[]): World;
function stepMultiWorld(
  world: World,
  inputs: (InputState | undefined)[],
  dt: number,
): void;
```

- `createMultiWorld`: `mode: 'multi'`, um `Player` por `Seat`, lado a lado no
  ponto de partida; `players[0]` e o host e comeca em foco
- sala: `ROOM_W` x `ROOM_H` deixam de ser fixos. `setRoomSize(mode)` troca
  entre `ROOM_SIZES.solo` (11x13) e `ROOM_SIZES.multi` (17x19) e e chamado
  por `createEmptyWorld` antes de gerar qualquer sala. O tamanho e global do
  processo, nao do `World`: so ha uma partida por navegador
- templates proprios em `multiplayer/templates/room.template.ts`, com ate 8
  rondas por sala; `pickTemplate` escolhe o conjunto por `world.mode`
- dificuldade: cada jogador alem do primeiro multiplica os inimigos da sala
  por `+MULTI_ENEMIES_PER_PLAYER` (`enemyMultiplier`) e adianta a dificuldade
  em `MULTI_THREAT_ROOMS` salas (`threatBoost`): contagem de inimigos, chance
  de ninja, visao, tempo de deteccao, saltos e inteligencia nascem como se a
  sala fosse mais funda. Com 4 jogadores a sala 1 ja vale a sala 13 do solo
- `stepMultiWorld`: `inputs[i]` e o input de `players[i]`; sem input, parado.
  Ordem: todos andam, o grupo avanca de sala, inimigos, todos atacam, balas,
  todos coletam
- o grupo anda junto: a sala avanca com o jogador vivo mais a frente; quem
  ficou alem de `ROOMS_BEHIND` e puxado para `run.checkpoint`
- dinheiro e individual: a moeda e de quem pegou
- a partida acaba (`status: 'dead'`) quando todos os jogadores morrem
- ainda nao vale no multi: inatividade

### Loja, bau de revive e troca de arma em rede

No solo sao acoes diretas do store. Em rede viajam como pulsos no
`InputState` (`buy`, `leaveShop`, `revive`, `select`) e quem aplica e o host,
no passo, com o jogador certo em foco (`desk`, em `multiplayer.system.ts`).

- loja nao pausa e e de cada um: `open` perto do bau liga `player.shopping`
  (e sorteia os precos na primeira vez, `visitShop`). Quem esta com a loja
  aberta nao anda nem ataca; os outros seguem. `buy` so vale com a loja
  aberta e sai da carteira de quem comprou; `leaveShop`, ou se afastar, fecha.
  `world.status` continua `playing`; o store mostra a tela `shop` so para
  quem tem `shopping`
- bau de revive: tile `R` na sala da loja do multi (`Room.reviveChest`), um
  por contrato. `reviveAllowance` diz quantos ele levanta: um por ficha do
  grupo (`run.revives`); sem ficha, um de graca por bau (`Room.reviveFree`).
  `open` perto dele, com alguem morto: se da para levantar todos, levanta;
  se ha mais mortos que revives, liga `player.reviving` e quem abriu escolhe
  com `revive: player.id` ate acabar. Quem volta nasce ao lado do bau com
  `REVIVE_HP` da vida
- no multi a ficha nao e gasta sozinha ao morrer (isso e do solo): o morto
  assiste ate o grupo chegar ao bau
- `select`: `'next'`, `'sword'` ou o id de uma arma do arsenal
- recomeco: com `status: 'dead'`, `restartMatch()` (so host) cria outro mundo
  com os mesmos lugares e manda o estado; os convidados voltam a `playing`
  sozinhos ao receber. A sessao e a conexao continuam as mesmas

### Rede

Quem simula e o host, no navegador dele. O servidor de salas so repassa.

```ts
type Snapshot; // World sem `player` e `intelligence`; `rooms` e `run.events` opcionais
function encodeSnapshot(world: World, sentRooms: string): Snapshot;
function applySnapshot(previous: World | null, snapshot: Snapshot, you: number): World;
function cleanInput(payload: unknown): InputState | null;
```

- host: a cada `SNAPSHOT_EVERY` passos (30 vezes por segundo) manda o mundo
  em JSON. `rooms` so vai quando `roomsKey` muda (sala nova, caixa quebrada);
  `run.events` so vai com `status: 'dead'`. O fim da partida vai na hora
- convidado: nao simula. Manda o `InputState` quando ele muda e troca o mundo
  inteiro a cada snapshot; `world.player` vira `players[you]`. A engine ja
  suaviza posicao entre estados
- host guarda o ultimo input de cada convidado; pulso (`interact`, `open`)
  fica guardado ate o passo seguinte (`mergeInput`, `clearPulses`) e todo
  input passa por `cleanInput`
- o convidado nao espera o host para desenhar (`prediction.util.ts`). A cada
  passo local, `predictStep` anda o proprio jogador pelo input (`movePlayer`)
  e adianta colegas, inimigos e balas em linha reta, na velocidade medida
  entre os dois ultimos estados, por ate `EXTRAPOLATE_MAX`. A cada estado,
  `reconcile` poe o jogador onde o host disse e reaplica os inputs locais dos
  ultimos `rtt` segundos (ping do convidado + ping do host). E so visual: o
  host continua decidindo tudo
- ping: cada cliente cronometra `net:ping` a cada 2 s e avisa com
  `net:latency`; o servidor guarda em `PlayerInfo.ping` e repassa em
  `session:update`. O `session.store` leva os pings ao `game.store`
  (`setPings`, por lugar da partida), que os usa na previsao e no placar
  (`Score.ping`)
- aba do host em segundo plano para o `requestAnimationFrame`: a partida
  congela para todos ate ele voltar

### Store

- `game.store`: `Screen` ganha `'lobby'`. `openLobby()`, `startMulti(seats,
link, seed?)`, `receiveInput(index, payload)`, `receiveState(snapshot)`.
  `tick` simula (solo ou host) ou so envia input (convidado). No multi nao ha
  legenda inicial nem pausa, e a sala nao conta para `best`. `backToMenu` e
  `startRun` chamam `link.leave()`
- placar e menu: `Player` tem `kills` (quem estava em foco quando o inimigo
  morreu) e `deaths` (cada vez que `hp` cruza zero). O store publica
  `scores` (um por jogador, com `you` e `alive`), `scoreboard` (aberto pelo
  Tab segurado ou pelo icone do HUD) e, em rede, `online`, `host` e `menu`.
  `togglePause` em rede nao pausa: abre e fecha `menu` por cima do jogo.
  O store tambem publica `reviving` (escolha do bau aberta) e tem
  `revive(id)` e `restartMatch()`.
  `endMatch()` so vale para o host: poe `status: 'dead'` e manda o estado na
  hora, levando todos para a tela de resultado
- `session.store`: `status` (`idle`, `connecting`, `lobby`, `room`,
  `playing`), `name` (persistido), `sessions`, `session`, `you`, `error`;
  `connect`, `create(publica)`, `join(codigo)`, `start`, `leave`,
  `disconnect`. Ao receber `session:started` monta o `MultiLink` e chama
  `startMulti`; `session:closed` (host saiu) tira todos da partida
- `app/net`: `protocol.ts` (copia do servidor) e `session.client.ts`
  (socket.io). Endereco do servidor: `VITE_SERVER_URL`, ou a mesma maquina na
  porta 3001
