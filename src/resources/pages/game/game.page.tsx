import { setJoystickInput } from '@/app/store/game-store/game.store';
import { VirtualJoystick } from '@/resources/components/base/virtual-joystick/virtual-joystick.component';
import { GameOverDialog } from '@/resources/pages/game/components/game-over-dialog.component';
import { Hud } from '@/resources/pages/game/components/hud.component';
import { ShopDialog } from '@/resources/pages/game/components/shop-dialog.component';
import { useGamePage } from '@/resources/pages/game/use-game.page';

export function GamePage() {
  const { canvasRef, screen, hud, best, buy, closeShop, restart, backToMenu } =
    useGamePage();

  return (
    <div className='relative h-full w-full'>
      <canvas
        ref={canvasRef}
        className='block h-full w-full'
      />
      <Hud hud={hud} />
      <VirtualJoystick onMove={setJoystickInput} />
      <ShopDialog
        open={screen === 'shop'}
        money={hud.money}
        onBuy={buy}
        onClose={closeShop}
      />
      <GameOverDialog
        open={screen === 'gameover'}
        room={hud.room}
        kills={hud.kills}
        best={best}
        onRestart={restart}
        onMenu={backToMenu}
      />
    </div>
  );
}
