import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

const RADIUS = 28;

// joystick flutuante: nasce onde o dedo toca, em qualquer ponto da area de
// toque; esse ponto e a origem ate soltar
export function useVirtualJoystick(
  onMove: (moveX: number, moveY: number) => void,
) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  // dica de uso: o botao desenha um infinito ate o primeiro toque
  const [hint, setHint] = useState(true);
  // onde o disco esta, relativo a area de toque; null = solto, em repouso
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
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
    setAt(null);
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return {
    knob,
    hint,
    at,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (origin.current) return;
        setHint(false);
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        origin.current = {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId,
        };
        setAt({ x: event.clientX - rect.left, y: event.clientY - rect.top });
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
