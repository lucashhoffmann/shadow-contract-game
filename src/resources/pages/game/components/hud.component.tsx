import { ChevronsRight } from 'lucide-react';

import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  DASH_MAX,
  SHOP_EVERY,
} from '@/app/modules/world/constants/world.constants';
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

// saltos guardados: um traco por salto, aceso enquanto houver
function DashPips({ dashes }: { dashes: number }) {
  return (
    <div
      role='img'
      aria-label={`Saltos: ${dashes} de ${DASH_MAX}`}
      className='flex items-center gap-1'
    >
      <ChevronsRight
        aria-hidden
        className='size-4 text-sky-300'
        strokeWidth={3}
      />
      {Array.from({ length: DASH_MAX }, (_, i) => (
        <span
          key={i}
          data-state={i < dashes ? 'full' : 'empty'}
          className={cn(
            'h-2.5 w-3.5 -skew-x-12 rounded-xs',
            i < dashes ? 'bg-sky-400' : 'bg-white/20',
          )}
        />
      ))}
    </div>
  );
}

type HudProps = {
  hud: HudData;
  // armas de fogo da run, em ordem
  arsenal: { id: WeaponId; ammo: number }[];
  onSelectWeapon: (id: WeaponId | null) => void;
  // foto de cada arma, vinda da engine (data URL)
  previews: Record<WeaponId | 'sword', string>;
};

// arma na mao: foto do modelo, nome e, se for de fogo, balas restantes.
// Sem bala fica cinza e opaca: esta na mao, mas nao atira.
function WeaponCard({ hud, previews }: Pick<HudProps, 'hud' | 'previews'>) {
  const weapon = hud.weaponId ? ITEMS[hud.weaponId] : null;
  const empty = !!weapon && hud.ammo <= 0;
  return (
    <div
      data-empty={empty}
      className={cn(
        'flex w-fit items-center gap-2 rounded-lg border-2 border-white/80 bg-[#1b1d3a] px-2 py-1',
        empty && 'border-white/40 opacity-60 grayscale',
      )}
    >
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

// Escolha da arma: espada e cada arma de fogo do arsenal. So aparece quando
// ha arma de fogo. Arma sem bala continua escolhivel, cinza e opaca.
function WeaponSlots({ hud, arsenal, previews, onSelectWeapon }: HudProps) {
  if (arsenal.length === 0) return null;
  const slots: { id: WeaponId | null; name: string; ammo: number | null }[] = [
    { id: null, name: 'Espada', ammo: null },
    ...arsenal.map(({ id, ammo }) => ({ id, name: ITEMS[id].name, ammo })),
  ];
  return (
    <div
      role='group'
      aria-label='Armas'
      className='pointer-events-auto flex gap-1'
    >
      {slots.map(({ id, name, ammo }) => {
        const selected = id === hud.weaponId;
        const empty = ammo === 0;
        return (
          <button
            key={id ?? 'sword'}
            type='button'
            aria-pressed={selected}
            aria-label={
              ammo === null
                ? name
                : `${name}: ${ammo} ${empty ? '(sem balas)' : 'balas'}`
            }
            data-empty={empty}
            onClick={() => onSelectWeapon(id)}
            className={cn(
              'flex w-14 flex-col items-center rounded-md border-2 bg-[#1b1d3a] px-1 py-0.5 text-[10px] leading-tight font-black',
              selected ? 'border-yellow-300' : 'border-white/30',
              empty && 'opacity-50 grayscale',
            )}
          >
            <img
              src={previews[id ?? 'sword']}
              alt=''
              className='h-5 w-10 object-contain'
            />
            {ammo ?? '∞'}
          </button>
        );
      })}
    </div>
  );
}

export function Hud({ hud, arsenal, previews, onSelectWeapon }: HudProps) {
  // escudo soma na barra: ela passa a medir vida maxima + escudo, com a
  // parte do escudo em azul logo depois da vida
  const capacity = hud.maxHp + hud.shield;
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
            className='flex h-4 w-28 overflow-hidden rounded-full bg-black/50 sm:w-40'
          >
            <div
              className='h-full bg-green-500 transition-[width]'
              style={{ width: `${(hud.hp / capacity) * 100}%` }}
            />
            <div
              data-testid='shield-bar'
              className='h-full bg-sky-400 transition-[width]'
              style={{ width: `${(hud.shield / capacity) * 100}%` }}
            />
          </div>
          <p className='text-sm font-black'>{hud.hp}</p>
          {hud.shield > 0 && (
            <p
              aria-label='Escudo'
              className='text-sm font-black text-sky-300'
            >
              +{hud.shield}
            </p>
          )}
        </div>
        <DashPips dashes={hud.dashes} />
        <WeaponCard
          hud={hud}
          previews={previews}
        />
        <WeaponSlots
          hud={hud}
          arsenal={arsenal}
          previews={previews}
          onSelectWeapon={onSelectWeapon}
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
