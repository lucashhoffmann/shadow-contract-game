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
`vi.mock('@/app/engine/game-engine')`.

## Onde colocar

- sempre dentro de uma pasta `tests/` do modulo, pagina ou componente
- nome: `<arquivo-testado>.test.ts` ou `.test.tsx`

## Mundo de teste

`src/test/world.fixture.ts`:

- `createArenaWorld()`: uma sala aberta, fechada nas bordas, sem inimigos
- `addEnemy(world, x, y, facing)`: inimigo parado olhando para `facing`

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
- `enemy`: cone (angulo, alcance, parede), deteccao sobe e desce, alerta
  atira
- `combat`: melee so em inimigo nao alertado, arma gasta municao, morte solta
  dinheiro, coleta soma
- `shop`: compra debita, sem saldo nao compra, gatilho abre uma vez por sala
- `world`: `stepWorld` integra tudo, congela fora de `playing`, morte muda
  `status`
