/**
 * Challenge links. `#/arena/duel/make`: play a set yourself, then send the link.
 * `#/arena/challenge/<code>`: play the sender's set, then compare and reply.
 */
import { useMemo, useState } from 'react';
import { challengeHash, challengeIsCurrent, decodeChallenge, type Challenge } from '../../../arena/net/codec.ts';
import { absoluteLink } from '../../../arena/net/codec.ts';
import { generator } from '../../../arena/gen/index.ts';
import { DUEL_FORMATS, duelSet, type DuelFormat } from '../../../arena/plan.ts';
import { DUEL_CAP_MS, type PuzzleResult } from '../../../arena/state/duel.ts';
import { Card, EmptyState } from '../../components/kit.tsx';
import { game } from '../../game.ts';
import { navigate } from '../../router.ts';
import { Comparison, DuelPlay, type DuelEnd } from './DuelPlay.tsx';
import { FormatPicker, LinkBox, nav, randomSeed, saveDuel, useMyName } from './common.tsx';
import { arenaStore, useArena } from '../../../arena/state/store.ts';

const START_MS = 3500;

const resultsOf = (e: DuelEnd): PuzzleResult[] => e.state.me.map((r) => r ?? { solved: false, ms: e.state.capMs });
const outcomeOf = (w: 'me' | 'them' | 'draw' | null) => (w === 'me' ? 'win' : w === 'them' ? 'loss' : 'draw') as 'win' | 'loss' | 'draw';

export function NameField() {
  const name = useArena((s) => s.displayName);
  return (
    <label className="dl-name">
      <span>Your name (your friend sees it; at most 20 characters)</span>
      <input type="text" value={name} maxLength={20} placeholder="Player" autoComplete="nickname" onChange={(e) => arenaStore.getState().setDisplayName(e.target.value)} />
    </label>
  );
}

/* ---------------- make a challenge ---------------- */

export function MakeChallenge() {
  const [format, setFormat] = useState<DuelFormat>(nav.make?.format ?? nav.format);
  const [seed, setSeed] = useState<string | null>(null);
  if (seed === null) {
    return (
      <div className="page narrow">
        <h1>Make a challenge link</h1>
        <p className="muted">You play a set of puzzles now. Your friend gets a link, plays the same set whenever they like, and sees both results side by side.</p>
        <Card as="section" aria-label="Setup">
          <h2>Format</h2>
          <FormatPicker value={format} onChange={(f) => { nav.format = f; setFormat(f); }} />
          <NameField />
        </Card>
        <div className="dl-actions">
          <button className="btn primary big" onClick={() => { setSeed(nav.make?.seed ?? randomSeed()); nav.make = null; }}>Start my run</button>
          <a className="btn ghost" href="#/arena/duel">Back</a>
        </div>
      </div>
    );
  }
  return <MakeRun seed={seed} format={format} />;
}

function MakeRun({ seed, format }: { seed: string; format: DuelFormat }) {
  const me = useMyName();
  const puzzles = useMemo(() => duelSet(seed, format), [seed, format]);
  const [startAt] = useState(() => Date.now() + START_MS);
  return (
    <DuelPlay
      seed={seed}
      format={format}
      puzzles={puzzles}
      mode="solo"
      meName={me}
      opponent={null}
      startAt={startAt}
      endExtra={(e) => {
        const link = absoluteLink(challengeHash({ v: 1, gen: generator.version, seed, format, from: me, results: resultsOf(e), at: Date.now() }));
        return (
          <Card as="section" aria-label="Your challenge link" tone="primary">
            <h2>Send this to a friend</h2>
            <p className="muted small">The link carries the seed and your result, nothing more. Your result is on the honour system.</p>
            <LinkBox url={link} shareTitle="A duel challenge on Inhabit" shareText={`I scored ${e.view.scores.me} of ${puzzles.length} on an Inhabit ${DUEL_FORMATS[format].title} set. Can you beat it?`} />
          </Card>
        );
      }}
      endActions={() => <a className="btn ghost" href="#/arena/duel">Back to the hub</a>}
    />
  );
}

/* ---------------- receive a challenge ---------------- */

export function ChallengeScreen({ code }: { code?: string }) {
  const c = useMemo(() => (code ? decodeChallenge(code) : null), [code]);
  if (!c) {
    return (
      <div className="page narrow">
        <EmptyState glyph="?" title="This challenge link is damaged" action={<a className="btn primary" href="#/arena/duel">Open the duel hub</a>}>
          The link is incomplete or was changed on the way. Ask your friend to send it again, or start a new duel.
        </EmptyState>
      </div>
    );
  }
  if (!challengeIsCurrent(c)) {
    return (
      <div className="page narrow">
        <Card tone="flat">
          <div role="alert">
          <h1>Made with a different version of the game</h1>
          <p>{c.from} sent this link from another version of Inhabit, so the puzzles in it are not the ones you would get here, and your results cannot be compared fairly.</p>
          </div>
          <div className="dl-actions">
            <button className="btn primary" onClick={() => { nav.format = c.format; navigate('#/arena/duel/make'); }}>Make a fresh {DUEL_FORMATS[c.format].title} challenge instead</button>
            <a className="btn ghost" href="#/arena/duel">Back</a>
          </div>
        </Card>
      </div>
    );
  }
  return c.vs ? <ReplyView c={c} /> : <PlayChallenge c={c} />;
}

