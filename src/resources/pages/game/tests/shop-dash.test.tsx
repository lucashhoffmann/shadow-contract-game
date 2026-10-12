import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMarket } from '@/app/modules/shop/systems/shop.system';
import { DASH_MAX } from '@/app/modules/world/constants/world.constants';
import { ShopDialog } from '@/resources/pages/game/components/shop-dialog.component';

const PREVIEWS = {
  sword: 'data:sword',
  pistol: 'data:pistol',
  silenced: 'data:silenced',
  shotgun: 'data:shotgun',
  ammo: 'data:ammo',
};

function shop(dashes: number, onBuy = vi.fn()) {
  render(
    <ShopDialog
      open
      money={1000}
      market={createMarket()}
      arsenal={[]}
      dashes={dashes}
      previews={PREVIEWS}
      onBuy={onBuy}
      onClose={vi.fn()}
    />,
  );
  return onBuy;
}

it('loja vende os saltos que faltam', async () => {
  const onBuy = shop(2);
  const card = screen.getByRole('button', { name: /Saltos/ });
  expect(card).toHaveTextContent(`+${DASH_MAX - 2} saltos`);
  await userEvent.click(card);
  expect(onBuy).toHaveBeenCalledWith('dash');
});

it('com os saltos cheios o cartao fica apagado', () => {
  shop(DASH_MAX);
  const card = screen.getByRole('button', { name: /Saltos/ });
  expect(card).toBeDisabled();
  expect(card).toHaveTextContent('Saltos cheios');
});
