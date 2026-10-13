# Personagens

Como player e inimigos sao modelados e animados, e como criar um tipo ou uma
skin nova. Codigo em `src/app/engine/renderers/character.renderer.ts` (monta e
posa) e `world.renderer.ts` (anima a cada quadro).

Ha dois jeitos de desenhar um personagem, e os dois convivem:

- **de pecas** (o que este jogo usa): **montado em codigo** com formas
  basicas do three.js e **animado por conta**, girando articulacoes a cada
  quadro. Sem osso, clipe nem arquivo. E o que as secoes 1 a 6 descrevem
- **de modelo**: arquivo glTF com esqueleto e clipes de animacao, atras do
  adaptador `CharacterView`. **Desligado no Shadow Contract**: o codigo, os
  testes e o empacotador estao aqui, mas `character-models.config.ts` esta
  vazio e nao ha arquivo de modelo no repositorio. Esta ligado no Blade &
  Bounty, o jogo medieval que nasceu deste. Ver "Personagens de modelo", no
  fim

## Eixos

Local do personagem: `+x` e a frente, `+z` e a direita, `+y` e para cima.
`SIDES = [1, -1]` e `[direita, esquerda]`; `arms[0]` e `legs[0]` sao os da
direita. A simulacao e 2D `(x, y)`; a engine poe o personagem em
`(x, altura, -y)`.

## 1. Pecas

`createCharacterKit(look)` cria as formas uma vez (`geo`) e todos os
personagens do kit as reaproveitam.

| Peca                          | Forma                                                               |
| ----------------------------- | ------------------------------------------------------------------- |
| cabeca (`head`)               | esfera, raio 0.3                                                    |
| tronco (`torso`)              | capsula, mais larga nos ombros                                      |
| braco, perna (`arm`, `leg`)   | capsulas finas                                                      |
| mao (`hand`)                  | esfera pequena                                                      |
| pe (`foot`)                   | capsula deitada e achatada                                          |
| rosto, olho, camisa, gravata  | caixas                                                              |
| faixa (`band`), pontas        | anel (torus) e duas caixas (`tail`)                                 |
| cabelo (`hair`)               | meia esfera                                                         |
| arma de fogo no braco (`gun`) | caixa                                                               |
| katana                        | `blade` (perfil 2D curvo extrudado, `katanaBlade`), `grip`, `guard` |

Proporcao "chibi": cabeca grande, tronco curto. Alturas fixas das
articulacoes: `HIP_Y` 0.36, `TORSO_Y` 0.6, `SHOULDER_Y` 0.76, `HEAD_Y` 1.1.

## 2. Receita de cada tipo

`CharacterKind` e `'player'` mais os `EnemyKind` (`ninja`, `suit`, `fat`).
Tres tabelas definem um tipo:

- `PARTS[kind]`: pecas do tronco (`body`) e da cabeca (`head`). Cada peca e
  uma linha `[forma, material, x, y, z, inclinacao?, escala?]`
- `CLOTH[kind]`: material de bracos e pernas
- `HOLD[kind]`: angulo em que o braco direito fica parado segurando a arma

| Tipo     | Corpo                                    | Cabeca                              | Na mao                 |
| -------- | ---------------------------------------- | ----------------------------------- | ---------------------- |
| `player` | tronco na cor da roupa                   | capuz, rosto, olhos, faixa e pontas | katana                 |
| `ninja`  | igual ao player, roxo com faixa vermelha | igual                               | katana                 |
| `suit`   | tronco azul, camisa, gravata vermelha    | pele, cabelo, olhos                 | pistola (caixa)        |
| `fat`    | tronco preto, camisa, gravata dourada    | pele, careca, olhos                 | escopeta (caixa maior) |

Excecoes escritas em `make(kind)`, fora das tabelas:

- quem leva arma de fogo no braco (`gunner`: `suit` e `fat`) tem mao na cor
  da pele e nao ganha espada
- `fat` tem o tronco escalado em x e z (`girth` 1.5) e os ombros afastados
  na mesma proporcao
- so o `player` usa as escalas de `PlayerLook`; inimigo e sempre 1

## 3. Esqueleto

Sem ossos. As articulacoes sao grupos vazios aninhados; girar um grupo leva
junto tudo que esta dentro dele.

