# Reuso em outros jogos

O que deste projeto serve para o proximo jogo, o que e so do Shadow Contract,
e como comecar um jogo novo a partir daqui. Regras de camada e nome continuam
em `docs/pattern.md`.

Estado atual, sem enfeite: **ainda nao existe uma engine separada**. Quase todo
arquivo de `src/app` importa `modules/world` (o `World` deste jogo). O que
existe e uma arquitetura que se repete bem e um punhado de pecas que ja sao
neutras. Este documento marca a fronteira para ela nao piorar e da a ordem de
extracao para quando houver um segundo jogo.

## Jogos que saem daqui

| Jogo            | Pasta                        | O que mudou                                                        |
| --------------- | ---------------------------- | ------------------------------------------------------------------ |
| Shadow Contract | `workspace/shadow-contract`  | o original: ninja e terno, personagens de pecas, cenario de caixas |
| Blade & Bounty  | `workspace/blade-and-bounty` | medieval: arco, besta, modelos e masmorra do KayKit, outras fontes |

O Blade & Bounty foi feito pelo caminho de "Comecar um jogo novo hoje"
(copia), nao por pacote. Por isso o codigo comum existe **duas vezes**.

**Regra enquanto nao ha pacote:** correcao ou melhoria em codigo comum feita
num jogo e copiada para o outro no mesmo dia. Vale para:

- `src/app/engine/characters/*` menos `character-models.config.ts`
- `src/app/engine/scenery/model-kit.ts`
- `scripts/pack-kaykit*.mjs`
- os testes dessas pastas

Os arquivos sao identicos nos dois, salvo os nomes que o tema trocou no
Blade & Bounty (`ninja` virou `knight`, `pistol` virou `bow` etc.; tabela no
README de la). `diff -r` entre as duas pastas mostra o que divergiu.

Com dois jogos, o passo "Quando virar pacote" deixou de ser hipotetico: o
primeiro candidato e exatamente essa lista.

## As tres camadas de reuso

```text
plataforma   conta, pagamento, analytics, anuncio, compartilhar, instalar
             nao sabe que jogo esta rodando
kit          laco de passo fixo, input, rng, colisao em grade, caminho,
             rede host/convidado, joystick, i18n
             sabe que e um jogo, nao sabe qual
jogo         World, sistemas, constantes, templates, renderers, HUD, textos
             so serve para o Shadow Contract
```

A plataforma e onde o reuso rende mais (todo jogo precisa igual) e onde ainda
nao ha codigo. O kit rende medio e esta hoje misturado com o jogo.

## Mapa do que existe

### Ja neutro: copia direto

Nao importa nada de `app/modules` nem de `app/store`.

| Arquivo                                                         | O que e                                                                                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `shared/utils/rng.util.ts`                                      | rng com seed, estado em `{ rngState }`                                                                                           |
| `shared/utils/math.util.ts`                                     | distancia, angulo, clamp                                                                                                         |
| `shared/lib/utils.ts`                                           | `cn` de classes                                                                                                                  |
| `app/net/protocol.ts`                                           | contrato do servidor de salas; `game:input`, `game:state` e `game:event` levam `unknown`, o jogo define o formato                |
| `app/net/session.client.ts`                                     | conexao socket.io                                                                                                                |
| `resources/components/base/virtual-joystick/*`                  | joystick de toque com botoes de salto, agachar e ataque                                                                          |
| `resources/components/ui/*`                                     | botao e dialogo                                                                                                                  |
| `resources/pages/home/components/install-app/*`                 | convite de instalar o PWA                                                                                                        |
| `resources/pages/game/components/damage-vignette.component.tsx` | borda que pulsa (dano, aviso, vida baixa)                                                                                        |
| `resources/pages/game/components/kill-streak.component.tsx`     | selo de sequencia                                                                                                                |
| `app/engine/characters/*` menos `character-models.config.ts`    | personagem de modelo glTF atras de `CharacterView`: view, escolha de clipes, carregador, esqueleto KayKit (`docs/characters.md`) |
| `scripts/pack-kaykit.mjs`                                       | junta clipes do KayKit num GLB so, sem malha                                                                                     |
| `app/engine/scenery/model-kit.ts`                               | kit de cenario: um GLB com varias pecas, pedidas pelo nome (`docs/scenery.md`)                                                   |
| `scripts/pack-kaykit-dungeon.mjs`                               | junta pecas soltas do KayKit Dungeon num GLB so, com a textura uma vez                                                           |

