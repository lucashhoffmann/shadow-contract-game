import {
  DEFAULT_LOOK,
  LOOK_SCALE,
  type PlayerLook,
} from '@/app/store/game-store/game.store';
import { Button } from '@/resources/components/ui/button';

type LookEditorProps = {
  look: PlayerLook;
  onChange: (patch: Partial<PlayerLook>) => void;
};

const COLORS = [
  ['cloth', 'Roupa'],
  ['accent', 'Faixa'],
  ['skin', 'Pele'],
] as const;

const SIZES = [
  ['head', 'Cabeca'],
  ['legs', 'Pernas'],
  ['hands', 'Maos'],
] as const;

export function LookEditor({ look, onChange }: LookEditorProps) {
  return (
    <section
      aria-label='Personagem'
      className='flex w-full max-w-xs flex-col gap-3 rounded-lg border p-4 text-left text-sm'
    >
      <h2 className='font-black uppercase'>Personagem</h2>
      <div className='flex justify-between gap-2'>
        {COLORS.map(([key, label]) => (
          <label
            key={key}
            className='flex flex-col items-center gap-1'
          >
            {label}
            <input
              type='color'
              value={look[key]}
              onChange={(event) => onChange({ [key]: event.target.value })}
              className='h-9 w-14 cursor-pointer bg-transparent'
            />
          </label>
        ))}
      </div>
      {SIZES.map(([key, label]) => (
        <label
          key={key}
          className='flex items-center justify-between gap-3'
        >
          {label}
          <input
            type='range'
            min={LOOK_SCALE.min}
            max={LOOK_SCALE.max}
            step={0.05}
            value={look[key]}
            onChange={(event) =>
              onChange({ [key]: Number(event.target.value) })
            }
            className='w-40'
          />
        </label>
      ))}
      <Button
        variant='outline'
        size='sm'
        onClick={() => onChange(DEFAULT_LOOK)}
      >
        Restaurar padrao
      </Button>
    </section>
  );
}
