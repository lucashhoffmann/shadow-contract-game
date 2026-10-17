import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Snapshot } from '@/app/modules/multiplayer/utils/snapshot.util';
import type { InputState } from '@/app/modules/world/types/world.types';
import type { Joined, PlayerInfo, SessionInfo } from 'three-hex-engine/protocol';
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
// quem esta em cada lugar da partida (id do socket), na ordem de
// `world.players`. Fixo desde o comeco: se alguem sai no meio, a lista da
// sessao encolhe, mas os lugares do mundo nao mudam.
let roster: string[] = [];
// mede o ping de tempos em tempos enquanto conectado
let pinging: ReturnType<typeof setInterval> | undefined;
const PING_EVERY = 2000;

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => {
      const entered = (result: Joined | { ok: false; error: string }) => {
        if (!result.ok)
          return set({ error: translateSessionError(result.error) });
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
        roster = session.players.map((player) => player.id);
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
        pings(session);
      };

      // ping de cada lugar da partida, para o placar e para a previsao
      const pings = (session: SessionInfo) => {
        if (get().status !== 'playing') return;
        useGameStore
          .getState()
          .setPings(
            roster.map(
              (id) => session.players.find((p) => p.id === id)?.ping ?? 0,
            ),
          );
      };

      // cronometra uma ida e volta ao servidor e avisa o resultado
      const measure = (live: SessionSocket) => {
        const sent = performance.now();
        live.emit('net:ping', () =>
          live.emit('net:latency', performance.now() - sent),
        );
      };

      const listen = (live: SessionSocket) => {
        live.on('connect', () => {
          clearInterval(pinging);
          pinging = setInterval(() => measure(live), PING_EVERY);
          measure(live);
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
        live.on('session:update', (session) => {
          set({ session });
          pings(session);
        });
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
          useGameStore.getState().receiveInput(roster.indexOf(from), payload);
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
          clearInterval(pinging);
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
