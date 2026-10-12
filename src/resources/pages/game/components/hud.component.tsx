import {
  Banknote,
  ChevronsRight,
  Cross,
  Heart,
  ListOrdered,
  Pause,
} from 'lucide-react';

import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import {
  DASH_MAX,
  SHOP_EVERY,
} from '@/app/modules/world/constants/world.constants';
import type { WeaponId } from '@/app/modules/world/types/world.types';
import type { Hud as HudData } from '@/app/store/game-store/game.store';
import { cn } from '@/shared/lib/utils';
import { useTexts } from '@/shared/i18n';

const SEGMENT_STYLE = {
  done: 'bg-primary text-primary-foreground',
  current: 'animate-pulse bg-white text-black scale-110',
  todo: 'bg-white/25 text-white',
};

// Estilo do HUD: o mesmo da home. Fonte dos titulos com contorno, paineis de
// borda branca e sombra dura embaixo.
const PANEL =
  'rounded-xl border-[3px] border-white bg-[var(--game-hudPanel)] shadow-[0_3px_0_var(--game-ink)]';
const BUTTON =
  'pointer-events-auto flex size-10 cursor-pointer items-center justify-center rounded-xl border-4 border-white bg-[var(--game-secondary)] text-white shadow-[0_4px_0_var(--game-ink)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none sm:size-11';
// abaixo dessa fracao da vida a barra fica vermelha e pulsa
const LOW_HEALTH = 0.3;

// um contrato = SHOP_EVERY salas; o ultimo segmento e a loja
// tempo que falta de um efeito (0 a 1); some quando acaba
function EffectBar({
  label,
  left,
  color,
}: {
  label: string;
  left: number;
  color: string;
}) {
  if (left <= 0) return null;
  return (
    <div className='animate-hud-pop flex items-center gap-2'>
      <div
        role='progressbar'
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(left * 100)}
        className='h-2.5 w-24 overflow-hidden rounded-full border-2 border-white bg-black/50 sm:w-40'
      >
        <div
          className={`h-full ${color} transition-[width] duration-200 ease-linear`}
          style={{ width: `${left * 100}%` }}
        />
      </div>
      <p className='text-outline text-xs tracking-wide uppercase sm:text-sm'>
        {label}
      </p>
    </div>
  );
}

