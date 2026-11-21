/**
 * Proof replay: step through a tactic proof line by line and show, for each line, the goals before and
 * after it and the proof term built so far (with `?_` for the parts still to be built).
 *
 * Everything shown comes from the engine. For each cut point k (after body line k) the proof is checked
 * with every tactic after the cut replaced by just enough `sorry`s to close the goals left open there:
 *   - the goals after line k are the goals those inserted `sorry`s close (each closes its `before[0]`),
 *   - the partial term is the elaborated term of that truncated proof, with `sorryAx T` printed as `?_`.
 * Which tactics come "after the cut" and how many goals they close is read from the full proof's
 * tactic steps (their source ranges and goal counts), not guessed from the text.
 */
import type { CheckResult, Engine, Env, Goal, Hyp, TacticStep } from '../../../domains/lean/engine/types.ts';

export interface ReplayLine {
  /** 1-based index among the body's non-blank lines. */
  index: number;
  /** The line's text without its indentation. */
  text: string;
  indent: number;
  /** Offsets in the body. */
  from: number;
  to: number;
}

export interface ReplayCut {
  /** Goals open after this many lines (0 = the statement's goal). Null if the truncated proof failed. */
  goals: Goal[] | null;
  /** The proof term built so far, `?_` for holes. */
  term: string | null;
  /** The source that was checked for this cut (body part only), for the curious. */
  body: string;
  /** Lean's first error for this cut, if any. */
  error: string | null;
}

export interface Replay {
  header: string;
  body: string;
  lines: ReplayLine[];
  /** cuts[k] = state after the first k lines; cuts.length === lines.length + 1. */
  cuts: ReplayCut[];
  /** The full proof's check. */
  complete: boolean;
  /** The full proof's first error (message, 1-based line index among `lines`). */
  fullError: { message: string; line: number | null } | null;
  /** Lines from this index on (1-based) were not reached because of an earlier error. */
  reachable: number;
}

/** Split a body into its non-blank lines (comments-only lines are skipped too). */
export function bodyLines(body: string): ReplayLine[] {
  const out: ReplayLine[] = [];
  let pos = 0;
  for (const raw of body.split('\n')) {
    const trimmed = raw.trim();
    if (trimmed && !trimmed.startsWith('--')) {
      const indent = raw.length - raw.trimStart().length;
      out.push({ index: out.length + 1, text: trimmed, indent, from: pos + indent, to: pos + raw.trimEnd().length });
    }
    pos += raw.length + 1;
  }
  return out;
}

/** Replace `sorryAx T` (T one argument: a parenthesized group or an identifier) with `?_`; drop parentheses around a lone hole. */
export function holesFromSorry(term: string): string {
  let out = '';
  let i = 0;
  while (i < term.length) {
    if (term.startsWith('sorryAx ', i) && (i === 0 || !/[\w.'']/.test(term[i - 1]))) {
      let j = i + 'sorryAx '.length;
      if (term[j] === '(') {
        let depth = 0;
        for (; j < term.length; j++) {
          if (term[j] === '(') depth++;
          else if (term[j] === ')' && --depth === 0) { j++; break; }
        }
      } else {
        while (j < term.length && /[^\s(),⟨⟩]/.test(term[j])) j++;
      }
      // a trailing Bool argument (`sorryAx T true`), as real Lean prints it
      const rest = term.slice(j);
      const boolArg = /^ (true|false)\b/.exec(rest);
      if (boolArg) j += boolArg[0].length;
      out += '?_';
      i = j;
    } else {
      out += term[i++];
    }
  }
  return out.replace(/\(\?_\)/g, '?_');
}

interface Node { s: TacticStep; i: number; parent: number | null }

/** For each step, the smallest step that contains it (by source range); ties go to the earlier step. */
function stepTree(steps: TacticStep[]): Node[] {
  return steps.map((s, i) => {
    let parent: number | null = null;
    steps.forEach((p, j) => {
      if (j === i) return;
      const contains = p.from <= s.from && s.to <= p.to && (p.to - p.from > s.to - s.from || j < i);
      if (!contains) return;
      if (parent === null || steps[parent].to - steps[parent].from > p.to - p.from) parent = j;
    });
    return { s, i, parent };
  });
}

/**
 * The source with every tactic that starts at or after `cut` replaced by `sorry`s. Returns the new source
 * and the offsets (in the new source) where the `sorry`s were put. Steps must come from checking `source`.
 */
