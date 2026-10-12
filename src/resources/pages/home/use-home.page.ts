import { useEffect, useState } from 'react';

import { pingServer } from '@/app/net/session.client';

// de quanto em quanto tempo confere de novo, enquanto a home esta aberta
const PING_EVERY = 15000;

// O multiplayer so aparece com o servidor de salas no ar: confere ao abrir a
// home e de tempos em tempos, para o botao surgir (ou sumir) sozinho.
export function useHomePage() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () =>
      pingServer().then((alive) => {
        if (active) setOnline(alive);
      });
    void check();
    const timer = setInterval(check, PING_EVERY);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return { online };
}
