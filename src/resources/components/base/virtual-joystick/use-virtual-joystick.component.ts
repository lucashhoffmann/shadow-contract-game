import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';

const RADIUS = 48;

// joystick flutuante: a origem e onde o dedo encostou
export function useVirtualJoystick(
  onMove: (moveX: number, moveY: number) => void,
) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number } | null>(null);

  const update = (clientX: number, clientY: number) => {
    if (!origin.current) return;
    let dx = clientX - origin.current.x;
    let dy = clientY - origin.current.y;
    const length = Math.hypot(dx, dy);
    if (length > RADIUS) {
      dx *= RADIUS / length;
      dy *= RADIUS / length;
    }
    setKnob({ x: dx, y: dy });
    // tela cresce para baixo, simulacao cresce para frente
    onMove(dx / RADIUS, (0 - dy) / RADIUS);
  };

  const release = () => {
    origin.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return {
    knob,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        origin.current = { x: event.clientX, y: event.clientY };
        update(event.clientX, event.clientY);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) =>
        update(event.clientX, event.clientY),
      onPointerUp: release,
      onPointerCancel: release,
    },
  };
}