export function truncateAt(source: string, steps: TacticStep[], cut: number): { source: string; sorries: number[] } {
  const tree = stepTree(steps);
  const frontier = tree.filter((n) => n.s.from >= cut && (n.parent === null || steps[n.parent].from < cut));
  // group by parent, then split into runs of siblings separated only by whitespace or `;`
  const groups = new Map<number | null, Node[]>();
  for (const n of frontier) {
    const g = groups.get(n.parent) ?? [];
    g.push(n);
    groups.set(n.parent, g);
  }
  const runs: Node[][] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.s.from - b.s.from);
    // drop steps nested in another member (equal ranges)
    const flat = g.filter((n, k) => !g.some((m, l) => l !== k && m.s.from <= n.s.from && n.s.to <= m.s.to && (m.s.to - m.s.from > n.s.to - n.s.from || l < k)));
    let run: Node[] = [];
    for (const n of flat) {
      const prev = run[run.length - 1];
      if (prev && !/^[\s;]*$/.test(source.slice(prev.s.to, n.s.from))) {
        runs.push(run);
        run = [];
      }
      run.push(n);
    }
    if (run.length) runs.push(run);
  }
  runs.sort((a, b) => b[0].s.from - a[0].s.from); // replace from the end so offsets stay valid
  let out = source;
  const edits: { at: number; text: string; removed: number }[] = [];
  for (const run of runs) {
    const first = run[0].s;
    const last = run[run.length - 1].s;
    const n = Math.max(1, first.before.length - last.after.length);
    const multiline = source.slice(first.from, last.to).includes('\n');
    const lineStart = source.lastIndexOf('\n', first.from - 1) + 1;
    const col = first.from - lineStart;
    const sep = multiline ? '\n' + ' '.repeat(col) : '; ';
    const text = Array.from({ length: n }, () => 'sorry').join(sep);
    out = out.slice(0, first.from) + text + out.slice(last.to);
    edits.push({ at: first.from, text, removed: last.to - first.from });
  }
  // offsets of the inserted sorries in the final source
  edits.sort((a, b) => a.at - b.at);
  const sorries: number[] = [];
  let shift = 0;
  for (const e of edits) {
    let k = 0;
    for (;;) {
      const p = e.text.indexOf('sorry', k);
      if (p < 0) break;
      sorries.push(e.at + shift + p);
      k = p + 5;
    }
    shift += e.text.length - e.removed;
  }
  return { source: out, sorries };
}

/** If nothing at all comes after the cut (the proof is finished, or the body is empty), there is nothing to replace. */
function cutResult(engine: Engine, env: Env, header: string, body: string, full: CheckResult, cutInBody: number): ReplayCut {
  const head = header + '\n';
  const src = head + body;
  const t = truncateAt(src, full.steps, head.length + cutInBody);
  let source = t.source;
  let sorries = t.sorries;
  if (sorries.length === 0) {
    // nothing after the cut: close whatever the proof leaves open (an empty body leaves the statement's goal)
    const open = cutInBody === 0 && !body.trim() ? 1 : full.diagnostics.find((d) => d.code === 'unsolved-goals')?.data?.goals?.length ?? 0;
    if (open > 0) {
      source = (cutInBody === 0 && !body.trim() ? head : source.replace(/\s*$/, '') + '\n');
      sorries = [];
      for (let j = 0; j < open; j++) {
        sorries.push(source.length + 2);
        source += '  sorry\n';
      }
    }
  }
  const r = engine.check(env, source);
  const bodyText = source.slice(head.length);
  const err = r.diagnostics.find((d) => d.severity === 'error');
  if (err) return { goals: err.code === 'unsolved-goals' ? err.data?.goals ?? null : null, term: null, body: bodyText, error: err.message };
  const goals: Goal[] = [];
  for (const at of sorries) {
    const st = r.steps.find((s) => s.tactic === 'sorry' && s.from === at);
    if (st && st.before[0]) goals.push(st.before[0]);
  }
  const decl = r.decls.find((d) => d.isTacticProof && d.term) ?? r.decls.find((d) => d.term);
  return { goals, term: decl?.term ? holesFromSorry(decl.term) : null, body: bodyText, error: null };
}

/** Check the proof and every truncation of it. `header` ends in `:= by`. */
export function buildReplay(engine: Engine, env: Env, header: string, body: string): Replay {
  const head = header + '\n';
  const full = engine.check(env, head + body);
  const lines = bodyLines(body);
  const firstErr = full.diagnostics.find((d) => d.severity === 'error');
  let fullError: Replay['fullError'] = null;
  let reachable = lines.length + 1;
  if (firstErr) {
    const at = firstErr.from - head.length;
    const line = lines.find((l) => at >= l.from && at <= l.to) ?? (at >= 0 ? [...lines].reverse().find((l) => l.from <= at) : undefined);
    fullError = { message: firstErr.message, line: line?.index ?? null };
    if (line && firstErr.code !== 'unsolved-goals') reachable = line.index;
  }
  // after an error, replay the part before it: check that prefix on its own (it just ends with goals open)
  const prefixBody = reachable <= lines.length ? body.slice(0, reachable >= 2 ? lines[reachable - 2].to : 0) : body;
  const prefixFull = prefixBody === body ? full : engine.check(env, head + prefixBody);
  const cuts: ReplayCut[] = [];
  for (let k = 0; k <= lines.length; k++) {
    if (k >= reachable) {
      cuts.push({ goals: null, term: null, body: '', error: null });
      continue;
    }
    const cutInBody = k === 0 ? 0 : lines[k - 1].to;
    cuts.push(cutResult(engine, env, header, prefixBody, prefixFull, cutInBody));
  }
  return { header, body, lines, cuts, complete: full.complete, fullError, reachable };
}