O servidor de salas (`shadow-contract-server`) tambem e neutro: nao simula
nada, so junta jogadores e repassa mensagens. Serve a qualquer jogo em que o
host simula.

### Neutro na ideia, preso no jogo: precisa separar

O mecanismo serve a qualquer jogo, mas o arquivo importa tipos ou constantes
deste. A ultima coluna e o que corta a dependencia.

| Peca                                                      | Onde esta                                      | O que prende                                                                         | Como soltar                                                |
| --------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Laco de passo fixo, acumulador, teto de frame             | `app/engine/game-engine.ts`                    | chama `useGameStore`, monta cena e camera deste jogo                                 | receber `tick`, `getWorld` e `render` por parametro        |
| Teclado para eixo de movimento, pulsos (F, B)             | `app/engine/game-engine.ts`                    | `InputState` deste jogo                                                              | tipo generico de input                                     |
| Soco de camera e blur (`punch`, `clash`, dash)            | `app/engine/game-engine.ts`                    | le `world.player`                                                                    | receber as intensidades de 0 a 1                           |
| Colisao de circulo em grade, raio, linha de visao         | `modules/level/utils/grid.util.ts`             | `World`, `ROOM_W/H`, tiles e portas deste jogo, e a tabela de saque no mesmo arquivo | receber `isSolid(tx, ty)`; tirar saque e portas do arquivo |
| Caminho em grade (A\*)                                    | `modules/level/utils/pathfinding.util.ts`      | `World`, `tileAt`                                                                    | receber `isSolid`                                          |
| Snapshot host para convidado, `mergeInput`, `clearPulses` | `modules/multiplayer/utils/snapshot.util.ts`   | campos do `World`, `ITEMS` em `cleanInput`                                           | generico em `TWorld`; a limpeza de input fica no jogo      |
| Predicao do jogador local                                 | `modules/multiplayer/utils/prediction.util.ts` | `movePlayer`                                                                         | receber a funcao de mover                                  |
| Foco trocado (`asPlayer`, `nearestPlayer`)                | `modules/world/utils/players.util.ts`          | `Player`                                                                             | generico em `TPlayer` com `pos` e `hp`                     |
| Idioma, `useTexts`, `eventText`                           | `shared/i18n.ts`                               | o mecanismo divide o arquivo com os textos do jogo                                   | mecanismo num arquivo, textos em outro                     |
| Numero que sobe (`Floater`) e sua textura                 | `combat.system.ts`, `world.renderer.ts`        | tags deste jogo (headshot, overkill)                                                 | tipo com `text` e `color`                                  |
| Balao de tecla sobre objeto (`prompts`)                   | `world.renderer.ts`                            | sabe de caixa, bau e inimigo                                                         | receber lista de `{ pos, glyph, action }`                  |
| Lobby, sala de espera, placar com ping                    | `store/session-store`, `pages/lobby`           | chama `game.store` para comecar a partida                                            | callback `onStart`                                         |
| Imagem de recorde para compartilhar                       | `pages/game/components/share-record/*`         | texto e marca fixos                                                                  | receber titulo, numero e cores                             |
| Registro de eventos da partida (`run.events`)             | varios sistemas                                | so o formato e reusavel                                                              | tipo `{ at, text, en? }`                                   |

### So deste jogo: nao tentar reaproveitar

`modules/world/types` e `constants`, `combat`, `enemy`, `player`, `shop`,
`level.system`, os `*.template.ts`, `character.renderer`, `weapon.renderer`,
`world.renderer` (menos floaters e prompts), HUD, loja, legenda, `colors.ts`,
os textos de `i18n.ts`.

O jogo novo reescreve isso. O que ele herda daqui e o **formato**, descrito
abaixo, nao o codigo.

## O formato que se repete

Todo jogo neste molde tem as mesmas sete decisoes. Mantenha-as e o kit encaixa.

1. **Um `World` de dados simples.** Sem classe, sem metodo, sem referencia
   circular: serializa em JSON, o que da snapshot de rede e save de graca.
