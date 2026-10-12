import {
  getWorld,
  pressJoystickAttack,
  setJoystickCrouch,
  setJoystickDash,
  setJoystickInput,
} from '@/app/store/game-store/game.store';
import { VirtualJoystick } from '@/resources/components/base/virtual-joystick/virtual-joystick.component';
import { DamageVignette } from '@/resources/pages/game/components/damage-vignette.component';
import { GameOverDialog } from '@/resources/pages/game/components/game-over-dialog.component';
import { Hud } from '@/resources/pages/game/components/hud.component';
import { MatchMenu } from '@/resources/pages/game/components/match-menu.component';
import { ReviveDialog } from '@/resources/pages/game/components/revive-dialog.component';
import { Scoreboard } from '@/resources/pages/game/components/scoreboard.component';
import { KillStreak } from '@/resources/pages/game/components/kill-streak.component';
import { LegendDialog } from '@/resources/pages/game/components/legend-dialog.component';
import { ShopDialog } from '@/resources/pages/game/components/shop-dialog.component';
import { useGamePage } from '@/resources/pages/game/use-game.page';

// abaixo disso (pontos de vida) a tela pulsa em vermelho
const LOW_HP = 20;

export function GamePage() {
  const {
    canvasRef,
    screen,
    hud,
    arsenal,
    selectWeapon,
    hits,
    idleWarnings,
    market,
    best,
    legend,
    previews,
    buy,
    closeShop,
    restart,
    pause,
    online,
    host,
    menu,
    endMatch,
    leaveMatch,
    reviving,
    revive,
    reviveAllowance,
    waitingNote,
    scores,
    streak,
    scoreboard,
    toggleScoreboard,
    backToMenu,
  } = useGamePage();

  return (
    <div className='relative h-full w-full'>
      <canvas
        ref={canvasRef}
        className='block h-full w-full'
      />
      <DamageVignette hits={hits} />
      {/* vida baixa: a mesma borda vermelha, pulsando ate recuperar ou morrer */}
      <DamageVignette
        hits={hud.hp > 0 && hud.hp < LOW_HP ? 1 : 0}
        loop
      />
      <DamageVignette
        hits={idleWarnings}
        color='blue'
      />
      <Hud
        hud={hud}
        arsenal={arsenal}
        previews={previews}
        onSelectWeapon={selectWeapon}
        onPause={screen === 'playing' ? pause : undefined}
        onScoreboard={
          online && screen === 'playing' ? toggleScoreboard : undefined
        }
      />
      <KillStreak
        count={screen === 'playing' ? streak.count : 0}
        at={streak.at}
      />
      <Scoreboard
        open={scoreboard && screen === 'playing'}
        scores={scores}
      />
      <ReviveDialog
        open={reviving && screen === 'playing'}
        scores={scores}
        allowance={reviveAllowance}
        onRevive={revive}
        onClose={closeShop}
      />
      <MatchMenu
        open={menu}
        host={host}
        onResume={pause}
        onEnd={endMatch}
        onLeave={leaveMatch}
      />
      {screen === 'playing' && (
        <VirtualJoystick
          onMove={setJoystickInput}
          onDash={setJoystickDash}
          onCrouch={setJoystickCrouch}
          onAttack={pressJoystickAttack}
        />
      )}
      <LegendDialog
        open={screen === 'intro' || screen === 'paused'}
        {...legend}
      />
      <ShopDialog
        open={screen === 'shop'}
        money={hud.money}
        market={market}
        arsenal={arsenal}
        dashes={hud.dashes}
        previews={previews}
        onBuy={buy}
        onClose={closeShop}
      />
      <GameOverDialog
        open={screen === 'gameover'}
        room={hud.room}
        kills={hud.kills}
        best={best}
        run={getWorld()?.run ?? null}
        onRestart={restart}
        note={waitingNote}
        onMenu={online ? leaveMatch : backToMenu}
      />
    </div>
  );
}
