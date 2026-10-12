import {
  DEFAULT_LOOK,
  LOOK_SCALE,
  type PlayerLook,
  WEAPON_SCALE,
} from '@/app/store/game-store/game.store';
import { Button } from '@/resources/components/ui/button';
import { useTexts } from '@/shared/i18n';

type LookEditorProps = {
  look: PlayerLook;
  onChange: (patch: Partial<PlayerLook>) => void;
};

const COLORS = ['cloth', 'accent', 'skin'] as const;

const SIZES = [
  ['head', LOOK_SCALE],
  ['legs', LOOK_SCALE],
  ['hands', LOOK_SCALE],
  ['feet', LOOK_SCALE],
  ['weapon', WEAPON_SCALE],
] as const;

export function LookEditor({ look, onChange }: LookEditorProps) {
  const t = useTexts();
  return (
    <section
      aria-label={t.character.title}
      className='flex w-full max-w-xs flex-col gap-3 rounded-lg border p-4 text-left text-sm'
    >
      <h2 className='font-black uppercase'>{t.character.title}</h2>
      <div className='flex justify-between gap-2'>
        {COLORS.map((key) => (
          <label
            key={key}
            className='flex flex-col items-center gap-1'
          >
            {t.character[key]}
            <input
              type='color'
              value={look[key]}
              onChange={(event) => onChange({ [key]: event.target.value })}
              className='h-9 w-14 cursor-pointer bg-transparent'
            />
          </label>
        ))}
      </div>
      {SIZES.map(([key, range]) => (
        // numero fora do <label>: o nome acessivel do slider segue so o rotulo
        <div
          key={key}
          className='flex items-center gap-2'
        >
          <label className='flex flex-1 items-center justify-between gap-3'>
            {t.character[key]}
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
        {t.character.reset}
      </Button>
    </section>
  );
}
