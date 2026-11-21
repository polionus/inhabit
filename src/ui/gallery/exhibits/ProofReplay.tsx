/**
 * Gallery exhibit 'proof-replay': step through a tactic proof line by line. For each line: the goals before and
 * after it (what changed is marked) and the proof term built so far, with `?_` for the holes still open.
 * All goals and terms come from the engine (see src/gallery/proof-replay.ts for how partial terms are made).
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { ExhibitProps } from '../types.ts';
import { data, engine } from '../../data.ts';
import { href } from '../../router.ts';
import { LeanInline } from '../../components/Markdown.tsx';
import { PROOF_PRESETS, buildReplay, diffGoals, diffSpan, referenceBody, removedHyps } from '../../../gallery/proof-replay.ts';
import type { Goal } from '../../../engine/types.ts';
import { GoalCard, LeanMarked } from '../proof-replay/LeanMarked.tsx';
import '../../styles/gallery-proof-replay.css';

const SPEEDS = [
  { label: 'Slow', ms: 2400 },
  { label: 'Normal', ms: 1400 },
  { label: 'Fast', ms: 700 },
];

interface Source { level: string; header: string; body: string }

function presetSource(levelId: string): Source | null {
  const f = data.findLevel(levelId);
  if (!f || !('header' in f.level)) return null;
  const body = referenceBody(f.level as never);
  return body ? { level: levelId, header: f.level.header, body } : null;
}

const levelTitle = (id: string) => data.findLevel(id)?.level.title ?? id;

/** `other` is the state on the other side of the line: the goals before it (for 'after'), or after it (for 'before'). */
function GoalList({ goals, other, side }: { goals: Goal[] | null; other?: Goal[] | null; side: 'before' | 'after' }) {
  if (!goals) return <p className="muted small">Not available.</p>;
  if (goals.length === 0) return <p className="pr-done">No goals. The proof is finished.</p>;
  const diffs = side === 'after' && other ? diffGoals(other, goals) : null;
  const gone = side === 'before' && other ? removedHyps(goals, other) : [];
  return (
    <div className="goals">
      {goals.length > 1 && <div className="goal-count">{goals.length} goals</div>}
      {goals.map((g, i) => (
        <GoalCard key={i} goal={g} diff={diffs?.[i]} gone={i === 0 ? gone : []} label={goals.length > 1 ? `Goal ${i + 1} of ${goals.length}` : 'Goal'} />
      ))}
    </div>
  );
}

