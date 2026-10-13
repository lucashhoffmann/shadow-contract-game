import { TUTORIAL_STEPS } from '@/app/modules/tutorial/systems/tutorial.system';
import { useTutorialOverlay } from '@/resources/pages/game/components/tutorial-overlay/use-tutorial-overlay.component';
import { cn } from '@/shared/lib/utils';
import { useTexts } from '@/shared/i18n';

// botao brute de jogo, igual ao da legenda
const CHUNKY =
  'font-display text-outline cursor-pointer rounded-2xl border-4 border-white px-5 py-1.5 text-lg text-white uppercase shadow-[0_5px_0_var(--game-ink)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none';

// Guia do tutorial. Boas-vindas e fim sao cartoes cheios, com o jogo
// escurecido. Os passos de acao sao uma faixa pequena e translucida logo
// abaixo do HUD: o jogador le e continua vendo a sala. O passo so avanca
// quando ele faz a acao pedida (tutorial.system).
export function TutorialOverlay() {
  const t = useTexts();
  const { open, step, touch, begin, skip, menu, play } = useTutorialOverlay();
  if (!open) return null;
  const card = t.tutorial.steps[step];
  const hint = touch ? card.touch : card.keyboard;
  const edge = step === 'welcome' || step === 'done';
  // passos com acao contam de 1 ate o total, sem os dois cartoes das pontas
  const index = TUTORIAL_STEPS.indexOf(step);
  const total = TUTORIAL_STEPS.length - 2;

  if (!edge) {
    return (
      <div
        role='dialog'
        aria-label={t.tutorial.title}
        className='font-display pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4 sm:top-32'
      >
        <div
          key={step}
          className='animate-hud-pop flex w-full max-w-sm flex-col items-center gap-1 rounded-2xl border-2 border-white/25 bg-black/45 px-4 py-2 text-center backdrop-blur-sm'
        >
          <p className='text-outline text-[10px] tracking-widest text-[var(--game-brand)] uppercase'>
            {t.tutorial.title} {index}/{total}
          </p>
          <h2 className='text-outline text-xl leading-none tracking-wide text-white uppercase'>
            {card.title}
          </h2>
          <p className='font-sans text-xs text-white/80'>{hint}</p>
          <button
            type='button'
            className='pointer-events-auto cursor-pointer font-sans text-[11px] text-white/60 underline-offset-2 hover:text-white hover:underline'
            onClick={skip}
          >
            {t.tutorial.skip}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role='dialog'
      aria-label={t.tutorial.title}
      className='font-display absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-4'
    >
      <div
        key={step}
        className='animate-hud-pop flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-4 border-white bg-[var(--game-background)] p-5 text-center shadow-[0_8px_0_var(--game-ink)]'
      >
        <h2 className='text-outline text-2xl leading-none tracking-wide text-white uppercase sm:text-3xl'>
          {card.title}
        </h2>
        <p className='font-sans text-sm text-white/80'>{hint}</p>
        <div className='flex flex-wrap justify-center gap-3 pt-1'>
          {step === 'welcome' ? (
            <>
              <button
                type='button'
                className={cn(CHUNKY, 'bg-[var(--game-neutralButton)]')}
                onClick={skip}
              >
                {t.tutorial.skip}
              </button>
              <button
                type='button'
                className={cn(CHUNKY, 'bg-[var(--game-success)]')}
                onClick={begin}
              >
                {t.common.start}
              </button>
            </>
          ) : (
            <>
              <button
                type='button'
                className={cn(CHUNKY, 'bg-[var(--game-neutralButton)]')}
                onClick={menu}
              >
                {t.legend.home}
              </button>
              <button
                type='button'
                className={cn(CHUNKY, 'bg-[var(--game-success)]')}
                onClick={play}
              >
                {t.home.play}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
