/**
 * Live duels: `#/arena/duel/host` (create a room) and `#/arena/live/<roomId>` (join one).
 * Over the internet this is a WebRTC data channel via PeerJS (loaded only after the player agrees
 * to the privacy notice); in two tabs of one browser it is a BroadcastChannel.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { generator } from '../../../arena/gen/index.ts';
import { absoluteLink } from '../../../arena/net/codec.ts';
import { LocalTransport } from '../../../arena/net/localTransport.ts';
import { createSession, type Session, type SessionState } from '../../../arena/net/session.ts';
import { roomKind, type DuelTransport } from '../../../arena/net/transport.ts';
import { duelSet, type DuelFormat } from '../../../arena/plan.ts';
import type { PuzzleResult } from '../../../arena/state/duel.ts';
import { Card, EmptyState, Icon } from '../../components/kit.tsx';
import { game } from '../../game.ts';
import { navigate } from '../../router.ts';
import { DuelPlay, type DuelEnd, type Remote } from './DuelPlay.tsx';
import { FormatPicker, LinkBox, nav, randomSeed, saveDuel, useMyName } from './common.tsx';

type Kind = 'peer' | 'local';

export function Privacy({ onGo, onBack }: { onGo: () => void; onBack: () => void }) {
  return (
    <Card className="dl-privacy" tone="gold" as="section" aria-label="Before you connect">
      <h2>Before you connect</h2>
      <p>A live duel connects your browser <strong>directly</strong> to your friend&apos;s browser. In plain words:</p>
      <ul>
        <li><strong>Each of you can see the other&apos;s IP address</strong>, and so can the signalling service that introduces the two browsers (PeerJS&apos;s free public broker). Google&apos;s public STUN server is also contacted to help the browsers find each other.</li>
        <li>Nothing else is sent to anyone: during the duel only your display name, whether each puzzle was solved and how long it took travel between you. There is no account, no analytics and no Inhabit server.</li>
        <li>Only share the room link with people you trust. Until you click below, no connection to any of these services is made.</li>
        <li>Results are on the honour system, and friend duels are unrated.</li>
      </ul>
      <div className="dl-actions">
        <button className="btn primary big" onClick={onGo}>I understand, connect</button>
        <button className="btn ghost" onClick={onBack}>Back</button>
      </div>
    </Card>
  );
}

function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [st, setSt] = useState<SessionState | null>(null);
  const live = useRef<Session | null>(null);
  useEffect(() => {
    const bye = () => live.current?.close();
    window.addEventListener('pagehide', bye);
    return () => {
      window.removeEventListener('pagehide', bye);
      live.current?.close();
      live.current = null;
    };
  }, []);
  const attach = (s: Session) => {
    live.current?.close();
    live.current = s;
    setSession(s);
    setSt(s.getState());
    s.subscribe(setSt);
  };
  return { session, st, attach };
}

/** A fan-out for the session's single progress callback, so each round can subscribe and unsubscribe. */
function makeRemote(): { remote: Remote; push: (i: number, r: PuzzleResult) => void } {
  const subs = new Set<(i: number, r: PuzzleResult) => void>();
  return { remote: { subscribe: (cb) => { subs.add(cb); return () => { subs.delete(cb); }; } }, push: (i, r) => subs.forEach((cb) => cb(i, r)) };
}

export function HostScreen() {
  const [format, setFormat] = useState<DuelFormat>(nav.format);
  const [kind, setKind] = useState<Kind | null>(null);
  const [go, setGo] = useState(false);
  if (go && kind) return <LiveDuel role="host" kind={kind} format={format} />;
  return (
    <div className="page narrow">
      <h1>Duel a friend, live</h1>
      <Card as="section" aria-label="Setup">
        <h2>Format</h2>
        <FormatPicker value={format} onChange={(f) => { nav.format = f; setFormat(f); }} />
        <h2>Where is your friend?</h2>
        <div className="dl-formats" role="radiogroup" aria-label="Connection">
          <button type="button" role="radio" aria-checked={kind === 'peer'} className={`dl-format ${kind === 'peer' ? 'on' : ''}`} onClick={() => setKind('peer')}>
            <strong>On another device</strong><span className="small">Over the internet, browser to browser.</span>
          </button>
          <button type="button" role="radio" aria-checked={kind === 'local'} className={`dl-format ${kind === 'local' ? 'on' : ''}`} onClick={() => setKind('local')}>
            <strong>In another tab of this browser</strong><span className="small">No network at all. Handy to try it out.</span>
          </button>
        </div>
      </Card>
      {kind === 'peer' && <Privacy onGo={() => setGo(true)} onBack={() => navigate('#/arena/duel')} />}
      {kind === 'local' && <div className="dl-actions"><button className="btn primary big" onClick={() => setGo(true)}>Create the room</button><a className="btn ghost" href="#/arena/duel">Back</a></div>}
      {kind === null && <div className="dl-actions"><a className="btn ghost" href="#/arena/duel">Back</a></div>}
    </div>
  );
}

export function JoinScreen({ roomId }: { roomId?: string }) {
  const kind = roomId ? roomKind(roomId) : null;
  const [go, setGo] = useState(false);
  if (!roomId || !kind) {
    return (
      <div className="page narrow">
        <EmptyState glyph="?" title="That is not a room link" action={<a className="btn primary" href="#/arena/duel">Back to duels</a>}>The link looks incomplete. Ask your friend to send it again.</EmptyState>
      </div>
    );
  }
  if (go || kind === 'local') return <LiveDuel role="guest" kind={kind} roomId={roomId} />;
  return (
    <div className="page narrow">
      <h1>Join a live duel</h1>
      <p className="muted">Someone invited you to a duel. Read this, then decide.</p>
      <Privacy onGo={() => setGo(true)} onBack={() => navigate('#/arena/duel')} />
    </div>
  );
}

