import { SHOP_ITEMS } from '@/app/modules/shop/constants/shop.constants';
import type { ItemDef, ItemId } from '@/app/modules/world/types/world.types';
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
  onBuy: (id: ItemId) => void;
  onClose: () => void;
};

function describeItem(item: ItemDef): string {
  if (item.kind === 'armor') return `+${item.bonusHp} de vida`;
  return `${item.ammo} tiros${item.area ? ', em area' : ''}`;
}

export function ShopDialog({ open, money, onBuy, onClose }: ShopDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Escolha o equipamento</DialogTitle>
          <DialogDescription>
            Vale so para o contrato atual. Voce tem $ {money}.
          </DialogDescription>
        </DialogHeader>
        <div className='grid grid-cols-3 gap-3'>
          {SHOP_ITEMS.map((item) => (
            <Button
              key={item.id}
              variant='secondary'
              className='h-auto flex-col gap-1 py-4 whitespace-normal'
              disabled={money < item.price}
              onClick={() => onBuy(item.id)}
            >
              <span className='font-black uppercase'>{item.name}</span>
              <span className='text-xs opacity-80'>{describeItem(item)}</span>
              <span className='font-bold'>$ {item.price}</span>
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