// ---------------------------------------------------------------------------------------------------------
// What changed between two goal lists

export type HypMark = 'new' | 'same';
export interface GoalDiff {
  goal: Goal;
  /** Per hypothesis entry of `goal`. */
  hyps: HypMark[];
  targetChanged: boolean;
  /** This goal was already open, unchanged, before the step. */
  untouched: boolean;
}

const hypKey = (n: string, h: Hyp) => `${n} : ${h.type}${h.value ? ' := ' + h.value : ''}`;
const goalKey = (g: Goal) => `${g.caseName ?? ''}|${g.hyps.map((h) => h.names.map((n) => hypKey(n, h)).join(',')).join(';')}|${g.target}`;

/** Mark what is new in each goal of `after`, relative to the goal the step worked on (`before[0]`). */
export function diffGoals(before: Goal[], after: Goal[]): GoalDiff[] {
  const main = before[0];
  const others = new Set(before.slice(1).map(goalKey));
  return after.map((g) => {
    if (others.has(goalKey(g)) && !(main && goalKey(main) === goalKey(g))) {
      return { goal: g, hyps: g.hyps.map(() => 'same' as const), targetChanged: false, untouched: true };
    }
    const had = new Set(main ? main.hyps.flatMap((h) => h.names.map((n) => hypKey(n, h))) : []);
    return {
      goal: g,
      hyps: g.hyps.map((h) => (h.names.some((n) => !had.has(hypKey(n, h))) ? 'new' : 'same')),
      targetChanged: !main || main.target !== g.target,
      untouched: false,
    };
  });
}

/** Hypotheses of `before[0]` that are gone afterwards from every goal (e.g. `obtain` consumed `h`). Empty when the step closed a goal. */
export function removedHyps(before: Goal[], after: Goal[]): string[] {
  const main = before[0];
  // a goal that was closed did not use its hypotheses up; only count a goal that was transformed
  if (!main || after.length < before.length) return [];
  const still = new Set(after.flatMap((g) => g.hyps.flatMap((h) => h.names.map((n) => hypKey(n, h)))));
  return main.hyps.flatMap((h) => h.names.filter((n) => !still.has(hypKey(n, h))));
}

/** Split `cur` into [prefix, changed, suffix] against `prev` (common prefix and suffix, at token boundaries). */
export function diffSpan(prev: string, cur: string): [string, string, string] {
  if (prev === cur) return [cur, '', ''];
  let a = 0;
  while (a < prev.length && a < cur.length && prev[a] === cur[a]) a++;
  let b = 0;
  while (b < prev.length - a && b < cur.length - a && prev[prev.length - 1 - b] === cur[cur.length - 1 - b]) b++;
  // widen to token boundaries so a highlight never splits a name
  const word = /[\w.'?_ₐ-ₜ₀-₉]/;
  while (a > 0 && word.test(cur[a - 1]) && word.test(cur[a] ?? '')) a--;
  let end = cur.length - b;
  while (end < cur.length && end > 0 && word.test(cur[end]) && word.test(cur[end - 1])) end++;
  return [cur.slice(0, a), cur.slice(a, end), cur.slice(end)];
}

// ---------------------------------------------------------------------------------------------------------
// Presets: reference solutions taken from the levels themselves (the UI reads header and body from content)

export interface ProofPreset {
  level: string;
  label: string;
  /** One line on what to watch for. */
  watch: string;
}

export const PROOF_PRESETS: ProofPreset[] = [
  { level: 'props-07', label: 'Implication chain', watch: 'Each apply wraps the hole in one more function call.' },
  { level: 'logic-04', label: 'Unpack ∧, build ∧', watch: 'constructor turns one hole into a pair of holes.' },
  { level: 'logic-06', label: '∨ case split', watch: 'cases makes one hole per constructor of ∨.' },
  { level: 'quant-07', label: '∃ elimination', watch: 'obtain opens the witness; use fills in the first half of the pair.' },
  { level: 'props-10', label: 'A have in the middle', watch: 'have adds a hypothesis, then exact fills the hole using it.' },
];

/** The body of a level's reference proof: `solutions[0]`, or a Parsons level's lines in order. */
export function referenceBody(level: { kind: string; solutions?: string[]; lines?: string[] }): string | null {
  if (level.kind === 'proof' && level.solutions?.length) return level.solutions[0];
  if (level.kind === 'parsons' && level.lines?.length) return level.lines.join('\n');
  return null;
}
