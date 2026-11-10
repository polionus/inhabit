import { useMemo, useState } from 'react';
import type { Goal } from '../../engine/types.ts';
import type { BodyDiagnostic } from '../lean/offsets.ts';
import { explain } from '../lean/explain.ts';
import { Lean, LeanInline } from './Markdown.tsx';

function GoalView({ goal, index, total, onInsert }: { goal: Goal; index: number; total: number; onInsert?: (name: string) => void }) {
  return (
    <div className="goal" role="group" aria-label={total > 1 ? `Goal ${index + 1} of ${total}` : 'Goal'}>
      {goal.caseName && <div className="case">case {goal.caseName}</div>}
      {goal.hyps.map((h, i) => (
        <div className={`hyp ${h.isProof ? 'proof' : 'data'}`} key={i}>
          <span className="hyp-names">
            {h.names.map((n, j) =>
              onInsert ? (
                <button key={j} className="hyp-name" title={`Insert ${n}`} onClick={() => onInsert(n)}>{n}</button>
              ) : (
                <span key={j} className="hyp-name static">{n}</span>
              ),
            )}
          </span>
          <span className="colon"> : </span>
          <LeanInline code={h.type + (h.value ? ` := ${h.value}` : '')} />
        </div>
      ))}
      <div className="target">
        <span className="turnstile">⊢</span> <LeanInline code={goal.target} />
      </div>
    </div>
  );
}

export function Goals({ goals, onInsert, label }: { goals: Goal[]; onInsert?: (n: string) => void; label?: string }) {
  return (
    <div className="goals">
      {label && <div className="label">{label}</div>}
      {goals.length > 1 && <div className="goal-count">{goals.length} goals</div>}
      {goals.map((g, i) => (
        <GoalView key={i} goal={g} index={i} total={goals.length} onInsert={onInsert} />
      ))}
    </div>
  );
}

export function DiagnosticItem({ d, defaultOpen = false }: { d: BodyDiagnostic | (import('../../engine/types.ts').Diagnostic); defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ex = useMemo(() => explain(d), [d]);
  const where = 'inBody' in d && !d.inBody ? ' (in the statement)' : '';
  return (
    <li className={`diag diag-${d.severity}`}>
      <div className="diag-head">
        <span className="sev">{d.severity === 'error' ? 'Error' : d.severity === 'warning' ? 'Warning' : 'Output'}{where}</span>
      </div>
      <pre className="raw">{d.message}</pre>
      {d.code !== 'command-output' && (
        <>
          <button className="linkish" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide explanation' : 'What does this mean?'}
          </button>
          {open && (
            <div className="explain">
              <div className="label">What this means</div>
              <p>{ex.what}</p>
              <div className="label">What to try</div>
              <ul>{ex.tryThis.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t.replace(/`([^`]+)`/g, '<code class="inline">$1</code>') }} />)}</ul>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export interface InfoviewProps {
  goals: Goal[] | null;
  /** Fallback goals (e.g. from an unsolved-goals diagnostic) when nothing is at the cursor. */
  fallbackGoals?: Goal[] | null;
  diagnostics: BodyDiagnostic[];
  complete: boolean;
  pending?: boolean;
  onInsert?: (n: string) => void;
  /** Label for the complete state. */
  completeText?: string;
  emptyHint?: string;
}

export function Infoview({ goals, fallbackGoals, diagnostics, complete, pending, onInsert, completeText = 'No goals. The proof is complete.', emptyHint = 'Click inside the proof to see the goals at that point.' }: InfoviewProps) {
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const shown = goals && goals.length ? goals : null;
  const fb = !shown && fallbackGoals?.length ? fallbackGoals : null;
  const summary = complete
    ? 'Proof complete'
    : errors.length
      ? `${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`
      : shown
        ? `${shown.length} ${shown.length === 1 ? 'goal' : 'goals'}`
        : 'No goal at the cursor';
  return (
    <section className="infoview" aria-label="Infoview" aria-busy={pending}>
      <div className="sr-only" role="status" aria-live="polite">{summary}</div>
      <div className="info-body">
        {complete ? (
          <div className="done-state"><span className="check" aria-hidden="true">✓</span> {completeText}</div>
        ) : shown ? (
          <Goals goals={shown} onInsert={onInsert} />
        ) : goals && goals.length === 0 && !errors.length ? (
          <div className="done-state quiet"><span className="check" aria-hidden="true">✓</span> No goals here.</div>
        ) : fb ? (
          <Goals goals={fb} label="Still to prove" />
        ) : (
          !diagnostics.length && <p className="muted">{emptyHint}</p>
        )}
        {diagnostics.length > 0 && (
          <ul className="diags" aria-label="Messages">
            {diagnostics.map((d, i) => (
              <DiagnosticItem key={`${d.code}-${d.from}-${i}`} d={d} defaultOpen={false} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export { Lean };
