import type * as THREE from 'three';

// Fronteira entre quem desenha o mundo e o corpo de um personagem. Quem
// desenha conhece so isto: entrega a pose do quadro e nao sabe se por tras ha
// um modelo com esqueleto (gltf-character.view.ts) ou outra coisa.
// Nada aqui sabe de que jogo se trata: ver docs/engine-reuse.md.

// O que o personagem esta fazendo neste quadro. Vem da simulacao: a view nao
// tem relogio proprio para as acoes, so mostra a fase que recebe.
export type CharacterPose = {
  // 0 = parado, 1 = correndo
  moving: number;
  crouching: boolean;
  // fase de cada acao, de 0 (comecou) a 1 (acabou); null = nao esta fazendo
  attack: number | null;
  dash: number | null;
  shot: number | null;
  // qual jeito de golpear: a view escolhe o clipe por este indice
  swing: number;
  // o golpe em curso e o giro
  spinning: boolean;
  dead: boolean;
  // Tudo daqui para baixo e opcional: enriquece a animacao quando o
  // esqueleto tem os clipes, e nao faz falta quando nao tem.
  // numero fixo do personagem (o id): escolhe entre as variacoes de parado,
  // andar, correr e morrer, para dois iguais nao se mexerem igual
  variant?: number;
  // jeito de lutar com o que esta na mao: troca o conjunto de golpes e o
  // clipe de mira e de tiro ('bow', 'two'...; os nomes sao do `ClipSet`)
  style?: string;
  // de arma de alcance na mao, apontando; `shot` e o disparo em si
  aiming?: boolean;
  // fase do arremesso (adaga do cavaleiro)
  throwing?: number | null;
  // fase da reacao a um golpe levado; `blocked`: o escudo segurou
  hit?: number | null;
  blocked?: boolean;
  // fase do grito de desafio (chefe ao despertar)
  taunt?: number | null;
  // gesto de corpo inteiro fora do combate (comemorar na loja)
  emote?: { name: string; phase: number } | null;
};

export type CharacterView = {
  // o corpo, com os pes na origem e olhando para +x. Quem usa poe isto dentro
  // do proprio grupo e cuida de posicao e direcao no mundo
  object: THREE.Object3D;
  pose(pose: CharacterPose, dt: number): void;
  // ponto do corpo onde se prende um objeto (arma na mao); null se o
  // personagem nao tem esse ponto
  slot(name: string): THREE.Object3D | null;
  // destaca o corpo inteiro numa cor (furia); null volta ao normal
  highlight(color: number | null): void;
  dispose(): void;
};
