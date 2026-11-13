import { useCallback, useEffect, useRef, useState } from 'react';
import { RUSH_LIMIT_MS, RUSH_MODES, RUSH_PENALTY_MS, RUSH_STRIKES, RUSH_TITLE, rushItem, type RushMode } from '../../arena/state/model.ts';
import { statementKey } from '../../arena/plan.ts';
import { arenaStore, useArena } from '../../arena/state/store.ts';
import type { QuickPuzzle } from '../../arena/types.ts';
import { Card, Countdown, Pill, ScreenHeader, celebrate, sfx } from '../components/kit.tsx';
import { Markdown, Lean } from '../components/Markdown.tsx';
import { PuzzlePlayer, type PuzzleOutcome } from './PuzzlePlayer.tsx';

type Phase =
  | { name: 'pick' }
  | { name: 'ready'; mode: RushMode; n: number }
  | { name: 'play'; mode: RushMode }
  | { name: 'end'; mode: RushMode; score: number; best: boolean; previous: number; wrong: QuickPuzzle[] };

interface Run {
  seed: string;
  index: number;
  score: number;
  strikes: number;
  seen: string[];
  wrong: QuickPuzzle[];
  /** Epoch ms the timed run ends (moves earlier with each penalty); null for survival. */
  until: number | null;
  /** Brief feedback pause after an answer: ignore input meanwhile. */
  settling: boolean;
}