```text
root            posicao e direcao no mundo
├── shadow      disco escuro no chao
└── lean        inclina o corpo todo (corrida, mergulho do salto)
    └── body    gira e avanca no golpe
        ├── trunk     tronco; dobra e encurta ao agachar
        ├── head
        ├── legs[2]   pivo no quadril (HIP_Y)
        └── arms[2]   pivo no ombro (SHOULDER_Y)
            └── sword   so em arms[0]: grupo proprio, gira no golpe
```

`make` devolve um `Character` com essas referencias (`root`, `lean`, `body`,
`trunk`, `head`, `legs`, `arms`, `sword`, `shadow`) mais o estado que a
animacao guarda entre quadros (`last`, `speed`, `idle`, `swing`,
`attackLeft`).

Arma de fogo do player nao e peca do personagem: `createHeldGuns`
(`weapon.renderer.ts`) pendura os modelos no braco direito e mostra o da arma
em uso.

## 4. Aparencia

- **Toon**: `MeshToonMaterial` com rampa de 3 tons (`ramp`). A sombra cai em
  degraus, nao em gradiente
- **Contorno**: `addParts` da a cada peca uma copia dela mesma, `OUTLINE`
  maior em cada eixo, com o material `outline` pintado so por dentro
  (`BackSide`). De fora, sobra a borda escura. O material e um so por kit
  (`kit.outline`): trocar esse material nas malhas de um personagem muda o
  contorno dele inteiro. E assim que a furia do inimigo e a raiva do player
  ficam com borda vermelha (`mat.rageOutline`, em `world.renderer.ts`)
- **Custo**: 2 malhas por peca. Serve ate ~30 personagens em cena; acima
  disso, fundir geometrias

## 5. Animacao

Nada e gravado. A cada quadro o renderer calcula angulos e aplica nos
pivos. As funcoes se somam nesta ordem:

