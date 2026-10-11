import {
  DEFAULT_LOOK,
  LOOK_SCALE,
  type PlayerLook,
  WEAPON_SCALE,
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
  ['head', 'Cabeca', LOOK_SCALE],
  ['legs', 'Pernas', LOOK_SCALE],
  ['hands', 'Maos', LOOK_SCALE],
  ['feet', 'Pes', LOOK_SCALE],
  ['weapon', 'Arma', WEAPON_SCALE],
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
      {SIZES.map(([key, label, range]) => (
        // numero fora do <label>: o nome acessivel do slider segue so o rotulo
        <div
          key={key}
          className='flex items-center gap-2'
        >
          <label className='flex flex-1 items-center justify-between gap-3'>
            {label}
            <input
              type='range'
              min={range.min}
              max={range.max}
              step={0.05}
              value={look[key]}
              onChange={(event) =>
                onChange({ [key]: Number(event.target.value) })
              }
              className='w-32'
            />
          </label>
          <output className='w-10 text-right font-bold tabular-nums'>
            {Math.round(look[key] * 100)}%
          </output>
        </div>
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
