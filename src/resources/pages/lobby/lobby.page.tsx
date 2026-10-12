import { ArrowLeft, Crown, Lock, Play, Users } from 'lucide-react';

import { MAX_PLAYERS, NAME_MAX } from '@/app/net/protocol';
import { useLobbyPage } from '@/resources/pages/lobby/use-lobby.page';
import { useTexts } from '@/shared/i18n';

// botao gordo de jogo, igual ao da home
const CHUNKY =
  'text-outline flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-4 border-white px-5 py-2 text-lg text-white uppercase shadow-[0_5px_0_var(--game-ink)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100';
const PANEL =
  'flex w-full flex-col gap-3 rounded-2xl border-4 border-white/80 bg-[var(--game-panel)] p-4';
const FIELD =
  'w-full rounded-xl border-4 border-white bg-[var(--game-ink)] px-3 py-2 font-sans text-lg font-bold text-white outline-none focus:border-[var(--game-highlight)]';

// Sala de espera do multiplayer, em tres passos: nome, listagem de sessoes e
// sessao (quem entrou e o codigo de convite).
export function LobbyPage() {
  const t = useTexts();
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
    <main className='game-menu-background font-display relative flex h-full touch-pan-y flex-col items-center gap-5 overflow-y-auto p-6 pt-16 text-center'>
      <button
        type='button'
        className={`${CHUNKY} absolute top-3 left-3 bg-[var(--game-secondary)] text-base`}
        onClick={exit}
      >
        <ArrowLeft
          aria-hidden
          className='size-5'
          strokeWidth={3}
        />
        {t.common.menu}
      </button>
      <h1 className='text-outline text-5xl leading-none tracking-wide text-white uppercase'>
        {t.home.multiplayer}
      </h1>
      {error && (
        <p
          role='alert'
          className='rounded-xl bg-[var(--game-brandPink)] px-4 py-2 font-sans text-sm font-bold text-white'
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
              {t.lobby.yourName}
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
              className={`${CHUNKY} bg-[var(--game-success)]`}
            >
              {status === 'connecting' ? t.lobby.connecting : t.lobby.enter}
            </button>
          </form>
        )}

        {status === 'lobby' && (
          <>
            <section className={PANEL}>
              <h2 className='text-xl text-[var(--game-highlight)] uppercase'>
                {t.lobby.createSession}
              </h2>
              <div className='grid grid-cols-2 gap-3'>
                <button
                  type='button'
                  className={`${CHUNKY} bg-[var(--game-success)]`}
                  onClick={() => create(true)}
                >
                  <Users
                    aria-hidden
                    className='size-5'
                    strokeWidth={3}
                  />
                  {t.lobby.public}
                </button>
                <button
                  type='button'
                  className={`${CHUNKY} bg-[var(--game-secondary)]`}
                  onClick={() => create(false)}
                >
                  <Lock
                    aria-hidden
                    className='size-5'
                    strokeWidth={3}
                  />
                  {t.lobby.private}
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
              <label className='flex flex-col gap-2 text-left text-xl text-[var(--game-highlight)] uppercase'>
                {t.lobby.joinCode}
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
                className={`${CHUNKY} bg-[var(--game-secondary)]`}
              >
                {t.lobby.enter}
              </button>
            </form>
            <section
              aria-label={t.lobby.publicSessions}
              className={PANEL}
            >
              <h2 className='text-xl text-[var(--game-highlight)] uppercase'>
                {t.lobby.publicSessions}
              </h2>
              {sessions.length === 0 && (
                <p className='font-sans text-sm text-white/70'>
                  {t.lobby.noSessions}
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
                      aria-label={t.lobby.joinHost(open.hostName)}
                      className={`${CHUNKY} bg-[var(--game-success)] px-4 py-1 text-base`}
                      onClick={() => join(open.code)}
                    >
                      {t.lobby.enter}
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
              {t.lobby.sessionType(session.public)}. {t.lobby.inviteCode}:
            </p>
            <p
              aria-label={t.lobby.inviteCode}
              className='text-outline text-5xl tracking-[0.25em] text-[var(--game-highlight)]'
            >
              {session.code}
            </p>
            <ul
              aria-label={t.lobby.players}
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
                    {player.id === you?.id && t.lobby.you}
                  </span>
                  {player.host && (
                    <Crown
                      aria-label={t.lobby.host}
                      className='size-5 text-[var(--game-highlight)]'
                      strokeWidth={3}
                    />
                  )}
                </li>
              ))}
            </ul>
            <p className='font-sans text-sm text-white/70'>
              {t.lobby.playerCount(session.players.length, MAX_PLAYERS)}{' '}
              {you?.host ? t.lobby.hostHint : t.lobby.guestHint}
            </p>
            <div className='grid grid-cols-2 gap-3'>
              <button
                type='button'
                className={`${CHUNKY} bg-[var(--game-secondary)]`}
                onClick={leave}
              >
                {t.lobby.leave}
              </button>
              <button
                type='button'
                disabled={!you?.host}
                className={`${CHUNKY} bg-[var(--game-success)]`}
                onClick={start}
              >
                <Play
                  aria-hidden
                  className='size-5 fill-white'
                  strokeWidth={3}
                />
                {t.common.start}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
