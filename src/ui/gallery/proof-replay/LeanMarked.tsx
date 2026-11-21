/** Lean text with highlighted spans (and `?_` holes drawn as holes), plus an Infoview-style goal card with "what changed" marks. */
import { useMemo } from 'react';
import type { Goal } from '../../../engine/types.ts';
import { highlightHtml } from '../../lean/highlightCore.ts';
import { LeanInline } from '../../components/Markdown.tsx';
import type { GoalDiff } from '../../../gallery/proof-replay.ts';

export interface Span { from: number; to: number }

const holeHtml = (s: string) => s.split('?_').map(highlightHtml).join('<span class="gx-hole" title="a hole: still to be built">?_</span>');

/** Inline Lean with `marks` wrapped in <mark>. Marks must not overlap. */
export function LeanMarked({ code, marks = [], markClass = 'gx-mark', holes = false, block = false }: { code: string; marks?: Span[]; markClass?: string; holes?: boolean; block?: boolean }) {
  const html = useMemo(() => {
    const hl = holes ? holeHtml : highlightHtml;
    const ms = [...marks].filter((m) => m.to > m.from).sort((a, b) => a.from - b.from);
    let out = '';
    let pos = 0;
    for (const m of ms) {
      if (m.from < pos) continue;
      out += hl(code.slice(pos, m.from));
      out += `<mark class="${markClass}">${hl(code.slice(m.from, m.to))}</mark>`;
      pos = m.to;
    }
    return out + hl(code.slice(pos));
  }, [code, marks, markClass, holes]);
  return block ? <pre className="code gx-code"><code dangerouslySetInnerHTML={{ __html: html }} /></pre> : <code className="inline" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** One goal, rendered like the Infoview (same classes), with new hypotheses and a changed target marked. */
export function GoalCard({ goal, diff, gone = [], targetMarks, targetMarkClass, label }: {
  goal: Goal;
  diff?: GoalDiff;
  /** Names of hypotheses to show as consumed (struck through). */
  gone?: string[];
  /** Spans to mark inside the target (instead of marking the whole target as changed). */
  targetMarks?: Span[];
  targetMarkClass?: string;
  label?: string;
}) {
  const changed = !!diff?.targetChanged && !diff.untouched;
  return (
    <div className={`goal gx-goal${diff?.untouched ? ' gx-untouched' : ''}`} role="group" aria-label={label ?? 'Goal'}>
      {goal.caseName && <div className="case">case {goal.caseName}</div>}
      {goal.hyps.map((h, i) => {
        const isNew = diff?.hyps[i] === 'new' && !diff.untouched;
        const isGone = h.names.every((n) => gone.includes(n));
        return (
          <div className={`hyp ${h.isProof ? 'proof' : 'data'}${isNew ? ' gx-new' : ''}${isGone ? ' gx-gone' : ''}`} key={i}>
            <span className="hyp-names">
              {h.names.map((n, j) => <span key={j} className="hyp-name static">{n}</span>)}
            </span>
            <span className="colon"> : </span>
            <LeanInline code={h.type + (h.value ? ` := ${h.value}` : '')} />
            {isNew && <span className="gx-tag">new</span>}
            {isGone && <span className="gx-tag gone">used up</span>}
          </div>
        );
      })}
      <div className={`target${changed ? ' gx-changed' : ''}`}>
        <span className="turnstile">⊢</span>{' '}
        {targetMarks ? <LeanMarked code={goal.target} marks={targetMarks} markClass={targetMarkClass} /> : <LeanInline code={goal.target} />}
        {changed && <span className="gx-tag">changed</span>}
      </div>
    </div>
  );
}
