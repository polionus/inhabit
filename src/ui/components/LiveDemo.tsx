import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../../engine/index.ts'; // always the real engine, never fixtures
import type { Goal } from '../../engine/types.ts';
import type { HomeDemo } from '../../content/types.ts';
import { highlightHtml } from '../lean/highlight.ts';
import { demoStates, describeGoals } from '../demoSteps.ts';
import { Goals } from './Infoview.tsx';
import { InlineMd, Markdown } from './Markdown.tsx';

type Computed = { states: Goal[][] | null };

const cache = new Map<string, Computed>();

/** Run the real engine once per demo source; any failure degrades to "no goal states". */
function compute(demo: HomeDemo): Computed {
  const hit = cache.get(demo.code);
  if (hit) return hit;
  let states: Goal[][] | null = null;
  try {
    const r = engine.check(engine.baseEnv(), demo.code);
    if (r.complete) {
      states = demoStates(demo.code, demo.steps, r.steps);
      if (states && states.length !== demo.steps.length + 1) states = null;
    }
  } catch {
    states = null;
  }
  const out = { states };
  cache.set(demo.code, out);
  return out;
}

export function LiveDemo({ demo, cta }: { demo: HomeDemo; cta: React.ReactNode }) {
  const [computed, setComputed] = useState<Computed | null>(() => cache.get(demo.code) ?? null);
  const [i, setI] = useState(0);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (computed) return;
    const t = window.setTimeout(() => setComputed(compute(demo)), 0);
    return () => window.clearTimeout(t);
  }, [demo, computed]);

  const lines = useMemo(() => demo.code.split('\n'), [demo.code]);
  const htmlLines = useMemo(() => lines.map((l) => highlightHtml(l) || '&nbsp;'), [lines]);
  const noteLines = demo.steps.map((s) => s.line);
  const n = demo.steps.length;
  const step = Math.min(i, n);
  const curLine = step === 0 ? 1 : noteLines[step - 1];
  const states = computed?.states ?? null;
  const goals = states ? states[step] : null;
  const last = step === n;

  // Which step a click on a given line jumps to: the latest note at or before that line.
  const stepForClick = (line: number): number => {
    let k = 0;
    noteLines.forEach((nl, idx) => {
      if (nl <= line) k = idx + 1;
    });
    return k;
  };

  const live = !computed ? '' : goals ? describeGoals(goals) : `Step ${step} of ${n}.`;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('a')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setI((x) => Math.min(n, x + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setI((x) => Math.max(0, x - 1));
    }
  };

  return (
    <section className="demo" aria-labelledby="demo-h" ref={root} onKeyDown={onKey}>
      <div className="demo-head">
        <h2 id="demo-h">{demo.heading}</h2>
        <div className="demo-intro"><Markdown text={demo.intro} /></div>
      </div>
      <p className="demo-english"><span className="label">In English</span><span>{demo.english}</span></p>
      <div className="demo-code" role="group" aria-label="Lean code. Click a line to jump to that step.">
        <div className="demo-code-scroll">
          {lines.map((_, k) => {
            const ln = k + 1;
            return (
              <div
                key={k}
                className={`dl${ln === curLine ? ' cur' : ''}${noteLines.includes(ln) ? ' tac' : ''}`}
                aria-current={ln === curLine ? 'step' : undefined}
                onClick={() => setI(stepForClick(ln))}
              >
                <span className="dl-no" aria-hidden="true">{ln}</span>
                <span className="dl-txt" dangerouslySetInnerHTML={{ __html: htmlLines[k] }} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="demo-nav">
        <button className="btn" onClick={() => setI(Math.max(0, step - 1))} disabled={step === 0}>Back</button>
        <span className="demo-count" aria-hidden="true">{step} / {n}</span>
        {last ? (
          <button className="btn" onClick={() => setI(0)}>Replay</button>
        ) : (
          <button className="btn primary" onClick={() => setI(step + 1)}>Next step</button>
        )}
      </div>
      <div className="demo-state" aria-busy={!computed}>
        <div className="sr-only" role="status" aria-live="polite">{live}</div>
        <div className="demo-note" key={`n${step}`}>
          {step === 0 ? (
            <p className="muted">{states ? 'This is the goal Lean starts with. Step through to watch it change.' : 'Step through the proof, one line at a time.'}</p>
          ) : (
            <p><InlineMd text={demo.steps[step - 1].note} /></p>
          )}
        </div>
        {states && goals ? (
          <div className="demo-fade" key={step}>
            {goals.length === 0 ? (
              <div className="done-state"><span className="check" aria-hidden="true">✓</span> No goals. The proof is complete.</div>
            ) : (
              <Goals goals={goals} />
            )}
          </div>
        ) : !computed ? (
          <div className="demo-ph" aria-hidden="true" />
        ) : null}
      </div>
      {last && (
        <div className="demo-closing">
          <Markdown text={demo.closing} />
          {cta}
        </div>
      )}
    </section>
  );
}
