import { io, type Socket } from 'socket.io-client';

import type { ClientEvents, ServerEvents } from '@/app/net/protocol';

// Conexao com o servidor de salas (shadow-contract-server). So transporte:
// quem decide o que fazer com cada mensagem e o session.store.

export type SessionSocket = Socket<ServerEvents, ClientEvents>;

// VITE_SERVER_URL em producao; sem ela, a mesma maquina do jogo na porta 3001
// (serve para rede local: o celular acha o servidor pelo IP do computador)
export function serverUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
  return configured || `${location.protocol}//${location.hostname}:3001`;
}

export function connectSession(url = serverUrl()): SessionSocket {
  return io(url, { transports: ['websocket'] });
}

// Health check: o servidor de salas esta no ar? Sem resposta em PING_TIMEOUT
// ms, conta como fora.
const PING_TIMEOUT = 3000;
export async function pingServer(url = serverUrl()): Promise<boolean> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(PING_TIMEOUT),
    });
    return response.ok;
  } catch {
    return false;
  }
}
