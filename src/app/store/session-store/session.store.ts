import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Snapshot } from '@/app/modules/multiplayer/utils/snapshot.util';
import type { InputState } from '@/app/modules/world/types/world.types';
import type { Joined, PlayerInfo, SessionInfo } from '@/app/net/protocol';
import { connectSession, type SessionSocket } from '@/app/net/session.client';
import { useGameStore } from '@/app/store/game-store/game.store';
import { getTexts, translateSessionError } from '@/shared/i18n';

// Sala de espera do multiplayer: nome, listagem de sessoes, quem esta na
// sessao e o comeco da partida. Liga o servidor de salas ao game.store.

export type SessionStatus =
  // sem conexao: so o nome para preencher
  | 'idle'
  | 'connecting'
  // conectado, vendo a listagem
  | 'lobby'
  // dentro de uma sessao, esperando o host comecar
  | 'room'
  | 'playing';

type SessionStore = {
  status: SessionStatus;
  // nome do jogador, lembrado entre visitas
  name: string;
  error: string | null;
  sessions: SessionInfo[];
  session: SessionInfo | null;
  you: PlayerInfo | null;
  setName: (name: string) => void;
  connect: () => void;
  create: (isPublic: boolean) => void;
  join: (code: string) => void;
  start: () => void;
  // sai da sessao e volta para a listagem
  leave: () => void;
  // fecha a conexao (saiu do multiplayer)
  disconnect: () => void;
};

// fora do estado reativo, como o World do game.store
let socket: SessionSocket | null = null;

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => {
      const entered = (result: Joined | { ok: false; error: string }) => {
        if (!result.ok) return set({ error: translateSessionError(result.error) });
        set({
          status: 'room',
          session: result.session,
          you: result.you,
          error: null,
        });
      };

      // partida comecou: entrega o jogo ao game.store, ligado a este socket
      const play = (session: SessionInfo) => {
        const me = socket?.id;
        const you = session.players.findIndex((player) => player.id === me);
        if (!socket || you < 0) return;
        const live = socket;
        set({ status: 'playing', session });
        useGameStore.getState().startMulti(
          session.players.map(({ name, color }) => ({ name, color })),
          {
            host: session.players[you].host,
            you,
            sendState: (snapshot: Snapshot) =>
              live.emit('game:state', snapshot),
            sendInput: (input: InputState) => live.emit('game:input', input),
            leave: () => get().leave(),
          },
        );
      };

      const listen = (live: SessionSocket) => {
        live.on('connect', () => {
          set({ status: 'lobby', error: null });
          live.emit('session:list', (sessions) => set({ sessions }));
        });
        live.on('connect_error', () =>
          set({
            status: 'idle',
            error: getTexts().lobby.connectionError,
          }),
        );
        live.on('session:list', (sessions) => set({ sessions }));
        live.on('session:update', (session) => set({ session }));
        live.on('session:started', play);
        live.on('session:closed', () => {
          const playing = get().status === 'playing';
          set({
            status: 'lobby',
            session: null,
            you: null,
            error: getTexts().lobby.closedError,
          });
          live.emit('session:list', (sessions) => set({ sessions }));
          // tira da partida quem estava jogando
          if (playing) useGameStore.getState().backToMenu();
        });
        live.on('game:input', (from, payload) => {
          const index =
            get().session?.players.findIndex((player) => player.id === from) ??
            -1;
          useGameStore.getState().receiveInput(index, payload);
        });
        live.on('game:state', (payload) =>
          useGameStore.getState().receiveState(payload as Snapshot),
        );
      };

      return {
        status: 'idle',
        name: '',
        error: null,
        sessions: [],
        session: null,
        you: null,
        setName: (name) => set({ name }),
        connect: () => {
          if (socket || !get().name.trim()) return;
          set({ status: 'connecting', error: null });
          socket = connectSession();
          listen(socket);
        },
        create: (isPublic) =>
          socket?.emit(
            'session:create',
            { name: get().name, public: isPublic },
            entered,
          ),
        join: (code) =>
          socket?.emit('session:join', { code, name: get().name }, entered),
        start: () =>
          socket?.emit('session:start', (result) => {
            if (!result.ok) set({ error: translateSessionError(result.error) });
          }),
        leave: () => {
          if (!socket || !get().session) return;
          socket.emit('session:leave');
          set({ status: 'lobby', session: null, you: null });
          socket.emit('session:list', (sessions) => set({ sessions }));
        },
        disconnect: () => {
          socket?.close();
          socket = null;
          set({
            status: 'idle',
            sessions: [],
            session: null,
            you: null,
            error: null,
          });
        },
      };
    },
    {
      name: 'shadow-contract-session',
      partialize: (state) => ({ name: state.name }),
    },
  ),
);
