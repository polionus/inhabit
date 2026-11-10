/**
 * A tiny fake implementing the Engine interface with canned results, so every screen can be
 * exercised without the real engine. It "knows" a handful of scripted proofs (see fixtures.ts):
 * a body passes iff it follows a script's lines; deviations yield plausible diagnostics.
 */
import type { CheckOptions, CheckResult, Diagnostic, Engine, Env, Goal, Hyp, TacticStep } from '../../engine/types.ts';

export interface Script {
  /** Header line (ends in `:= by` or `:=`). */
  header: string;
  /** Body lines of the canonical proof. */
  lines: string[];
  /** Goal states: states[i] is the goal list before line i; last is after the final line. */
  states: Goal[][];
  term?: string;
}

export const scripts: Script[] = [];
export const registerScript = (s: Script) => {
  if (!scripts.some((x) => x.header === s.header && x.lines.join('\n') === s.lines.join('\n'))) scripts.push(s);
};

export const hyp = (names: string, type: string, isProof = true): Hyp => ({ names: names.split(' '), type, isProof });
export const goal = (hyps: Hyp[], target: string, caseName?: string): Goal => ({ hyps, target, caseName });

interface FEnv extends Env {
  ext: string[];
}

const mkEnv = (ext: string[]): Env => ({ __brand: 'Env', ext }) as FEnv;

const TACTICS = ['intro', 'intros', 'exact', 'apply', 'refine', 'have', 'show', 'constructor', 'left', 'right', 'cases', 'rcases', 'obtain', 'rintro', 'exfalso', 'contradiction', 'assumption', 'rfl', 'rw', 'simp', 'sorry', 'use', 'induction', 'omega'];

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const normTerm = (s: string) =>
  s.replace(/->/g, '→').replace(/\/\\/g, '∧').replace(/\\\//g, '∨').replace(/<->/g, '↔').replace(/[\s()]/g, '');

function lineRanges(text: string, from: number, to: number): { text: string; from: number; to: number }[] {
  const out: { text: string; from: number; to: number }[] = [];
  let pos = from;
  for (const raw of text.slice(from, to).split('\n')) {
    const trimmedStart = raw.length - raw.trimStart().length;
    if (raw.trim() && !raw.trim().startsWith('--')) {
      out.push({ text: raw.trim(), from: pos + trimmedStart, to: pos + raw.trimEnd().length });
    }
    pos += raw.length + 1;
  }
  return out;
}

function checkImpl(env: Env, source: string, opts?: CheckOptions): CheckResult {
  const diagnostics: Diagnostic[] = [];
  const steps: TacticStep[] = [];
  const decls: CheckResult['decls'] = [];
  const e = env as FEnv;
  void e;

  // commands: #check / #eval
  const cmdRe = /^#(check|eval|print|reduce)\s+(.*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = cmdRe.exec(source))) {
    const arg = m[2].trim();
    let msg: string;
    if (m[1] === 'eval') {
      const sum = /^(\d+)\s*\+\s*(\d+)$/.exec(arg);
      msg = sum ? String(Number(sum[1]) + Number(sum[2])) : '42';
    } else msg = `${arg} : ${/^[A-Z]/.test(arg) ? 'Type' : 'Nat → Nat → Nat'}`;
    diagnostics.push({ severity: 'info', code: 'command-output', message: msg, from: m.index, to: m.index + m[0].length });
  }

  const script = scripts.find((s) => source.includes(s.header));
  const hasDecl = /(^|\n)\s*(theorem|lemma|example|def)\b/.test(source);
  if (!script) {
    if (/\bunknownthing\b|\bfoo_bar\b/.test(source)) {
      const i = source.search(/\bunknownthing\b|\bfoo_bar\b/);
      diagnostics.push({ severity: 'error', code: 'unknown-identifier', message: 'unknown identifier', from: i, to: i + 8, data: { name: source.slice(i, i + 12).split(/\W/)[0], suggestions: ['hp', 'hq'] } });
    }
    if (/\bsorry\b/.test(source)) {
      const i = source.search(/\bsorry\b/);
      diagnostics.push({ severity: 'warning', code: 'sorry', message: "declaration uses 'sorry'", from: i, to: i + 5 });
    }
    const ok = !diagnostics.some((d) => d.severity === 'error');
    return { diagnostics, steps, decls, ok, complete: ok && hasDecl && !/\bsorry\b/.test(source) };
  }

  const hStart = source.indexOf(script.header);
  const bodyStart = hStart + script.header.length;
  const bodyEnd = (() => {
    const nl = source.indexOf('\n\n', bodyStart);
    return nl < 0 ? source.length : nl;
  })();
  const after = source.slice(bodyStart, bodyEnd);
  const afterTrim = after.replace(/\s+$/, '');
  const lines = lineRanges(source, bodyStart, bodyStart + afterTrim.length);
  let matched = 0;
  let failed = false;
  let sawSorry = false;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const word = ln.text.split(/[\s⟨(]/)[0].replace(/^·/, '');
    const state = script.states[Math.min(matched, script.states.length - 1)];
    if (ln.text === 'sorry') {
      diagnostics.push({ severity: 'warning', code: 'sorry', message: "declaration uses 'sorry'", from: ln.from, to: ln.to });
      steps.push({ from: ln.from, to: ln.to, tactic: 'sorry', before: state, after: [], ok: true });
      sawSorry = true;
      matched = script.lines.length;
      continue;
    }
    if (failed) break;
    let err: Diagnostic | null = null;
    if (/unknownthing|foo_bar/.test(ln.text)) {
      err = { severity: 'error', code: 'unknown-identifier', message: `unknown identifier '${ln.text.split(' ').pop()}'`, from: ln.from, to: ln.to, data: { name: ln.text.split(' ').pop(), suggestions: ['hp'] } };
    } else if (!TACTICS.includes(word) && !script.header.endsWith(':=')) {
      err = { severity: 'error', code: 'unknown-tactic', message: `unknown tactic '${word}'`, from: ln.from, to: ln.to, data: { tactic: word, suggestions: ['exact'] } };
    } else if (opts?.allowedTactics && script.header.endsWith('by') && !opts.allowedTactics.includes(word) && word !== 'sorry') {
      err = { severity: 'error', code: 'tactic-locked', message: `tactic '${word}' is not available yet`, from: ln.from, to: ln.to, data: { tactic: word } };
    } else if (opts?.allowedTactics?.length === 0 && /^by\b/.test(ln.text)) {
      err = { severity: 'error', code: 'mode', message: 'this level needs a term, not a tactic block', from: ln.from, to: ln.to };
    } else if (norm(ln.text) !== norm(script.lines[matched] ?? '')) {
      err = { severity: 'error', code: 'type-mismatch', message: `type mismatch\n  ${ln.text}\nhas type\n  ?\nbut is expected to have type\n  ${state[0]?.target ?? 'False'}`, from: ln.from, to: ln.to, data: { expected: state[0]?.target ?? 'False', actual: 'P' } };
    }
    if (err) {
      diagnostics.push(err);
      steps.push({ from: ln.from, to: ln.to, tactic: word, before: state, after: state, ok: false });
      failed = true;
      continue;
    }
    steps.push({ from: ln.from, to: ln.to, tactic: word, before: script.states[matched], after: script.states[matched + 1] ?? [], ok: true });
    matched++;
  }
  const complete0 = !failed && !sawSorry && matched === script.lines.length && lines.length > 0;
  if (!failed && !sawSorry && matched < script.lines.length) {
    const g = script.states[matched] ?? [];
    diagnostics.push({
      severity: 'error',
      code: 'unsolved-goals',
      message: `unsolved goals\n${g.map((x) => `⊢ ${x.target}`).join('\n')}`,
      from: hStart,
      to: bodyStart,
      data: { goals: g },
    });
  }
  const ok = !diagnostics.some((d) => d.severity === 'error');
  decls.push({
    name: script.header.split(' ')[1] ?? '',
    kind: 'theorem',
    type: script.states[0]?.[0]?.target ?? '',
    from: hStart,
    to: bodyEnd,
    ok,
    usesSorry: sawSorry,
    term: complete0 ? (script.term ?? 'fun h => ⟨h.2, h.1⟩') : undefined,
    usedTactics: steps.map((s) => s.tactic),
    usedConstants: [],
    isTacticProof: script.header.endsWith('by'),
  });
  return { diagnostics, steps, decls, ok, complete: ok && complete0 };
}

