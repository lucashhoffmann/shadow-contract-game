import { useEffect, useRef, useState } from 'react';

import {
  type CharacterPreview,
  createCharacterPreview,
} from '@/app/engine/character-preview';
import { renderWeaponPreviews } from '@/app/engine/weapon-preview';
import type { WeaponId } from '@/app/modules/world/types/world.types';
import { useGameStore } from '@/app/store/game-store/game.store';

export function useCharacterPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<CharacterPreview | null>(null);
  const look = useGameStore((state) => state.look);
  const setLook = useGameStore((state) => state.setLook);
  const backToMenu = useGameStore((state) => state.backToMenu);
  // so do preview: qual arma o personagem segura; null = espada
  const [weapon, setWeapon] = useState<WeaponId | null>(null);
  // fotos das armas para os cartoes, tiradas uma vez por montagem
  const [previews] = useState(renderWeaponPreviews);

  useEffect(() => {
    if (!canvasRef.current) return;
    const preview = createCharacterPreview(canvasRef.current);
    previewRef.current = preview;
    return () => {
      previewRef.current = null;
      preview.dispose();
    };
  }, []);

  // roda depois do efeito acima, entao ja desenha o look inicial
  useEffect(() => {
    previewRef.current?.setLook(look);
  }, [look]);

  useEffect(() => {
    previewRef.current?.setWeapon(weapon);
  }, [weapon]);

  return {
    canvasRef,
    look,
    setLook,
    weapon,
    setWeapon,
    previews,
    backToMenu,
  };
}
