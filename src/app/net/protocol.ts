// Contrato entre o servidor de salas e o jogo. O front copia este arquivo:
// mudou aqui, muda la.
//
// O servidor nao simula nada. Quem cria a sessao (host) roda o jogo no
// proprio navegador; o servidor so junta os jogadores e repassa mensagens.

export const MAX_PLAYERS = 4;
export const NAME_MAX = 16;
// cor de cada jogador, pela ordem de entrada
export const PLAYER_COLORS = ['#ff8a3c', '#39d0ff', '#3fe08a', '#ff5fa2'];

export type PlayerInfo = {
  id: string;
  name: string;
  color: string;
  host: boolean;
  // ida e volta ate o servidor, em ms; 0 enquanto nao mediu
  ping: number;
};

export type SessionInfo = {
  // codigo de 5 letras: e o convite
  code: string;
  hostName: string;
  // aparece na listagem publica; privada so entra com o codigo
  public: boolean;
  // partida ja comecou: nao aceita mais ninguem
  started: boolean;
  players: PlayerInfo[];
};

export type Failure = { ok: false; error: string };
export type Joined = { ok: true; session: SessionInfo; you: PlayerInfo };

// cliente -> servidor; o ultimo argumento e a resposta (ack)
export type ClientEvents = {
  'session:list': (reply: (sessions: SessionInfo[]) => void) => void;
  'session:create': (
    input: { name: string; public: boolean },
    reply: (result: Joined | Failure) => void,
  ) => void;
  'session:join': (
    input: { code: string; name: string },
    reply: (result: Joined | Failure) => void,
  ) => void;
  'session:leave': () => void;
  // medir o ping: o cliente cronometra ate a resposta chegar
  'net:ping': (reply: () => void) => void;
  // avisar o ping medido, para os outros verem no placar
  'net:latency': (ms: number) => void;
  // so o host: fecha a entrada e avisa todo mundo
  'session:start': (reply: (result: { ok: true } | Failure) => void) => void;
  // convidado -> host: input do jogador, formato definido pelo jogo
  'game:input': (payload: unknown) => void;
  // host -> convidados: estado do mundo; pode perder pacote
  'game:state': (payload: unknown) => void;
  // host -> convidados: acontecimento que nao pode se perder
  'game:event': (payload: unknown) => void;
};

// servidor -> cliente
export type ServerEvents = {
  // quem esta na sua sessao mudou
  'session:update': (session: SessionInfo) => void;
  // a listagem publica mudou
  'session:list': (sessions: SessionInfo[]) => void;
  'session:started': (session: SessionInfo) => void;
  // o host saiu: a sessao acabou
  'session:closed': () => void;
  'game:input': (from: string, payload: unknown) => void;
  'game:state': (payload: unknown) => void;
  'game:event': (payload: unknown) => void;
};