export default function ProofReplay(_props: ExhibitProps) {
  const env = useMemo(() => data.fullEnv(), []);
  const [presetId, setPresetId] = useState(PROOF_PRESETS[0].level);
  const [own, setOwn] = useState<Source | null>(null);
  const preset = useMemo(() => presetSource(presetId), [presetId]);
  const src = own ?? preset;
  const deferredBody = useDeferredValue(src?.body ?? '');
  const replay = useMemo(() => (src ? buildReplay(engine, env, src.header, deferredBody) : null), [src?.header, deferredBody, env]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = replay?.lines.length ?? 0;
  const [step, setStep] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<number | undefined>(undefined);

  const maxStep = replay ? Math.min(n, replay.reachable) : 0;
  const cur = Math.min(step, maxStep);

  useEffect(() => {
    if (!playing) return;
    if (cur >= maxStep) { setPlaying(false); return; }
    timer.current = window.setTimeout(() => setStep((s) => Math.min(s + 1, maxStep)), SPEEDS[speed].ms);
    return () => window.clearTimeout(timer.current);
  }, [playing, cur, maxStep, speed]);

  const choose = (level: string) => {
    setOwn(null);
    setPresetId(level);
    setStep(0);
    setPlaying(true);
  };
  const play = () => {
    if (playing) return setPlaying(false);
    if (cur >= maxStep) setStep(0);
    setPlaying(true);
  };
  const go = (k: number) => { setPlaying(false); setStep(Math.max(0, Math.min(maxStep, k))); };

  if (!src || !replay) return <p className="muted">This exhibit could not load its proofs.</p>;

  const line = cur > 0 ? replay.lines[cur - 1] : null;
  const before = cur > 0 ? replay.cuts[cur - 1] : null;
  const after = replay.cuts[cur];
  const lineFailed = !!line && cur === replay.reachable;
  const prevTerm = cur > 0 ? replay.cuts[cur - 1].term : null;
  const term = after.term;
  const [tPre, tMid, tPost] = term && prevTerm ? diffSpan(prevTerm, term) : [term ?? '', '', ''];
  const termMarks = tMid ? [{ from: tPre.length, to: tPre.length + tMid.length }] : [];
  const holes = term ? term.split('?_').length - 1 : 0;
  const watch = own ? null : PROOF_PRESETS.find((p) => p.level === presetId)?.watch;
  const links = [...new Set([src.level, 'props-03', 'logic-02'])].filter((id) => data.findLevel(id)).slice(0, 3);

  const summary = lineFailed
    ? `Line ${cur}: ${line!.text}. Lean reports an error here.`
    : `${line ? `Line ${cur} of ${n}: ${line.text}.` : 'Before the first line.'} ${
        after.goals ? (after.goals.length === 0 ? 'No goals left.' : `${after.goals.length} goal${after.goals.length > 1 ? 's' : ''} open, first target ${after.goals[0].target}.`) : ''
      } ${term ? `Term so far: ${term}.` : ''}`;

  return (
    <div className="pr">
      <p className="pr-frame">
        A tactic proof is a list of instructions for building a term, and the proposition is that term's type. Step through a proof
        below to see the goal before and after each line, and under it the term the lines have built so far, with <code className="inline">?_</code> marking
        each hole still to fill. Press Play, or click any line to jump there.
      </p>

      <div className="pr-presets" role="group" aria-label="Try this">
        <span className="pr-label">Try this</span>
        {PROOF_PRESETS.map((p) => (
          <button key={p.level} className={`btn small${!own && presetId === p.level ? ' primary' : ''}`} aria-pressed={!own && presetId === p.level} onClick={() => choose(p.level)}>
            {p.label}
          </button>
        ))}
        <button className={`btn small${own ? ' primary' : ' outline'}`} aria-pressed={!!own} onClick={() => { setPlaying(false); setOwn({ ...src, body: src.body }); }}>
          Edit this proof
        </button>
      </div>

      <div className="pr-main">
        <section className="card pr-proof" aria-label="The proof">
          <div className="pr-header"><LeanInline code={src.header} /></div>
          {own ? (
            <label className="pr-edit">
              <span className="sr-only">Proof body</span>
              <textarea
                value={own.body}
                spellCheck={false}
                rows={Math.max(4, own.body.split('\n').length + 1)}
                onChange={(e) => { setOwn({ ...own, body: e.target.value }); setStep(Number.MAX_SAFE_INTEGER); }}
                aria-describedby="pr-edit-note"
              />
              <span id="pr-edit-note" className="muted small">
                Edit the tactic lines (two spaces of indent). The replay follows as you type.{' '}
                <button className="linkish" onClick={() => setOwn(null)}>Back to the preset</button>
              </span>
            </label>
          ) : null}
          <ol className="pr-lines" aria-label="Proof lines">
            <li>
              <button className={`pr-line pr-start${cur === 0 ? ' current' : ''}`} aria-current={cur === 0 ? 'step' : undefined} onClick={() => go(0)}>
                <span className="pr-num">0</span><span className="muted">start: just the statement</span>
              </button>
            </li>
            {replay.lines.map((l) => {
              const unreached = l.index > replay.reachable;
              const failed = l.index === replay.reachable;
              return (
                <li key={l.index}>
                  <button
                    className={`pr-line${l.index === cur ? ' current' : ''}${l.index < cur ? ' done' : ''}${failed ? ' failed' : ''}`}
                    aria-current={l.index === cur ? 'step' : undefined}
                    disabled={unreached}
                    onClick={() => go(l.index)}
                    style={{ paddingLeft: `calc(.5rem + ${Math.max(0, l.indent - 2) * 0.5}ch)` }}
                  >
                    <span className="pr-num">{l.index}</span>
                    <LeanInline code={l.text} />
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="pr-controls" role="group" aria-label="Replay controls">
            <button className="btn small ghost" onClick={() => go(0)} disabled={cur === 0} aria-label="Back to the start">⏮</button>
            <button className="btn small" onClick={() => go(cur - 1)} disabled={cur === 0}>← Prev</button>
            <button className="btn small primary pr-play" onClick={play} disabled={maxStep === 0}>{playing ? 'Pause' : cur >= maxStep ? 'Replay' : 'Play'}</button>
            <button className="btn small" onClick={() => go(cur + 1)} disabled={cur >= maxStep}>Next →</button>
            <label className="pr-speed">
              <span className="muted small">Speed</span>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                {SPEEDS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
              </select>
            </label>
          </div>
          {watch && <p className="pr-watch small">{watch}</p>}
        </section>

        <section className="pr-state" aria-label="Proof state">
          <div className="pr-goalpair">
            <div className="pr-col">
              <div className="label">{line ? 'Before this line' : 'The goal'}</div>
              <GoalList goals={line ? before!.goals : after.goals} other={line && !lineFailed ? after.goals : null} side="before" />
            </div>
            {line && (
              <div className="pr-col" key={`a${cur}`}>
                <div className="label">After <code className="inline">{line.text.length > 28 ? line.text.slice(0, 26) + '…' : line.text}</code></div>
                {lineFailed ? (
                  <div className="err-card sev-error"><div className="err-title">Lean reports a problem</div><pre className="raw">{replay.fullError?.message}</pre></div>
                ) : (
                  <GoalList goals={after.goals} other={before!.goals} side="after" />
                )}
              </div>
            )}
          </div>

          <div className="card pr-term" aria-label="Proof term so far">
            <div className="pr-term-head">
              <span className="label">The term so far</span>
              {term && <span className="muted small">{holes === 0 ? 'no holes: a complete proof term' : `${holes} hole${holes > 1 ? 's' : ''}, one per open goal`}</span>}
            </div>
            {term ? (
              <div key={`t${cur}`} className="pr-term-code"><LeanMarked code={term} marks={termMarks} holes block /></div>
            ) : (
              <p className="muted small">{lineFailed ? 'No term: this line does not check.' : 'Not available.'}</p>
            )}
            <p className="muted small pr-term-note">
              {cur === 0
                ? 'Before any tactic runs, the whole proof is one hole whose type is the statement.'
                : 'The highlight is what this line added. Lean’s kernel never sees the tactics, only this term.'}
            </p>
          </div>
        </section>
      </div>

      <p className="sr-only" aria-live="polite">{summary}</p>

      <p className="pr-links small">
        Where this is taught:{' '}
        {links.map((id, i) => (
          <span key={id}>{i > 0 && ' · '}<a href={href.level(id)}>{levelTitle(id)}</a></span>
        ))}
      </p>
    </div>
  );
}
