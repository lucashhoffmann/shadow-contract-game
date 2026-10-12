import { fireEvent, render, screen } from '@testing-library/react';

import { VirtualJoystick } from '@/resources/components/base/virtual-joystick/virtual-joystick.component';

function setup() {
  const onMove = vi.fn();
  render(
    <VirtualJoystick
      onMove={onMove}
      onDash={vi.fn()}
    />,
  );
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
    render(
      <VirtualJoystick
        onMove={vi.fn()}
        onDash={vi.fn()}
      />,
    );
    const zone = screen.getByLabelText('Joystick');
    const knob = zone.querySelector('[data-hint]')!;
    expect(knob).toHaveClass('joystick-hint');
    // na dica quem move e a animacao, nao o estilo
    expect(knob).not.toHaveAttribute('style');

    fireEvent.pointerDown(zone, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(knob).not.toHaveClass('joystick-hint');
    fireEvent.pointerUp(zone, { pointerId: 1 });
    expect(knob).not.toHaveClass('joystick-hint');
    expect(knob).toHaveAttribute('style');
  });

  it('em repouso o disco fica no canto esquerdo, embaixo', () => {
    render(
      <VirtualJoystick
        onMove={vi.fn()}
        onDash={vi.fn()}
      />,
    );
    const disc = screen.getByLabelText('Joystick').firstElementChild!;
    expect(disc).toHaveAttribute('data-active', 'false');
    // longe dos botoes, que ficam no canto direito
    expect((disc as HTMLElement).style.left).not.toBe('50%');
    expect((disc as HTMLElement).style.transform).toBe('');
  });

  it('a area de toque e a faixa de baixo da tela inteira', () => {
    render(
      <VirtualJoystick
        onMove={vi.fn()}
        onDash={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Joystick')).toHaveClass(
      'inset-x-0',
      'bottom-0',
      'h-[45%]',
    );
  });

  it('o disco nasce onde o dedo toca e volta ao repouso ao soltar', () => {
    const { onMove, zone } = setup();
    const disc = zone.firstElementChild!;
    // toque em (100, 100) com a area comecando em (52, 52)
    expect(disc).toHaveAttribute('data-active', 'true');
    expect(disc).toHaveStyle({ left: '48px', top: '48px' });
    // tocar nao anda: o ponto tocado vira o centro
    expect(onMove).toHaveBeenLastCalledWith(0, 0);

    fireEvent.pointerUp(zone, { pointerId: 1 });
    expect(disc).toHaveAttribute('data-active', 'false');
  });

  it('arrastar para cima anda para frente, proporcional ao raio', () => {
    const { onMove, zone } = setup();
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 100, clientY: 86 });
    expect(onMove).toHaveBeenLastCalledWith(0, 0.5);
  });

  it('cada novo toque vira o centro, em qualquer ponto da area', () => {
    const { onMove, zone } = setup();
    fireEvent.pointerUp(zone, { pointerId: 1 });
    fireEvent.pointerDown(zone, { pointerId: 2, clientX: 300, clientY: 70 });
    expect(onMove).toHaveBeenLastCalledWith(0, 0);
    fireEvent.pointerMove(zone, { pointerId: 2, clientX: 314, clientY: 70 });
    expect(onMove).toHaveBeenLastCalledWith(0.5, 0);
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

  it('botao de salto avisa ao apertar e ao soltar, sem mexer no joystick', () => {
    const onMove = vi.fn();
    const onDash = vi.fn();
    render(
      <VirtualJoystick
        onMove={onMove}
        onDash={onDash}
      />,
    );
    const button = screen.getByRole('button', { name: 'Saltar' });
    const disc = screen.getByLabelText('Joystick').firstElementChild!;

    fireEvent.pointerDown(button, { pointerId: 5, clientX: 10, clientY: 10 });
    expect(onDash).toHaveBeenLastCalledWith(true);
    // o toque ficou no botao: o disco nao saiu do repouso
    expect(disc).toHaveAttribute('data-active', 'false');
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.pointerUp(button, { pointerId: 5 });
    expect(onDash).toHaveBeenLastCalledWith(false);
  });

  it('solta o salto se o controle sai da tela', () => {
    const onDash = vi.fn();
    const { unmount } = render(
      <VirtualJoystick
        onMove={vi.fn()}
        onDash={onDash}
      />,
    );
    unmount();
    expect(onDash).toHaveBeenLastCalledWith(false);
  });

  it('ignora movimento sem toque ativo', () => {
    const onMove = vi.fn();
    render(
      <VirtualJoystick
        onMove={onMove}
        onDash={vi.fn()}
      />,
    );
    fireEvent.pointerMove(screen.getByLabelText('Joystick'), {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });
    expect(onMove).not.toHaveBeenCalled();
  });
});

it('botao de agachar liga num toque, desliga no outro e solta ao sair', () => {
  const onMove = vi.fn();
  const onCrouch = vi.fn();
  const { unmount } = render(
    <VirtualJoystick
      onMove={onMove}
      onDash={vi.fn()}
      onCrouch={onCrouch}
    />,
  );
  const button = screen.getByRole('button', { name: 'Agachar' });
  expect(button).toHaveAttribute('aria-pressed', 'false');

  fireEvent.pointerDown(button, { pointerId: 7 });
  fireEvent.pointerUp(button, { pointerId: 7 });
  // soltar o dedo nao levanta: fica agachado
  expect(onCrouch).toHaveBeenLastCalledWith(true);
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(onMove).not.toHaveBeenCalled();

  fireEvent.pointerDown(button, { pointerId: 8 });
  expect(onCrouch).toHaveBeenLastCalledWith(false);
  expect(button).toHaveAttribute('aria-pressed', 'false');

  fireEvent.pointerDown(button, { pointerId: 9 });
  unmount();
  expect(onCrouch).toHaveBeenLastCalledWith(false);
});

it('botao de ataque e maior que os de salto e agachar, e nao mexe no joystick', () => {
  const onMove = vi.fn();
  const onAttack = vi.fn();
  render(
    <VirtualJoystick
      onMove={onMove}
      onDash={vi.fn()}
      onCrouch={vi.fn()}
      onAttack={onAttack}
    />,
  );
  const attack = screen.getByRole('button', { name: 'Atacar' });
  // tamanho pelas classes: 20 (5rem) contra 16 (4rem)
  expect(attack).toHaveClass('size-20');
  expect(screen.getByRole('button', { name: 'Saltar' })).toHaveClass('size-16');
  expect(screen.getByRole('button', { name: 'Agachar' })).toHaveClass(
    'size-16',
  );

  fireEvent.pointerDown(attack, { pointerId: 3 });
  fireEvent.pointerUp(attack, { pointerId: 3 });
  // um toque, um golpe
  expect(onAttack).toHaveBeenCalledTimes(1);
  expect(onMove).not.toHaveBeenCalled();
});

it('sem acao de ataque o botao nao aparece', () => {
  render(
    <VirtualJoystick
      onMove={vi.fn()}
      onDash={vi.fn()}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Atacar' })).toBeNull();
});
