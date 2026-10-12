import { cn } from '@/shared/lib/utils';

type KillStreakProps = {
  // mortes seguidas: 2 a 5 mostram o aviso; menos que isso, nada
  count: number;
  // momento da ultima morte: muda a cada uma e reinicia a animacao
  at: number;
};

// um nome e uma cor por tamanho de sequencia: esquenta ate o vermelho
const STREAKS: Record<number, [name: string, color: string]> = {
  2: ['Double', 'text-[#fff3c4]'],
  3: ['Triple', 'text-[#ffd21f]'],
  4: ['Quadra', 'text-[#ff8a1f]'],
  5: ['Penta', 'text-[#ff2b2b]'],
};

// Aviso de sequencia de mortes (double a penta kill): estoura no alto da
// tela, na fonte dos numeros de dano, e some sozinho. Nao intercepta toque e
// fica acima do meio, para nao cobrir o personagem.
export function KillStreak({ count, at }: KillStreakProps) {
  const streak = STREAKS[count];
  if (!streak) return null;
  const [name, color] = streak;
  return (
    <div
      key={at}
      role='status'
      className={cn(
        // contorno mais fino que o dos titulos: a letra desta fonte e fina e o
        // contorno grosso a engolia
        'font-hit animate-streak pointer-events-none absolute inset-x-0 top-[16%] z-10 flex flex-col items-center text-center leading-[0.85] uppercase opacity-0 [&>span]:[-webkit-text-stroke-width:0.13em]',
        color,
      )}
    >
      <span className='text-outline text-5xl tracking-wide sm:text-6xl'>
        {name}
      </span>
      <span className='text-outline text-6xl tracking-wider sm:text-7xl'>
        Kill
      </span>
    </div>
  );
}
