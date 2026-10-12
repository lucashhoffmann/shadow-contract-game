import { Play, Settings, Trophy, UserRound } from 'lucide-react';

import { useGameStore } from '@/app/store/game-store/game.store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/resources/components/ui/dialog';
import { InstallApp } from '@/resources/pages/home/components/install-app/install-app.component';

// botao gordo de jogo: borda branca, sombra dura embaixo, afunda ao clicar
const CHUNKY =
  'text-outline flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-4 border-white text-white uppercase shadow-[0_5px_0_#14141f] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none';
const SECONDARY = `${CHUNKY} w-full bg-[#3d4fd6] px-5 py-2 text-lg`;

export function HomePage() {
  const best = useGameStore((state) => state.best);
  const startRun = useGameStore((state) => state.startRun);
  const openCharacter = useGameStore((state) => state.openCharacter);
  const bloodColor = useGameStore((state) => state.bloodColor);
  const setBloodColor = useGameStore((state) => state.setBloodColor);

  return (
    <main className='font-display relative flex min-h-full flex-col items-center justify-center gap-7 overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,#3a3f78_0%,#1f2033_55%,#12131f_100%)] p-6 text-center'>
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
        <div className='absolute top-0 left-1/2 h-5 w-16 -translate-x-1/2 rounded-b-xl border-x-4 border-b-4 border-[#14141f] bg-[#3a3d52]' />
        <div className='spotlight-light absolute top-3 left-1/2 h-3 w-10 -translate-x-1/2 rounded-full bg-white shadow-[0_0_24px_10px_rgb(255_255_255/0.75)]' />
      </div>
      <div
        aria-hidden
        className='spotlight-light pointer-events-none absolute top-[22%] left-1/2 h-[46vh] w-[min(130vw,48rem)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgb(255_255_255/0.2)_0%,rgb(255_255_255/0.06)_45%,transparent_70%)]'
      />
      <h1 className='text-outline relative flex -rotate-3 flex-col text-6xl leading-none tracking-wide uppercase sm:text-7xl'>
        <span className='text-white'>Shadow</span>{' '}
        <span className='text-[1.15em] text-[#ff2d55]'>Contract</span>
      </h1>
      <p className='text-outline relative flex items-center gap-2 rounded-full bg-black/35 px-4 py-1 text-lg text-[#ffd21f]'>
        <Trophy
          aria-hidden
          className='size-5'
          strokeWidth={3}
        />
        Recorde: sala {best}
      </p>
      <button
        type='button'
        className={`${CHUNKY} relative bg-[#2fd15a] px-14 py-4 text-4xl`}
        onClick={() => startRun()}
      >
        <Play
          aria-hidden
          className='size-8 fill-white'
          strokeWidth={3}
        />
        Play
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
          Configurar personagem
        </button>
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
              Configurações
            </button>
          </DialogTrigger>
          <DialogContent className='font-sans'>
            <DialogHeader>
              <DialogTitle>Configurações</DialogTitle>
              <DialogDescription>
                Preferências visuais do jogo.
              </DialogDescription>
            </DialogHeader>
            <label className='flex items-center justify-between gap-4'>
              Cor do sangue
              <input
                type='color'
                value={bloodColor}
                onChange={(event) => setBloodColor(event.target.value)}
                className='h-10 w-14 cursor-pointer bg-transparent'
              />
            </label>
          </DialogContent>
        </Dialog>
      </div>
      <InstallApp />
      <p className='relative max-w-xs font-sans text-sm text-white/70'>
        WASD ou setas para andar. Chegue por tras para eliminar. Fique fora do
        cone de visao.
      </p>
      <footer className='text-outline animate-credit absolute inset-x-0 bottom-3 text-base tracking-wide text-white motion-reduce:animate-none'>
        Desenvolvido por{' '}
        <a
          href='https://github.com/lucashhoffmann/'
          target='_blank'
          rel='noopener noreferrer'
          className='text-[#ff2d55] underline-offset-4 hover:underline'
        >
          Hoffmann
        </a>
      </footer>
    </main>
  );
}
