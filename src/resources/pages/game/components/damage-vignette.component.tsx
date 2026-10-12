type DamageVignetteProps = {
  // cada novo golpe ou aviso reinicia o pulso
  hits: number;
  color?: 'red' | 'blue';
};

// bordas que pulsam ao levar dano ou ficar parado; nao interceptam toque
export function DamageVignette({ hits, color = 'red' }: DamageVignetteProps) {
  if (hits === 0) return null;
  return (
    <div
      key={hits}
      data-testid={color === 'blue' ? 'idle-vignette' : 'damage-vignette'}
      className='animate-damage pointer-events-none absolute inset-0 opacity-0'
      style={{
        background: `radial-gradient(ellipse at center, transparent 50%, color-mix(in srgb, ${color === 'blue' ? COLORS.ui.info : COLORS.ui.destructive} 65%, transparent) 100%)`,
      }}
    />
  );
}
import { COLORS } from '@/shared/colors';