2. **Sistemas sao funcoes** `fn(world, ...args, dt)` que mutam o `World`.
3. **Passo fixo** (`FIXED_DT`). Nada de relogio dentro da simulacao.
4. **Aleatorio so por `nextRandom(world)`.** Mesma seed, mesma partida: e o
   que deixa testar chance com numero exato.
5. **Numero de balanceamento em `*.constants.ts`**, com comentario dizendo o
   que ele faz no jogo. E onde se ajusta o jogo sem ler codigo.
6. **Simulacao nao sabe de tela.** `modules` nao importa `three`, React nem
   DOM. A engine le o `World` e desenha; a UI le um resumo (`Hud`) no store.
7. **Host simula, servidor repassa.** Multiplayer sem servidor de jogo: o
   navegador do host roda `stepWorld` e manda snapshot.

Mais os habitos que sustentam isso: teste ao lado em `tests/`, e
`docs/contracts.md` atualizado junto com `world.types.ts`.

## Regra daqui para frente

Para a fronteira nao piorar enquanto nao ha segundo jogo:

- **Codigo de plataforma nasce em `src/platform/`** e nao importa `app/modules`,
  `app/store` nem `app/engine`. Conta, pagamento, posse de item, analytics e
  anuncio entram ai. Fala com o jogo por funcoes e eventos de nome generico
  (`track('match_end', { score })`, `owns('skin:x')`), nunca pelo `World`.
- **Peca nova que serve a qualquer jogo** (um utilitario de grade, um
  componente de toque) nao importa `modules/world`. Recebe por parametro o
  que precisa.
- **Mecanismo e conteudo em arquivos separados.** O que mais prende codigo
  aqui e o arquivo que tem os dois: `grid.util.ts` com colisao e tabela de
  saque, `i18n.ts` com o hook e os textos.

O teste da fronteira e mecanico: um arquivo e reusavel se a lista de imports
dele nao tem `@/app/modules`, `@/app/store` nem `@/app/engine`.

## Comecar um jogo novo hoje

Enquanto nao houver pacote, o caminho e copiar. E barato e nao acopla os jogos.

1. Copie o repositorio inteiro e o `shadow-contract-server`.
2. Mantenha: `shared/utils`, `shared/lib`, `app/net`, `resources/components`,
   a configuracao (vite, tsconfig, eslint, vitest, tailwind, PWA), os `docs/`.
3. Apague o conteudo de `app/modules/*`, os renderers, as paginas de jogo e
   os textos de `i18n.ts`. Guarde `game-engine.ts`, `grid.util.ts`,
   `pathfinding.util.ts`, `snapshot.util.ts` e `prediction.util.ts` como ponto
   de partida: sao as pecas da segunda tabela.
4. Escreva o `World` novo em `world.types.ts` seguindo o formato acima.
5. Escreva `stepWorld`, depois o renderer, depois o HUD. Nessa ordem: o jogo
   roda em teste antes de ter tela.
6. Ao adaptar cada peca guardada no passo 3, solte a dependencia do jeito que
   a tabela diz. E nessa hora que ela vira kit de verdade.

## Quando virar pacote

So com o segundo jogo andando. Antes disso nao da para saber qual e a
interface certa, e pacote com um unico consumidor so adiciona etapa de build.

Ordem, do que rende mais para o que rende menos:

1. **Plataforma** (`src/platform` vira pacote): conta, pagamento, analytics.
   Todo jogo usa igual, e e o que tem dinheiro e dado de usuario: corrigir num
   lugar so importa.
2. **Rede** (`app/net` + servidor + snapshot generico): ja esta quase solta.
3. **Kit de simulacao**: rng, math, grade, caminho, laco de passo fixo.
4. **Componentes de toque e UI**: joystick, vinheta, instalar, compartilhar.

Forma: monorepo pnpm (`packages/platform`, `packages/net`, `packages/kit`,
`games/shadow-contract`, `games/<novo>`). O projeto ja usa pnpm; workspace nao
pede ferramenta nova. Publicar em registro so se os jogos forem para
repositorios separados.

Nao entra em pacote: renderers, modelos, sistemas de combate e inimigo. Cada
jogo tem os seus, e forcar um formato comum ai custa mais do que copiar.