export const fakeEngine: Engine = {
  baseEnv: () => mkEnv([]),
  extend: (env, source) => {
    const bad = /\bunknownthing\b/.test(source);
    const diagnostics: Diagnostic[] = bad
      ? [{ severity: 'error', code: 'unknown-identifier', message: 'unknown identifier', from: 0, to: 4, data: { name: 'unknownthing' } }]
      : [];
    return { env: mkEnv([...((env as FEnv).ext ?? []), source]), result: { diagnostics, steps: [], decls: [], ok: !bad, complete: false } };
  },
  check: (env, source, opts) => {
    try {
      return checkImpl(env, source, opts);
    } catch (e) {
      return { diagnostics: [{ severity: 'error', code: 'other', message: String(e), from: 0, to: 0 }], steps: [], decls: [], ok: false, complete: false };
    }
  },
  goalsAt: (result, offset) => {
    if (!result.steps.length) return null;
    for (const s of result.steps) if (s.to >= offset) return s.before;
    return result.steps[result.steps.length - 1].after;
  },
  elab: (_env, term, binders) => {
    const t = term.trim();
    const bad = /\bunknownthing\b|\bℝ\b|\bReal\b/.exec(t) ?? /\bℝ\b|\bReal\b/.exec(binders ?? '');
    const depth = [...t].reduce((d, c) => d + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
    if (!t) return { ok: false, diagnostics: [{ severity: 'error', code: 'parse', message: 'expected term', from: 0, to: 0 }] };
    if (bad) {
      return { ok: false, diagnostics: [{ severity: 'error', code: 'unknown-identifier', message: `unknown identifier '${bad[0]}'`, from: 0, to: t.length, data: { name: bad[0] } }] };
    }
    if (depth !== 0 || /[→∧∨↔=]\s*$/.test(t)) {
      return { ok: false, diagnostics: [{ severity: 'error', code: 'parse', message: 'unexpected end of input', from: t.length, to: t.length }] };
    }
    const isProp = /[∀∃→∧∨¬↔=≤<∈⊆]|^True$|^False$/.test(t) || /->|<->|\/\\|\\\//.test(t);
    return { ok: true, pretty: t.replace(/->/g, '→').replace(/\/\\/g, '∧').replace(/\\\//g, '∨').replace(/<->/g, '↔'), type: isProp ? 'Prop' : 'Nat', diagnostics: [] };
  },
  defEq: (_env, a, b) => normTerm(a) === normTerm(b),
  constant: () => null,
  tactics: () => TACTICS,
};
