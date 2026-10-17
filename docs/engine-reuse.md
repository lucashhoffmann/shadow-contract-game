# Reuso em outros jogos

O que este projeto pega da engine compartilhada, o que e so do Shadow
Contract, e onde vai codigo novo que serve a mais de um jogo. Regras de
camada e nome continuam em `docs/pattern.md`.

Estado atual: **a engine existe** e e uma biblioteca separada,
`three-hex-engine`, publicada no npm (`^0.1.1` em `dependencies`).
Repositorio: https://github.com/lucashhoffmann/three-hex-engine
(local em `../../three-hex-engine`). Arquitetura hexagonal (portas e
adaptadores) com plugins: ver o
[README](https://github.com/lucashhoffmann/three-hex-engine/blob/main/README.md) e
[architecture.md](https://github.com/lucashhoffmann/three-hex-engine/blob/main/docs/architecture.md).
Como cada jogo usa a engine e como comecar um jogo novo:
[AGENTS.md](https://github.com/lucashhoffmann/three-hex-engine/blob/main/AGENTS.md).
Os mesmos docs vem dentro do pacote: `node_modules/three-hex-engine/README.md`
e `node_modules/three-hex-engine/docs/`.

Este projeto e independente: lockfile proprio, deploy proprio, `pnpm install`
aqui dentro.

Codigo comum nao e mais copiado entre jogos. Correcao em peca que ja esta na
engine e feita no repositorio dela, sai numa versao nova e chega a cada jogo
quando ele sobe a versao.

## Jogos que usam a engine

| Jogo            | Pasta                              | O que mudou                                                        |
| --------------- | ---------------------------------- | ------------------------------------------------------------------ |
| Shadow Contract | `workspace/games/shadow-contract`  | o original: ninja e terno, personagens de pecas, cenario de caixas |
| Blade & Bounty  | `workspace/games/blade-and-bounty` | medieval: arco, besta, modelos e masmorra do KayKit, outras fontes |
| Sushi Rush      | `workspace/games/sushi-rush`       | restaurante: simulacao nova, kit Sushi Restaurant, sem combate     |

## O que este jogo pega da engine

| Import                   | O que usa                                                                       | Onde no jogo                                     |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| `three-hex-engine/core`     | `createEngine`: laco de passo fixo, teto de frame, frame snap                   | `app/engine/game-engine.ts`                      |
| `three-hex-engine/clock`    | `rafClock`                                                                      | `game-engine.ts`                                 |
| `three-hex-engine/input`    | `createKeyboardInput`, `createGamepadInput`, `combineInputs`, `MOVE`            | `game-engine.ts` (mover, dash, agachar)          |
| `three-hex-engine/three`    | `createThreeRenderer`, view de personagem glTF, clipes, carregador, `ModelKit`  | `game-engine.ts`, renderers, `characters`        |
| `three-hex-engine/kit`      | `nextRandom`, `clamp`, `distance`, `angleTo`, grade (`searchGrid`, `moveCircle`, `circleHitsTiles`, `castRay`) | `app/modules` (TS puro) |
| `three-hex-engine/protocol` | contrato do servidor de salas, um arquivo so para front e servidor              | `session.store`, lobby                           |
| `three-hex-engine/net`      | conexao socket.io                                                               | `app/net/session.client.ts` (so le `VITE_SERVER_URL`) |
| `three-hex-engine/server`   | servidor de salas inteiro                                                       | `shadow-contract-server/src/main.ts`             |

`three-hex-engine/kit` e TS puro: `app/modules` pode importar. `three` continua
so em `src/app/engine` (a engine importa `three` nos adaptadores dela).

`grid.util.ts` e `pathfinding.util.ts` continuam no jogo com a mesma
assinatura: sabem do `World`, de tiles e portas, e passam a conta para o kit.

## O que fica no jogo

`modules/world/types` e `constants`, `combat`, `enemy`, `player`, `shop`,
`level.system`, os `*.template.ts`, `character.renderer`, `weapon.renderer`,
`world.renderer`, `character-preview.ts`, `weapon-preview.ts`,
`character-models.config.ts` (hoje vazio: modelo desligado), `kaykit.rig.ts`,
`scenery.config.ts`, HUD, loja, legenda, `colors.ts`, `i18n.ts`, os atalhos de
um toque (P, F, B, Q, Tab, Enter) e o `preventDefault` no `keydown` de
`game-engine.ts`.

O jogo novo reescreve isso. O que ele herda daqui e o **formato**, descrito
abaixo, nao o codigo.

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

O kit esta em boa parte na engine (laco, input, rng, grade, rede). A
plataforma ainda nao tem codigo.

## Ainda no jogo, candidato a ir para a engine

### Ja neutro

Nao importa nada de `app/modules` nem de `app/store`. Precisou num segundo
jogo: mover para a engine, nao copiar.

| Arquivo                                                         | O que e                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `shared/lib/utils.ts`                                           | `cn` de classes                                                       |
| `resources/components/base/virtual-joystick/*`                  | joystick de toque com botoes de salto, agachar e ataque               |
| `resources/components/ui/*`                                     | botao e dialogo                                                       |
| `resources/pages/home/components/install-app/*`                 | convite de instalar o PWA                                             |
| `resources/pages/game/components/damage-vignette.component.tsx` | borda que pulsa (dano, aviso, vida baixa)                             |
| `resources/pages/game/components/kill-streak.component.tsx`     | selo de sequencia                                                     |
| `scripts/pack-kaykit.mjs`                                       | junta clipes do KayKit num GLB so, sem malha                          |
| `scripts/pack-kaykit-dungeon.mjs`                               | junta pecas soltas do KayKit Dungeon num GLB so, com a textura uma vez |

### Neutro na ideia, preso no jogo: precisa separar

O mecanismo serve a qualquer jogo, mas o arquivo importa tipos ou constantes
deste. A ultima coluna e o que corta a dependencia.

| Peca                                                      | Onde esta                                      | O que prende                                                      | Como soltar                                     |
| --------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| Atalhos de um toque (P, F, B, Q, Tab)                     | `app/engine/game-engine.ts`                    | `keydown` proprio; o `InputPort` ainda nao tem pulso              | pulso no `InputPort` ([AGENTS.md](https://github.com/lucashhoffmann/three-hex-engine/blob/main/AGENTS.md))   |
| Soco de camera e blur (`punch`, `clash`, dash)            | `app/engine/game-engine.ts`                    | le `world.player`                                                 | receber as intensidades de 0 a 1                |
| Tiles, portas e saque junto da colisao                    | `modules/level/utils/grid.util.ts`             | a conta ja e do kit; o arquivo ainda junta tiles, portas e saque  | tirar saque e portas do arquivo                 |
| Snapshot host para convidado, `mergeInput`, `clearPulses` | `modules/multiplayer/utils/snapshot.util.ts`   | campos do `World`, `ITEMS` em `cleanInput`                        | `networkPlugin` da engine ([AGENTS.md](https://github.com/lucashhoffmann/three-hex-engine/blob/main/AGENTS.md)) |
| Predicao do jogador local                                 | `modules/multiplayer/utils/prediction.util.ts` | `movePlayer`                                                      | receber a funcao de mover                       |
| Foco trocado (`asPlayer`, `nearestPlayer`)                | `modules/world/utils/players.util.ts`          | `Player`                                                          | generico em `TPlayer` com `pos` e `hp`          |
| Idioma, `useTexts`, `eventText`                           | `shared/i18n.ts`                               | o mecanismo divide o arquivo com os textos do jogo                | mecanismo num arquivo, textos em outro          |
| Numero que sobe (`Floater`) e sua textura                 | `combat.system.ts`, `world.renderer.ts`        | tags deste jogo (headshot, overkill)                              | tipo com `text` e `color`                       |
| Balao de tecla sobre objeto (`prompts`)                   | `world.renderer.ts`                            | sabe de caixa, bau e inimigo                                      | receber lista de `{ pos, glyph, action }`       |
| Lobby, sala de espera, placar com ping                    | `store/session-store`, `pages/lobby`           | chama `game.store` para comecar a partida                         | callback `onStart`                              |
| Imagem de recorde para compartilhar                       | `pages/game/components/share-record/*`         | texto e marca fixos                                               | receber titulo, numero e cores                  |
| Registro de eventos da partida (`run.events`)             | varios sistemas                                | so o formato e reusavel                                           | tipo `{ at, text, en? }`                        |

## O formato que se repete

Todo jogo neste molde tem as mesmas sete decisoes. Mantenha-as e o kit encaixa.

1. **Um `World` de dados simples.** Sem classe, sem metodo, sem referencia
   circular: serializa em JSON, o que da snapshot de rede e save de graca.
2. **Sistemas sao funcoes** `fn(world, ...args, dt)` que mutam o `World`.
3. **Passo fixo** (`FIXED_DT`). Nada de relogio dentro da simulacao.
4. **Aleatorio so por `nextRandom(world)`** (`three-hex-engine/kit`). Mesma seed,
   mesma partida: e o que deixa testar chance com numero exato.
5. **Numero de balanceamento em `*.constants.ts`**, com comentario dizendo o
   que ele faz no jogo. E onde se ajusta o jogo sem ler codigo.
6. **Simulacao nao sabe de tela.** `modules` nao importa `three`, React nem
   DOM. A engine le o `World` e desenha; a UI le um resumo (`Hud`) no store.
7. **Host simula, servidor repassa.** Multiplayer sem servidor de jogo: o
   navegador do host roda `stepWorld` e manda snapshot.

Mais os habitos que sustentam isso: teste ao lado em `tests/`, e
`docs/contracts.md` atualizado junto com `world.types.ts`.

## Regra daqui para frente

- **Codigo que serve a qualquer jogo vai para o repositorio `three-hex-engine`**,
  com teste, e e importado. Nao e copiado de um jogo para outro. O jogo recebe
  subindo a versao (`pnpm up three-hex-engine`). Onde e como:
  [AGENTS.md](https://github.com/lucashhoffmann/three-hex-engine/blob/main/AGENTS.md).
- **Nunca editar `node_modules/three-hex-engine`.** Corrigir no repositorio,
  publicar versao nova, subir a versao no jogo.
- **Engine e jogo juntos:** na engine `pnpm build --watch` (tsup); no jogo
  `pnpm link ../../three-hex-engine`. Antes de commitar o jogo,
  `pnpm unlink three-hex-engine && pnpm install`, para `package.json` e o
  lockfile voltarem a versao do npm. Link commitado quebra o deploy.
- **Mudou a engine:** `pnpm test` no `three-hex-engine` e `pnpm test` em cada
  jogo com a versao nova.
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

## Comecar um jogo novo

Seguir o [AGENTS.md](https://github.com/lucashhoffmann/three-hex-engine/blob/main/AGENTS.md) da engine: comeca
pelo `examples/coin-rush` (jogo minimo com teste), escreve o `World`, os
sistemas e o renderer nessa ordem. O que serve a qualquer jogo ja vem da
engine.
