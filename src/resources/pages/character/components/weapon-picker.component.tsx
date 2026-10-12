import { Check } from 'lucide-react';

import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import type { WeaponId } from '@/app/modules/world/types/world.types';
import { cn } from '@/shared/lib/utils';

type WeaponPickerProps = {
  // null = espada
  weapon: WeaponId | null;
  // foto de cada arma, vinda da engine (data URL)
  previews: Record<WeaponId | 'sword', string>;
  onChange: (weapon: WeaponId | null) => void;
};

// cor do cartao: as armas de fogo usam as mesmas da loja
const OPTIONS: [id: WeaponId | null, label: string, color: string][] = [
  [null, 'Espada', 'bg-rose-500'],
  ['pistol', ITEMS.pistol.name, 'bg-sky-500'],
  ['silenced', ITEMS.silenced.name, 'bg-violet-500'],
  ['shotgun', ITEMS.shotgun.name, 'bg-orange-500'],
];

// Cartoes no estilo da loja. So muda o preview: na run a arma vem da loja
export function WeaponPicker({
  weapon,
  previews,
  onChange,
}: WeaponPickerProps) {
  return (
    <section
      aria-label='Arma no preview'
      className='font-display mt-5 flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border-4 border-white/80 bg-[#16345c] p-4 pt-0 text-center'
    >
      <h2 className='-mt-5 rounded-full border-4 border-white bg-[#1f4f8f] px-5 py-1 tracking-wide text-white uppercase shadow-lg'>
        Arma no preview
      </h2>
      <p className='font-sans text-xs font-bold tracking-wide text-white/80 uppercase'>
        So para ver como fica. Na run, a arma vem da loja.
      </p>
      <div className='grid w-full grid-cols-2 gap-3'>
        {OPTIONS.map(([id, label, color]) => {
          const picked = id === weapon;
          return (
            <button
              key={label}
              type='button'
              aria-pressed={picked}
              onClick={() => onChange(id)}
              className='group flex cursor-pointer flex-col items-center gap-2 rounded-2xl outline-none'
            >
              <span
                className={cn(
                  'flex w-full flex-col items-center gap-1 rounded-2xl border-4 border-white p-2 text-white shadow-lg transition-transform group-hover:-translate-y-1 group-focus-visible:ring-4 group-focus-visible:ring-yellow-300',
                  color,
                  picked
                    ? '-translate-y-1 ring-4 ring-yellow-300'
                    : 'opacity-75 saturate-75',
                )}
              >
                {/* altura de duas linhas: nome longo nao desalinha os cartoes */}
                <span className='flex h-8 items-center text-center text-xs leading-tight tracking-wide uppercase'>
                  {label}
                </span>
                <span className='flex aspect-square w-full items-center justify-center rounded-full bg-white/20'>
                  <img
                    src={previews[id ?? 'sword']}
                    alt=''
                    className='w-full scale-125 -rotate-12 object-contain drop-shadow-lg'
                  />
                </span>
              </span>
              {/* no lugar do preco da loja: marca a arma em uso */}
              <span
                aria-hidden
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-xl border-4 border-white shadow-md',
                  picked ? 'bg-green-500 text-white' : 'bg-slate-500',
                )}
              >
                {picked && (
                  <Check
                    className='size-5'
                    strokeWidth={4}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
