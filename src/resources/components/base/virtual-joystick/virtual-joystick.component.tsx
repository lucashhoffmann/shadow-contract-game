import { cn } from '@/shared/lib/utils';
import { useVirtualJoystick } from '@/resources/components/base/virtual-joystick/use-virtual-joystick.component';

type VirtualJoystickProps = {
  onMove: (moveX: number, moveY: number) => void;
};

// Controle fixo para telas de toque; a zona de toque e o proprio disco.
// Meio transparente, para nao tampar o jogo. Ate o primeiro toque o botao
// passeia em forma de infinito, mostrando que e para arrastar.
export function VirtualJoystick({ onMove }: VirtualJoystickProps) {
  const { knob, hint, handlers } = useVirtualJoystick(onMove);

  return (
    <div
      aria-label='Joystick'
      className='virtual-joystick pointer-events-auto absolute z-10 hidden size-24 touch-none rounded-full border-4 border-white/35 bg-white/5 select-none'
      style={{
        bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
      {...handlers}
    >
      <div
        data-hint={hint}
        className={cn(
          'pointer-events-none absolute top-1/2 left-1/2 size-10 rounded-full bg-white/80',
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
  );
}
