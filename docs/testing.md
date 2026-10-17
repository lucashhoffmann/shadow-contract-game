# Testes

Stack: Vitest + jsdom + Testing Library. Config em `vite.config.ts`, setup em
`src/test/setup.ts`.

## Comandos

```bash
pnpm test          # roda tudo uma vez
pnpm test:watch    # modo watch
pnpm typecheck     # inclui os arquivos de teste (tsconfig.spec.json)
```

## Camadas de teste

| Camada        | O que cobre                | Como                                              |
| ------------- | -------------------------- | ------------------------------------------------- |
| `app/modules` | regras do jogo             | Vitest puro sobre `World`, sem DOM                |
| `app/store`   | ponte simulacao/UI         | Vitest chamando acoes do store                    |
| `resources`   | HUD, loja, menus, joystick | Testing Library                                   |
| `app/engine`  | render three.js            | cena three sem WebGL (jsdom); visual no navegador |

Personagem de modelo (`app/engine/characters`): `kaykit.assets.test.ts` le os
GLB de `public/models` e confere clipes e ossos contra a configuracao. Os
testes de `clip-driver` e da view moraram aqui e agora estao na engine
(`three-hex-engine`, `src/adapters/three/tests`). Teste de renderer com
inimigo de modelo troca so `loadCharacterView` (`vi.mock('three-hex-engine/three')` mantendo o
resto do modulo): sem isso o arquivo nao chega no jsdom e o inimigo fica de
pecas.

Cenario de modelo (`app/engine/scenery`): `dungeon.assets.test.ts` confere as
pecas do GLB publicado contra `SCENERY`. O teste do kit (`model-kit.test.ts`)
esta na engine. Teste de renderer com o kit troca so `loadModelKit`
(`vi.mock('three-hex-engine/three')` mantendo o resto do modulo) por um kit de
caixas; sem isso o renderer desenha o cenario antigo.

Codigo da engine tem os testes dela, no repositorio `three-hex-engine`
(`pnpm test` la). Mudou a engine: rodar os testes dela e o `pnpm test` deste
jogo com a versao nova.

jsdom nao tem WebGL. Teste de pagina que monta a engine usa
`vi.mock('@/app/engine/game-engine')`; a tela de personagem usa
`vi.mock('@/app/engine/character-preview')`. O preview de arma do HUD tambem
precisa de WebGL: `vi.mock('@/app/engine/weapon-preview')`.

## Onde colocar

- sempre dentro de uma pasta `tests/` do modulo, pagina ou componente
- nome: `<arquivo-testado>.test.ts` ou `.test.tsx`

## Mundo de teste

`src/test/world.fixture.ts`:

- `createArenaWorld()`: uma sala aberta, fechada nas bordas, sem inimigos
- `addEnemy(world, x, y, facing, kind?)`: inimigo parado olhando para `facing`;
  `kind` e `'suit'` por padrao

Usar a fixture em vez de `createWorld` quando o teste precisa de geometria
conhecida. Usar `createWorld(seed)` para testar geracao e integracao.

## Regras

- regra nova em `modules` entra com teste na mesma mudanca
- teste de simulacao avanca tempo chamando o sistema com `dt` fixo; nunca
  timers reais
- teste de geracao fixa o `seed`
- todo template novo passa automaticamente pela validacao de
  `level/tests/level.test.ts`
- componente visual e testado por props; quem le o store e a pagina
- nao testar detalhe de implementacao do three; testar o `World` que ele
  desenha

## O que cada modulo garante

- `multiplayer`: cada jogador anda pelo proprio input, inimigo vai no vivo
  mais perto, bala fere so quem acerta, morte conta para quem atirou, carteira
  individual, morto nao age, partida acaba quando todos morrem, quem fica para
  tras e puxado; todo template 17x19 e valido; mais jogadores, mais inimigos
  e inimigos mais espertos que no solo; loja individual e sem pausa, bau de
  revive (fichas do grupo, um gratis por bau, escolha quando faltam revives),
  troca de arma e recomeco sem derrubar a sessao
- `level`: template valido, caminho entre entrada e saida, geracao
  deterministica, loja a cada `SHOP_EVERY` salas, no maximo 3 salas vivas
- `player`: anda, nao atravessa parede, desliza na parede, diagonal nao e mais
  rapida
- `enemy` (dificuldade): dano cresce com o nivel e acompanha a vida maxima
  do alvo, alerta chama os colegas por perto, ninjas cercam, ninja desvia de
  parte dos tiros
- `enemy`: cone (angulo, alcance, parede), deteccao sobe e desce, ouve passo
  e salto por perto e vai investigar, terno
  dispara bala, ninja golpeia de perto, tiro recebido alerta
- `combat`: melee so em inimigo nao alertado e sem gastar municao, arma dispara
  balas e gasta municao, bala para em parede, acerta por contato, some no fim
  do alcance, morte solta dinheiro, coleta soma
- `shop`: compra cobra o preco de mercado, sem saldo nao compra, precos
  deterministicos por seed, oscilacao dentro da faixa, inflacao com teto,
  recompra encarece, bau abre e reabre com B so ao alcance, precos sorteados
  so na primeira abertura
- `world`: `stepWorld` integra tudo, congela em `intro`, `paused`, `shop` e
  `dead`, morte muda `status`
