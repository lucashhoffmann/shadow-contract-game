import { ArrowLeft, Crown, Lock, Play, Users } from 'lucide-react';

import { MAX_PLAYERS, NAME_MAX } from '@/app/net/protocol';
import { useLobbyPage } from '@/resources/pages/lobby/use-lobby.page';

// botao gordo de jogo, igual ao da home
const CHUNKY =
  'text-outline flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-4 border-white px-5 py-2 text-lg text-white uppercase shadow-[0_5px_0_#14141f] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100';
const PANEL =
  'flex w-full flex-col gap-3 rounded-2xl border-4 border-white/80 bg-[#16345c] p-4';
const FIELD =
  'w-full rounded-xl border-4 border-white bg-[#14141f] px-3 py-2 font-sans text-lg font-bold text-white outline-none focus:border-[#ffd21f]';

// Sala de espera do multiplayer, em tres passos: nome, listagem de sessoes e
// sessao (quem entrou e o codigo de convite).
export function LobbyPage() {
  const {
    status,
    name,
    error,
    sessions,
    session,
    you,
    code,
    setName,
    setCode,
    connect,
    create,
    join,
    start,
    leave,
    exit,
  } = useLobbyPage();

  return (
    <main className='font-display relative flex min-h-full flex-col items-center gap-5 overflow-y-auto bg-[radial-gradient(ellipse_at_50%_30%,#3a3f78_0%,#1f2033_55%,#12131f_100%)] p-6 pt-16 text-center'>
      <button
        type='button'
        className={`${CHUNKY} absolute top-3 left-3 bg-[#3d4fd6] text-base`}
        onClick={exit}
      >
        <ArrowLeft
          aria-hidden
          className='size-5'
          strokeWidth={3}
        />
        Menu
      </button>
      <h1 className='text-outline text-5xl leading-none tracking-wide text-white uppercase'>
        Multiplayer
      </h1>
      {error && (
        <p
          role='alert'
          className='rounded-xl bg-[#ff2d55] px-4 py-2 font-sans text-sm font-bold text-white'
        >
          {error}
        </p>
      )}
      <div className='flex w-full max-w-md flex-col gap-4'>
        {(status === 'idle' || status === 'connecting') && (
          <form
            className={PANEL}
            onSubmit={(event) => {
              event.preventDefault();
              connect();
            }}
          >
            <label className='flex flex-col gap-2 text-left text-lg text-white uppercase'>
              Seu nome
              <input
                value={name}
                maxLength={NAME_MAX}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                className={FIELD}
              />
            </label>
            <button
              type='submit'
              disabled={!name.trim() || status === 'connecting'}
              className={`${CHUNKY} bg-[#2fd15a]`}
            >
              {status === 'connecting' ? 'Conectando...' : 'Entrar'}
            </button>
          </form>
        )}

        {status === 'lobby' && (
          <>
            <section className={PANEL}>
              <h2 className='text-xl text-[#ffd21f] uppercase'>Criar sessao</h2>
              <div className='grid grid-cols-2 gap-3'>
                <button
                  type='button'
                  className={`${CHUNKY} bg-[#2fd15a]`}
                  onClick={() => create(true)}
                >
                  <Users
                    aria-hidden
                    className='size-5'
                    strokeWidth={3}
                  />
                  Publica
                </button>
                <button
                  type='button'
                  className={`${CHUNKY} bg-[#3d4fd6]`}
                  onClick={() => create(false)}
                >
                  <Lock
                    aria-hidden
                    className='size-5'
                    strokeWidth={3}
                  />
                  Privada
                </button>
              </div>
            </section>
            <form
              className={PANEL}
              onSubmit={(event) => {
                event.preventDefault();
                join(code);
              }}
            >
              <label className='flex flex-col gap-2 text-left text-xl text-[#ffd21f] uppercase'>
                Entrar com codigo
                <input
                  value={code}
                  placeholder='ABCDE'
                  onChange={(event) => setCode(event.target.value)}
                  className={`${FIELD} text-center tracking-[0.4em] uppercase`}
                />
              </label>
              <button
                type='submit'
                disabled={code.length < 5}
                className={`${CHUNKY} bg-[#3d4fd6]`}
              >
                Entrar
              </button>
            </form>
            <section
              aria-label='Sessoes publicas'
              className={PANEL}
            >
              <h2 className='text-xl text-[#ffd21f] uppercase'>
                Sessoes publicas
              </h2>
              {sessions.length === 0 && (
                <p className='font-sans text-sm text-white/70'>
                  Nenhuma sessao aberta agora. Crie a sua.
                </p>
              )}
              <ul className='flex flex-col gap-2'>
                {sessions.map((open) => (
                  <li
                    key={open.code}
                    className='flex items-center justify-between gap-3 rounded-xl bg-black/30 px-3 py-2'
                  >
                    <span className='text-left text-lg text-white'>
                      {open.hostName}
                      <span className='ml-2 font-sans text-sm text-white/70'>
                        {open.players.length}/{MAX_PLAYERS}
                      </span>
                    </span>
                    <button
                      type='button'
                      aria-label={`Entrar na sessao de ${open.hostName}`}
                      className={`${CHUNKY} bg-[#2fd15a] px-4 py-1 text-base`}
                      onClick={() => join(open.code)}
                    >
                      Entrar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {status === 'room' && session && (
          <section className={PANEL}>
            <p className='font-sans text-sm font-bold text-white/80 uppercase'>
              {session.public ? 'Sessao publica' : 'Sessao privada'}. Codigo de
              convite:
            </p>
            <p
              aria-label='Codigo de convite'
              className='text-outline text-5xl tracking-[0.25em] text-[#ffd21f]'
            >
              {session.code}
            </p>
            <ul
              aria-label='Jogadores'
              className='flex flex-col gap-2'
            >
              {session.players.map((player) => (
                <li
                  key={player.id}
                  className='flex items-center gap-3 rounded-xl bg-black/30 px-3 py-2 text-left text-xl'
                >
                  <span
                    aria-hidden
                    className='size-5 shrink-0 rounded-full border-2 border-white'
                    style={{ background: player.color }}
                  />
                  <span
                    className='text-outline grow'
                    style={{ color: player.color }}
                  >
                    {player.name}
                    {player.id === you?.id && ' (voce)'}
                  </span>
                  {player.host && (
                    <Crown
                      aria-label='Host'
                      className='size-5 text-[#ffd21f]'
                      strokeWidth={3}
                    />
                  )}
                </li>
              ))}
            </ul>
            <p className='font-sans text-sm text-white/70'>
              {session.players.length}/{MAX_PLAYERS} jogadores.{' '}
              {you?.host
                ? 'Comece quando todos entrarem.'
                : 'Esperando o host comecar.'}
            </p>
            <div className='grid grid-cols-2 gap-3'>
              <button
                type='button'
                className={`${CHUNKY} bg-[#3d4fd6]`}
                onClick={leave}
              >
                Sair
              </button>
              <button
                type='button'
                disabled={!you?.host}
                className={`${CHUNKY} bg-[#2fd15a]`}
                onClick={start}
              >
                <Play
                  aria-hidden
                  className='size-5 fill-white'
                  strokeWidth={3}
                />
                Comecar
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
