# Shadow Contract

Jogo stealth top-down de navegador: three.js puro na engine, React so na UI.

Antes de criar ou mover arquivo, ler:

- README do `three-hex-engine` (https://github.com/lucashhoffmann/three-hex-engine, ou
  `node_modules/three-hex-engine/README.md`): engine compartilhada; o que ja
  existe antes de escrever de novo
- `docs/pattern.md`: camadas, direcao de dependencias, nomes e sufixos
- `docs/folder-structure.md`: arvore alvo e onde cada coisa mora
- `docs/contracts.md`: tipos e interfaces entre simulacao, store, engine e UI
- `docs/testing.md`: o que testar, onde colocar e como rodar
- `docs/engine-reuse.md`: o que e reusavel em outros jogos e o que e so deste
- `docs/characters.md`: como os personagens sao montados e animados; como
  criar inimigo, skin ou golpe novo
- `docs/scenery.md`: cenario de modelo (piso, parede, caixas, baus); como
  trocar peca ou kit

Regras que mais quebram:

- `three` so pode ser importado em `src/app/engine` (a engine compartilhada
  importa `three` nos adaptadores dela)
- `src/app/modules` e TS puro: sem `three`, sem React, sem DOM. Pode importar
  `three-hex-engine/kit`, que tambem e TS puro
- codigo que serve a qualquer jogo vai para o repositorio `three-hex-engine`,
  nao e copiado entre jogos; o jogo recebe subindo a versao
  (`pnpm up three-hex-engine`)
- nunca editar `node_modules/three-hex-engine`: corrigir no repositorio,
  publicar versao nova, subir a versao aqui
- engine e jogo juntos: `pnpm build --watch` na engine e
  `pnpm link ../../three-hex-engine` aqui; antes de commitar,
  `pnpm unlink three-hex-engine && pnpm install` (link commitado quebra o deploy)
- mudou a engine: `pnpm test` no `three-hex-engine` e aqui, com a versao nova
- todo teste mora dentro de uma pasta `tests/`
- mudou tipo em `world.types.ts`: atualizar `docs/contracts.md` na mesma mudanca
- codigo de plataforma (conta, pagamento, analytics, anuncio) nasce em
  `src/platform` e nao importa `app/modules`, `app/store` nem `app/engine`

Comandos: `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`.
