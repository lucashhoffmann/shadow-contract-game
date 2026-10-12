import { useEffect, useRef, useState } from 'react';

import { createGameEngine } from '@/app/engine/game-engine';
import { renderWeaponPreviews } from '@/app/engine/weapon-preview';
import { useGameStore } from '@/app/store/game-store/game.store';
import { useTexts } from '@/shared/i18n';

export function useGamePage() {
  const t = useTexts();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screen = useGameStore((state) => state.screen);
  const hud = useGameStore((state) => state.hud);
  const idleWarnings = useGameStore((state) => state.idleWarnings);
  const market = useGameStore((state) => state.market);
  const best = useGameStore((state) => state.best);
  const buy = useGameStore((state) => state.buy);
  const arsenal = useGameStore((state) => state.arsenal);
  const selectWeapon = useGameStore((state) => state.selectWeapon);
  const closeShop = useGameStore((state) => state.closeShop);
  const startRun = useGameStore((state) => state.startRun);
  const begin = useGameStore((state) => state.begin);
  const togglePause = useGameStore((state) => state.togglePause);
  const backToMenu = useGameStore((state) => state.backToMenu);
  const openLobby = useGameStore((state) => state.openLobby);
  // partida em rede: nao pausa (P abre o menu), e jogar de novo volta para
  // as sessoes
  const online = useGameStore((state) => state.online);
  const host = useGameStore((state) => state.host);
  const menu = useGameStore((state) => state.menu);
  const endMatch = useGameStore((state) => state.endMatch);
  const scores = useGameStore((state) => state.scores);
  const streak = useGameStore((state) => state.streak);
  const scoreboard = useGameStore((state) => state.scoreboard);
  const setScoreboard = useGameStore((state) => state.setScoreboard);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createGameEngine(canvasRef.current);
    return () => engine.dispose();
  }, []);

  // a mesma legenda serve de abertura da run e de tela de pausa
  // fotos das armas para o HUD, tiradas uma vez por montagem
  const [previews] = useState(renderWeaponPreviews);

  // conta golpes levados: vida ou escudo cairam desde o ultimo render
  const health = hud.hp + hud.shield;
  const [damage, setDamage] = useState({ hp: health, hits: 0 });
  if (health !== damage.hp) {
    setDamage({
      hp: health,
      hits: damage.hits + (health < damage.hp ? 1 : 0),
    });
  }

  const restartMatch = useGameStore((state) => state.restartMatch);
  const reviving = useGameStore((state) => state.reviving);
  const revive = useGameStore((state) => state.revive);
  // sair da partida em rede: volta para as sessoes
  const leaveMatch = () => {
    backToMenu();
    openLobby();
  };
  // em rede so o host recomeca, e para todos, sem derrubar a sessao
  const restart = online ? (host ? restartMatch : undefined) : () => startRun();
  const legend =
    screen === 'paused'
      ? {
          title: t.game.paused,
          actionLabel: t.common.continue,
          onAction: togglePause,
          onMenu: backToMenu,
          onRestart: restart,
        }
      : {
          title: t.game.howToPlay,
          actionLabel: t.common.start,
          onAction: begin,
          onMenu: backToMenu,
        };

  return {
    canvasRef,
    screen,
    hud,
    arsenal,
    selectWeapon,
    hits: damage.hits,
    idleWarnings,
    market,
    best,
    legend,
    previews,
    buy,
    closeShop,
    restart,
    pause: togglePause,
    online,
    host,
    menu,
    endMatch,
    leaveMatch,
    reviving,
    revive,
    // quantos o bau de revive ainda levanta: fichas, ou o gratis
    reviveAllowance: Math.max(1, hud.revives),
    waitingNote: online && !host ? t.match.waitingHost : undefined,
    scores,
    streak,
    scoreboard,
    // icone do placar: liga e desliga (no teclado e o Tab segurado)
    toggleScoreboard: () => setScoreboard(!scoreboard),
    backToMenu,
  };
}
