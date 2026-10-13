# Cenario

Como piso, paredes, objetos quebraveis, baus e moedas sao desenhados, e como
trocar uma peca ou o kit inteiro. Codigo em `src/app/engine/scenery/` e em
`buildRoom`, `buildChest`, `buildProp` e `buildPickup` de `world.renderer.ts`.

Ha dois cenarios:

- **de caixas** (o que este jogo usa): paredes e piso de caixa com papel de
  parede gerado, objetos montados em codigo
- **de kit**: pecas de um arquivo glTF. **Desligado no Shadow Contract**
  (`SCENERY.url` e `null`, e nao ha arquivo de kit no repositorio): o codigo,
  os testes e o empacotador estao aqui para quando houver um kit do tema.
  Esta ligado no Blade & Bounty, com o KayKit Dungeon Pack. Ligado, o de
  caixas ainda aparece enquanto o kit baixa, e fica se ele nao chegar

O resto deste documento descreve o cenario de kit como ele funciona quando
ligado; os nomes de peca sao os do KayKit Dungeon Pack.

A simulacao nao muda: parede continua sendo o tile `#`, caixa o tile `o`, com
as mesmas colisoes. O kit so troca o desenho.

## As pecas e quem conhece o que

| Arquivo                           | Papel                                                      | Sabe de que jogo e? |
| --------------------------------- | ---------------------------------------------------------- | ------------------- |
| `scenery/model-kit.ts`            | `ModelKit`: um GLB com varias pecas, pedidas pelo nome     | nao                 |
| `scenery/scenery.config.ts`       | `SCENERY`: que peca faz cada coisa neste jogo, e o tamanho | **sim**             |
| `scripts/pack-kaykit-dungeon.mjs` | monta o GLB a partir do pacote baixado                     | nao                 |

```ts
type ModelKit = {
  clone(name: string): THREE.Object3D | null; // copia para por em cena
  mesh(name: string): { geometry; material } | null; // para InstancedMesh
  dispose(): void;
};
```

- `clone` serve a objeto solto (caixa, bau, moedas)
- `mesh` serve ao que se repete muito (piso, parede): devolve geometria e
  material compartilhados para um `InstancedMesh`. So existe para peca de uma
  malha so
- o kit troca o material do arquivo por `MeshLambertMaterial`: mais barato, e
  o cenario nao precisa de brilho

## O que cada coisa usa

`SCENERY`, em `scenery.config.ts`:

| No jogo                     | Peca do kit                                          | Como                                                  |
| --------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| piso                        | `floor_tile_small`                                   | um por tile (parede inclusive), em lote               |
| parede (tile `#`)           | `wall_half`                                          | um bloco por tile, em lote                            |
| objeto quebravel (tile `o`) | `box_large`, `crates_stacked`, `barrel_large`, `keg` | sorteado pelo `id`, virado para um dos 4 lados        |
| bau dourado                 | `chest_gold`                                         | no lugar do objeto, com a aura                        |
| bau da loja e de revive     | `chest`, com a tampa `chest_lid`                     | a tampa gira na dobradica para abrir                  |
| dinheiro no chao            | `coin_stack_small`                                   | com a aura                                            |
| porta de correr             | a folha de madeira de `wall_doorway`                 | duas folhas no vao, sem moldura; correm para os lados |

Continua de antes, sem peca do kit: destrocos da caixa quebrada, coracao,
escudo e os outros itens.

### Parede

O kit foi feito para muro fino entre salas; o jogo tem parede grossa, de um
tile inteiro, em qualquer formato. A adaptacao:

- `wall_half` tem 2 de comprido, 4 de alto e 1 de grosso. Cada tile de parede
  recebe um, encolhido para 1 de comprido e `WALL_HEIGHT` de alto. A grossura
  ja e a de um tile
- a face de tijolo fica nos dois lados compridos. Tile de parede sem vizinho
  de parede dos lados, mas com vizinho em cima ou embaixo, gira o bloco 90
  graus: a parede que corre pela coluna mostra o tijolo para a sala
- a altura e a de sempre (baixa), para a camera de cima continuar vendo o chao
  atras da parede

### Cor por contrato

Cada contrato tinha a sua cor de parede. Com o kit, o material e clonado por
nivel e tingido no mesmo tom (`sceneryTint`). O efeito e discreto: o topo
escuro das paredes domina a vista de cima.

## Arquivo e peso

O arquivo nao esta neste repositorio. Gerado pelo script (no Blade & Bounty,
`public/models/kaykit/dungeon.glb`): 395 KB, 10 pecas, uma textura e um
material. Baixa uma vez ao abrir a partida; o service worker guarda.

No pacote original cada peca e um `.gltf` com o proprio `.bin`, e todas
apontam para a mesma textura: seriam 21 downloads. O script copia a geometria
de cada peca para um binario so, poe cada uma num no `piece_<nome>` e embute a
textura uma vez.

Origem e licenca: KayKit Dungeon Pack 1.1, de Kay Lousberg
(kaylousberg.itch.io), CC0.

## Como entra no jogo

1. `createWorldRenderer` pede o kit (`loadModelKit(SCENERY.url)`) e segue
   desenhando o cenario de caixas
2. quando o kit chega, salas, objetos e itens ja desenhados sao removidos; o
   `sync` seguinte refaz tudo com ele. Portas e tampas de bau sao
   registradas de novo junto
3. cada construtor tenta o kit primeiro e cai no de caixas se a peca nao
   existir: kit incompleto nao quebra nada

## Receitas

**Trocar a peca de alguma coisa** (ex.: outro piso):

1. por o nome do `.gltf` em `PIECES` no script e rodar
   `node scripts/pack-kaykit-dungeon.mjs <Dungeon_Pack>`
2. trocar o nome em `SCENERY`. Ajustar `scale` olhando o tamanho da peca: o
   kit usa 2 unidades por ladrilho, o jogo usa 1 por tile
3. `pnpm test`: `dungeon.assets.test.ts` acusa peca citada que nao esta no
   arquivo

**Mais variedade de objeto quebravel**: mais uma linha em `SCENERY.props`.
A escolha e pelo `id`, entao a mesma caixa tem sempre a mesma cara.

**Outro kit** (outro tema, outro jogo): empacotar no mesmo formato (cada peca
num no `piece_<nome>`), apontar `SCENERY.url` e os nomes. `model-kit.ts` nao
muda.

**Ligar neste jogo**: baixar o pacote, rodar
`node scripts/pack-kaykit-dungeon.mjs <Dungeon_Pack>` (gera
`public/models/kaykit/dungeon.glb`) e por esse caminho em `SCENERY.url`.

**Desligar**: `SCENERY.url = null` (como esta hoje). Volta o cenario de
caixas.

## O que falta

- **decoracao**: tocha, estandarte, mesa, pilar e o resto do pacote nao
  entram. Pedem lugar no template da sala (ou sorteio) para nao ficar no
  caminho
- **parede e um bloco por tile**: quina e ponta de parede usam o mesmo bloco,
  sem peca propria de canto
- **destrocos**: caixa quebrada vira as tabuas antigas, na cor da variacao
  antiga, nao na da peca do kit
- **desempenho em celular fraco** nao foi medido. O piso sao 143 ladrilhos por
  sala (323 no multiplayer), num lote so
