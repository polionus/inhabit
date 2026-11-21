/**
 * Gallery exhibit 'rewrite-compute'. Two panels:
 *  - Rewrite: a goal and a rule; the engine runs `rewrite [rule]`; the matched and replaced subterms are marked
 *    (located in TS and confirmed against the engine's goal, see src/gallery/rewrite-compute.ts).
 *  - Compute: a closed expression reduced step by step; every step is an `rfl` equation the engine checks.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ExhibitProps } from '../types.ts';
import { data, engine } from '../../data.ts';
import { href } from '../../router.ts';
import { LeanInline } from '../../components/Markdown.tsx';
import {
  COMPUTE_PRESETS, DOUBLE_DEF, RW_PRESETS, checkSteps, reduce, rflCheck, runRewrite,
} from '../../../gallery/rewrite-compute.ts';
import { GoalCard, LeanMarked } from '../proof-replay/LeanMarked.tsx';
import { ExhibitIntro, TryThis, Zone, Verdict, TaughtIn } from '../kit.tsx';
import '../../styles/gallery-proof-replay.css';
import '../../styles/gallery-rewrite-compute.css';

const levelTitle = (id: string) => data.findLevel(id)?.level.title ?? id;
const LevelLink = ({ id }: { id: string }) => <a href={href.level(id)}>{levelTitle(id)}</a>;

export default function RewriteCompute(_props: ExhibitProps) {
  const [tab, setTab] = useState<'rw' | 'compute'>('rw');
  return (
    <div className="rc">
      <ExhibitIntro lead="Pick a goal and a rule, or an expression, and watch what changes.">
        <p>
          Two ways an equation gets used. <strong>Rewrite</strong> finds the left side of an equation in your goal and swaps in the right side.{' '}
          <strong>Compute</strong> unfolds definitions until only a value is left, which is why <code className="inline">rfl</code> can prove{' '}
          <code className="inline">double 3 = 6</code>.
        </p>
      </ExhibitIntro>
      <div className="rc-tabs" role="tablist" aria-label="Panel">
        <button role="tab" id="rc-tab-rw" aria-controls="rc-panel-rw" aria-selected={tab === 'rw'} className={`rc-tab${tab === 'rw' ? ' on' : ''}`} onClick={() => setTab('rw')}>Rewrite</button>
        <button role="tab" id="rc-tab-c" aria-controls="rc-panel-c" aria-selected={tab === 'compute'} className={`rc-tab${tab === 'compute' ? ' on' : ''}`} onClick={() => setTab('compute')}>Compute</button>
      </div>
      {tab === 'rw' ? <RewritePanel /> : <ComputePanel />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------

function RewritePanel() {
  const env = useMemo(() => data.fullEnv(), []);
  const [presetId, setPresetId] = useState(RW_PRESETS[0].id);
  const preset = RW_PRESETS.find((p) => p.id === presetId)!;
  const [goal, setGoal] = useState(preset.goal);
  const [rule, setRule] = useState(preset.rules[0]);
  const [draft, setDraft] = useState(preset.rules[0]);
  const [history, setHistory] = useState<string[]>([]);

  const run = useMemo(() => runRewrite(engine, env, preset.binders, goal, rule), [env, preset.binders, goal, rule]);

  const pick = (id: string) => {
    const p = RW_PRESETS.find((x) => x.id === id)!;
    setPresetId(id);
    setGoal(p.goal);
    setRule(p.rules[0]);
    setDraft(p.rules[0]);
    setHistory([]);
  };
  const apply = (r: string) => { setRule(r); setDraft(r); };
  const carryOn = () => {
    if (!run.after) return;
    setHistory([...history, rule]);
    setGoal(run.after);
  };
  const restart = () => { setGoal(preset.goal); setHistory([]); };

  const m = run.match;
  const beforeMarks = m ? m.before : run.fallback ? [run.fallback.before] : [];
  const afterMarks = m?.confirmed ? m.after : run.fallback ? [run.fallback.after] : [];
  const g0 = { hyps: run.hyps, target: run.before };
  const g1 = run.after ? { hyps: run.hyps, target: run.after } : null;
  const ruleName = rule.replace(/^←\s*/, '');

  const summary = run.ok
    ? `rewrite [${rule}] turns ${run.before} into ${run.after}.${m?.confirmed ? ` It matched ${m.instance}${m.before.length > 1 ? `, ${m.before.length} times` : ''}.` : ''}`
    : `rewrite [${rule}] fails: ${run.pattern ? `the pattern ${run.pattern} is not in the goal.` : 'see Lean’s message.'}`;

  return (
    <section className="rc-panel" id="rc-panel-rw" role="tabpanel" aria-labelledby="rc-tab-rw">
      <TryThis
        label="Try this goal"
        presets={RW_PRESETS.map((p) => ({ label: p.label, active: p.id === presetId, onPick: () => pick(p.id) }))}
      />
      {preset.note && <p className="rc-note small">{preset.note}</p>}

      <Zone kind="play" label="Choose the rule">
        <div className="rc-rules">
        <div className="rc-rule-row" role="group" aria-label="Rewrite rules">
          {preset.rules.map((r) => (
            <button key={r} className={`btn small${r === rule ? ' primary' : ' outline'}`} aria-pressed={r === rule} onClick={() => apply(r)}>
              <span className="rc-mono">{r}</span>
            </button>
          ))}
        </div>
        <form className="rc-own" onSubmit={(e) => { e.preventDefault(); apply(draft); }}>
          <label htmlFor="rc-rule-input" className="muted small">Or type one</label>
          <span className="rc-own-field">
            <span className="rc-mono muted" aria-hidden="true">rw [</span>
            <input id="rc-rule-input" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} autoComplete="off" placeholder="Nat.add_comm x y" />
            <span className="rc-mono muted" aria-hidden="true">]</span>
          </span>
          <button className="btn small" type="button" onClick={() => setDraft(draft.trim().startsWith('←') ? draft.replace(/^←\s*/, '') : '← ' + draft.trim())} aria-label="Flip the direction (←)">←</button>
          <button className="btn small primary" type="submit">Rewrite</button>
        </form>
        {run.ok && (
          <div className="rc-actions">
            <button className="btn small" onClick={carryOn}>Continue from the result</button>
            {history.length > 0 && <button className="btn small ghost" onClick={restart}>Start over</button>}
          </div>
        )}
        </div>
      </Zone>

      <Zone kind="lean" label="What Lean says">
        {run.ruleType && (
          <p className="rc-ruletype small">
            <span className="rc-mono">{ruleName}</span> : <LeanInline code={run.ruleType} />
            {rule.startsWith('←') && <span className="muted"> (used right to left)</span>}
          </p>
        )}
      <div className="rc-flow">
        <div className="rc-side">
          <div className="label">Goal{history.length ? ` (after ${history.map((h) => `rw [${h}]`).join(', ')})` : ''}</div>
          <GoalCard goal={g0} targetMarks={run.ok ? beforeMarks : []} targetMarkClass="gx-mark-old" label="Goal before the rewrite" />
        </div>
        <div className="rc-arrow" aria-hidden="true">
          <span className="rc-mono">rewrite [{rule}]</span>
          <svg viewBox="0 0 60 16" width="60" height="16"><path d="M2 8h50M46 3l7 5-7 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="rc-side" key={`${goal}|${rule}`}>
          {run.ok && g1 ? (
            <>
              <div className="label">Result</div>
              <GoalCard goal={g1} targetMarks={afterMarks} targetMarkClass="gx-mark-new" label="Goal after the rewrite" />
            </>
          ) : (
            <div className="err-card sev-error rc-err">
              <div className="err-title">Lean reports a problem</div>
              <pre className="raw">{run.error}</pre>
              {run.pattern && (
                <p className="small">
                  The rule’s left side, <LeanInline code={run.pattern} />, appears nowhere in the goal{run.pattern.includes('?') ? ' (the ?-names stand for any term)' : ''}.
                  {ruleName === 'h' && !rule.startsWith('←') && ' Try it backwards with ←.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      </Zone>

      {run.ok && (
        <Zone kind="explain" label="What matched" className="rc-explain">
          {m?.confirmed ? (
            <p className="small">
              Matched <LeanMarked code={m.instance} marks={[{ from: 0, to: m.instance.length }]} markClass="gx-mark-old" />
              {m.bindings.length > 0 && <> with {m.bindings.map(([v, t], i) => <span key={v}>{i > 0 && ', '}<code className="inline">{v} := {t}</code></span>)}</>}
              {m.before.length > 1 ? <>, and replaced all {m.before.length} occurrences at once.</> : '.'}
            </p>
          ) : (
            <p className="small muted">The highlight shows the text that changed: this match needed Lean to unfold a definition, which the exhibit doesn’t trace.</p>
          )}
          {run.closedByRfl && <p className="small">Plain <code className="inline">rw</code> would also try <code className="inline">rfl</code> afterwards and close this goal outright.</p>}
        </Zone>
      )}

      <p className="sr-only" aria-live="polite">{summary}</p>
      <TaughtIn links={[...new Set(['eq-04', 'eq-06', preset.level])].map((id) => ({ href: href.level(id), title: levelTitle(id) }))} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------

function useComputeEnv() {
  return useMemo(() => {
    const lvl = data.findLevel('nat-02')?.level;
    const def = lvl && lvl.kind === 'proof' ? `${lvl.header}\n${lvl.solutions[0]}` : DOUBLE_DEF;
    const ext = engine.extend(data.fullEnv(), def);
    return { env: ext.env, def, ok: ext.result.ok };
  }, []);
}

function Stepper({ value, range, onChange, label }: { value: number; range: [number, number, number]; onChange: (v: number) => void; label: string }) {
  return (
    <span className="rc-stepper" role="group" aria-label={label}>
      <button className="btn small icon" onClick={() => onChange(value - 1)} disabled={value <= range[0]} aria-label={`${label}: smaller`}>−</button>
      <span className="rc-mono rc-stepper-v" aria-live="polite">{value}</span>
      <button className="btn small icon" onClick={() => onChange(value + 1)} disabled={value >= range[1]} aria-label={`${label}: larger`}>+</button>
    </span>
  );
}

function ComputePanel() {
  const { env, def, ok: defOk } = useComputeEnv();
  const [presetId, setPresetId] = useState(COMPUTE_PRESETS[0].id);
  const preset = COMPUTE_PRESETS.find((p) => p.id === presetId)!;
  const [a, setA] = useState(preset.a[2]);
  const [b, setB] = useState(preset.b?.[2] ?? 0);
  const steps = useMemo(() => reduce(preset.make(a, b), preset.strategy), [preset, a, b]);
  const check = useMemo(() => checkSteps(engine, env, steps), [env, steps]);
  const [shown, setShown] = useState(steps.length);
  const [playing, setPlaying] = useState(false);
  const [guess, setGuess] = useState('');
  const [guessResult, setGuessResult] = useState<{ ok: boolean; message: string | null; for: string } | null>(null);

  useEffect(() => { setShown(steps.length); setPlaying(false); setGuessResult(null); }, [steps]);
  useEffect(() => {
    if (!playing) return;
    if (shown >= steps.length) { setPlaying(false); return; }
    const t = window.setTimeout(() => setShown((s) => s + 1), 900);
    return () => window.clearTimeout(t);
  }, [playing, shown, steps.length]);

  const pick = (id: string) => {
    const p = COMPUTE_PRESETS.find((x) => x.id === id)!;
    setPresetId(id);
    setA(p.a[2]);
    setB(p.b?.[2] ?? 0);
  };
  const start = steps[0].text;
  const value = steps[steps.length - 1].text;
  const all = check.stepOk.every(Boolean) && check.endOk;
  const addRules = useMemo(() => ['Nat.add_zero', 'Nat.add_succ'].map((n) => ({ n, t: engine.constant(env, n)?.type })).filter((x) => x.t), [env]);

  const replay = () => { setShown(1); setPlaying(true); };
  const doGuess = (e: FormEvent) => {
    e.preventDefault();
    setGuessResult({ ...rflCheck(engine, env, start, guess), for: guess.trim() });
  };

  return (
    <section className="rc-panel" id="rc-panel-c" role="tabpanel" aria-labelledby="rc-tab-c">
      <TryThis
        label="Try this expression"
        presets={COMPUTE_PRESETS.map((p) => ({ label: p.label, active: p.id === presetId, onPick: () => pick(p.id) }))}
      />

      <div className="rc-compute">
        <div className="rc-left">
        <Zone
          kind={preset.id === 'beta' ? 'explain' : 'lean'}
          label={preset.id === 'double' ? 'The definition' : preset.id === 'add' ? 'Addition recurses on its second argument' : 'Applying a function'}
          aside={preset.id === 'double' ? <>from <LevelLink id="nat-02" /></> : undefined}
          className="rc-def"
        >
          {preset.id === 'double' && (
            <>
              <LeanMarked code={def} block />
              {!defOk && <p className="tt-error small">The engine did not accept this definition.</p>}
            </>
          )}
          {preset.id === 'add' && (
            <>
              {addRules.map((r) => <p key={r.n} className="rc-ruletype small"><span className="rc-mono">{r.n}</span> : <LeanInline code={r.t!} /></p>)}
              <p className="small muted">Both hold by <code className="inline">rfl</code>: they are the two cases of <code className="inline">Nat.add</code>. A numeral like 3 is <code className="inline">Nat.succ 2</code> underneath.</p>
            </>
          )}
          {preset.id === 'beta' && (
            <>
              <p className="small">A <code className="inline">fun</code> applied to an argument reduces by putting the argument in for the variable (β-reduction). Then the arithmetic computes.</p>
            </>
          )}
        </Zone>
        <Zone kind="play" label="Change the numbers" className="rc-knobs">
          <Stepper value={a} range={preset.a} onChange={setA} label={preset.id === 'beta' ? 'argument' : 'first number'} />
          {preset.b && <Stepper value={b} range={preset.b} onChange={setB} label="second number" />}
        </Zone>
        </div>

        <Zone kind="lean" label="Step by step" className="rc-steps" aside={
          <span className="rc-actions">
            <button className="btn small" onClick={replay} disabled={playing}>Replay</button>
            <button className="btn small ghost" onClick={() => { setPlaying(false); setShown(Math.min(shown + 1, steps.length)); }} disabled={shown >= steps.length}>Next step</button>
          </span>
        }>
          <ol className="rc-steplist" aria-label={`Reduction of ${start}`}>
            {steps.slice(0, shown).map((s, i) => (
              <li key={`${start}-${i}`} className={`rc-step${i === shown - 1 ? ' latest' : ''}`}>
                <span className="rc-eq" aria-hidden="true">{i === 0 ? '' : '='}</span>
                <span className="rc-expr">
                  <LeanMarked
                    code={s.text}
                    marks={i === shown - 1 ? (s.result ? [s.result] : []) : s.redex ? [s.redex] : []}
                    markClass={i === shown - 1 ? 'gx-mark-new' : 'gx-mark-old'}
                  />
                </span>
                {i > 0 && (
                  <span className={`rc-ok ${check.stepOk[i] ? 'yes' : 'no'}`} title={check.stepOk[i] ? 'rfl proves this step (engine-checked)' : 'rfl does not prove this step'}>
                    {check.stepOk[i] ? 'rfl ✓' : 'rfl ✗'}
                  </span>
                )}
                {s.why && <span className="rc-why small">{s.why}</span>}
              </li>
            ))}
          </ol>
          {shown >= steps.length && (
            <Verdict tone={all ? 'ok' : 'no'}>
              {all ? (
                <>The engine checks <code className="inline">example : {start} = {value} := rfl</code>, and <code className="inline">#reduce {start}</code> prints <code className="inline">{check.reduced}</code>.</>
              ) : (
                <>Some step did not check. That shouldn’t happen; please report it.</>
              )}
            </Verdict>
          )}
        </Zone>
      </div>

      <Zone kind="play" label="Your turn" className="rc-guess">
      <form onSubmit={doGuess}>
        <label htmlFor="rc-guess-input" className="small">Your turn: what is <code className="inline">{start}</code> equal to by <code className="inline">rfl</code>? Any expression works, not only the value.</label>
        <span className="rc-own-field">
          <span className="rc-mono muted" aria-hidden="true">{start} =</span>
          <input id="rc-guess-input" value={guess} onChange={(e) => setGuess(e.target.value)} spellCheck={false} autoComplete="off" placeholder={steps[1]?.text ?? value} />
          <button className="btn small primary" type="submit">Check with rfl</button>
        </span>
        {guessResult && (
          guessResult.ok ? (
            <Verdict tone="ok">Yes: <code className="inline">rfl</code> proves <code className="inline">{start} = {guessResult.for}</code>. Both sides compute to the same value.</Verdict>
          ) : (
            <div className="err-card sev-error" role="status"><div className="err-title">Lean reports a problem</div><pre className="raw">{guessResult.message}</pre></div>
          )
        )}
      </form>
      </Zone>

      <p className="sr-only" aria-live="polite">{`${start} reduces to ${value} in ${steps.length - 1} steps. ${all ? 'Every step checked with rfl.' : ''}`}</p>
      <TaughtIn links={['nat-02', 'eq-01'].map((id) => ({ href: href.level(id), title: levelTitle(id) }))} />
    </section>
  );
}
