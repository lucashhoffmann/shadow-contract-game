import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/resources/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import { useTexts } from '@/shared/i18n';

type LegendDialogProps = {
  open: boolean;
  title: string;
  actionLabel: string;
  onAction: () => void;
  // volta para a tela inicial, largando a run
  onMenu: () => void;
  onRestart?: () => void;
};

// botao gordo de jogo, igual ao da home e da tela de derrota
const CHUNKY =
  'font-display text-outline cursor-pointer rounded-2xl border-4 border-white px-6 py-2 text-xl text-white uppercase shadow-[0_5px_0_var(--game-ink)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none';

// botoes secundarios: menores que a acao principal
const SMALL = 'px-4 py-1.5 text-base';

// usado antes de cada run ("Como jogar") e na pausa ("Pausado")
export function LegendDialog({
  open,
  title,
  actionLabel,
  onAction,
  onMenu,
  onRestart,
}: LegendDialogProps) {
  const t = useTexts();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onAction()}
    >
      <DialogContent
        showCloseButton={false}
        // So a legenda rola. Os botoes ficam fora do painel, flutuando embaixo:
        // sempre a vista, sem precisar rolar ate o fim para comecar.
        className='max-h-[94dvh] grid-rows-[minmax(0,1fr)_auto] gap-3 border-0 bg-transparent p-0 shadow-none sm:max-w-xl'
      >
        <div className='flex min-h-0 flex-col gap-4 overflow-y-auto rounded-3xl border-4 border-white bg-[var(--game-background)] p-6 shadow-[0_8px_0_var(--game-ink)]'>
          <DialogHeader className='items-center text-center'>
            <DialogTitle className='font-display text-outline text-4xl leading-none tracking-wide text-white uppercase sm:text-5xl'>
              {title}
            </DialogTitle>
            <DialogDescription className='font-display text-outline text-lg text-[var(--game-brandPink)]'>
              {t.legend.subtitle}
            </DialogDescription>
          </DialogHeader>
          {t.legend.sections.map(({ title: section, entries }) => (
            <section
              key={section}
              className='rounded-2xl bg-black/25 p-3'
            >
              <h3 className='font-display text-outline mb-2 text-lg tracking-wide text-[var(--game-highlight)] uppercase'>
                {section}
              </h3>
              <dl className='grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm'>
                {entries.map(([label, text]) => (
                  <div
                    key={label}
                    className='contents'
                  >
                    <dt className='rounded-md bg-white/10 px-2 py-0.5 font-black whitespace-nowrap text-white'>
                      {label}
                    </dt>
                    <dd className='text-white/75'>{text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <DialogFooter className='flex-row flex-wrap items-center justify-center gap-3 pb-2 sm:justify-center'>
          <button
            type='button'
            className={cn(CHUNKY, SMALL, 'bg-[var(--game-neutralButton)]')}
            onClick={onMenu}
          >
            {t.legend.home}
          </button>
          <button
            type='button'
            className={cn(CHUNKY, SMALL, 'bg-[var(--game-neutralButton)]')}
            // entra ou sai da tela cheia; navegador sem suporte ignora
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen?.()
                : document.documentElement.requestFullscreen?.()
            }
          >
            {t.legend.fullscreen}
          </button>
          {onRestart && (
            <button
              type='button'
              className={`${CHUNKY} bg-[var(--game-secondary)]`}
              onClick={onRestart}
            >
              {t.legend.restart}
            </button>
          )}
          <button
            type='button'
            className={`${CHUNKY} bg-[var(--game-success)]`}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
