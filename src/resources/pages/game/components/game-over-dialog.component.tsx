import { RotateCcw, Skull } from 'lucide-react';
import { useState } from 'react';

import type { Run } from '@/app/modules/world/types/world.types';
import { Button } from '@/resources/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/resources/components/ui/dialog';

type GameOverDialogProps = {
  open: boolean;
  room: number;
  kills: number;
  best: number;
  run: Run | null;
  onRestart: () => void;
  onMenu: () => void;
};

export function GameOverDialog({
  open,
  room,
  kills,
  best,
  run,
  onRestart,
  onMenu,
}: GameOverDialogProps) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const attempts = run?.stats.meleeAttempts ?? 0;
  const hits = run?.stats.meleeHits ?? 0;
  const misses = attempts - hits;
  const projectilesFired = run?.stats.projectilesFired ?? 0;
  const projectilesHit = run?.stats.projectilesHit ?? 0;
  const projectileMisses = projectilesFired - projectilesHit;
  const rate = (value: number, total: number) =>
    total ? `${Math.round((value / total) * 100)}%` : '0%';
  const time = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  return (
    <Dialog open={open}>
      {/* sem caixa: titulo, caveira e botoes soltos sobre o jogo */}
      <DialogContent
        showCloseButton={false}
        className='font-display flex flex-col items-center gap-6 border-0 bg-transparent text-center shadow-none'
      >
        <DialogHeader className='items-center gap-3'>
          <DialogTitle className='text-outline flex flex-col text-5xl leading-none tracking-wide uppercase sm:text-6xl'>
            <span className='text-white'>Contrato</span>{' '}
            <span className='text-[1.2em] text-[#ff2d55]'>falhou!</span>
          </DialogTitle>
          <Skull
            aria-hidden
            className='size-16 fill-white text-[#14141f] drop-shadow-[0_4px_0_#14141f]'
            strokeWidth={1.5}
          />
          <DialogDescription className='text-outline text-lg text-white'>
            Sala {room}, {kills} eliminados. Recorde: sala {best}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='flex-col items-center gap-3 sm:flex-col sm:justify-center'>
          <button
            type='button'
            className='text-outline flex items-center gap-2 rounded-2xl border-4 border-white bg-[#2fd15a] px-6 py-3 text-2xl text-white uppercase shadow-[0_5px_0_#14141f] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none'
            onClick={() => {
              setAnalysisOpen(false);
              onRestart();
            }}
          >
            <RotateCcw
              aria-hidden
              className='size-6'
              strokeWidth={3.5}
            />
            Jogar de novo
          </button>
          <div className='flex gap-2 font-sans'>
            <Button
              variant='outline'
              onClick={() => {
                setAnalysisOpen(false);
                onMenu();
              }}
            >
              Menu
            </Button>
            <Button
              variant='secondary'
              disabled={!run}
              onClick={() => setAnalysisOpen(true)}
            >
              Ver análise do jogo
            </Button>
          </div>
        </DialogFooter>
        <Dialog
          open={analysisOpen && open}
          onOpenChange={setAnalysisOpen}
        >
          <DialogContent className='max-h-[85vh] overflow-y-auto font-sans sm:max-w-2xl'>
            <DialogHeader>
              <DialogTitle>Análise do jogo</DialogTitle>
              <DialogDescription>
                Resumo e registro da partida encerrada.
              </DialogDescription>
            </DialogHeader>
            {run && (
              <>
                <div className='grid grid-cols-2 gap-2 text-sm sm:grid-cols-3'>
                  <p>Tempo: {time(run.seconds)}</p>
                  <p>Sala: {run.roomIndex}</p>
                  <p>Eliminações: {run.kills}</p>
                  <p>{`Força do ataque: ${Math.round(run.attackVariance.min * 100)}%–${Math.round(run.attackVariance.max * 100)}%`}</p>
                  <p>Dano causado: {run.stats.damageDealt}</p>
                  <p>Facadas: {attempts}</p>
                  <p>
                    Acertos: {hits} ({rate(hits, attempts)})
                  </p>
                  <p>
                    Erros: {misses} ({rate(misses, attempts)})
                  </p>
                  <p>Projéteis: {projectilesFired}</p>
                  <p>
                    Acertos de tiro: {projectilesHit} (
                    {rate(projectilesHit, projectilesFired)})
                  </p>
                  <p>
                    Erros de tiro: {projectileMisses} (
                    {rate(projectileMisses, projectilesFired)})
                  </p>
                  <p>Vida recuperada: {run.stats.healthRecovered}</p>
                  <p>Dano sofrido: {run.stats.damageTaken}</p>
                  <p>Dano bloqueado: {run.stats.damageBlocked}</p>
                  <p>Dinheiro coletado: ${run.earned}</p>
                  <p>Lojas visitadas: {run.shops}</p>
                </div>
                <section className='space-y-1 text-sm'>
                  <h3 className='font-semibold'>Insights</h3>
                  <p>
                    {attempts
                      ? misses
                        ? `${misses} facada${misses > 1 ? 's' : ''} errada${misses > 1 ? 's' : ''} alertaram os alvos.`
                        : 'Todas as facadas acertaram.'
                      : 'Nenhuma facada nesta partida.'}
                  </p>
                  <p>
                    {run.stats.healthRecovered
                      ? `${run.stats.healthRecovered} pontos de vida recuperados durante a partida.`
                      : 'Nenhuma vida recuperada durante a partida.'}
                  </p>
                </section>
                <section className='space-y-2 text-sm'>
                  <h3 className='font-semibold'>Registro da partida</h3>
                  <ol className='max-h-56 space-y-1 overflow-y-auto rounded-md border p-3'>
                    {run.events.map((event, index) => (
                      <li key={index}>
                        <span className='text-muted-foreground'>
                          {time(event.at)}
                        </span>{' '}
                        {event.text}
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}
            <DialogFooter>
              <Button onClick={() => setAnalysisOpen(false)}>Voltar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
