import { Cross } from 'lucide-react';

import type { Score } from '@/app/store/game-store/game.store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/resources/components/ui/dialog';
import { useTexts } from '@/shared/i18n';

type ReviveDialogProps = {
  open: boolean;
  // placar da partida: os mortos sao as opcoes
  scores: Score[];
  // quantos o bau ainda levanta (fichas do grupo, ou o revive gratis)
  allowance: number;
  onRevive: (id: number) => void;
  onClose: () => void;
};

// Bau de revive com mais mortos do que revives: quem abriu escolhe quem
// volta. O jogo dos outros continua por baixo.
export function ReviveDialog({
  open,
  scores,
  allowance,
  onRevive,
  onClose,
}: ReviveDialogProps) {
  const t = useTexts();
  const dead = scores.filter((score) => !score.alive);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent
        showCloseButton={false}
        className='gap-4 rounded-3xl border-4 border-white bg-[#1f2033] shadow-[0_8px_0_#14141f] sm:max-w-sm'
      >
        <DialogHeader className='items-center text-center'>
          <DialogTitle className='font-display text-outline flex items-center gap-2 text-3xl leading-none tracking-wide text-white uppercase'>
            <Cross
              aria-hidden
              className='size-7 fill-[#3fe08a] text-[#3fe08a]'
            />
            {t.match.reviveTitle}
          </DialogTitle>
          <DialogDescription className='text-white/75'>
            {t.match.reviveNote(allowance)}
          </DialogDescription>
        </DialogHeader>
        <ul className='flex flex-col gap-2'>
          {dead.map((score) => (
            <li key={score.id}>
              <button
                type='button'
                className='font-display text-outline flex w-full cursor-pointer items-center gap-3 rounded-2xl border-4 border-white bg-[#16345c] px-4 py-2 text-left text-xl shadow-[0_5px_0_#14141f] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none'
                style={{ color: score.color ?? '#ffffff' }}
                onClick={() => onRevive(score.id)}
              >
                <span
                  aria-hidden
                  className='size-4 shrink-0 rounded-full border-2 border-white'
                  style={{ background: score.color ?? '#ffffff' }}
                />
                {score.name}
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <button
            type='button'
            className='font-display text-outline w-full cursor-pointer rounded-2xl border-4 border-white bg-[#3d4fd6] px-6 py-2 text-lg text-white uppercase shadow-[0_5px_0_#14141f] transition-transform active:translate-y-1 active:shadow-none'
            onClick={onClose}
          >
            {t.common.close}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
