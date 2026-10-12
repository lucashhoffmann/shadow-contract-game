import { ChevronsDown, ChevronsUp, Sword } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { useTexts } from '@/shared/i18n';
import { useVirtualJoystick } from '@/resources/components/base/virtual-joystick/use-virtual-joystick.component';

type VirtualJoystickProps = {
  onMove: (moveX: number, moveY: number) => void;
  // botao de salto apertado ou solto
  onDash: (pressed: boolean) => void;
  // botao de agachar ligado ou desligado; sem ele, o botao nao aparece
  onCrouch?: (on: boolean) => void;
  // botao de ataque (vale como a tecla F); sem ele, o botao nao aparece
  onAttack?: () => void;
};

// Controle para telas de toque. A faixa de baixo da tela inteira e a area de
// toque: o disco nasce onde o dedo encosta e some de la ao soltar, voltando
// para o repouso, no canto esquerdo embaixo (os botoes ficam no direito). Meio transparente, para nao tampar o
// jogo. Ate o primeiro toque o botao passeia em forma de infinito, mostrando
// que e para arrastar.
export function VirtualJoystick({
  onMove,
  onDash,
  onCrouch,
  onAttack,
}: VirtualJoystickProps) {
  const t = useTexts();
  // agachar e liga/desliga: um toque agacha, outro levanta
  const [crouched, setCrouched] = useState(false);
  // saiu da tela agachado: nao deixa preso
  useEffect(() => () => onCrouch?.(false), [onCrouch]);

  // saiu da tela com o botao apertado: nao deixa o salto preso
  useEffect(() => () => onDash(false), [onDash]);

  const { knob, hint, at, handlers } = useVirtualJoystick(onMove);

  return (
    <div
      aria-label={t.common.joystick}
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
                // repouso no canto esquerdo: no meio ficava em cima do
                // agachar em tela estreita
                left: 'max(1.25rem, env(safe-area-inset-left))',
                bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
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
          aria-label={t.common.crouch}
          aria-pressed={crouched}
          className={cn(
            'pointer-events-auto absolute right-5 flex size-16 items-center justify-center rounded-full border-4 active:scale-90',
            crouched
              ? 'border-white bg-[var(--game-highlight)]/80 text-[var(--game-ink)]'
              : 'border-white/35 bg-white/10 text-white/80',
          )}
          style={{
            // com o botao de ataque no canto, o agachar fica a esquerda dele
            right: onAttack ? '7rem' : undefined,
            bottom: onAttack
              ? 'calc(max(1.25rem, env(safe-area-inset-bottom)) + 0.5rem)'
              : 'max(1.25rem, env(safe-area-inset-bottom))',
          }}
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
      {/* ataque: o botao principal, maior que os outros, no canto do polegar.
          Golpeia com a espada, quebra a caixa ao alcance e, com arma de
          fogo, da a facada: o mesmo que a tecla F */}
      {onAttack && (
        <button
          type='button'
          aria-label={t.common.attack}
          className='pointer-events-auto absolute right-5 flex size-20 items-center justify-center rounded-full border-4 border-white/60 bg-[var(--game-brandPink)]/45 text-white active:scale-90 active:bg-[var(--game-brandPink)]/75'
          style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          onPointerDown={(event) => {
            // o toque para aqui: nao comeca o joystick por baixo
            event.stopPropagation();
            onAttack();
          }}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <Sword
            aria-hidden
            className='size-10'
            strokeWidth={2.5}
          />
        </button>
      )}
      {/* salto: no canto direito da area de toque, acima do agachar.
          O toque para aqui: nao comeca o joystick por baixo */}
      <button
        type='button'
        aria-label={t.common.dash}
        className='pointer-events-auto absolute right-5 flex size-16 items-center justify-center rounded-full border-4 border-white/35 bg-white/10 text-white/80 active:scale-90 active:bg-white/25'
        style={{
          // com o ataque no canto, o salto fica em cima dele, centrado; sem
          // ele, sobe uma posicao so quando ha o agachar embaixo
          right: onAttack ? '1.75rem' : undefined,
          bottom: onAttack
            ? 'calc(max(1.25rem, env(safe-area-inset-bottom)) + 5.75rem)'
            : onCrouch
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
