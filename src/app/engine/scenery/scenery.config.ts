// O cenario deste jogo montado com um kit de modelos: que peca faz cada
// coisa e em que tamanho.
//
// No Shadow Contract o kit esta DESLIGADO (`url` em null): o cenario e o de
// caixas e papel de parede. Os nomes de peca abaixo sao os do KayKit Dungeon
// Pack, usado no Blade & Bounty, e ficam como exemplo do formato.
//
// Para ligar: gerar o GLB (scripts/pack-kaykit-dungeon.mjs ou equivalente),
// por em public/models e apontar `url`. tests/dungeon.assets.test.ts passa a
// conferir as pecas. Passo a passo em docs/scenery.md.

export type Placed = { piece: string; scale: number };

export const SCENERY: {
  url: string | null;
  floor: Placed;
  wall: { piece: string; length: number; height: number };
  props: Placed[];
  chest: Placed & { lid: string };
  goldenChest: Placed;
  money: Placed;
  door: { piece: string; leaf: string; width: number; height: number };
} = {
  url: null,
  // ladrilho de 2 x 2 no kit: metade da um tile
  floor: { piece: 'floor_tile_small', scale: 0.5 },
  // meio muro: `length` de comprido (em x, a partir da origem), `height` de
  // alto e 1 de grosso. Vira um bloco de 1 tile, na altura de parede do jogo
  wall: { piece: 'wall_half', length: 2, height: 4 },
  // objetos quebraveis: a aparencia sai do id, como antes. Cada um no
  // tamanho que cabe num tile sem encostar nos vizinhos
  props: [
    { piece: 'box_large', scale: 0.52 },
    { piece: 'crates_stacked', scale: 0.36 },
    { piece: 'barrel_large', scale: 0.42 },
    { piece: 'keg', scale: 0.4 },
  ],
  // bau da loja e de revive; `lid` e o no da tampa, que gira para abrir
  chest: { piece: 'chest', scale: 0.55, lid: 'chest_lid' },
  goldenChest: { piece: 'chest_gold', scale: 0.5 },
  money: { piece: 'coin_stack_small', scale: 0.5 },
  // porta de correr: duas folhas de madeira. `leaf` e o no da folha dentro da
  // peca; `width` e `height` sao o tamanho dela no kit (a origem fica na
  // dobradica, `hinge` para dentro da folha)
  door: {
    piece: 'wall_doorway',
    leaf: 'wall_doorway_door',
    width: 2,
    height: 2.75,
  },
};
