import { Banknote, Shield } from 'lucide-react';

import { SHOP_ITEMS } from '@/app/modules/shop/constants/shop.constants';
import { refillPrice } from '@/app/modules/shop/systems/shop.system';
import type {
  ItemDef,
  ItemId,
  Market,
  WeaponId,
} from '@/app/modules/world/types/world.types';
import { Button } from '@/resources/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/resources/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import { getTexts, useTexts } from '@/shared/i18n';

type ShopDialogProps = {
  open: boolean;
  money: number;
  market: Market;
  // armas de fogo que o player ja tem: viram recarga, mais barata
  arsenal: { id: WeaponId; ammo: number }[];
  // foto de cada arma, vinda da engine (data URL)
  previews: Record<WeaponId | 'sword' | 'ammo', string>;
  onBuy: (id: ItemId) => void;
  onClose: () => void;
};

// cor do cartao de cada item: so visual
const CARD_COLOR: Record<ItemId, string> = {
  pistol: 'bg-sky-500',
  silenced: 'bg-violet-500',
  shotgun: 'bg-orange-500',
  armor: 'bg-emerald-500',
};

function describeItem(item: ItemDef): string {
  if (item.kind === 'armor') return getTexts().shop.bonusHealth(item.bonusHp);
  return getTexts().shop.shots(item.ammo, item.pellets);
}

function percent(ratio: number): number {
  return Math.round((ratio - 1) * 100);
}

// variacao do preco de hoje contra o preco base do item
function PriceChange({ change }: { change: number }) {
  if (change === 0) return null;
  return (
    <span className={change > 0 ? 'text-red-300' : 'text-green-300'}>
      {change > 0 ? '▲' : '▼'} {Math.abs(change)}%
    </span>
  );
}

type ItemCardProps = {
  item: ItemDef;
  price: number;
  affordable: boolean;
  // balas que a recarga repoe; undefined = item novo, nao recarga
  refill?: number;
  // colete nao tem modelo: fica sem foto e leva o icone de escudo
  preview?: string;
  onBuy: () => void;
};

// cartao colorido com a foto do item e o preco embaixo; sem saldo fica apagado
function ItemCard({
  item,
  price,
  affordable,
  refill,
  preview,
  onBuy,
}: ItemCardProps) {
  const t = useTexts();
  return (
    <button
      type='button'
      disabled={!affordable}
      onClick={onBuy}
      className='group flex flex-col items-center gap-1 rounded-2xl outline-none disabled:cursor-not-allowed sm:gap-2'
    >
      <span
        className={cn(
          'flex w-full flex-col items-center gap-1 rounded-2xl border-4 border-white p-2 text-white shadow-lg transition-transform group-hover:-translate-y-1 group-focus-visible:ring-4 group-focus-visible:ring-yellow-300 group-disabled:translate-y-0 group-disabled:opacity-60 group-disabled:saturate-50',
          CARD_COLOR[item.id],
        )}
      >
        {/* altura de duas linhas: nome longo nao desalinha os cartoes */}
        <span className='flex h-8 items-center text-center text-xs leading-tight font-black tracking-wide uppercase'>
          {t.shop.items[item.id]}
        </span>
        {/* no celular a arte e menor, para os quatro cartoes caberem */}
        <span className='flex aspect-square w-3/5 items-center justify-center rounded-full bg-white/20 sm:w-full'>
          {preview ? (
            <img
              src={preview}
              alt=''
              className='w-full scale-125 -rotate-12 object-contain drop-shadow-lg'
            />
          ) : (
            <Shield
              aria-hidden
              className='size-1/2'
              strokeWidth={2.5}
            />
          )}
        </span>
        <span className='text-[11px] font-bold opacity-90'>
          {refill === undefined
            ? describeItem(item)
            : refill > 0
              ? t.shop.refill(refill)
              : t.shop.fullAmmo}
        </span>
      </span>
      <span className='flex items-center gap-1.5 rounded-xl border-4 border-white bg-green-500 px-3 text-base font-black text-white shadow-md group-disabled:bg-slate-500 group-disabled:text-white/70 sm:py-0.5 sm:text-lg'>
        <Banknote
          aria-hidden
          className='size-5'
        />
        {price}
      </span>
      <span className='h-4 text-xs font-bold'>
        {refill === undefined ? (
          <PriceChange change={percent(price / item.price)} />
        ) : (
          <span className='text-sky-300'>{t.shop.owned}</span>
        )}
      </span>
    </button>
  );
}

export function ShopDialog({
  open,
  money,
  market,
  arsenal,
  previews,
  onBuy,
  onClose,
}: ShopDialogProps) {
  const t = useTexts();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent
        showCloseButton={false}
        // entra com atraso: da tempo de ver a tampa do bau abrir
        // sem painel: os cartoes flutuam direto sobre o jogo escurecido
        // Cabe sempre na tela: titulo em cima e Continuar embaixo ficam fixos,
        // e so os cartoes rolam se faltar altura. O fundo e a sombra enorme,
        // na mesma cor, escurecem a tela inteira por igual, para o HUD atras
        // nao brigar com o texto.
        className='fill-mode-backwards max-h-dvh grid-rows-[auto_minmax(0,1fr)_auto] gap-3 border-0 bg-black/45 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)] delay-500 sm:max-w-2xl sm:gap-4 sm:p-6'
      >
        <DialogHeader className='items-center sm:text-center'>
          <DialogTitle className='rounded-full border-4 border-white bg-[#1f4f8f] px-5 py-2 text-base font-black tracking-wide text-white uppercase shadow-lg'>
            {t.shop.title}
          </DialogTitle>
          <DialogDescription className='text-xs font-bold tracking-wide text-white/80 uppercase'>
            {t.shop.summary(money, percent(market.inflation))}
          </DialogDescription>
        </DialogHeader>
        {/* touch-pan-y: o body trava gestos; aqui o arrasto vertical rola */}
        <div className='grid min-h-0 touch-pan-y grid-cols-2 gap-x-3 gap-y-2 overflow-y-auto overscroll-contain p-1 sm:grid-cols-4 sm:gap-3'>
          {SHOP_ITEMS.map((item) => {
            const owned = arsenal.find((weapon) => weapon.id === item.id);
            const refill = owned && item.ammo - owned.ammo;
            const price = owned
              ? refillPrice(market.prices[item.id])
              : market.prices[item.id];
            return (
              <ItemCard
                key={item.id}
                item={item}
                price={price}
                refill={refill}
                affordable={money >= price && refill !== 0}
                // recarga mostra a municao, nao a arma
                preview={
                  item.id === 'armor'
                    ? undefined
                    : previews[owned ? 'ammo' : item.id]
                }
                onBuy={() => onBuy(item.id)}
              />
            );
          })}
        </div>
        <DialogFooter>
          <Button
            size='lg'
            onClick={onClose}
          >
            {t.common.continue}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
