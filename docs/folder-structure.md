# Estrutura de Pastas

Estrutura alvo do `shadow-contract`. Regras de nome e dependencia estao em
`docs/pattern.md`.

## Raiz

```text
.
├── CLAUDE.md
├── docs
│   ├── contracts.md
│   ├── folder-structure.md
│   ├── pattern.md
│   └── testing.md
├── public
├── src
│   ├── app
│   ├── resources
│   ├── shared
│   └── test
├── components.json
├── eslint.config.js
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## `src`

```text
src
├── app
│   ├── engine
│   │   ├── game-engine.ts
│   │   ├── character-preview.ts
│   │   ├── weapon-preview.ts
│   │   ├── characters                   personagens de modelo (docs/characters.md)
│   │   │   ├── character-view.types.ts
│   │   │   ├── clip-driver.util.ts
│   │   │   ├── gltf-character.view.ts
│   │   │   ├── character-model.loader.ts
│   │   │   ├── kaykit.rig.ts
│   │   │   ├── character-models.config.ts
│   │   │   └── tests
│   │   ├── scenery                      cenario de modelo (docs/scenery.md)
│   │   │   ├── model-kit.ts
│   │   │   ├── scenery.config.ts
│   │   │   └── tests
│   │   └── renderers
│   │       ├── character.renderer.ts
│   │       ├── weapon.renderer.ts
│   │       └── world.renderer.ts
│   ├── modules
│   │   ├── world
│   │   ├── level
│   │   ├── player
│   │   ├── enemy
│   │   ├── combat
│   │   ├── shop
│   │   └── multiplayer
│   ├── net                              servidor de salas (multiplayer)
│   │   ├── protocol.ts                  copia de shadow-contract-server
│   │   └── session.client.ts            conexao socket.io
│   └── store
│       ├── game-store
│       │   ├── game.store.ts
│       │   └── tests
│       └── session-store
│           └── session.store.ts         nome, sessoes, sala de espera
├── resources
│   ├── components
│   │   ├── base
│   │   │   └── virtual-joystick
│   │   └── ui
│   ├── pages
│   │   ├── app.tsx
│   │   ├── home
│   │   ├── lobby
│   │   ├── character
│   │   └── game
│   └── main.tsx
├── shared
│   ├── lib
│   ├── styles
│   └── utils
└── test
    ├── setup.ts
    └── world.fixture.ts
```

## Modulos

```text
src/app/modules
├── world
│   ├── constants/world.constants.ts     numeros de balanceamento
│   ├── types/world.types.ts             tipos compartilhados
│   ├── systems/world.system.ts          createWorld, stepWorld (solo)
│   ├── utils/players.util.ts            jogador em foco, vivos, mais perto
│   └── tests
├── level
│   ├── templates/room.template.ts       salas pre-fabricadas
│   ├── utils/grid.util.ts               tile, colisao, raio, linha de visao
│   ├── utils/pathfinding.util.ts        findPath
│   ├── systems/level.system.ts          gerar e descartar salas
│   └── tests
├── player
│   ├── systems/player.system.ts         movimento
│   └── tests
├── enemy
│   ├── systems/enemy.system.ts          visao, deteccao, FSM
│   └── tests
├── combat
│   ├── systems/combat.system.ts         ataque, balas, morte, coleta
│   └── tests
├── shop
│   ├── constants/shop.constants.ts      catalogo de itens
│   ├── systems/shop.system.ts           mercado, compra e gatilho da loja
│   └── tests
└── multiplayer                          so o que muda com varios jogadores
    ├── systems/multiplayer.system.ts    createMultiWorld, stepMultiWorld
    ├── utils/snapshot.util.ts           mensagens host <-> convidado
    ├── templates/room.template.ts       salas 17x19
    └── tests
```

## Paginas

```text
src/resources/pages
├── app.tsx                              escolhe tela pelo store
├── home
│   ├── home.page.tsx
│   └── tests
├── character
│   ├── character.page.tsx
│   ├── use-character.page.ts            cria preview 3D, le store
│   ├── components
│   │   ├── look-editor.component.tsx    cores e tamanhos do player
│   │   └── weapon-picker.component.tsx  arma mostrada no preview
│   └── tests
└── game
    ├── game.page.tsx
    ├── use-game.page.ts                 cria engine, le store
    ├── components
    │   ├── hud.component.tsx
    │   ├── legend-dialog.component.tsx  legenda inicial e tela de pausa
    │   ├── shop-dialog.component.tsx
    │   ├── game-over-dialog.component.tsx
    │   └── share-record                 cartao PNG do recorde e compartilhamento
    └── tests
```

## Onde cada coisa mora

| Preciso de                       | Vai em                                         |
| -------------------------------- | ---------------------------------------------- |
| nova regra de jogo               | `app/modules/<feature>/systems`                |
| novo numero de balanceamento     | `app/modules/<feature>/constants`              |
| nova sala                        | `app/modules/level/templates/room.template.ts` |
| novo item de loja                | `app/modules/shop/constants/shop.constants.ts` |
| tipo usado por mais de um modulo | `app/modules/world/types/world.types.ts`       |
| novo visual 3D                   | `app/engine/renderers`                         |
| novo campo visivel na UI         | `Hud` em `app/store/game-store/game.store.ts`  |
| nova tela ou painel              | `resources/pages/<feature>`                    |
| helper matematico neutro         | `shared/utils`                                 |
| mundo de teste                   | `src/test/world.fixture.ts`                    |