function LiveDuel({ role, kind, format: hostFormat, roomId }: { role: 'host' | 'guest'; kind: Kind; format?: DuelFormat; roomId?: string }) {
  const me = useMyName();
  const { session, st, attach } = useSession();
  const [room, setRoom] = useState<string | null>(roomId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const fan = useRef(makeRemote());
  const firstSeed = useRef(randomSeed());
  const seedCount = useRef(0);

  useEffect(() => {
    setError(null);
    let cancelled = false;
    let created: Session | null = null;
    const start = async () => {
      let tr: DuelTransport | null = null;
      try {
        if (kind === 'peer') {
          const { PeerTransport } = await import('../../../arena/net/peerTransport.ts');
          tr = new PeerTransport();
        } else tr = new LocalTransport();
        if (cancelled) { tr.close(); return; }
        seedCount.current = 0;
        const s = createSession({
          transport: tr, role, name: me, gen: generator.version, format: hostFormat,
          newSeed: () => (seedCount.current++ === 0 ? firstSeed.current : randomSeed()),
          now: () => Date.now(),
        });
        s.onProgress((i, r) => fan.current.push(i, r));
        created = s;
        attach(s);
        if (role === 'host') setRoom(await tr.host());
        else await tr.join(roomId!);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'The connection failed.');
      }
    };
    // Deferred a tick so a development double-mount never opens (and drops) a connection.
    const t = window.setTimeout(() => void start(), 0);
    return () => { clearTimeout(t); cancelled = true; created?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const format = st?.format ?? hostFormat ?? 'standard';
  const seed = st?.seed ?? null;
  const puzzles = useMemo(() => (seed ? duelSet(seed, format) : []), [seed, format]);

  const detail = error ?? (st && (st.phase === 'failed' || st.phase === 'closed') ? st.detail : null);
  const asChallenge = () => { nav.make = { format, seed: firstSeed.current }; navigate('#/arena/duel/make'); };

  if (detail) {
    return (
      <div className="page narrow">
        <Card tone="flat" aria-label="Connection problem"><div role="alert">
          <h1>{st?.versionMismatch ? 'Different versions of the game' : 'No duel this time'}</h1>
          <p>{detail}</p>
          {!st?.versionMismatch && <p className="muted small">If no connection forms, a challenge link does the same job: you play the set now, your friend plays it whenever they like.</p>}
          </div>
          <div className="dl-actions">
            {role === 'host' && !st?.versionMismatch && <button className="btn primary" onClick={asChallenge}>Send a challenge link instead</button>}
            {role === 'host' && <button className="btn" onClick={() => setAttempt((a) => a + 1)}>Try again</button>}
            <a className="btn ghost" href="#/arena/duel">Back</a>
          </div>
        </Card>
      </div>
    );
  }

  if (!st || !session || st.phase === 'connecting' || st.phase === 'lobby' || !st.startAt || puzzles.length === 0) {
    const joined = st && st.opponent;
    const link = room && role === 'host' ? absoluteLink(`#/arena/live/${room}`) : '';
    return (
      <div className="page narrow">
        <h1>{role === 'host' ? 'Duel a friend, live' : 'Joining the duel'}</h1>
        {role === 'host' && !joined && (
          <Card as="section" aria-label="Invite">
            <p>Send this link to your friend. When they open it, the duel starts.</p>
            {link ? <LinkBox url={link} shareTitle="Duel me on Inhabit" shareText={`Duel me on Inhabit (${format}). Open the link and we play the same puzzles.`} /> : <p className="muted"><Icon name="clock" size={16} /> Setting up the room…</p>}
            {link && <p className="dl-wait small" role="status"><span className="dl-pulse" aria-hidden="true" /> Waiting for your friend to open it. The room stays open while this page is open.</p>}
            {kind === 'local' && <p className="muted small">This is a same-browser room: open the link in another tab of this browser.</p>}
          </Card>
        )}
        {(role === 'guest' || joined) && <Card><p role="status"><span className="dl-pulse" aria-hidden="true" /> {joined ? `Connected to ${st!.opponent}. Starting…` : 'Connecting…'}</p></Card>}
        <div className="dl-actions"><a className="btn ghost" href="#/arena/duel">Cancel</a></div>
      </div>
    );
  }

  const opponent = { name: st.opponent ?? 'Friend' };
  return (
    <DuelPlay
      key={st.round}
      seed={st.seed!}
      format={st.format}
      puzzles={puzzles}
      mode="live"
      meName={me}
      opponent={opponent}
      startAt={st.startAt}
      remote={fan.current.remote}
      opponentLeft={st.opponentLeft}
      onLocalResult={(i, r) => session.sendProgress(i, r)}
      onEnd={(e: DuelEnd) => {
        session.finish();
        const w = e.view.winner;
        saveDuel({ at: Date.now(), opponent: 'friend', name: opponent.name, format: st.format, seed: st.seed!, me: e.view.scores.me, them: e.view.scores.them, result: w === 'me' ? 'win' : w === 'them' ? 'loss' : 'draw', ...(e.view.opponentLeft ? { left: true } : {}) });
        game().recordEvent({ type: 'arena-duel', won: w === 'me', opponent: 'friend' });
      }}
      endActions={() => (
        <>
          <button className="btn primary big" disabled={st.opponentLeft || st.rematch.me} onClick={() => session.requestRematch()}>
            {st.rematch.me ? `Waiting for ${opponent.name}…` : st.rematch.them ? `${opponent.name} wants a rematch: accept` : 'Rematch'}
          </button>
          <a className="btn ghost" href="#/arena/duel">Back to the hub</a>
        </>
      )}
    />
  );
}
