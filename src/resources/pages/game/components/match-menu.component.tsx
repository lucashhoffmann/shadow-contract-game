import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/resources/components/ui/dialog';
import { useTexts } from '@/shared/i18n';

type MatchMenuProps = {
  open: boolean;
  // host pode acabar a partida para todos
  host: boolean;
  onResume: () => void;
  onEnd: () => void;
  onLeave: () => void;
};

// botao gordo de jogo, igual ao da home e da legenda
const CHUNKY =
  'font-display text-outline w-full cursor-pointer rounded-2xl border-4 border-white px-6 py-2 text-xl text-white uppercase shadow-[0_5px_0_var(--game-ink)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none';

// Menu da partida em rede (P ou botao de pausa). Nao pausa: o jogo e de
// todos e continua por baixo.
export function MatchMenu({
  open,
  host,
  onResume,
  onEnd,
  onLeave,
}: MatchMenuProps) {
  const t = useTexts();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onResume()}
    >
      <DialogContent
        showCloseButton={false}
        className='gap-4 rounded-3xl border-4 border-white bg-[var(--game-background)] shadow-[0_8px_0_var(--game-ink)] sm:max-w-sm'
      >
        <DialogHeader className='items-center text-center'>
          <DialogTitle className='font-display text-outline text-4xl leading-none tracking-wide text-white uppercase'>
            {t.match.title}
          </DialogTitle>
          <DialogDescription className='text-white/75'>
            {host ? t.match.endNote : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='flex-col gap-3 sm:flex-col'>
          <button
            type='button'
            className={`${CHUNKY} bg-[var(--game-success)]`}
            onClick={onResume}
          >
            {t.match.resume}
          </button>
          {host && (
            <button
              type='button'
              className={`${CHUNKY} bg-[var(--game-brandPink)]`}
              onClick={onEnd}
            >
              {t.match.end}
            </button>
          )}
          <button
            type='button'
            className={`${CHUNKY} bg-[var(--game-secondary)]`}
            onClick={onLeave}
          >
            {t.match.leave}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
