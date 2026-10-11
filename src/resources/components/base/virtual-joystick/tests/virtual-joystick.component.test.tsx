import { fireEvent, render, screen } from '@testing-library/react';

import { VirtualJoystick } from '@/resources/components/base/virtual-joystick/virtual-joystick.component';

function setup() {
  const onMove = vi.fn();
  render(<VirtualJoystick onMove={onMove} />);
  const zone = screen.getByLabelText('Joystick');
  fireEvent.pointerDown(zone, { pointerId: 1, clientX: 100, clientY: 100 });
  return { onMove, zone };
}

describe('VirtualJoystick', () => {
  it('arrastar para cima anda para frente, proporcional ao raio', () => {
    const { onMove, zone } = setup();
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 100, clientY: 76 });
    expect(onMove).toHaveBeenLastCalledWith(0, 0.5);
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
