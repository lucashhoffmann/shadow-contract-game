import type { CharacterModel } from '@/app/engine/characters/character-model.loader';
import type { EnemyKind } from '@/app/modules/world/types/world.types';

// O unico arquivo desta pasta que sabe que jogo e este: quem usa que modelo.
//
// No Shadow Contract os modelos estao DESLIGADOS: player e inimigos sao os
// personagens de pecas (renderers/character.renderer.ts). Os adaptadores
// ficam prontos para quando houver modelos proprios do tema.
//
// Para ligar: por os arquivos em public/models e preencher aqui. Exemplo com
// o esqueleto do KayKit (kaykit.rig.ts), como no Blade & Bounty:
//
//   export const PLAYER_MODEL: CharacterModel | null = {
//     url: '/models/kaykit/rogue-hooded.glb',
//     clipsUrl: KAYKIT_CLIPS_URL,
//     rig: KAYKIT_MEDIUM,
//     holds: [{ slot: 'rightHand', url: '/models/kaykit/sword_1handed.gltf' }],
//   };
//
// Passo a passo em docs/characters.md.

export const PLAYER_MODEL = null as CharacterModel | null;

// tipo fora da lista continua com o personagem de pecas
export const ENEMY_MODELS: Partial<Record<EnemyKind, CharacterModel>> = {};