function ContractBar({ room }: { room: number }) {
  const t = useTexts();
  const contract = Math.max(0, Math.floor((room - 1) / SHOP_EVERY)) + 1;
  const position = room - (contract - 1) * SHOP_EVERY;

  return (
    <div className='flex flex-col items-center gap-1'>
      {/* troca de contrato: o titulo estoura */}
      <p
        key={contract}
        className='text-outline animate-hud-pop text-sm tracking-wide uppercase sm:text-lg'
      >
        {t.game.contract(contract)}
      </p>
      <ol
        aria-label={t.game.contractRoom(position, SHOP_EVERY)}
        className={cn('flex items-center gap-1 p-1 sm:p-1.5', PANEL)}
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
                'flex h-4 w-3 items-center justify-center rounded-sm text-[10px] font-black transition-all duration-300 sm:h-5 sm:w-3.5',
                step === SHOP_EVERY && 'w-5 sm:w-6',
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
  const t = useTexts();
  return (
    <div
      role='img'
      aria-label={t.game.dashes(dashes, DASH_MAX)}
      className='flex items-center gap-1'
    >
      <ChevronsRight
        aria-hidden
        className='size-4 text-sky-300 drop-shadow-[0_2px_0_var(--game-ink)] sm:size-5'
        strokeWidth={4}
      />
      {Array.from({ length: DASH_MAX }, (_, i) => (
        <span
          key={i}
          data-state={i < dashes ? 'full' : 'empty'}
          className={cn(
            'h-2.5 w-3 -skew-x-12 rounded-xs border border-[var(--game-ink)] transition-all duration-200 sm:h-3 sm:w-4',
            i < dashes ? 'bg-sky-400' : 'scale-75 bg-white/20',
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
  // botao de pausa no cabecalho (no toque nao ha tecla P); sem ele, some
  onPause?: () => void;
  // botao do placar (no toque nao ha Tab); sem ele, some
  onScoreboard?: () => void;
};

// arma na mao: foto do modelo, nome e, se for de fogo, balas restantes.
// Sem bala fica cinza e opaca: esta na mao, mas nao atira.
function WeaponCard({ hud, previews }: Pick<HudProps, 'hud' | 'previews'>) {
  const t = useTexts();
  const weapon = hud.weaponId ? ITEMS[hud.weaponId] : null;
  const empty = !!weapon && hud.ammo <= 0;
  return (
    <div
      data-empty={empty}
      // troca de arma: o cartao estoura
      key={hud.weaponId ?? 'sword'}
      className={cn(
        'animate-hud-pop flex w-fit items-center gap-2 px-2 py-1',
        PANEL,
        empty && 'border-white/40 opacity-60 grayscale',
      )}
    >
      {/* espada: so a imagem (o nome fica para leitor de tela). Arma de
          fogo leva nome, balas e headshot ao lado */}
      <img
        src={previews[hud.weaponId ?? 'sword']}
        alt={weapon ? '' : t.common.sword}
        className='h-8 w-16 object-contain sm:h-12 sm:w-24'
      />
      {/* no celular so as balas: nome e headshot nao cabem na coluna */}
      {weapon && (
        <div>
          <p className='text-outline hidden text-xs tracking-wide uppercase sm:block sm:text-sm'>
            {t.shop.items[weapon.id]}
          </p>
          <p
            aria-label={t.game.bullets(hud.ammo, weapon.ammo)}
            className='text-outline text-lg leading-none sm:text-xl'
          >
            {hud.ammo}
            <span className='text-xs opacity-60'>/{weapon.ammo}</span>
          </p>
          <p className='text-outline hidden text-[10px] leading-tight text-orange-300 uppercase sm:block sm:text-xs'>
            Headshot {hud.headshot}%
          </p>
        </div>
      )}
    </div>
  );
}

// Escolha da arma: espada e cada arma de fogo do arsenal. So aparece quando
// ha arma de fogo. Arma sem bala continua escolhivel, cinza e opaca.
function WeaponSlots({ hud, arsenal, previews, onSelectWeapon }: HudProps) {
  const t = useTexts();
  if (arsenal.length === 0) return null;
  const slots: { id: WeaponId | null; name: string; ammo: number | null }[] = [
    { id: null, name: t.common.sword, ammo: null },
    ...arsenal.map(({ id, ammo }) => ({ id, name: t.shop.items[id], ammo })),
  ];
  return (
    <div
      role='group'
      aria-label={t.common.weapons}
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
                : `${name}: ${ammo} ${empty ? t.common.noBullets : t.common.bullets}`
            }
            data-empty={empty}
            onClick={() => onSelectWeapon(id)}
            className={cn(
              'text-outline flex w-12 cursor-pointer flex-col items-center rounded-lg border-[3px] bg-[var(--game-hudPanel)] px-1 py-0.5 text-[11px] leading-tight shadow-[0_3px_0_var(--game-ink)] transition-transform active:translate-y-0.5 active:shadow-none sm:w-14 sm:text-xs',
              selected
                ? '-translate-y-0.5 border-yellow-300'
                : 'border-white/40',
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

export function Hud({
  hud,
  arsenal,
  previews,
  onSelectWeapon,
  onPause,
  onScoreboard,
}: HudProps) {
  const t = useTexts();
  // escudo soma na barra: ela passa a medir vida maxima + escudo, com a
  // parte do escudo em azul logo depois da vida
  const capacity = hud.maxHp + hud.shield;
  const low = hud.hp > 0 && hud.hp <= hud.maxHp * LOW_HEALTH;
  return (
    // Entra descendo do topo. No celular tudo e menor e respeita o entalhe;
    // os tres blocos (vida e armas, contrato, sala e dinheiro) nunca se
    // encostam: os lados encolhem e o meio fica do tamanho que precisa.
    <header className='font-display animate-hud-in pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)] items-start gap-2 bg-gradient-to-b from-black/65 via-black/25 to-transparent px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-6 text-white sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3 sm:p-4 sm:pb-8'>
      <div className='flex min-w-0 flex-col gap-1.5 sm:gap-2'>
        <div className='flex items-center gap-1.5 sm:gap-2'>
          <Heart
            aria-hidden
            className={cn(
              'size-5 shrink-0 fill-[var(--game-brandPink)] text-[var(--game-ink)] sm:size-6',
              low && 'animate-pulse',
            )}
            strokeWidth={2.5}
          />
          <div
            role='progressbar'
            aria-label={t.common.health}
            aria-valuemin={0}
            aria-valuemax={hud.maxHp}
            aria-valuenow={hud.hp}
            className={cn(
              'relative flex h-4 w-20 shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-black/60 shadow-[0_3px_0_var(--game-ink)] sm:h-5 sm:w-44',
              low && 'animate-pulse border-red-300',
            )}
          >
            <div
              className={cn(
                'h-full bg-gradient-to-b transition-[width,background-color] duration-300',
                low ? 'from-red-400 to-red-600' : 'from-green-400 to-green-600',
              )}
              style={{ width: `${(hud.hp / capacity) * 100}%` }}
            />
            <div
              data-testid='shield-bar'
              className='h-full bg-gradient-to-b from-sky-300 to-sky-500 transition-[width] duration-300'
              style={{ width: `${(hud.shield / capacity) * 100}%` }}
            />
            {/* brilho por cima, para a barra parecer um tubo */}
            <div className='pointer-events-none absolute inset-x-1 top-0.5 h-1 rounded-full bg-white/35' />
          </div>
          {/* o numero estoura a cada mudanca de vida */}
          <p
            key={hud.hp}
            className={cn(
              'text-outline animate-hud-pop text-base leading-none sm:text-xl',
              low && 'text-red-300',
            )}
          >
            {hud.hp}
          </p>
          {hud.shield > 0 && (
            <p
              key={`shield-${hud.shield}`}
              aria-label={t.common.shield}
              // no celular nao cabe ao lado da barra: la o escudo aparece so
              // como a parte azul dela
              className='text-outline animate-hud-pop hidden text-base leading-none text-sky-300 sm:block sm:text-xl'
            >
              +{hud.shield}
            </p>
          )}
        </div>
        <EffectBar
          label={t.game.invisible}
          left={hud.invisible}
          color='bg-cyan-300'
        />
        <EffectBar
          label={t.game.invincible}
          left={hud.invincible}
          color='bg-amber-400'
        />
        <DashPips dashes={hud.dashes} />
        {hud.revives > 0 && (
          <div
            role='img'
            aria-label={t.game.revives(hud.revives)}
            className='flex items-center gap-1'
          >
            {Array.from({ length: hud.revives }, (_, i) => (
              <Cross
                key={i}
                aria-hidden
                className='animate-hud-pop size-4 fill-emerald-400 text-emerald-400 drop-shadow-[0_2px_0_var(--game-ink)] sm:size-5'
                strokeWidth={2}
              />
            ))}
          </div>
        )}
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
      <div className='flex min-w-0 flex-col items-end gap-1.5 text-right sm:gap-2'>
        {/* sala e dinheiro estouram quando mudam */}
        <p
          key={`room-${hud.room}`}
          className='text-outline animate-hud-pop text-base leading-none tracking-wide uppercase sm:text-xl'
        >
          {t.game.room(hud.room)}
        </p>
        <div
          key={`money-${hud.money}`}
          className={cn(
            'animate-hud-pop flex items-center gap-1 border-white bg-[var(--game-success)] px-2 py-0.5 sm:gap-1.5 sm:px-3',
            PANEL,
            'bg-[var(--game-success)]',
          )}
        >
          <Banknote
            aria-hidden
            className='size-4 sm:size-5'
            strokeWidth={2.5}
          />
          <p className='text-outline text-base leading-none sm:text-xl'>
            $ {hud.money}
          </p>
        </div>
        {onScoreboard && (
          <button
            type='button'
            aria-label={t.match.showScoreboard}
            onClick={onScoreboard}
            className={BUTTON}
          >
            <ListOrdered
              aria-hidden
              className='size-5'
              strokeWidth={3}
            />
          </button>
        )}
        {onPause && (
          <button
            type='button'
            aria-label={t.common.pause}
            onClick={onPause}
            className={BUTTON}
          >
            <Pause
              aria-hidden
              className='size-5 fill-white'
              strokeWidth={3}
            />
          </button>
        )}
      </div>
    </header>
  );
}
