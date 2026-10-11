import { useVirtualJoystick } from '@/resources/components/base/virtual-joystick/use-virtual-joystick.component';

type VirtualJoystickProps = {
  onMove: (moveX: number, moveY: number) => void;
};

// so aparece em tela de toque; a zona de toque e a metade de baixo da tela
export function VirtualJoystick({ onMove }: VirtualJoystickProps) {
  const { knob, handlers } = useVirtualJoystick(onMove);

  return (
    <div
      aria-label='Joystick'
      className='absolute inset-x-0 bottom-0 hidden h-1/2 touch-none pointer-coarse:block'
      {...handlers}
    >
      <div className='absolute bottom-10 left-1/2 size-28 -translate-x-1/2 rounded-full border-2 border-white/30 bg-white/10'>
        <div
          className='absolute top-1/2 left-1/2 size-12 rounded-full bg-white/60'
          style={{
            transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          }}
        />
      </div>
    </div>
  );
}
