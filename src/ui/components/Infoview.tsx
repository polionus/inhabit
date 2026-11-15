import { useMemo, useState } from 'react';
import type { Diagnostic, Goal } from '../../engine/types.ts';
import type { BodyDiagnostic } from '../lean/offsets.ts';
import { explain } from '../lean/explain.ts';
import { Lean, LeanInline } from './Markdown.tsx';
import { Icon } from './icons.tsx';

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

/** Lean's own output for `#check` / `#eval` / `#print` commands. */
export function CommandOutputs({ outputs, label = "Lean's output" }: { outputs: { message: string }[]; label?: string }) {
  if (!outputs.length) return null;
  return (
    <section className="outputs" aria-label="Command output">
      <div className="label">{label}</div>
      {outputs.map((o, i) => <pre key={i} className="raw out">{o.message}</pre>)}
    </section>
  );
}

const withCode = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/`([^`]+)`/g, '<code class="inline">$1</code>');

function Explanation({ d, skipDidYouMean = false }: { d: Diagnostic; skipDidYouMean?: boolean }) {
  const ex = useMemo(() => explain(d), [d]);
  const tries = skipDidYouMean ? ex.tryThis.filter((t) => !t.startsWith('Did you mean')) : ex.tryThis;
  return (
    <div className="explain">
      <div className="label">What this means</div>
      <p dangerouslySetInnerHTML={{ __html: withCode(ex.what) }} />
      {tries.length > 0 && (
        <>
          <div className="label">What to try</div>
          <ul>{tries.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: withCode(t) }} />)}</ul>
        </>
      )}
    </div>
  );
}

const sevLabel = (d: Diagnostic) => (d.severity === 'error' ? 'Lean reports a problem' : d.severity === 'warning' ? 'A note from Lean' : 'Lean says');

export function DiagnosticItem({ d, defaultOpen = false, friendlySorry = false }: { d: BodyDiagnostic | Diagnostic; defaultOpen?: boolean; friendlySorry?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const where = 'inBody' in d && !d.inBody && d.code !== 'unsolved-goals' && d.code !== 'sorry' ? ' (in the statement)' : '';
  if (friendlySorry && d.code === 'sorry') {
    return (
      <li className="diag diag-todo">
        <div className="diag-head"><span className="sev">To do</span></div>
        <p>Not finished yet. This still contains <code className="inline">sorry</code>, Lean's placeholder for "to be done".</p>
        <pre className="raw small">{d.message}</pre>
        <button className="linkish" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide explanation' : 'What does this mean?'}
        </button>
        {open && <Explanation d={d} />}
      </li>
    );
  }
  return (
    <li className={`diag diag-${d.severity}`}>
      <div className="diag-head">
        <span className="sev">{sevLabel(d)}{where}</span>
      </div>
      <pre className="raw">{d.message}</pre>
      {d.code !== 'command-output' && (
        <>
          <button className="linkish" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide explanation' : 'What does this mean?'}
          </button>
          {open && <Explanation d={d} />}
        </>
      )}
    </li>
  );
}

/** The earliest error, in full: Lean's message, the explanation, a suggestion, and the goal where it happened. */
function FirstError({ d, goalHere, onReplace }: { d: BodyDiagnostic; goalHere: Goal[] | null; onReplace?: InfoviewProps['onReplace'] }) {
  const where = !d.inBody && d.code !== 'unsolved-goals' ? ' (in the statement)' : '';
  const suggestions = d.data?.suggestions?.slice(0, 3) ?? [];
  const canReplace = !!onReplace && d.inBody && d.bTo > d.bFrom && (d.code === 'unknown-identifier' || d.code === 'unknown-tactic');
  return (
    <div className={`err-card sev-${d.severity}`} role="group" aria-label="First message from Lean">
      <div className="err-title">{sevLabel(d)}{where}</div>
      <pre className="raw">{d.message}</pre>
      {suggestions.length > 0 && (
        <p className="err-suggest">
          Did you mean{' '}
          {suggestions.map((sg, i) => (
            <span key={sg}>
              {i > 0 && (i === suggestions.length - 1 ? ' or ' : ', ')}
              {canReplace ? (
                <button type="button" className="suggest-btn" title={`Replace with ${sg}`} onClick={() => onReplace!(d.bFrom, d.bTo, sg)}>{sg}</button>
              ) : (
                <code className="inline">{sg}</code>
              )}
            </span>
          ))}
          ?
        </p>
      )}
      <Explanation d={d} skipDidYouMean={suggestions.length > 0} />
      {goalHere && goalHere.length > 0 && (
        <div className="err-goal">
          <div className="label">The goal where this happened</div>
          <Goals goals={goalHere} />
        </div>
      )}
    </div>
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
  /** Replace a range of the body (body coordinates), e.g. to apply a "did you mean". */
  onReplace?: (from: number, to: number, text: string) => void;
  /** The proof state where the earliest error starts, when known. */
  errorGoals?: Goal[] | null;
  /** The declaration still contains `sorry` (also detected from a `sorry` diagnostic). */
  sorryLeft?: boolean;
  /** Label for the complete state. */
  completeText?: string;
  emptyHint?: string;
  /** Command output (#check etc.) relevant to the cursor, shown labelled as Lean's output. */
  outputs?: { message: string }[];
  /** Render the `sorry` warning as a calm "to do" note (level play). */
  friendlySorry?: boolean;
}

const sameGoals = (a: Goal[] | null | undefined, b: Goal[] | null | undefined) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

export function Infoview({ goals, fallbackGoals, diagnostics, complete, pending, onInsert, onReplace, errorGoals, sorryLeft = false, completeText = 'No goals. The proof is complete.', emptyHint = 'Put the cursor on a line to see the goal there.', outputs = [], friendlySorry = false }: InfoviewProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const errors = diagnostics.filter((d) => d.severity === 'error').sort((a, b) => a.from - b.from);
  const others = diagnostics.filter((d) => d.severity !== 'error');
  const hasSorry = sorryLeft || diagnostics.some((d) => d.code === 'sorry');
  const unfinished = errors.length > 0 || hasSorry;
  const isComplete = complete && !unfinished;
  const shown = goals && goals.length ? goals : null;
  const fb = !shown && fallbackGoals?.length ? fallbackGoals : null;
  const first = errors[0] ?? null;
  const goalHere = first ? (first.data?.goals?.length ? first.data.goals : errorGoals ?? null) : null;
  const showGoalHere = goalHere && !sameGoals(goalHere, shown) && !sameGoals(goalHere, fb) ? goalHere : null;
  // after a syntax error the later syntax errors are usually echoes of the first
  const rest = [...errors.slice(1), ...(first ? others : [])];
  const inline = first ? [] : others;
  const summary = isComplete
    ? 'Proof complete'
    : errors.length
      ? `${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`
      : shown
        ? `${shown.length} ${shown.length === 1 ? 'goal' : 'goals'}`
        : 'No goal at the cursor';
  return (
    <section className="infoview" aria-label="Infoview" aria-busy={pending}>
      <div className="info-head">
        <span className="eyebrow"><span className="turnstile" aria-hidden="true">⊢</span> Goals</span>
        <span className={`pill info-status ${isComplete ? 'pill-ok' : errors.length ? 'pill-err' : shown ? 'pill-primary' : ''} ${pending ? 'pending' : ''}`} aria-hidden="true">{summary}</span>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{summary}</div>
      <div className="info-body">
        {isComplete ? (
          <div className="done-state"><span className="check" aria-hidden="true"><Icon name="check" size={16} strokeWidth={3.5} /></span> {completeText}</div>
        ) : shown ? (
          <Goals goals={shown} onInsert={onInsert} />
        ) : goals && goals.length === 0 ? (
          <p className="info-note">{hasSorry ? 'A sorry closes the goal for now. Put the cursor on an earlier line to see what is left.' : 'No goals are open at this line.'}</p>
        ) : fb ? (
          <Goals goals={fb} label="Still to prove" />
        ) : (
          !outputs.length && <p className="info-note">{emptyHint}</p>
        )}
        <CommandOutputs outputs={outputs} />
        {first && <FirstError d={first} goalHere={showGoalHere} onReplace={onReplace} />}
        {inline.length > 0 && (
          <ul className="diags" aria-label="Messages">
            {inline.map((d, i) => (
              <DiagnosticItem key={`${d.code}-${d.from}-${i}`} d={d} defaultOpen={false} friendlySorry={friendlySorry} />
            ))}
          </ul>
        )}
        {rest.length > 0 && (
          <div className="diags-more">
            <button type="button" className="linkish" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
              {moreOpen ? 'Hide the other messages' : `${rest.length} more ${rest.length === 1 ? 'message' : 'messages'}`}
            </button>
            {moreOpen && (
              <ul className="diags" aria-label="More messages">
                {rest.map((d, i) => (
                  <DiagnosticItem key={`${d.code}-${d.from}-${i}`} d={d} defaultOpen={false} friendlySorry={friendlySorry} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export { Lean };
