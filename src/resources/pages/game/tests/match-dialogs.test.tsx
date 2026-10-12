import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GameOverDialog } from '@/resources/pages/game/components/game-over-dialog.component';
import { ReviveDialog } from '@/resources/pages/game/components/revive-dialog.component';

const score = (id: number, name: string, alive: boolean) => ({
  id,
  name,
  color: '#39d0ff',
  kills: 0,
  deaths: alive ? 0 : 1,
  alive,
  you: id === 0,
  ping: 0,
});

it('convidado ve o aviso de espera no lugar de Jogar de novo', () => {
  render(
    <GameOverDialog
      open
      room={2}
      kills={1}
      best={2}
      run={null}
      note='Esperando o host comecar outra partida.'
      onMenu={vi.fn()}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Jogar de novo' })).toBeNull();
  expect(
    screen.getByText('Esperando o host comecar outra partida.'),
  ).toBeInTheDocument();
});

it('escolha do bau de revive lista so os mortos', async () => {
  const onRevive = vi.fn();
  render(
    <ReviveDialog
      open
      allowance={1}
      scores={[
        score(0, 'Lucas', true),
        score(1, 'Ana', false),
        score(2, 'Bia', false),
      ]}
      onRevive={onRevive}
      onClose={vi.fn()}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Lucas' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Bia' }));
  expect(onRevive).toHaveBeenCalledWith(2);
});
