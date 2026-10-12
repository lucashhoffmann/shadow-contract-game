import { COLORS } from '@/shared/colors';
import { useEffect, useRef, useState } from 'react';
import { getTexts, useLanguage } from '@/shared/i18n';

// Cartao do recorde para story: PNG em pe, 1080x1920, com o nome do jogo e
// o recorde na fonte dos titulos (--font-display).

export type RecordCard = {
  // maior sala alcancada
  best: number;
  // sala e eliminacoes da partida que acabou
  room: number;
  kills: number;
};

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT = "'Lilita One', 'Arial Rounded MT Bold', system-ui, sans-serif";
const INK = COLORS.ui.ink;
// largura maxima de uma linha de texto
const LINE = 940;

function drawCard(
  context: CanvasRenderingContext2D,
  { best, room, kills }: RecordCard,
): void {
  const background = context.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, COLORS.ui.cardTop);
  background.addColorStop(0.55, COLORS.ui.background);
  background.addColorStop(1, INK);
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  // letra gorda com contorno escuro e sombra dura, como os titulos do jogo
  const line = (text: string, y: number, size: number, color: string) => {
    context.font = `${size}px ${FONT}`;
    // encolhe ate caber na largura
    const fitted = Math.min(
      size,
      (size * LINE) / context.measureText(text).width,
    );
    context.font = `${fitted}px ${FONT}`;
    context.lineWidth = fitted * 0.2;
    context.strokeStyle = INK;
    context.fillStyle = INK;
    context.strokeText(text, WIDTH / 2, y + fitted * 0.09);
    context.strokeText(text, WIDTH / 2, y);
    context.fillStyle = color;
    context.fillText(text, WIDTH / 2, y);
  };

  line('SHADOW', 430, 230, COLORS.ui.white);
  line('CONTRACT', 660, 230, COLORS.ui.brandPink);
  line(getTexts().share.myRecord, 980, 96, COLORS.ui.highlight);
  line(getTexts().share.room(best), 1220, 330, COLORS.ui.white);
  line(
    getTexts().share.run(room, kills),
    1470,
    60,
    COLORS.ui.cardText,
  );
  line(getTexts().share.challenge, 1690, 84, COLORS.ui.success);
}

// desenha o cartao e devolve o PNG; null se o navegador nao tem canvas 2D
export async function renderRecordCard(card: RecordCard): Promise<Blob | null> {
  // a fonte precisa estar carregada antes de desenhar no canvas
  await document.fonts?.load(`200px ${FONT}`);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return null;
  drawCard(context, card);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function useShareRecord({ best, room, kills }: RecordCard) {
  const language = useLanguage((state) => state.language);
  const [busy, setBusy] = useState(false);
  // O cartao e desenhado ao abrir a tela, nao no toque: o navegador so abre
  // a folha de compartilhamento logo em seguida a um gesto, e esperar a
  // fonte e o PNG depois do toque fazia perder essa janela (caia no
  // download).
  const ready = useRef<Promise<File | null> | null>(null);
  useEffect(() => {
    ready.current = renderRecordCard({ best, room, kills }).then(
      (blob) =>
        blob &&
        new File([blob], 'shadow-contract-recorde.png', { type: 'image/png' }),
    );
  }, [best, room, kills, language]);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const file = await ready.current;
      if (!file) return;
      // folha de compartilhamento do aparelho: e nela que aparece o
      // Instagram (Stories). So existe em HTTPS (ou localhost)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Shadow Contract',
          text: getTexts().share.message(best),
        });
        return;
      }
      // sem compartilhamento de arquivo: baixa o PNG para postar a mao
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // fechar a folha sem escolher nada nao e erro
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  };

  return { busy, share };
}
