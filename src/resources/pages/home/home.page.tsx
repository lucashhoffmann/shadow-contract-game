import { useGameStore } from '@/app/store/game-store/game.store';
import { Button } from '@/resources/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/resources/components/ui/dialog';
export function HomePage() {
  const best = useGameStore((state) => state.best);
  const startRun = useGameStore((state) => state.startRun);
  const openCharacter = useGameStore((state) => state.openCharacter);
  const bloodColor = useGameStore((state) => state.bloodColor);
  const setBloodColor = useGameStore((state) => state.setBloodColor);

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
      <Dialog>
        <DialogTrigger asChild>
          <Button variant='outline'>Configurações</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
            <DialogDescription>Preferências visuais do jogo.</DialogDescription>
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
      <p className='text-muted-foreground max-w-xs text-sm'>
        WASD ou setas para andar. Chegue por tras para eliminar. Fique fora do
        cone de visao.
      </p>
    </main>
  );
}
