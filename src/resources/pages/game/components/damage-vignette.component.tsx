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
        background: `radial-gradient(ellipse at center, transparent 50%, ${color === 'blue' ? 'rgb(59 130 246 / 0.65)' : 'rgb(239 68 68 / 0.65)'} 100%)`,
      }}
    />
  );
}