| Funcao          | Arquivo                 | O que faz                                                                                                                                                                 |
| --------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animate`       | `world.renderer.ts`     | suaviza posicao e direcao, mede a velocidade, balanca pernas e bracos na corrida, inclina `lean`                                                                          |
| `animateJumper` | `world.renderer.ts`     | chama `animate`; no salto faz o arco e o mergulho, vento nas costas (arcos e riscos que correm para tras; vale tambem para o corpo de modelo); agacha e encosta em parede |
| `poseCrouch`    | `character.renderer.ts` | quadril desce, tronco dobra (`trunk`), pernas abrem em passo                                                                                                              |
| `poseAttack`    | `character.renderer.ts` | golpe de espada, ou recuo do tiro em quem nao tem espada                                                                                                                  |
| `poseDead`      | `character.renderer.ts` | estirado, bracos e pernas abertos                                                                                                                                         |

Tudo depende de dados do `World`, nunca de relogio proprio: `player.slash`
(segundos que faltam do golpe), `player.dash`, `player.crouching`,
`enemy.attack`, `enemy.state`. A simulacao decide quando; a engine so
desenha a fase.

### Golpe de espada

`poseAttack(character, remaining, spinning)` recebe quanto falta do golpe
(`SLASH_TIME` no inicio, 0 no fim) e deriva duas curvas: `windup` (preparo,
na primeira metade) e `strike` (o corte). Cada jeito de golpear e um `Swing`
em `SWINGS`: so numeros dizendo quanto o tronco torce, quanto o braco abre e
sobe, quanto a lamina deita e varre, e quantas voltas o corpo da (`spin`).

- golpe novo sorteia um jeito diferente do anterior; o primeiro de cada
  personagem e o corte lateral
- `spinning` forca o giro: e o golpe de salto do player
- golpe novo = mais um objeto em `SWINGS`. Nao precisa de codigo

## 6. Aparencia do jogador

`PlayerLook` (`game.store.ts`), editado na tela de personagem:

| Campo                           | Efeito                                           |
| ------------------------------- | ------------------------------------------------ |
| `cloth`, `accent`, `skin`       | cores de roupa, faixa e pele                     |
| `head`, `legs`, `hands`, `feet` | escalas, de `LOOK_SCALE.min` a `max` (0.7 a 1.4) |
| `weapon`                        | escala da espada e das armas (0.4 a 1.4)         |

O `look` vale para o kit inteiro: aparencia nova pede kit novo
(`createCharacterKit`). No multiplayer, quem tem cor propria ganha um kit so
dele. As escalas sao so visuais: nao mudam alcance, colisao nem dano.

`character-preview.ts` usa o mesmo `make`, entao o que aparece no editor e o
que aparece na partida.

## Receitas

### Inimigo novo

1. `EnemyKind` em `world.types.ts` e stats em `ENEMY_KINDS`
   (`world.constants.ts`). `CharacterKind` ganha o tipo sozinho
2. `PARTS`, `CLOTH` e `HOLD` em `character.renderer.ts`: o TypeScript acusa
   as tres ate ter a entrada
3. forma que nao existe: mais uma linha em `geo`
4. proporcao diferente (largo, alto): escala no grupo certo dentro de `make`,
   como o `girth` do gordo. Nao mexer em `trunk.scale.y`: o agachar usa

O `fat` entrou assim, em cerca de 25 linhas.

### Skin do player

Do mais barato para o mais caro:

1. **Cor**: ja existe (`cloth`, `accent`, `skin`). Um conjunto de skin pode
   ser so tres cores com nome
2. **Peca trocada ou extra** (chapeu, mascara, capa curta, outra lamina): um
   campo novo em `PlayerLook` escolhe qual lista de `Part` entra em
   `PARTS.player`. Peca presa a `head` acompanha a cabeca; presa a `trunk`,
   o tronco; a `arms[i]`, o braco
3. **Silhueta** (mais gordo, mais alto): escala em grupo, como no gordo

Como o contorno e automatico em `addParts`, peca nova ja sai com borda.

### Golpe ou animacao nova

- golpe: objeto novo em `SWINGS`
- pose nova (comemorar, levar dano): funcao `poseX(character, fase)` no
  molde de `poseCrouch`, chamada em `drawPlayer` ou no laco dos inimigos, com
  a fase vinda de um contador do `World`

## Limites

- so forma simples: sem rosto detalhado, roupa com dobra, cabelo solto ou
  capa esvoacante
- sem deformacao de malha: junta e sempre peca rigida encostada em peca
  rigida
- modelo pronto (GLB com esqueleto) nao entra como skin do personagem de
  pecas: sao sistemas diferentes. Entra como personagem de modelo, pelo
  caminho da ultima secao

## Onde esta centralizado, e onde nao

A **montagem** ja e um lugar so: player e todos os inimigos saem de
`createCharacterKit(...).make(kind)`, pelas mesmas tabelas. O preview do
editor e a partida usam o mesmo codigo.

A **animacao** nao e: esta dividida em dois arquivos, e `world.renderer.ts`
mexe direto nas articulacoes (`lean`, `arms`, `legs`, `head`) dentro de
`animate`, `animateJumper`, `layDead` e `drawPlayer`. Para o que existe hoje
isso nao atrapalha o personagem de pecas. O personagem de modelo ja entra por
uma fronteira (`CharacterView`), mas a parte de pecas ainda nao passou para
tras dela: ver "O que falta" na ultima secao.

## Aprofundando: o golpe de espada

`poseAttack` roda todo quadro, mesmo sem golpe (com `remaining` 0 devolve
tudo ao repouso). Com golpe em curso:

```text
phase  = 1 - remaining / SLASH_TIME          0 no comeco, 1 no fim
windup = sin(pi * phase * 2)   se phase < 0.5   preparo: sobe e desce na 1a metade
strike = sin(pi * (phase - 0.2) / 0.8)  se phase > 0.2   corte: comeca antes do preparo acabar
turned = phase^2 * (3 - 2 * phase)          volta do giro, saindo e chegando devagar
```

`windup` e `strike` se sobrepoem entre 0.2 e 0.5: o braco ja desce enquanto o
tronco ainda termina de armar. E o que da peso ao golpe.

Cada articulacao recebe `windup * (numero de preparo) + strike * (numero de
golpe)`, com os numeros vindos do `Swing` sorteado:

| Articulacao          | Preparo (`windup`)  | Golpe (`strike`)                    |
| -------------------- | ------------------- | ----------------------------------- |
| `body.rotation.y`    | `windTwist` (torce) | `twist`, mais `turned * 2pi * spin` |
| `body.rotation.z`    | 0.1 fixo            | `-lean` (inclina para frente)       |
| `body.position.x`    | -0.08 (recua)       | `lunge` (avanca)                    |
| `arms[0].rotation.y` | `windSide` (abre)   | `-armSide` (cruza)                  |
| `arms[0].rotation.z` | `windRaise` (sobe)  | `armStrike` (desce)                 |
| `sword.rotation.y`   | 0.55 fixo           | `-swordTurn` (vira a lamina)        |
| `sword.rotation.z`   | `windTilt` (deita)  | `-swordSweep` (varre)               |

Braco esquerdo, cabeca e pernas levam so um pouco de `strike`, com numeros
fixos: acompanham sem roubar a cena.

Como afinar um golpe:

- mais **alcance visual**: subir `lunge` e `armStrike`
- mais **peso**: `windTwist` mais negativo (arma mais para tras) e `lean` maior
- **varrida mais larga**: `swordSweep`. Em 4.15 a lamina percorre mais de meia
  volta
- **giro**: `spin: 1` da uma volta inteira; com `swordSweep` baixo e `armSide`
  alto a espada fica aberta de lado e varre em volta

O tempo do golpe (`SLASH_TIME`, 0.36 s) e da simulacao, nao daqui: e ele que
define a duracao. Golpe mais lento ou mais rapido muda o jogo, nao so a
animacao.

Quem nao tem espada (`suit`, `fat`) usa `RECOIL` no lugar do `Swing`: o mesmo
calculo, com numeros de recuo de tiro.

## Aprofundando: acessorio e skin por peca

Exemplo completo: chapeu de palha como skin do player.

1. **Forma**, em `geo`:

   ```ts
   // cone baixo e largo
   hat: new THREE.ConeGeometry(0.42, 0.2, 16),
   ```

2. **Escolha**, em `PlayerLook` (`game.store.ts`), com o padrao em
   `DEFAULT_LOOK` e a validacao em `mergeLook`:

   ```ts
   hat: 'none' | 'straw';
   ```

3. **Peca**, em `createCharacterKit`. A posicao e relativa ao centro da
   cabeca, que tem raio 0.3:

   ```ts
   const HATS: Record<PlayerLook['hat'], Part[]> = {
     none: [],
     straw: [[geo.hat, mat.gold, 0, 0.27, 0]],
   };
   ```

   e a receita do player passa a somar a escolha:

   ```ts
   const player = ninja(mat.playerCloth, mat.playerAccent, mat.playerSkin);
   player.head.push(...HATS[look.hat]);
   ```

4. **Editor**: um seletor em `look-editor.component.tsx` chamando a mesma
   acao do store que ja troca cor e escala

Pronto: contorno, sombra toon, preview e multiplayer vem de graca, porque a
peca entrou pelo mesmo `addParts`.

Onde prender cada tipo de acessorio:

| Acessorio                        | Lista ou grupo                    | Acompanha                     |
| -------------------------------- | --------------------------------- | ----------------------------- |
| chapeu, mascara, oculos, chifre  | `PARTS[kind].head`                | a cabeca, inclusive o olhar   |
| mochila, capa curta, colete      | `PARTS[kind].body`                | o tronco, inclusive o agachar |
| luva, bracelete, escudo de braco | lista `parts` de `arms` em `make` | o braco                       |
| bota, joelheira                  | lista de `legs` em `make`         | a perna                       |
| outra arma branca                | `katanaInHand`                    | o punho, e o golpe            |

Cuidados:

- peca que sai muito do corpo (capa longa, asa) atravessa parede e o proprio
  corpo no agachar e no mergulho: nao ha colisao nem tecido
- arma branca nova precisa caber no golpe: `poseAttack` gira o grupo `sword`
  em torno do punho. Lamina muito mais longa que 0.88 passa do alcance real
  (`SWORD_RANGE`)
- `look` trafega no multiplayer e fica salvo no aparelho: campo novo precisa
  de padrao e de validacao em `mergeLook`, senao save antigo quebra
- skin paga: o que libera e a posse no servidor, nao o campo em `look`. O
  cliente aceitar `hat: 'straw'` nao pode bastar

## Personagens de modelo

Corpo feito de um arquivo glTF (malha, esqueleto, clipes de animacao) em vez
de pecas. Codigo em `src/app/engine/characters/`; arquivos em
`public/models/`.

### As pecas e quem conhece o que

```text
world.renderer.ts            sabe do jogo; entrega a pose do quadro
      │  CharacterPose
      ▼
