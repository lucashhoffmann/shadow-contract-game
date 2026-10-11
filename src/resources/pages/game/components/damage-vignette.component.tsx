type DamageVignetteProps = {
  // golpes levados na run; cada golpe novo reinicia o pulso
  hits: number;
};

// bordas vermelhas que pulsam ao levar dano; nao intercepta toque
export function DamageVignette({ hits }: DamageVignetteProps) {
  if (hits === 0) return null;
  return (
    <div
      key={hits}
      data-testid='damage-vignette'
      className='animate-damage pointer-events-none absolute inset-0 opacity-0'
      style={{
        background:
          'radial-gradient(ellipse at center, transparent 50%, rgb(239 68 68 / 0.65) 100%)',
      }}
    />
  );
}
