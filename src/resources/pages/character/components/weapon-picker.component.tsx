import { ITEMS } from '@/app/modules/shop/constants/shop.constants';
import type { WeaponId } from '@/app/modules/world/types/world.types';
import { Button } from '@/resources/components/ui/button';

type WeaponPickerProps = {
  // null = espada
  weapon: WeaponId | null;
  onChange: (weapon: WeaponId | null) => void;
};

const OPTIONS: [id: WeaponId | null, label: string][] = [
  [null, 'Espada'],
  ['pistol', ITEMS.pistol.name],
  ['silenced', ITEMS.silenced.name],
  ['shotgun', ITEMS.shotgun.name],
];

// So muda o preview: na run a arma vem da loja
export function WeaponPicker({ weapon, onChange }: WeaponPickerProps) {
  return (
    <section
      aria-label='Arma no preview'
      className='flex w-full max-w-xs flex-col gap-3 rounded-lg border p-4 text-left text-sm'
    >
      <h2 className='font-black uppercase'>Arma no preview</h2>
      <div className='grid grid-cols-2 gap-2'>
        {OPTIONS.map(([id, label]) => (
          <Button
            key={label}
            size='sm'
            variant={id === weapon ? 'default' : 'outline'}
            aria-pressed={id === weapon}
            className='h-auto py-2 whitespace-normal'
            onClick={() => onChange(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className='text-muted-foreground text-xs'>
        So para ver como fica. Na run, a arma vem da loja.
      </p>
    </section>
  );
}
