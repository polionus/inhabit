/**
 * One duel, from the 3-2-1 to the end screen. Transport-agnostic: the opponent is a bot timeline,
 * a live session's progress feed, a challenger's stored results (hidden until you finish), or
 * nobody (making a challenge). Owns the reducer from `src/arena/state/duel.ts`.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { duelReduce, duelView, newDuel, type DuelState, type DuelView, type PuzzleResult } from '../../../arena/state/duel.ts';
import type { Bot } from '../../../arena/state/duelBots.ts';
import type { DuelFormat } from '../../../arena/plan.ts';
import type { Puzzle } from '../../../arena/types.ts';
import { Lean, Markdown } from '../../components/Markdown.tsx';
import { Card, Countdown, Icon, celebrate, sfx } from '../../components/kit.tsx';
import { PuzzlePlayer, type PuzzleOutcome } from '../PuzzlePlayer.tsx';
import { Reference } from '../parts.tsx';
import { Avatar, BotBadge, fmtSecs, puzzleLabel } from './common.tsx';

export const HOLD_MS = 1100;

export type DuelMode = 'bot' | 'live' | 'challenge' | 'solo';

export interface DuelEnd {
  state: DuelState;
  view: DuelView;
}

export interface Remote {
  subscribe(cb: (i: number, r: PuzzleResult) => void): () => void;
}

export interface DuelPlayProps {
  seed: string;
  format: DuelFormat;
  puzzles: Puzzle[];
  mode: DuelMode;
  meName: string;
  opponent: { name: string; bot?: Bot } | null;
  /** Local epoch ms of the first puzzle; the screen counts down to it. */
  startAt: number;
  /** Bot: results with their durations; revealed as time passes. */
  botTimeline?: PuzzleResult[];
  /** Challenge: the challenger's results, hidden until you finish. */
  preset?: PuzzleResult[];
  /** Live: progress feed from the other player. */
  remote?: Remote;
  opponentLeft?: boolean;
  onLocalResult?: (i: number, r: PuzzleResult) => void;
  /** Called once when the duel is over. */
  onEnd?: (e: DuelEnd) => void;
  endActions: (e: DuelEnd) => ReactNode;
  /** Extra content on the end screen under the comparison (e.g. a challenge link). */
  endExtra?: (e: DuelEnd) => ReactNode;
}

