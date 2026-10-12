import { useState } from 'react';

import { useGameStore } from '@/app/store/game-store/game.store';
import { useSessionStore } from '@/app/store/session-store/session.store';

export function useLobbyPage() {
  const status = useSessionStore((state) => state.status);
  const name = useSessionStore((state) => state.name);
  const error = useSessionStore((state) => state.error);
  const sessions = useSessionStore((state) => state.sessions);
  const session = useSessionStore((state) => state.session);
  const you = useSessionStore((state) => state.you);
  const setName = useSessionStore((state) => state.setName);
  const connect = useSessionStore((state) => state.connect);
  const create = useSessionStore((state) => state.create);
  const join = useSessionStore((state) => state.join);
  const start = useSessionStore((state) => state.start);
  const leave = useSessionStore((state) => state.leave);
  const disconnect = useSessionStore((state) => state.disconnect);
  const backToMenu = useGameStore((state) => state.backToMenu);
  // codigo de convite digitado
  const [code, setCode] = useState('');

  return {
    status,
    name,
    error,
    sessions,
    session,
    you,
    code,
    setName,
    setCode: (value: string) => setCode(value.toUpperCase().slice(0, 5)),
    connect,
    create,
    join,
    start,
    leave,
    // sair do multiplayer: fecha a conexao e volta ao menu
    exit: () => {
      disconnect();
      backToMenu();
    },
  };
}
