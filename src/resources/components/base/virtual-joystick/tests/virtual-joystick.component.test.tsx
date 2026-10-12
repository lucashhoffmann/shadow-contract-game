import { fireEvent, render, screen } from '@testing-library/react';

import { VirtualJoystick } from '@/resources/components/base/virtual-joystick/virtual-joystick.component';

function setup() {
  const onMove = vi.fn();
  render(<VirtualJoystick onMove={onMove} />);
  const zone = screen.getByLabelText('Joystick');
  vi.spyOn(zone, 'getBoundingClientRect').mockReturnValue({
    left: 52,
    top: 52,
    width: 96,
    height: 96,
  } as DOMRect);
  fireEvent.pointerDown(zone, { pointerId: 1, clientX: 100, clientY: 100 });
  return { onMove, zone };
}

describe('VirtualJoystick', () => {
  it('mostra a dica em infinito ate o primeiro toque, e nao volta depois', () => {
    render(<VirtualJoystick onMove={vi.fn()} />);
    const zone = screen.getByLabelText('Joystick');
    const knob = zone.firstElementChild!;
    expect(knob).toHaveClass('joystick-hint');
    // na dica quem move e a animacao, nao o estilo
    expect(knob).not.toHaveAttribute('style');

    fireEvent.pointerDown(zone, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(knob).not.toHaveClass('joystick-hint');
    fireEvent.pointerUp(zone, { pointerId: 1 });
    expect(knob).not.toHaveClass('joystick-hint');
    expect(knob).toHaveAttribute('style');
  });

  it('fica centralizado na parte inferior da tela', () => {
    const { zone } = setup();
    expect(zone).toHaveClass('size-24');
    expect(zone).toHaveStyle({ left: '50%', transform: 'translateX(-50%)' });
  });

  it('arrastar para cima anda para frente, proporcional ao raio', () => {
    const { onMove, zone } = setup();
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 100, clientY: 86 });
    expect(onMove).toHaveBeenLastCalledWith(0, 0.5);
  });

  it('tocar na borda ja aponta na direcao tocada', () => {
    const { onMove, zone } = setup();
    fireEvent.pointerUp(zone, { pointerId: 1 });
    fireEvent.pointerDown(zone, { pointerId: 2, clientX: 128, clientY: 100 });
    expect(onMove).toHaveBeenLastCalledWith(1, 0);
  });

  it('limita o vetor ao raio', () => {
    const { onMove, zone } = setup();
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 400, clientY: -200 });
    const [moveX, moveY] = onMove.mock.lastCall!;
    expect(Math.hypot(moveX, moveY)).toBeCloseTo(1);
    expect(moveX).toBeCloseTo(Math.SQRT1_2);
    expect(moveY).toBeCloseTo(Math.SQRT1_2);
  });

  it('soltar zera o input', () => {
    const { onMove, zone } = setup();
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 130, clientY: 100 });
    fireEvent.pointerUp(zone, { pointerId: 1 });
    expect(onMove).toHaveBeenLastCalledWith(0, 0);
  });

  it('ignora outro dedo ate o primeiro soltar', () => {
    const { onMove, zone } = setup();
    fireEvent.pointerMove(zone, { pointerId: 2, clientX: 140, clientY: 100 });
    fireEvent.pointerUp(zone, { pointerId: 2 });
    expect(onMove).toHaveBeenLastCalledWith(0, 0);

    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 114, clientY: 100 });
    expect(onMove).toHaveBeenLastCalledWith(0.5, 0);
  });

  it('ignora movimento sem toque ativo', () => {
    const onMove = vi.fn();
    render(<VirtualJoystick onMove={onMove} />);
    fireEvent.pointerMove(screen.getByLabelText('Joystick'), {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });
    expect(onMove).not.toHaveBeenCalled();
  });
});