export function DuelPlay(p: DuelPlayProps) {
  const [state, dispatch] = useReducer(duelReduce, undefined, () => newDuel(p.seed, p.format, p.puzzles.length));
  const view = useMemo(() => duelView(state), [state]);
  const [now, setNow] = useState(() => Date.now());
  const [idx, setIdx] = useState(0);
  const [holding, setHolding] = useState(false);
  const started = state.startedAt !== null;
  const ref = useRef(p);
  ref.current = p;

  // Clock: ticks the reducer, starts the duel, reveals a bot's results.
  useEffect(() => {
    const step = () => {
      const t = Date.now();
      setNow(t);
      const q = ref.current;
      if (t >= q.startAt) {
        dispatch({ type: 'start', at: q.startAt });
        dispatch({ type: 'tick', now: t });
        if (q.botTimeline) {
          // The human's wall clock includes the pause between puzzles, so the bot's does too.
          let ft = 0;
          q.botTimeline.forEach((r, i) => {
            ft += r.ms + (i > 0 ? HOLD_MS : 0);
            if (ft <= t - q.startAt) dispatch({ type: 'remoteProgress', i, r });
          });
        }
      }
    };
    step();
    const id = window.setInterval(step, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!started) return;
    if (p.mode === 'solo') dispatch({ type: 'remoteLeft' });
    if (p.mode === 'challenge' && p.preset) p.preset.forEach((r, i) => dispatch({ type: 'remoteProgress', i, r }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // A bot's timeline is fixed in advance, so once you are done its remaining results (those inside
  // the time cap) are simply applied: there is no point making you wait for a program.
  useEffect(() => {
    if (!view.meFinished || !p.botTimeline || state.endedAt !== null) return;
    let ft = 0;
    p.botTimeline.forEach((r, i) => {
      ft += r.ms + (i > 0 ? HOLD_MS : 0);
      dispatch({ type: 'remoteProgress', i, r: ft <= state.capMs ? r : { solved: false, ms: state.capMs } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.meFinished]);

  useEffect(() => {
    if (p.opponentLeft) dispatch({ type: 'remoteLeft' });
  }, [p.opponentLeft]);

  useEffect(() => p.remote?.subscribe((i, r) => dispatch({ type: 'remoteProgress', i, r })), [p.remote]);

  // Countdown ticks.
  const toGo = Math.max(0, p.startAt - now);
  const lastTick = useRef(-1);
  useEffect(() => {
    const n = Math.ceil(toGo / 1000);
    if (!started && n > 0 && n !== lastTick.current) { lastTick.current = n; sfx.play('tick'); }
  }, [toGo, started]);

  const onDone = useCallback((i: number, o: PuzzleOutcome) => {
    const r = { solved: o.solved && !o.skipped, ms: o.ms };
    dispatch({ type: 'localResult', i, r });
    ref.current.onLocalResult?.(i, r);
    setHolding(true);
    window.setTimeout(() => { setIdx((x) => Math.max(x, i + 1)); setHolding(false); }, HOLD_MS);
  }, []);

  const showEnd = view.finished && !holding;
  const end: DuelEnd = { state, view };

  // One-time end effects.
  const ended = useRef(false);
  useEffect(() => {
    if (!showEnd || ended.current) return;
    ended.current = true;
    const w = view.winner;
    if (w === 'me') { sfx.play('win'); celebrate('win'); } else if (w === 'them') sfx.play('lose');
    ref.current.onEnd?.(end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEnd]);

  if (!started) {
    const n = Math.ceil(toGo / 1000);
    return (
      <div className="page narrow dl-stage">
        <Card tone="primary" className="dl-count">
          <p className="eyebrow">{p.mode === 'solo' ? 'Your challenge' : 'Get ready'}</p>
          <h1>{p.opponent ? <>You vs {p.opponent.name}{p.opponent.bot && <> <BotBadge /></>}</> : 'Set the pace'}</h1>
          <div className="dl-count-num tnum" role="timer" aria-live="polite" aria-label={`Starting in ${n}`}>{n > 0 ? n : 'Go'}</div>
          <p className="muted">{p.puzzles.length} puzzles. A wrong answer or a skip scores nothing and you move on.</p>
        </Card>
      </div>
    );
  }

  if (showEnd) return <EndScreen {...p} end={end} />;

  const cur = p.puzzles[idx];
  const board = <Scoreboard {...p} view={view} idx={idx} until={(state.startedAt ?? p.startAt) + state.capMs} onCap={() => dispatch({ type: 'tick', now: Date.now() + 1 })} />;
  if (!cur || (view.meFinished && !holding)) {
    return (
      <div className="page narrow dl-stage">
        {board}
        <Card className="dl-wait"><p><Icon name="clock" size={18} /> You are done. Waiting for {p.opponent?.name ?? 'the other player'} to finish, or for the time cap.</p></Card>
      </div>
    );
  }
  return (
    <div className="page wide dl-play">
      <PuzzlePlayer key={cur.id} puzzle={cur} allow={{ hints: false, reveal: false, skip: true }} explain={false} compact header={board} onDone={(o) => onDone(idx, o)} />
    </div>
  );
}

/* ---------------- scoreboard ---------------- */

function Marks({ marks, current, hidden }: { marks: string[]; current: number | null; hidden?: boolean }) {
  return (
    <span className="dl-marks" aria-hidden={hidden ? 'true' : undefined}>
      {marks.map((m, i) => (
        <span key={i} className={`dl-mark ${hidden ? 'hid' : m} ${current === i ? 'cur' : ''}`} />
      ))}
    </span>
  );
}

function Scoreboard(p: DuelPlayProps & { view: DuelView; idx: number; until: number; onCap: () => void }) {
  const { view } = p;
  const hideThem = p.mode === 'challenge';
  const label = (m: string[]) => m.map((x, i) => `${i + 1}: ${x}`).join(', ');
  return (
    <div className="dl-board" role="group" aria-label="Scoreboard">
      <div className="dl-row me">
        <span className="dl-who">{p.meName} <span className="muted small">(you)</span></span>
        <Marks marks={view.marks.me} current={view.on.me} />
        <span className="dl-score tnum" aria-label={`Your score ${view.scores.me}. ${label(view.marks.me)}`}>{view.scores.me}</span>
      </div>
      {p.opponent && (
        <div className="dl-row them">
          <span className="dl-who">{p.opponent.name} {p.opponent.bot && <BotBadge />}{view.opponentLeft && <span className="muted small"> (left)</span>}</span>
          <Marks marks={view.marks.them} current={view.on.them} hidden={hideThem} />
          <span className="dl-score tnum" aria-label={hideThem ? 'Their score is hidden until you finish' : `Their score ${view.scores.them}. ${label(view.marks.them)}`}>{hideThem ? '?' : view.scores.them}</span>
        </div>
      )}
      <div className="dl-cap"><Countdown until={p.until} onDone={p.onCap} label="Time cap" /></div>
    </div>
  );
}

/* ---------------- comparison and end screen ---------------- */

export function Comparison({ puzzles, me, them, meName, themName }: { puzzles: Puzzle[]; me: (PuzzleResult | null)[]; them: (PuzzleResult | null)[]; meName: string; themName: string }) {
  const cell = (r: PuzzleResult | null) => (r === null ? <span className="muted">not reached</span> : r.solved ? <span className="dl-ok"><Icon name="check" size={14} /> {fmtSecs(r.ms)}</span> : <span className="dl-miss"><Icon name="close" size={14} /> {fmtSecs(r.ms)}</span>);
  return (
    <ol className="dl-compare">
      <li className="dl-ch" aria-hidden="true"><span /><span /><span>{meName}</span><span>{themName}</span></li>
      {puzzles.map((pz, i) => (
        <li key={pz.id}>
          <span className="dl-n tnum">{i + 1}</span>
          <span className="dl-what small">{puzzleLabel(pz)} <span className="muted tnum">{pz.rating}</span></span>
          <span className="dl-c" aria-label={`${meName}`}>{cell(me[i] ?? null)}</span>
          <span className="dl-c" aria-label={`${themName}`}>{cell(them[i] ?? null)}</span>
        </li>
      ))}
    </ol>
  );
}

function EndScreen(p: DuelPlayProps & { end: DuelEnd }) {
  const { view, state } = p.end;
  const w = view.winner;
  const solo = p.mode === 'solo' || !p.opponent;
  const left = view.endReason === 'opponent-left' && p.mode !== 'solo' && p.mode !== 'challenge';
  const title = solo ? 'Your result' : w === 'me' ? 'You won' : w === 'them' ? 'You lost' : 'A draw';
  const sub = solo
    ? `${view.scores.me} of ${p.puzzles.length} solved, ${fmtSecs(view.solvedMs.me)} on the ones you got.`
    : w === 'draw'
      ? 'Same score and same time on the solved ones.'
      : view.scores.me === view.scores.them
        ? `Level on points; ${w === 'me' ? 'you were' : `${p.opponent!.name} was`} faster on the puzzles solved.`
        : '';
  return (
    <div className="page narrow dl-stage dl-end">
      <Card tone={w === 'me' ? 'gold' : 'default'} className={`dl-banner ${solo ? 'solo' : w}`}>
        <p className="eyebrow">{p.mode === 'challenge' ? 'Challenge' : p.mode === 'live' ? 'Live duel' : p.mode === 'bot' ? 'Duel against a bot' : 'Challenge'} · {state.format}</p>
        <h1>{title}</h1>
        {!solo && (
          <div className="dl-final">
            <div className="dl-side"><span>{p.meName}</span><strong className="tnum">{view.scores.me}</strong></div>
            <span className="dl-vs" aria-hidden="true">:</span>
            <div className="dl-side">{p.opponent!.bot && <Avatar bot={p.opponent!.bot} size={28} />}<span>{p.opponent!.name} {p.opponent!.bot && <BotBadge />}</span><strong className="tnum">{view.scores.them}</strong></div>
          </div>
        )}
        {sub && <p className="muted">{sub}</p>}
        {view.endReason === 'cap' && <p className="small">The time cap passed; puzzles still open scored nothing.</p>}
        {left && <p className="notice small">{p.opponent!.name} left before finishing. Result marked: opponent left.</p>}
        {p.mode === 'live' && <p className="muted small">Friend duels are unrated and run on the honour system.</p>}
        {p.mode === 'challenge' && <p className="muted small">Challenge results come from the link and are on the honour system.</p>}
      </Card>
      <Comparison puzzles={p.puzzles} me={state.me} them={solo ? state.them.map(() => null) : state.them} meName={p.meName} themName={solo ? '' : p.opponent!.name} />
      {p.endExtra?.(p.end)}
      <div className="dl-actions">{p.endActions(p.end)}</div>
      <section aria-label="Reference solutions" className="dl-refs">
        <h2>Reference solutions</h2>
        {p.puzzles.map((pz, i) => (
          <div key={pz.id}>
            <p className="small muted">Puzzle {i + 1}, {puzzleLabel(pz)}</p>
            <Markdown className="small" text={pz.kind === 'proof' ? pz.english : pz.prompt} />
            {pz.kind === 'quick' ? (
              <>
                {pz.code && <Lean code={pz.code} />}
                <Markdown className="small" text={`**Answer:** ${pz.options.find((o) => o.correct)?.text ?? ''}  \n${pz.options.find((o) => o.correct)?.why ?? ''}`} />
              </>
            ) : <Reference puzzle={pz} />}
          </div>
        ))}
      </section>
    </div>
  );
}
