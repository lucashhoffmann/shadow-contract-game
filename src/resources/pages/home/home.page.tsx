import { useGameStore } from '@/app/store/game-store/game.store';
import { Button } from '@/resources/components/ui/button';
export function HomePage() {
  const best = useGameStore((state) => state.best);
  const startRun = useGameStore((state) => state.startRun);
  const openCharacter = useGameStore((state) => state.openCharacter);

  return (
    <main className='flex min-h-full flex-col items-center justify-center gap-6 p-6 text-center'>
      <h1 className='text-5xl font-black tracking-tight uppercase italic'>
        Shadow Contract
      </h1>
      <p className='text-muted-foreground'>Recorde: sala {best}</p>
      <Button
        size='lg'
        className='h-14 px-12 text-xl font-black uppercase'
        onClick={() => startRun()}
      >
        Play
      </Button>
      <Button
        variant='outline'
        onClick={openCharacter}
      >
        Configurar personagem
      </Button>
      <p className='text-muted-foreground max-w-xs text-sm'>
        WASD ou setas para andar. Chegue por tras para eliminar. Fique fora do
        cone de visao.
      </p>
    </main>
  );
}