const randomSeed = () => `rush:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export function RushScreen() {
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  return (
    <div className="page arena rush">
      <ScreenHeader id="arena-rush" title="Proof Rush" icon="bolt" />
      {phase.name === 'pick' && <Picker onStart={(mode) => setPhase({ name: 'ready', mode, n: 3 })} />}
      {phase.name === 'ready' && <Ready n={phase.n} onTick={() => setPhase(phase.n > 1 ? { ...phase, n: phase.n - 1 } : { name: 'play', mode: phase.mode })} />}
      {phase.name === 'play' && <Play mode={phase.mode} onEnd={(r) => setPhase({ name: 'end', mode: phase.mode, ...r })} />}
      {phase.name === 'end' && <End phase={phase} onAgain={() => setPhase({ name: 'ready', mode: phase.mode, n: 3 })} onPick={() => setPhase({ name: 'pick' })} />}
    </div>
  );
}

function Picker({ onStart }: { onStart(m: RushMode): void }) {
  const bests = useArena((s) => s.rush.bests);
  const runs = useArena((s) => s.rush.runs);
  const blurb: Record<RushMode, string> = {
    m3: 'Score as many as you can in three minutes.',
    m5: 'Five minutes: more room to find a rhythm.',
    survival: 'No clock. Three strikes and the run is over.',
  };
  return (
    <>
      <div className="mode-grid rush-modes">
        {RUSH_MODES.map((m) => (
          <Card key={m} className="mode-card" as="section" aria-label={RUSH_TITLE[m]}>
            <div className="mode-head"><h2>{RUSH_TITLE[m]}</h2></div>
            <p className="muted">{blurb[m]}</p>
            <div className="mode-stats"><Pill tone={bests[m] ? 'gold' : 'neutral'}>Best {bests[m]}</Pill></div>
            <button className="btn primary block" onClick={() => onStart(m)}>Start</button>
          </Card>
        ))}
      </div>
      <p className="notice" role="note">
        {`A wrong answer costs a strike in Survival (three and you are out) and ${RUSH_PENALTY_MS / 1000} seconds in the timed modes. Skipping counts as a wrong answer. Questions get harder as you go. Keys 1–4 answer.`}
      </p>
      {runs.length > 0 && (
        <p className="muted small">Recent: {runs.slice(-8).reverse().map((r) => `${RUSH_TITLE[r.mode]} ${r.score}`).join(' · ')}</p>
      )}
    </>
  );
}

function Ready({ n, onTick }: { n: number; onTick(): void }) {
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    sfx.play('tick');
    const id = setTimeout(() => tick.current(), 800);
    return () => clearTimeout(id);
  }, [n]);
  return (
    <div className="countdown3" role="status" aria-live="assertive">
      <div className="count-num" key={n}>{n}</div>
      <p className="muted">Get ready.</p>
    </div>
  );
}

function Play({ mode, onEnd }: { mode: RushMode; onEnd(r: { score: number; best: boolean; previous: number; wrong: QuickPuzzle[] }): void }) {
  const limit = RUSH_LIMIT_MS[mode];
  const [run, setRun] = useState<Run>(() => {
    const seed = randomSeed();
    return { seed, index: 0, score: 0, strikes: 0, seen: [], wrong: [], until: limit ? Date.now() + limit : null, settling: false };
  });
  const [puzzle, setPuzzle] = useState<QuickPuzzle | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const ended = useRef(false);
  const wrongRef = useRef<QuickPuzzle[]>([]);

  // Generate the item for the current index lazily (cheap, and never ahead of need).
  useEffect(() => {
    const p = rushItem(run.seed, run.index, run.seen);
    setPuzzle(p.kind === 'quick' ? p : null);
  }, [run.seed, run.index]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    const r = runRef.current;
    const res = arenaStore.getState().finishRush(mode, r.score);
    if (res.best && r.score > 0) {
      sfx.play('win');
      celebrate('win');
    } else sfx.play('lose');
    onEnd({ score: r.score, ...res, wrong: wrongRef.current });
  }, [mode, onEnd]);

  const onDone = (p: QuickPuzzle, o: PuzzleOutcome) => {
    if (ended.current || runRef.current.settling) return;
    const r = runRef.current;
    const ok = o.solved;
    const strikes = ok || limit ? r.strikes : r.strikes + 1;
    let until = r.until;
    if (!ok) {
      wrongRef.current = [...wrongRef.current, p];
      if (limit && until) {
        until -= RUSH_PENALTY_MS;
        setFlash(`−${RUSH_PENALTY_MS / 1000}s`);
      } else setFlash('Strike');
    } else setFlash(null);
    const nextRun: Run = { ...r, score: r.score + (ok ? 1 : 0), strikes, until, seen: [...r.seen, statementKey(p)], settling: true };
    runRef.current = nextRun;
    setRun(nextRun);
    const over = (!limit && strikes >= RUSH_STRIKES) || (until !== null && until <= Date.now());
    window.setTimeout(
      () => {
        if (over) {
          finish();
          return;
        }
        setFlash(null);
        setRun((cur) => {
          const n = { ...cur, index: cur.index + 1, settling: false };
          runRef.current = n;
          return n;
        });
      },
      ok ? 280 : 650,
    );
  };

  const header = (
    <div className="rush-bar">
      <Pill tone="primary" title="Score">Score <span className="tnum">{run.score}</span></Pill>
      {limit && run.until ? (
        <Countdown until={run.until} onDone={finish} />
      ) : (
        <span className="strikes" role="img" aria-label={`${run.strikes} of ${RUSH_STRIKES} strikes`}>
          {Array.from({ length: RUSH_STRIKES }, (_, i) => <span key={i} className={i < run.strikes ? 'x on' : 'x'}>✗</span>)}
        </span>
      )}
      {flash && <Pill tone="err" className="flash">{flash}</Pill>}
    </div>
  );

  if (!puzzle) return <div className="rush-wait muted">{header}</div>;
  return (
    <PuzzlePlayer
      key={`${run.seed}:${run.index}:${puzzle.id}`}
      puzzle={puzzle}
      compact
      explain={false}
      allow={{ hints: false, reveal: false, skip: true }}
      header={header}
      onDone={(o) => onDone(puzzle, o)}
    />
  );
}

function End({ phase, onAgain, onPick }: { phase: Extract<Phase, { name: 'end' }>; onAgain(): void; onPick(): void }) {
  const wrong = phase.wrong;
  return (
    <>
      <Card tone={phase.best && phase.score > 0 ? 'gold' : 'primary'} className="rush-end" aria-label="Run over">
        <div className="eyebrow">{RUSH_TITLE[phase.mode]}</div>
        <div className="daily-score tnum">{phase.score}</div>
        <p role="status">{phase.best && phase.score > 0 ? 'A new personal best.' : `Your best is ${Math.max(phase.previous, phase.score)}.`}</p>
        {phase.best && phase.previous > 0 && <p className="muted small">Previous best {phase.previous}.</p>}
        <div className="actions">
          <button className="btn primary big" autoFocus onClick={onAgain}>Play again</button>
          <button className="btn outline big" onClick={onPick}>Change mode</button>
          <a className="btn ghost big" href="#/arena">Back to the Arena</a>
        </div>
      </Card>
      {wrong.length > 0 && (
        <>
          <h2 className="section-title">Review what you missed</h2>
          <div className="study">
            {wrong.map((p, i) => (
              <Card key={i} as="article" className="study-item">
                <Markdown text={p.prompt} />
                {p.code && <div className="header-ro"><Lean code={p.code} /></div>}
                <ul className="why-list">
                  {p.options.map((o, j) => (
                    <li key={j} className={o.correct ? 'right' : ''}>
                      <strong>{o.correct ? '✓ ' : '✗ '}</strong><Markdown text={o.text} className="inline-md" /> <span className="muted small">{o.why}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
