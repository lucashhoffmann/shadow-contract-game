import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

const RADIUS = 28;

// joystick fixo: a origem e o centro do disco, inclusive se tocar na borda
export function useVirtualJoystick(
  onMove: (moveX: number, moveY: number) => void,
) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  // dica de uso: o botao desenha um infinito ate o primeiro toque
  const [hint, setHint] = useState(true);
  const origin = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );

  useEffect(() => () => onMove(0, 0), [onMove]);

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

  const release = (pointerId: number) => {
    if (origin.current?.pointerId !== pointerId) return;
    origin.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return {
    knob,
    hint,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (origin.current) return;
        setHint(false);
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        origin.current = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          pointerId: event.pointerId,
        };
        update(event.clientX, event.clientY);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (origin.current?.pointerId === event.pointerId)
          update(event.clientX, event.clientY);
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) =>
        release(event.pointerId),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) =>
        release(event.pointerId),
    },
  };
}
