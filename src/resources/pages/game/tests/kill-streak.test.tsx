import { render, screen } from '@testing-library/react';

import { killEnemy } from '@/app/modules/combat/systems/combat.system';
import { FIXED_DT } from '@/app/modules/world/constants/world.constants';
import { getWorld, useGameStore } from '@/app/store/game-store/game.store';
import { KillStreak } from '@/resources/pages/game/components/kill-streak.component';
import { addEnemy } from '@/test/world.fixture';

const IDLE = { moveX: 0, moveY: 0, dash: false };

it('uma morte so nao mostra nada; de duas a cinco, o nome da sequencia', () => {
  const { rerender } = render(
    <KillStreak
      count={1}
      at={1}
    />,
  );
  expect(screen.queryByRole('status')).toBeNull();
  for (const [count, name] of [
    [2, 'Double'],
    [3, 'Triple'],
    [4, 'Quadra'],
    [5, 'Penta'],
  ] as const) {
    rerender(
      <KillStreak
        count={count}
        at={count}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(`${name}Kill`);
  }
});

it('cada morte nova reinicia a animacao, mesmo repetindo o penta', () => {
  const { rerender } = render(
    <KillStreak
      count={5}
      at={10}
    />,
  );
  const first = screen.getByRole('status');
  rerender(
    <KillStreak
      count={5}
      at={11}
    />,
  );
  expect(screen.getByRole('status')).not.toBe(first);
});

it('store publica a sequencia do jogador local a cada morte', () => {
  const store = () => useGameStore.getState();
  store().backToMenu();
  store().startRun(1);
  store().begin();
  expect(store().streak.count).toBe(0);

  const world = getWorld()!;
  for (let i = 0; i < 2; i++) {
    killEnemy(world, addEnemy(world, 1.5, 1.5, 0));
    store().tick(IDLE, FIXED_DT);
  }
  expect(store().streak).toEqual({
    count: 2,
    at: world.player.lastKillAt,
  });
  // run nova zera
  store().startRun(1);
  expect(store().streak.count).toBe(0);
});
