import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import type { Hud as HudData } from '@/app/store/game-store/game.store';

export function Hud({ hud }: { hud: HudData }) {
  return (
    <div className='pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4'>
      <div className='w-40'>
        <div
          role='progressbar'
          aria-label='Vida'
          aria-valuemin={0}
          aria-valuemax={hud.maxHp}
          aria-valuenow={hud.hp}
          className='h-4 overflow-hidden rounded-full bg-black/50'
        >
          <div
            className='h-full bg-green-500 transition-[width]'
            style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
          />
        </div>
        <p className='mt-1 text-sm font-bold'>
          {hud.weaponId
            ? `${ITEMS[hud.weaponId].name} x${hud.ammo}`
            : 'Sem arma'}
        </p>
      </div>
      <div className='text-right font-black'>
        <p>Sala {hud.room}</p>
        <p className='text-green-400'>$ {hud.money}</p>
      </div>
    </div>
  );
}
