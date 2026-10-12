import type { Score } from '@/app/store/game-store/game.store';
import { cn } from '@/shared/lib/utils';
import { useTexts } from '@/shared/i18n';
import { COLORS } from '@/shared/colors';

type ScoreboardProps = {
  open: boolean;
  scores: Score[];
};

// verde ate 80 ms, amarelo ate 160, vermelho acima
function pingColor(ping: number): string {
  if (!ping) return 'text-white/50';
  if (ping <= 80) return 'text-[var(--game-success)]';
  return ping <= 160 ? 'text-[#ffd21f]' : 'text-[var(--game-brandPink)]';
}

// Placar da partida: kills e mortes de cada jogador. Aparece por cima do
// jogo enquanto o Tab esta segurado, ou pelo icone do HUD no toque. Nao
// intercepta toque: o jogo continua por baixo.
export function Scoreboard({ open, scores }: ScoreboardProps) {
  const t = useTexts();
  if (!open) return null;
  // quem matou mais em cima; empate, quem morreu menos
  // ping so existe em rede: no solo a coluna some
  const online = scores.some((score) => score.ping > 0);
  const ranked = [...scores].sort(
    (a, b) => b.kills - a.kills || a.deaths - b.deaths,
  );

  return (
    <div className='pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4'>
      <table
        aria-label={t.match.scoreboard}
        className='font-display w-full max-w-sm table-fixed overflow-hidden rounded-2xl border-4 border-white bg-[var(--game-panel)]/95 text-white shadow-[0_6px_0_var(--game-ink)]'
      >
        <caption className='text-outline bg-[var(--game-panelTitle)] py-2 text-2xl tracking-wide uppercase'>
          {t.match.scoreboard}
        </caption>
        <thead>
          <tr className='text-sm text-[var(--game-highlight)] uppercase'>
            <th className='px-3 py-1 text-left font-normal'>
              {t.match.player}
            </th>
            <th className='w-[4.5rem] px-2 py-1 font-normal'>
              {t.match.kills}
            </th>
            <th className='w-[4.5rem] px-2 py-1 font-normal'>
              {t.match.deaths}
            </th>
            {online && (
              <th className='w-[4.5rem] px-2 py-1 font-normal'>
                {t.match.ping}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {ranked.map((score) => (
            <tr
              key={score.id}
              data-you={score.you}
              className={cn('text-xl', score.you && 'bg-white/15')}
            >
              <th
                scope='row'
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-left font-normal',
                  !score.alive && 'opacity-50',
                )}
              >
                <span
                  aria-hidden
                  className='size-4 shrink-0 rounded-full border-2 border-white'
                  style={{ background: score.color ?? COLORS.ui.white }}
                />
                <span
                  className='text-outline min-w-0 truncate'
                  style={{ color: score.color ?? COLORS.ui.white }}
                >
                  {score.name || t.match.player}
                </span>
                {score.you && (
                  <span className='font-sans text-xs text-white/70'>
                    {t.match.you}
                  </span>
                )}
                {!score.alive && (
                  <span className='font-sans text-xs text-[var(--game-brandPink)]'>
                    {t.match.dead}
                  </span>
                )}
              </th>
              <td className='px-2 py-1.5 text-center text-[var(--game-success)]'>
                {score.kills}
              </td>
              <td className='px-2 py-1.5 text-center text-[var(--game-brandPink)]'>
                {score.deaths}
              </td>
              {online && (
                <td
                  className={cn(
                    'px-2 py-1.5 text-center font-sans text-sm font-bold',
                    pingColor(score.ping),
                  )}
                >
                  {score.ping ? `${score.ping} ms` : '-'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
