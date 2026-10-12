# Pattern

Este documento define o padrao alvo do `shadow-contract`. Deriva do pattern do
`linkbuds-web`, adaptado para um jogo: sai API/cache/router, entram simulacao e
engine.

## Camadas

Dentro de `src`:

- `app`: simulacao do jogo, engine de render e estado
- `resources`: paginas e componentes React (menu, HUD, loja, game over)
- `shared`: utilitarios neutros, estilos e helpers

Dentro de `app`:

- `modules/`: regras do jogo em TS puro
- `engine/`: three.js, loop de render e teclado
- `net/`: conexao com o servidor de salas; so transporte, sem regra
- `store/`: estado zustand, dono do `World` e ponte entre engine e UI

## Direcao de dependencias

```text
shared  <-  app/modules  <-  app/store  <-  app/engine
                                  ^
                                  └──────  resources
```

Regras:

- `app/modules` nao importa `three`, React, DOM nem `store`
- `three` so e importado em `app/engine`
- `resources` so importa `app/engine` em hook de pagina que monta canvas:
  `use-game.page.ts` e `use-character.page.ts`
- `resources` nao muta `World`; so chama acoes do store
- `shared` nao depende de `app` nem de `resources`
- `resources/components/ui` nao contem regra de jogo

## Simulacao

- o estado do jogo e um unico objeto `World`, feito de dados simples
- sistemas sao funcoes que mutam `World`: `fn(world, ...args, dt)`
- `stepWorld` roda em passo fixo (`FIXED_DT`); nunca usar tempo de relogio
  dentro de `modules`
- aleatoriedade so via `nextRandom(world)`; nunca `Math.random` em `modules`
- numeros de balanceamento moram em `*.constants.ts`, nunca soltos no sistema
- coordenadas da simulacao sao 2D `(x, y)`; `y` cresce para frente. A engine
  converte para three como `(x, altura, -y)`

## Nomes de pastas

Sempre `lowercase` ou `kebab-case`. Nunca `PascalCase`.

## Nomes de arquivos

`kebab-case` com sufixo semantico:

- tipos: `*.types.ts`
- constantes: `*.constants.ts`
- sistema de simulacao (muta `World`): `*.system.ts`
- utilitario puro: `*.util.ts`
- sala pre-fabricada: `*.template.ts`
- store: `*.store.ts`
- renderer three.js (sincroniza meshes com `World`): `*.renderer.ts`
- pagina: `*.page.tsx`
- hook de pagina: `use-*.page.ts`
- componente local: `*.component.tsx`
- hook de componente: `use-*.component.ts`
- teste: `*.test.ts` e `*.test.tsx`

`index.ts` so quando consolidar ponto de entrada, com exports explicitos. Nunca
`export *`.

## Modulo de jogo

```text
src/app/modules/<feature>
├── constants
├── systems
├── templates
├── types
├── utils
└── tests
```

Cada pasta so existe quando o modulo precisa dela.

Tipos compartilhados por mais de um modulo moram em
`modules/world/types/world.types.ts`. Tipo usado por um modulo so fica no
proprio modulo.

## Paginas e componentes

```text
src/resources/pages/<feature>
├── <feature>.page.tsx
├── use-<feature>.page.ts
├── components
└── tests
```

- `*.page.tsx` orquestra a tela
- `use-*.page.ts` le o store e monta handlers
- componente sem logica propria: arquivo direto, recebe tudo por props
- componente com estado, efeito ou handler de mais de uma linha: pasta propria
  com `*.component.tsx` e `use-*.component.ts`
- componente reutilizado em mais de uma pagina sobe para
  `resources/components/base`
- primitives visuais (shadcn) ficam em `resources/components/ui`

## Testes

- nenhum teste solto ao lado de arquivo de producao; sempre dentro de `tests/`
- regra nova em `modules` entra com teste na mesma mudanca
- detalhes em `docs/testing.md`

## Boas praticas

- alias `@/` para imports absolutos
- `function` para funcoes nomeadas exportadas; `const` para callbacks locais
- `import type` para tipos
- sem abstracao especulativa: nada de interface com uma implementacao so
- simplificacao deliberada com teto conhecido leva comentario `ponytail:`
  dizendo o teto e o caminho de upgrade
