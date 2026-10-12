import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { useVirtualJoystick } from '@/resources/components/base/virtual-joystick/use-virtual-joystick.component';

type VirtualJoystickProps = {
  onMove: (moveX: number, moveY: number) => void;
  // botao de salto apertado ou solto
  onDash: (pressed: boolean) => void;
  // botao de agachar ligado ou desligado; sem ele, o botao nao aparece
  onCrouch?: (on: boolean) => void;
};

// Controle para telas de toque. A faixa de baixo da tela inteira e a area de
// toque: o disco nasce onde o dedo encosta e some de la ao soltar, voltando
// para o repouso, no meio embaixo. Meio transparente, para nao tampar o
// jogo. Ate o primeiro toque o botao passeia em forma de infinito, mostrando
// que e para arrastar.
export function VirtualJoystick({
  onMove,
  onDash,
  onCrouch,
}: VirtualJoystickProps) {
  // agachar e liga/desliga: um toque agacha, outro levanta
  const [crouched, setCrouched] = useState(false);
  // saiu da tela agachado: nao deixa preso
  useEffect(() => () => onCrouch?.(false), [onCrouch]);

  // saiu da tela com o botao apertado: nao deixa o salto preso
  useEffect(() => () => onDash(false), [onDash]);

  const { knob, hint, at, handlers } = useVirtualJoystick(onMove);

  return (
    <div
      aria-label='Joystick'
      className='virtual-joystick pointer-events-auto absolute inset-x-0 bottom-0 z-10 hidden h-[45%] touch-none select-none'
      {...handlers}
    >
      <div
        data-active={at !== null}
        className='pointer-events-none absolute size-24 rounded-full border-4 border-white/35 bg-white/5'
        style={
          at
            ? { left: at.x, top: at.y, transform: 'translate(-50%, -50%)' }
            : {
                left: '50%',
                bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
                transform: 'translateX(-50%)',
              }
        }
      >
        <div
          data-hint={hint}
          className={cn(
            'absolute top-1/2 left-1/2 size-10 rounded-full bg-white/80',
            hint && 'joystick-hint',
          )}
          // na dica quem move e a animacao (index.css)
          style={
            hint
              ? undefined
              : {
                  transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
                }
          }
        />
      </div>
      {/* agachar: primeiro botao, embaixo, mesmo formato do salto. Fica aceso
          enquanto ligado */}
      {onCrouch && (
        <button
          type='button'
          aria-label='Agachar'
          aria-pressed={crouched}
          className={cn(
            'pointer-events-auto absolute right-5 flex size-16 items-center justify-center rounded-full border-4 active:scale-90',
            crouched
              ? 'border-white bg-[#ffd21f]/80 text-[#14141f]'
              : 'border-white/35 bg-white/10 text-white/80',
          )}
          style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          onPointerDown={(event) => {
            // o toque para aqui: nao comeca o joystick por baixo
            event.stopPropagation();
            setCrouched(!crouched);
            onCrouch(!crouched);
          }}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <ChevronsDown
            aria-hidden
            className='size-8'
            strokeWidth={3}
          />
        </button>
      )}
      {/* salto: no canto direito da area de toque, acima do agachar.
          O toque para aqui: nao comeca o joystick por baixo */}
      <button
        type='button'
        aria-label='Saltar'
        className='pointer-events-auto absolute right-5 flex size-16 items-center justify-center rounded-full border-4 border-white/35 bg-white/10 text-white/80 active:scale-90 active:bg-white/25'
        style={{
          // com o agachar embaixo, o salto sobe uma posicao
          bottom: onCrouch
            ? 'calc(max(1.25rem, env(safe-area-inset-bottom)) + 5rem)'
            : 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onDash(true);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          onDash(false);
        }}
        onPointerCancel={() => onDash(false)}
        onPointerLeave={() => onDash(false)}
      >
        <ChevronsUp
          aria-hidden
          className='size-8'
          strokeWidth={3}
        />
      </button>
    </div>
  );
}