CharacterView                a fronteira (character-view.types.ts)
      ▲
gltf-character.view.ts       modelo + AnimationMixer; serve a qualquer esqueleto
      │ usa
clip-driver.util.ts          pose -> que clipe, que peso, que ponto. Conta pura
      ▲ configurado por
kaykit.rig.ts                um esqueleto: escala, frente, ossos, clipes
      ▲ usado por
character-models.config.ts   este jogo: que inimigo usa que arquivo
```

| Arquivo                      | Papel                                                                      | Sabe de que jogo e? |
| ---------------------------- | -------------------------------------------------------------------------- | ------------------- |
| `character-view.types.ts`    | `CharacterView` e `CharacterPose`: o contrato                              | nao                 |
| `clip-driver.util.ts`        | `driveClips`: escolhe clipes a partir da pose. Sem three                   | nao                 |
| `gltf-character.view.ts`     | `createGltfCharacterView`: copia o modelo, toca os clipes, `RigSpec`       | nao                 |
| `character-model.loader.ts`  | `loadCharacterView`: baixa (uma vez por arquivo) e monta, `CharacterModel` | nao                 |
| `kaykit.rig.ts`              | `KAYKIT_MEDIUM`: o esqueleto medio do KayKit                               | nao                 |
| `character-models.config.ts` | `ENEMY_MODELS`: inimigo -> modelo                                          | **sim, so ele**     |

Os cinco primeiros nao importam `app/modules` nem `app/store`: vao inteiros
para outro jogo (`docs/engine-reuse.md`).

### O contrato

```ts
type CharacterPose = {
  moving: number; // 0 parado, 1 correndo
  crouching: boolean;
  attack: number | null; // fase de 0 a 1; null = nao esta fazendo
  dash: number | null;
  shot: number | null;
  swing: number; // qual jeito de golpear
  spinning: boolean;
  dead: boolean;
};

