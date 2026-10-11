import { SHOP_ITEMS } from '@/app/modules/shop/constants/shop.constants';
import type {
  ItemDef,
  ItemId,
  Market,
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

type ShopDialogProps = {
  open: boolean;
  money: number;
  market: Market;
  onBuy: (id: ItemId) => void;
  onClose: () => void;
};

function describeItem(item: ItemDef): string {
  if (item.kind === 'armor') return `+${item.bonusHp} de vida`;
  return `${item.ammo} tiros${item.pellets > 1 ? `, ${item.pellets} balas` : ''}`;
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

export function ShopDialog({
  open,
  money,
  market,
  onBuy,
  onClose,
}: ShopDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Escolha o equipamento</DialogTitle>
          <DialogDescription>
            Vale so para a run atual. Voce tem $ {money}. Inflacao: +
            {percent(market.inflation)}%.
          </DialogDescription>
        </DialogHeader>
        <div className='grid grid-cols-3 gap-3'>
          {SHOP_ITEMS.map((item) => {
            const price = market.prices[item.id];
            return (
              <Button
                key={item.id}
                variant='secondary'
                className='h-auto flex-col gap-1 py-4 whitespace-normal'
                disabled={money < price}
                onClick={() => onBuy(item.id)}
              >
                <span className='font-black uppercase'>{item.name}</span>
                <span className='text-xs opacity-80'>{describeItem(item)}</span>
                <span className='font-bold'>$ {price}</span>
                <span className='text-xs'>
                  <PriceChange change={percent(price / item.price)} />
                </span>
              </Button>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
