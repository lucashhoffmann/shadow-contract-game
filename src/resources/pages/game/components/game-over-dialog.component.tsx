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
import { ShareRecord } from '@/resources/pages/game/components/share-record/share-record.component';
import { useLanguage, useTexts } from '@/shared/i18n';

type GameOverDialogProps = {
  open: boolean;
  room: number;
  kills: number;
  best: number;
  run: Run | null;
  // sem ele o botao some (convidado em rede: quem recomeca e o host)
  onRestart?: () => void;
  // aviso no lugar do botao de recomecar
  note?: string;
  onMenu: () => void;
};

export function GameOverDialog({
  open,
  room,
  kills,
  best,
  run,
  onRestart,
  note,
  onMenu,
}: GameOverDialogProps) {
  const t = useTexts();
  const language = useLanguage((state) => state.language);
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
            <span className='text-white'>{t.game.you}</span>{' '}
            <span className='text-[1.2em] text-[var(--game-brandPink)]'>
              {t.game.died}
            </span>
          </DialogTitle>
          <Skull
            aria-hidden
            className='size-16 fill-white text-[var(--game-ink)] drop-shadow-[0_4px_0_var(--game-ink)]'
            strokeWidth={1.5}
          />
          <DialogDescription className='text-outline text-lg text-white'>
            {t.game.gameOver(room, kills, best)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='flex-col items-center gap-3 sm:flex-col sm:justify-center'>
          {onRestart && (
            <button
              type='button'
              className='text-outline flex items-center gap-2 rounded-2xl border-4 border-white bg-[var(--game-success)] px-6 py-3 text-2xl text-white uppercase shadow-[0_5px_0_var(--game-ink)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none'
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
              {t.game.restart}
            </button>
          )}
          {note && <p className='text-outline text-lg text-white'>{note}</p>}
          <ShareRecord
            best={best}
            room={room}
            kills={kills}
          />
          <div className='flex gap-2 font-sans'>
            <Button
              variant='outline'
              onClick={() => {
                setAnalysisOpen(false);
                onMenu();
              }}
            >
              {t.common.menu}
            </Button>
            <Button
              variant='secondary'
              disabled={!run}
              onClick={() => setAnalysisOpen(true)}
            >
              {t.game.analysis}
            </Button>
          </div>
        </DialogFooter>
        <Dialog
          open={analysisOpen && open}
          onOpenChange={setAnalysisOpen}
        >
          <DialogContent className='max-h-[85vh] overflow-y-auto font-sans sm:max-w-2xl'>
            <DialogHeader>
              <DialogTitle>{t.game.analysisTitle}</DialogTitle>
              <DialogDescription>
                {t.game.analysisDescription}
              </DialogDescription>
            </DialogHeader>
            {run && (
              <>
                <div className='grid grid-cols-2 gap-2 text-sm sm:grid-cols-3'>
                  <p>
                    {t.game.time}: {time(run.seconds)}
                  </p>
                  <p>
                    {t.common.room}: {run.roomIndex}
                  </p>
                  <p>
                    {t.game.kills}: {run.kills}
                  </p>
                  <p>{`${t.game.attackStrength}: ${Math.round(run.attackVariance.min * 100)}%–${Math.round(run.attackVariance.max * 100)}%`}</p>
                  <p>
                    {t.game.damageDealt}: {run.stats.damageDealt}
                  </p>
                  <p>
                    {t.game.stabs}: {attempts}
                  </p>
                  <p>
                    {t.game.hits}: {hits} ({rate(hits, attempts)})
                  </p>
                  <p>
                    {t.game.misses}: {misses} ({rate(misses, attempts)})
                  </p>
                  <p>
                    {t.game.projectiles}: {projectilesFired}
                  </p>
                  <p>
                    {t.game.shotHits}: {projectilesHit} (
                    {rate(projectilesHit, projectilesFired)})
                  </p>
                  <p>
                    {t.game.shotMisses}: {projectileMisses} (
                    {rate(projectileMisses, projectilesFired)})
                  </p>
                  <p>
                    {t.game.healthRecovered}: {run.stats.healthRecovered}
                  </p>
                  <p>
                    {t.game.damageTaken}: {run.stats.damageTaken}
                  </p>
                  <p>
                    {t.game.damageBlocked}: {run.stats.damageBlocked}
                  </p>
                  <p>
                    {t.game.moneyCollected}: ${run.earned}
                  </p>
                  <p>
                    {t.game.shopsVisited}: {run.shops}
                  </p>
                </div>
                <section className='space-y-1 text-sm'>
                  <h3 className='font-semibold'>{t.game.insights}</h3>
                  <p>
                    {attempts
                      ? misses
                        ? t.game.missedStabs(misses)
                        : t.game.allStabsHit
                      : t.game.noStabs}
                  </p>
                  <p>
                    {run.stats.healthRecovered
                      ? t.game.recovered(run.stats.healthRecovered)
                      : t.game.noRecovery}
                  </p>
                </section>
                <section className='space-y-2 text-sm'>
                  <h3 className='font-semibold'>{t.game.log}</h3>
                  <ol className='max-h-56 space-y-1 overflow-y-auto rounded-md border p-3'>
                    {run.events.map((event, index) => (
                      <li key={index}>
                        <span className='text-muted-foreground'>
                          {time(event.at)}
                        </span>{' '}
                        {language === 'en'
                          ? (event.en ?? event.text)
                          : event.text}
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}
            <DialogFooter>
              <Button onClick={() => setAnalysisOpen(false)}>
                {t.common.back}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
