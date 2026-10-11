import { useEffect, useRef } from 'react';

import {
  type CharacterPreview,
  createCharacterPreview,
} from '@/app/engine/character-preview';
import { useGameStore } from '@/app/store/game-store/game.store';

export function useCharacterPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<CharacterPreview | null>(null);
  const look = useGameStore((state) => state.look);
  const setLook = useGameStore((state) => state.setLook);
  const backToMenu = useGameStore((state) => state.backToMenu);

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

  return { canvasRef, look, setLook, backToMenu };
}