type CharacterView = {
  object: THREE.Object3D; // pes na origem, olhando para +x
  pose(pose: CharacterPose, dt: number): void;
  slot(name: string): THREE.Object3D | null; // onde prender arma
  highlight(color: number | null): void; // furia
  dispose(): void;
};
```

Duas regras sustentam o resto:

- **a fase vem da simulacao.** Golpe, salto, tiro e morte nao andam no relogio
  da animacao: a view recebe a fase (`1 - slash / SLASH_TIME`) e poe o clipe
  naquele ponto. Por isso o movimento nunca sai de sincronia com o acerto. So
  os ciclos (parado, correr) correm no tempo do quadro
- **posicao e direcao nao sao da view.** Quem usa poe `object` dentro do
  proprio grupo. Aqui e o `root` do personagem de pecas, que ja segue a
  simulacao suavizado: sombra, marcadores e balao continuam nele

### Como a pose vira clipe

`driveClips(set, pose, deadFor, duration)` devolve a lista de clipes ativos;
o que nao esta na lista fica com peso 0.

| Pose                      | Clipes                                                                |
| ------------------------- | --------------------------------------------------------------------- |
| `dead`                    | `death`, uma vez, travado no fim                                      |
| `attack` (com `spinning`) | `spin`, se o esqueleto tem; senao o golpe da vez                      |
| `attack`                  | `attacks[swing % n]`, no ponto da fase                                |
| `dash`                    | `dash`                                                                |
| `shot`                    | `shot` no tronco; nas pernas, os ciclos                               |
| nada disso                | `idle` e `move` misturados por `moving`; agachado, `crouch` e `sneak` |

Prioridade: morte, golpe, salto, tiro. Acao sem clipe no `ClipSet` nao trava
o corpo: seguem os ciclos.

**Tiro so no tronco.** Quem esta de arma na mao passa o tempo todo com `shot`
ligado (apontando). Se o clipe de tiro tomasse o corpo inteiro, as pernas
parariam: o personagem deslizaria duro. Por isso o `RigSpec` lista os ossos
da cintura para baixo (`lower`), e a view cria duas versoes de cada clipe
envolvido: o de tiro so com as curvas do tronco, os ciclos so com as das
pernas. Com `shot` ligado, `driveClips` devolve os ciclos na parte `lower` e
o tiro na parte `upper`: o tronco aponta e as pernas andam, correm ou ficam
paradas conforme `moving`. Sem `lower` no esqueleto, o tiro volta a tomar o
corpo inteiro.

**Cambalhota no salto.** O KayKit nao tem clipe de rolamento, entao o giro e
conta: com `RigSpec.roll` (`{ turns, height, pivot }`), a view gira o corpo
inteiro para frente em torno de `pivot` (o centro do corpo) e o ergue
`height` no meio do caminho, tudo pela fase de `dash`. O clipe `dash` so da a
forma do corpo durante o giro: no `KAYKIT_MEDIUM` e um quadro parado de
`Crouching`, encolhido. Esqueleto com clipe de rolamento proprio usa o clipe
e deixa `roll` de fora.

Cada clipe e um `ClipRef` `{ name, from?, to? }`. `from` e `to` cortam o
trecho usado (fracao de 0 a 1): os golpes do KayKit duram mais de 1 s, com
preparo e volta longos, e o golpe do jogo dura `SLASH_TIME` (0.36 s). O
`KAYKIT_MEDIUM` usa so o miolo de cada um.

### Quem usa que modelo

`character-models.config.ts`. **Neste jogo: ninguem** (`PLAYER_MODEL` e
`null`, `ENEMY_MODELS` e vazio). A tabela e a do Blade & Bounty, como
exemplo de preenchimento:

| Quem               | Modelo (KayKit Adventurers) | Na mao                                 |
| ------------------ | --------------------------- | -------------------------------------- |
| player             | Rogue Hooded                | espada; com arma de alcance, a do jogo |
| quem golpeia       | Knight                      | espada                                 |
| quem atira         | Ranger                      | a arma de alcance do jogo              |
| o grande que atira | Barbarian, 25% maior        | a arma de duas maos do jogo            |

As armas na mao de quem atira sao os modelos de `weapon.renderer.ts`, os
mesmos do HUD: so mudam de lugar, do braco de pecas para a mao do modelo.

### Como entra no jogo

Em `world.renderer.ts`, igual para inimigo (`buildEnemy`) e player
(`buildPlayer`):

1. monta o personagem de pecas como sempre e pede `loadCharacterView`
2. enquanto o arquivo nao chega, o jogador ve o de pecas. Quando chega, o
   corpo de modelo entra no `root` e o `lean` (corpo de pecas) e escondido
3. a cada quadro, depois de animar o de pecas, `body.pose(...)` recebe a
   mesma fase
4. morto: o modelo cai pelo clipe, entao o `root` fica de pe (no de pecas e o
   `root` que deita)
5. furia do inimigo e raiva do player: `highlight` no modelo (brilho
   vermelho), ja que nao ha contorno
6. quem sai de cena chama `dispose`; modelo que chega depois disso e
   descartado
7. arquivo que nao chega (offline, erro): fica o de pecas, sem aviso

O `root` de pecas continua sendo animado por baixo, escondido. Custa pouco e
e o que mantem posicao, sombra e marcadores iguais para os dois corpos.

Como a pose e montada:

| Campo       | Inimigo                                                                | Player                                                         |
| ----------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `moving`    | velocidade suavizada / `MODEL_RUN_SPEED`                               | igual                                                          |
| `crouching` | nunca                                                                  | `player.crouching`                                             |
| `attack`    | `1 - enemy.attack / SLASH_TIME`, so quem golpeia                       | `1 - player.slash / SLASH_TIME`                                |
| `shot`      | quem atira: apontando (`AIM_HOLD`) em `alert`, e dali ate 1 no disparo | com arma na mao: apontando, e ate 1 no disparo (`player.shot`) |
| `dash`      | `1 - enemy.dash / DASH_TIME`                                           | `1 - player.dash / DASH_TIME`                                  |
| `spinning`  | nunca                                                                  | golpe que comecou em salto; vale ate o golpe acabar            |
| `swing`     | o indice sorteado pelo personagem de pecas                             | igual                                                          |

Player, alem disso:

- invisivel: esconde o corpo de modelo (e o de pecas continua escondido)
- arma de fogo: o suporte de `createHeldGuns` sai do braco de pecas e entra
  num encaixe na mao do modelo, que gira o eixo (cano em `+x` da mao) e
  desfaz a escala do corpo. A espada do modelo some enquanto ha arma na mao
- recuo e clarao do tiro seguem os de sempre: mexem no mesmo suporte

### Arquivos e peso

Nao ha arquivo de modelo neste repositorio. O que os scripts geram, medido
no Blade & Bounty:

| Arquivo                             | O que e                          | Tamanho      |
| ----------------------------------- | -------------------------------- | ------------ |
| `medium.anims.glb`                  | esqueleto + 16 clipes, sem malha | 334 KB       |
| um GLB por personagem               | malha, com a textura dentro      | 330 a 480 KB |
| espada (`.gltf` + `.bin` + textura) | o que vai na mao                 | 29 KB        |

Cada arquivo baixa quando o primeiro personagem que o usa aparece, e o
service worker guarda para jogar offline (`globPatterns` em `vite.config.ts`
ja inclui `glb`, `gltf` e `bin`).

O pacote original do KayKit traz um GLB por tema de animacao, cada um com o
manequim dentro (4 MB so nos cinco usados). `scripts/pack-kaykit.mjs` junta
os clipes escolhidos num arquivo so, tira malha e escala, e reduz curva
parada a um quadro.

Origem e licenca: KayKit Character Animations 1.1 e KayKit Adventurers 2.0,
de Kay Lousberg (kaylousberg.itch.io), CC0. Credito nao e obrigatorio.

### Ligar neste jogo

1. escolher os modelos (do tema do jogo) e por em `public/models/`. Para o
   KayKit: baixar os pacotes e rodar
   `node scripts/pack-kaykit.mjs <Character_Animations> <Adventurers>`
2. preencher `PLAYER_MODEL` e `ENEMY_MODELS` (o arquivo traz um exemplo)
3. `pnpm test`: com os arquivos presentes, `kaykit.assets.test.ts` deixa de
   ser pulado e confere clipes e ossos

### Receitas

**Outro inimigo com modelo do KayKit** (mesmo esqueleto):

1. por o nome do GLB em `CHARACTERS` no script e rodar
   `node scripts/pack-kaykit.mjs <Character_Animations> <Adventurers>`
2. uma entrada em `ENEMY_MODELS` com o `url`, `KAYKIT_CLIPS_URL` e
   `KAYKIT_MEDIUM`
3. `pnpm test`: `kaykit.assets.test.ts` confere que o arquivo existe e tem os
   ossos

**Clipe novo** (ex.: tiro de duas maos para o gordo): nome em `CLIPS` no
script, rodar, e apontar no `ClipSet`. O teste de arquivos acusa clipe
citado que nao foi empacotado.

**Outro esqueleto** (Quaternius, Mixamo): um arquivo `<kit>.rig.ts` com o
`RigSpec` dele. Antes, listar o que o arquivo tem:
`gltf.animations.map((clip) => clip.name)` e os nomes dos ossos das maos.
Nada mais muda: view, driver e carregador sao os mesmos.

**Trocar quem usa que modelo**: so `character-models.config.ts`.

**Desligar os modelos**: esvaziar `ENEMY_MODELS` e por `PLAYER_MODEL` em
`null` (como esta hoje). Volta tudo ao personagem de pecas.

### O que falta

- **aparencia do player nao vale no modelo.** Cores e escalas de `PlayerLook`
  so mexem no personagem de pecas, e o editor (`character-preview.ts`) ainda
  mostra o de pecas: o que se edita la nao e o que aparece na partida
- **multiplayer**: todo jogador usa o mesmo modelo, sem a cor de cada um. So
  o nome sobre a cabeca distingue
- **tema**: os modelos sao medievais (cavaleiro, arqueiro, barbaro) num jogo
  de ninja e terno, e seguram armas de fogo modernas
- **o personagem de pecas ainda nao esta atras de `CharacterView`.** O
  renderer continua girando as articulacoes dele direto. O passo seguinte e
  um `parts-character.view.ts` que embrulhe `animate`, `animateJumper`,
  `poseAttack`, `poseCrouch` e `poseDead`; ai o renderer fala so com a
  fronteira e o `root` de pecas escondido deixa de existir
- **contorno**: o modelo nao tem a borda escura das pecas. A casca invertida
  escala cada peca pelo centro, o que nao funciona em malha que deforma;
  pede um segundo `SkinnedMesh` com os vertices empurrados pela normal
- **variacao que o clipe nao traz**: encostar em parede, cabeca olhando em
  volta, vento do salto no corpo
- **desempenho em celular fraco** nao foi medido
