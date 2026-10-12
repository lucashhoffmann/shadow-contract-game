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
      {/* faixa de luz atras do titulo, como o cone de visao do jogo */}
      <div
        aria-hidden
        className='pointer-events-none absolute top-0 left-1/2 h-[70vh] w-[140vw] -translate-x-1/2 bg-[conic-gradient(from_150deg_at_50%_0%,transparent_0deg,rgb(255_255_255/0.07)_30deg,transparent_60deg)]'
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
      <p className='relative max-w-xs font-sans text-sm text-white/70'>
        WASD ou setas para andar. Chegue por tras para eliminar. Fique fora do
        cone de visao.
      </p>
    </main>
  );
}
