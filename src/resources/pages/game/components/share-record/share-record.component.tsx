import { Share2 } from 'lucide-react';

import {
  type RecordCard,
  useShareRecord,
} from '@/resources/pages/game/components/share-record/use-share-record.component';
import { useTexts } from '@/shared/i18n';

// Botao da tela de morte: gera o cartao do recorde e abre o
// compartilhamento. So aparece em aparelho de toque.
export function ShareRecord(card: RecordCard) {
  const t = useTexts();
  const { busy, share } = useShareRecord(card);

  return (
    <button
      type='button'
      disabled={busy}
      onClick={share}
      className='text-outline hidden items-center gap-2 rounded-2xl border-4 border-white bg-[var(--game-secondary)] px-5 py-2 text-xl text-white uppercase shadow-[0_5px_0_var(--game-ink)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-60 pointer-coarse:flex'
    >
      <Share2
        aria-hidden
        className='size-5'
        strokeWidth={3}
      />
      {busy ? t.share.generating : t.share.button}
    </button>
  );
}
