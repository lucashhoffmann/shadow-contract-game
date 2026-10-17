import {
  connectSession as connect,
  pingServer as ping,
  serverUrl as resolveUrl,
  type SessionSocket,
} from 'three-hex-engine/net';

// Conexao com o servidor de salas (shadow-contract-server). Transporte e protocolo vem
// da engine (engine/src/adapters/net); aqui so o endereco deste jogo. Quem
// decide o que fazer com cada mensagem e o session.store.

export type { SessionSocket };

// VITE_SERVER_URL em producao; sem ela, a mesma maquina do jogo na porta 3001
export function serverUrl(): string {
  return resolveUrl(import.meta.env.VITE_SERVER_URL as string | undefined);
}

export function connectSession(url = serverUrl()): SessionSocket {
  return connect(url);
}

export function pingServer(url = serverUrl()): Promise<boolean> {
  return ping(url);
}