/** A reply link already holds both results: show them. */
function ReplyView({ c }: { c: Challenge }) {
  const puzzles = useMemo(() => duelSet(c.seed, c.format), [c.seed, c.format]);
  const vs = c.vs!;
  const pts = (rs: PuzzleResult[]) => rs.filter((r) => r.solved).length;
  const time = (rs: PuzzleResult[]) => rs.reduce((a, r) => a + (r.solved ? r.ms : 0), 0);
  const a = pts(c.results), b = pts(vs.results);
  const verdict = a !== b ? (a > b ? `${c.from} won` : `${vs.from} won`) : time(c.results) === time(vs.results) || a === 0 ? 'A draw' : time(c.results) < time(vs.results) ? `${c.from} won on time` : `${vs.from} won on time`;
  return (
    <div className="page narrow dl-stage dl-end">
      <Card className="dl-banner" tone="primary">
        <p className="eyebrow">Challenge result · {DUEL_FORMATS[c.format].title}</p>
        <h1>{verdict}</h1>
        <div className="dl-final">
          <div className="dl-side"><span>{vs.from}</span><strong className="tnum">{b}</strong></div>
          <span className="dl-vs" aria-hidden="true">:</span>
          <div className="dl-side"><span>{c.from}</span><strong className="tnum">{a}</strong></div>
        </div>
        <p className="muted small">Both results come from links and are on the honour system.</p>
      </Card>
      <Comparison puzzles={puzzles} me={vs.results} them={c.results} meName={vs.from} themName={c.from} />
      <div className="dl-actions">
        <button className="btn primary" onClick={() => { nav.format = c.format; navigate('#/arena/duel/make'); }}>Start a new challenge</button>
        <a className="btn ghost" href="#/arena/duel">Back to the hub</a>
      </div>
    </div>
  );
}

function PlayChallenge({ c }: { c: Challenge }) {
  const me = useMyName();
  const puzzles = useMemo(() => duelSet(c.seed, c.format), [c.seed, c.format]);
  const [startAt, setStartAt] = useState<number | null>(null);
  if (startAt === null) {
    return (
      <div className="page narrow">
        <h1>{c.from} challenged you</h1>
        <Card as="section" aria-label="The challenge">
          <p><strong>{DUEL_FORMATS[c.format].title}</strong>: {DUEL_FORMATS[c.format].desc} Up to {DUEL_CAP_MS[c.format] / 60_000} minutes.</p>
          <p className="muted">{c.from}&apos;s score stays hidden until you finish. Their result comes from the link, on the honour system; the duel is unrated.</p>
          <NameField />
        </Card>
        <div className="dl-actions">
          <button className="btn primary big" onClick={() => setStartAt(Date.now() + START_MS)}>Play the set</button>
          <a className="btn ghost" href="#/arena/duel">Not now</a>
        </div>
      </div>
    );
  }
  return (
    <DuelPlay
      seed={c.seed}
      format={c.format}
      puzzles={puzzles}
      mode="challenge"
      meName={me}
      opponent={{ name: c.from }}
      startAt={startAt}
      preset={c.results}
      onEnd={(e) => {
        const w = e.view.winner;
        saveDuel({ at: Date.now(), opponent: 'challenge', name: c.from, format: c.format, seed: c.seed, me: e.view.scores.me, them: e.view.scores.them, result: outcomeOf(w) });
        game().recordEvent({ type: 'arena-duel', won: w === 'me', opponent: 'friend' });
      }}
      endExtra={(e) => {
        const reply = absoluteLink(challengeHash({ v: 1, gen: c.gen, seed: c.seed, format: c.format, from: me, results: resultsOf(e), at: Date.now(), vs: { from: c.from, results: c.results } }));
        return (
          <Card as="section" aria-label="Reply" tone="primary">
            <h2>Send your result back</h2>
            <p className="muted small">This link holds both results, so {c.from} sees the same comparison.</p>
            <LinkBox url={reply} shareTitle="My answer to your Inhabit challenge" shareText={`I scored ${e.view.scores.me} to ${e.view.scores.them} on your Inhabit challenge.`} />
          </Card>
        );
      }}
      endActions={() => (
        <>
          <button className="btn" onClick={() => { nav.format = c.format; navigate('#/arena/duel/make'); }}>Make my own challenge</button>
          <a className="btn ghost" href="#/arena/duel">Back to the hub</a>
        </>
      )}
    />
  );
}
