import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import { SHOP_EVERY } from '@/app/modules/world/constants/world.constants';
import type { WeaponId } from '@/app/modules/world/types/world.types';
import type { Hud as HudData } from '@/app/store/game-store/game.store';
import { cn } from '@/shared/lib/utils';

const SEGMENT_STYLE = {
  done: 'bg-primary text-primary-foreground',
  current: 'animate-pulse bg-white text-black',
  todo: 'bg-white/25 text-white',
};

// um contrato = SHOP_EVERY salas; o ultimo segmento e a loja
function ContractBar({ room }: { room: number }) {
  const contract = Math.max(0, Math.floor((room - 1) / SHOP_EVERY)) + 1;
  const position = room - (contract - 1) * SHOP_EVERY;

  return (
    <div className='flex flex-col items-center gap-1'>
      <p className='text-sm font-black tracking-wide uppercase'>
        Contrato {contract}
      </p>
      <ol
        aria-label={`Sala ${position} de ${SHOP_EVERY} do contrato`}
        className='flex items-center gap-1 rounded-lg border-2 border-white/80 bg-[#1b1d3a] p-1.5'
      >
        {Array.from({ length: SHOP_EVERY }, (_, i) => {
          const step = i + 1;
          const state =
            step < position ? 'done' : step === position ? 'current' : 'todo';
          return (
            <li
              key={step}
              data-state={state}
              className={cn(
                'flex h-5 w-3.5 items-center justify-center rounded-sm text-[10px] font-black',
                step === SHOP_EVERY && 'w-6',
                SEGMENT_STYLE[state],
              )}
            >
              {step === SHOP_EVERY ? '$' : ''}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type HudProps = {
  hud: HudData;
  // foto de cada arma, vinda da engine (data URL)
  previews: Record<WeaponId | 'sword', string>;
};

// arma na mao: foto do modelo, nome e, se for de fogo, balas restantes
function WeaponCard({ hud, previews }: HudProps) {
  const weapon = hud.weaponId ? ITEMS[hud.weaponId] : null;
  return (
    <div className='flex w-fit items-center gap-2 rounded-lg border-2 border-white/80 bg-[#1b1d3a] px-2 py-1'>
      <img
        src={previews[hud.weaponId ?? 'sword']}
        alt=''
        className='h-9 w-18 object-contain sm:h-12 sm:w-24'
      />
      <div>
        <p className='text-xs font-black tracking-wide uppercase'>
          {weapon?.name ?? 'Espada'}
        </p>
        {weapon && (
          <p
            aria-label={`Balas: ${hud.ammo} de ${weapon.ammo}`}
            className='text-lg leading-none font-black'
          >
            {hud.ammo}
            <span className='text-xs opacity-60'>/{weapon.ammo}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function Hud({ hud, previews }: HudProps) {
  return (
    <header className='pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[1fr_auto_1fr] items-start gap-2 bg-gradient-to-b from-black/60 to-transparent p-4'>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <div
            role='progressbar'
            aria-label='Vida'
            aria-valuemin={0}
            aria-valuemax={hud.maxHp}
            aria-valuenow={hud.hp}
            className='h-4 w-28 overflow-hidden rounded-full bg-black/50 sm:w-40'
          >
            <div
              className='h-full bg-green-500 transition-[width]'
              style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
            />
          </div>
          <p className='text-sm font-black'>{hud.hp}</p>
        </div>
        <WeaponCard
          hud={hud}
          previews={previews}
        />
      </div>
      <ContractBar room={hud.room} />
      <div className='text-right font-black'>
        <p>Sala {hud.room}</p>
        <p className='text-green-400'>$ {hud.money}</p>
      </div>
    </header>
  );
}
