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

| Camada        | O que cobre                | Como                                         |
| ------------- | -------------------------- | -------------------------------------------- |
| `app/modules` | regras do jogo             | Vitest puro sobre `World`, sem DOM           |
| `app/store`   | ponte simulacao/UI         | Vitest chamando acoes do store               |
| `resources`   | HUD, loja, menus, joystick | Testing Library                              |
| `app/engine`  | render three.js            | sem teste unitario; verificacao no navegador |

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

- `level`: template valido, caminho entre entrada e saida, geracao
  deterministica, loja a cada `SHOP_EVERY` salas, no maximo 3 salas vivas
- `player`: anda, nao atravessa parede, desliza na parede, diagonal nao e mais
  rapida
- `enemy`: cone (angulo, alcance, parede), deteccao sobe e desce, ouve passo
  e salto por perto e vai investigar, terno
  dispara bala, ninja golpeia de perto, tiro recebido alerta
- `combat`: melee so em inimigo nao alertado e sem gastar municao, arma dispara
  balas e gasta municao, bala para em parede, acerta por contato, some no fim
  do alcance, morte solta dinheiro, coleta soma
- `shop`: compra cobra o preco de mercado, sem saldo nao compra, precos
  deterministicos por seed, oscilacao dentro da faixa, inflacao com teto,
  recompra encarece, gatilho abre uma vez por sala
- `world`: `stepWorld` integra tudo, congela em `intro`, `paused`, `shop` e
  `dead`, morte muda `status`
