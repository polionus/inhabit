/** Pure helpers for the Home page's live demo: tie the copywriter's per-line notes to engine tactic steps. */
import type { Goal } from '../engine/types.ts';

export interface RangeLike {
  from: number;
}

/** 1-based line number containing `offset` in `code`. */
export function lineOfOffset(code: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, code.length);
  for (let i = 0; i < end; i++) if (code.charCodeAt(i) === 10) line++;
  return line;
}

/** Index of the engine step whose range starts on 1-based `line` (earliest such step), or -1. */
export function stepForLine(code: string, steps: RangeLike[], line: number): number {
  let best = -1;
  steps.forEach((s, i) => {
    if (lineOfOffset(code, s.from) !== line) return;
    if (best < 0 || s.from < steps[best].from) best = i;
  });
  return best;
}

/** For each note, the index of its engine step; `null` if any note has no step on its line. */
export function mapNotesToSteps(code: string, notes: { line: number }[], steps: RangeLike[]): number[] | null {
  const out: number[] = [];
  for (const n of notes) {
    const i = stepForLine(code, steps, n.line);
    if (i < 0) return null;
    out.push(i);
  }
  return out;
}

/**
 * Proof states for the demo: state 0 is the goal before any tactic, state k (1-based) is the
 * state after note k's step. `null` when the mapping is impossible.
 */
export function demoStates(
  code: string,
  notes: { line: number }[],
  steps: (RangeLike & { before: Goal[]; after: Goal[] })[],
): Goal[][] | null {
  const idx = mapNotesToSteps(code, notes, steps);
  if (!idx || !idx.length) return null;
  return [steps[idx[0]].before, ...idx.map((i) => steps[i].after)];
}

/** Plain-text reading of a goal list, for the aria-live region. */
export function describeGoals(goals: Goal[]): string {
  if (!goals.length) return 'No goals. The proof is complete.';
  const one = (g: Goal) =>
    [
      ...g.hyps.map((h) => `${h.names.join(' ')} : ${h.type}`),
      `Goal: ${g.target}`,
    ].join('. ');
  const head = goals.length > 1 ? `${goals.length} goals. ` : '';
  return head + goals.map(one).join(' Next goal. ');
}
