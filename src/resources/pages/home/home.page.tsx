import { Play, Settings, Trophy, UserRound, Users } from 'lucide-react';

import { useGameStore } from '@/app/store/game-store/game.store';
import { useHomePage } from '@/resources/pages/home/use-home.page';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/resources/components/ui/dialog';
import { InstallApp } from '@/resources/pages/home/components/install-app/install-app.component';
import { useLanguage, useTexts } from '@/shared/i18n';

// botao gordo de jogo: borda branca, sombra dura embaixo, afunda ao clicar
const CHUNKY =
  'text-outline flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-4 border-white text-white uppercase shadow-[0_5px_0_var(--game-ink)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none';
const SECONDARY = `${CHUNKY} w-full bg-[var(--game-secondary)] px-5 py-2 text-lg`;

export function HomePage() {
  const t = useTexts();
  const language = useLanguage((state) => state.language);
  const setLanguage = useLanguage((state) => state.setLanguage);
  const best = useGameStore((state) => state.best);
  const startRun = useGameStore((state) => state.startRun);
  const openCharacter = useGameStore((state) => state.openCharacter);
  const openLobby = useGameStore((state) => state.openLobby);
  const { online } = useHomePage();
  const bloodColor = useGameStore((state) => state.bloodColor);
  const setBloodColor = useGameStore((state) => state.setBloodColor);

  return (
    <main className='game-menu-background font-display relative flex min-h-full flex-col items-center justify-center gap-7 overflow-hidden p-6 text-center'>
      {/* Spot no teto iluminando o titulo: refletor, facho que abre para
          baixo e a poca de luz onde ele bate. O facho balanca bem e a lampada
          falha de vez em quando (spotlight-light, em index.css). */}
      <div
        aria-hidden
        className='spotlight pointer-events-none absolute top-0 left-1/2 h-[68vh] w-[min(150vw,60rem)] origin-top'
      >
        <div className='spotlight-light absolute inset-0 bg-gradient-to-b from-white/45 via-white/12 to-transparent blur-md [clip-path:polygon(47%_0,53%_0,100%_100%,0_100%)]' />
        {/* miolo mais forte do facho */}
        <div className='spotlight-light absolute inset-0 bg-gradient-to-b from-white/35 via-white/8 to-transparent blur-sm [clip-path:polygon(48.5%_0,51.5%_0,70%_100%,30%_100%)]' />
        <div className='absolute top-0 left-1/2 h-5 w-16 -translate-x-1/2 rounded-b-xl border-x-4 border-b-4 border-[var(--game-ink)] bg-[var(--game-ceiling)]' />
        <div className='spotlight-light absolute top-3 left-1/2 h-3 w-10 -translate-x-1/2 rounded-full bg-white shadow-[0_0_24px_10px_rgb(255_255_255/0.75)]' />
      </div>
      <div
        aria-hidden
        className='spotlight-light pointer-events-none absolute top-[22%] left-1/2 h-[46vh] w-[min(130vw,48rem)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgb(255_255_255/0.2)_0%,rgb(255_255_255/0.06)_45%,transparent_70%)]'
      />
      <h1 className='text-outline relative flex -rotate-3 flex-col text-6xl leading-none tracking-wide uppercase sm:text-7xl'>
        <span className='text-white'>Shadow</span>{' '}
        <span className='text-[1.15em] text-[var(--game-brandPink)]'>
          Contract
        </span>
      </h1>
      <p className='text-outline relative flex items-center gap-2 rounded-full bg-black/35 px-4 py-1 text-lg text-[var(--game-highlight)]'>
        <Trophy
          aria-hidden
          className='size-5'
          strokeWidth={3}
        />
        {t.home.record(best)}
      </p>
      <button
        type='button'
        className={`${CHUNKY} relative bg-[var(--game-success)] px-14 py-4 text-4xl`}
        onClick={() => startRun()}
      >
        <Play
          aria-hidden
          className='size-8 fill-white'
          strokeWidth={3}
        />
        {t.home.play}
      </button>
      <div className='relative flex w-full max-w-xs flex-col gap-3'>
        <button
          type='button'
          className={SECONDARY}
          onClick={openCharacter}
        >
          <UserRound
            aria-hidden
            className='size-5'
            strokeWidth={3}
          />
          {t.home.character}
        </button>
        {/* so com o servidor de salas no ar (use-home.page) */}
        {online && (
          <button
            type='button'
            className={SECONDARY}
            onClick={openLobby}
          >
            <Users
              aria-hidden
              className='size-5'
              strokeWidth={3}
            />
            {t.home.multiplayer}
          </button>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <button
              type='button'
              className={SECONDARY}
            >
              <Settings
                aria-hidden
                className='size-5'
                strokeWidth={3}
              />
              {t.home.settings}
            </button>
          </DialogTrigger>
          <DialogContent className='font-sans'>
            <DialogHeader>
              <DialogTitle>{t.home.settings}</DialogTitle>
              <DialogDescription>
                {t.home.settingsDescription}
              </DialogDescription>
            </DialogHeader>
            <label className='flex items-center justify-between gap-4'>
              {t.home.bloodColor}
              <input
                type='color'
                value={bloodColor}
                onChange={(event) => setBloodColor(event.target.value)}
                className='h-10 w-14 cursor-pointer bg-transparent'
              />
            </label>
          </DialogContent>
        </Dialog>
        <button
          type='button'
          className={SECONDARY}
          aria-label={t.home.changeLanguage}
          onClick={() => setLanguage(language === 'pt-BR' ? 'en' : 'pt-BR')}
        >
          <span
            aria-hidden
            className='text-2xl leading-none'
          >
            {language === 'pt-BR' ? '🇧🇷' : '🇺🇸'}
          </span>{' '}
          {t.home.language}: {t.home.languageName}
        </button>
      </div>
      <InstallApp />
      <p className='relative max-w-xs font-sans text-sm text-white/70'>
        {t.home.instructions}
      </p>
      <footer className='text-outline animate-credit absolute inset-x-0 bottom-3 text-base tracking-wide text-white motion-reduce:animate-none'>
        {t.home.credit}{' '}
        <a
          href='https://github.com/lucashhoffmann/'
          target='_blank'
          rel='noopener noreferrer'
          className='text-[var(--game-brandPink)] underline-offset-4 hover:underline'
        >
          Hoffmann
        </a>
      </footer>
    </main>
  );
}
