/**
 * Rewrite and compute.
 *
 * Rewrite: the goal before and after `rewrite [rule]` both come from the engine, and so does the error when
 * the rule's left side is not found. Which subterm matched (and what replaced it) is worked out here by
 * first-order matching on the printed goal, in the order `rw` searches (each node before its children, left
 * to right), and then CONFIRMED: rewriting every occurrence in TS must give exactly the goal the engine
 * printed. If it does not (a match only up to definitional unfolding, say), the highlight falls back to the
 * plain textual difference and says so.
 *
 * Compute: a tiny small-step reducer for a few closed Nat expressions (unfold `double`, unfold `+`, beta,
 * arithmetic on numerals). The steps are generated here; every equation `step_i = step_(i+1)` is checked
 * by the engine with `rfl` before it is shown.
 */
import type { Engine, Env, Hyp } from '../../../domains/lean/engine/types.ts';

// ---------------------------------------------------------------------------------------------------------
// A small parser for printed goals (with source spans)

export type Node =
  | { k: 'atom'; text: string; from: number; to: number; pfrom: number; pto: number }
  | { k: 'op'; op: string; l: Node; r: Node; from: number; to: number; pfrom: number; pto: number }
  | { k: 'app'; fn: Node; args: Node[]; from: number; to: number; pfrom: number; pto: number }
  | { k: 'succ'; arg: Node; from: number; to: number; pfrom: number; pto: number }
  | { k: 'not'; arg: Node; from: number; to: number; pfrom: number; pto: number };

interface Tok { t: string; from: number; to: number }

const BIN: Record<string, { p: number; right?: boolean }> = {
  '↔': { p: 20 }, '→': { p: 25, right: true }, '∨': { p: 30, right: true }, '∧': { p: 35, right: true },
  '=': { p: 50 }, '≠': { p: 50 }, '<': { p: 50 }, '≤': { p: 50 }, '>': { p: 50 }, '≥': { p: 50 },
  '+': { p: 65 }, '-': { p: 65 }, '*': { p: 70 }, '/': { p: 70 }, '%': { p: 70 },
};

function lex(s: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if ('()'.includes(c) || c in BIN || c === '¬') { out.push({ t: c, from: i, to: i + 1 }); i++; continue; }
    const m = /^[A-Za-z_α-ωΑ-Ω][\w'.α-ωΑ-Ω₀-₉]*|^\d+|^\.succ\b/.exec(s.slice(i));
    if (!m) return null;
    out.push({ t: m[0], from: i, to: i + m[0].length });
    i += m[0].length;
  }
  return out;
}

/** Parse a printed Lean expression (arithmetic, relations, connectives, application, `.succ`). Null if unsupported. */
export function parseExpr(s: string): Node | null {
  const lexed = lex(s);
  if (!lexed || !lexed.length) return null;
  const toks: Tok[] = lexed;
  let i = 0;
  const peek = () => toks[i];
  const isAtomStart = (t: Tok | undefined) => !!t && (t.t === '(' || /^[\w'α-ωΑ-Ω]/.test(t.t));
  const withSuffix = (n: Node, text: string, from: number, to: number): Node => {
    // `x.succ` (the printer's dot notation) splits off the identifier
    if (text.endsWith('.succ') && text !== 'Nat.succ') {
      const base = text.slice(0, -5);
      const inner: Node = { k: 'atom', text: base, from, to: from + base.length, pfrom: from, pto: from + base.length };
      return { k: 'succ', arg: inner, from, to, pfrom: from, pto: to };
    }
    return n;
  };
  function atom(): Node | null {
    const t = toks[i];
    if (!t) return null;
    if (t.t === '(') {
      i++;
      const e = expr(0);
      if (!e || toks[i]?.t !== ')') return null;
      const close = toks[i++];
      let n: Node = { ...e, pfrom: t.from, pto: close.to };
      // `(a + b).succ`
      const nx = toks[i];
      if (nx && nx.from === close.to && nx.t === '.succ') {
        i++;
        n = { k: 'succ', arg: n, from: t.from, to: nx.to, pfrom: t.from, pto: nx.to };
      }
      return n;
    }
    if (/^[\w'α-ωΑ-Ω]/.test(t.t)) {
      i++;
      const n: Node = { k: 'atom', text: t.t, from: t.from, to: t.to, pfrom: t.from, pto: t.to };
      return withSuffix(n, t.t, t.from, t.to);
    }
    return null;
  }
  function app(): Node | null {
    if (peek()?.t === '¬') {
      const t = toks[i++];
      const a = app();
      if (!a) return null;
      return { k: 'not', arg: a, from: t.from, to: a.pto, pfrom: t.from, pto: a.pto };
    }
    const f = atom();
    if (!f) return null;
    const args: Node[] = [];
    while (isAtomStart(peek())) {
      const a = atom();
      if (!a) return null;
      args.push(a);
    }
    if (!args.length) return f;
    const to = args[args.length - 1].pto;
    if (f.k === 'atom' && f.text === 'Nat.succ' && args.length === 1) return { k: 'succ', arg: args[0], from: f.pfrom, to, pfrom: f.pfrom, pto: to };
    return { k: 'app', fn: f, args, from: f.pfrom, to, pfrom: f.pfrom, pto: to };
  }
  function expr(minP: number): Node | null {
    let l = app();
    if (!l) return null;
    for (;;) {
      const t = peek();
      const info = t && BIN[t.t];
      if (!info || info.p < minP) break;
      i++;
      const r = expr(info.right ? info.p : info.p + 1);
      if (!r) return null;
      l = { k: 'op', op: t.t, l, r, from: l.pfrom, to: r.pto, pfrom: l.pfrom, pto: r.pto };
    }
    return l;
  }
  const e = expr(0);
  return e && i === toks.length ? e : null;
}

const isOne = (n: Node) => n.k === 'atom' && n.text === '1';

/** Structural equality, reading `x + 1` and `x.succ` / `Nat.succ x` as the same. */
export function sameExpr(a: Node, b: Node): boolean {
  if (a.k === 'succ' && b.k === 'op' && b.op === '+' && isOne(b.r)) return sameExpr(a.arg, b.l);
  if (b.k === 'succ' && a.k === 'op' && a.op === '+' && isOne(a.r)) return sameExpr(a.l, b.arg);
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'atom': return a.text === (b as typeof a).text;
    case 'op': { const o = b as typeof a; return a.op === o.op && sameExpr(a.l, o.l) && sameExpr(a.r, o.r); }
    case 'succ': case 'not': return sameExpr(a.arg, (b as typeof a).arg);
    case 'app': { const o = b as typeof a; return a.args.length === o.args.length && sameExpr(a.fn, o.fn) && a.args.every((x, j) => sameExpr(x, o.args[j])); }
  }
}

type Subst = Map<string, Node>;

function match(p: Node, e: Node, vars: Set<string>, s: Subst): boolean {
  if (p.k === 'atom' && vars.has(p.text)) {
    const bound = s.get(p.text);
    if (bound) return sameExpr(bound, e);
    s.set(p.text, e);
    return true;
  }
  // a pattern `p.succ` also matches `e + 1` (Lean unifies the two)
  if (p.k === 'succ' && e.k === 'op' && e.op === '+' && isOne(e.r)) return match(p.arg, e.l, vars, s);
  if (p.k !== e.k) return false;
  switch (p.k) {
    case 'atom': return p.text === (e as typeof p).text;
    case 'op': { const o = e as typeof p; return p.op === o.op && match(p.l, o.l, vars, s) && match(p.r, o.r, vars, s); }
    case 'succ': case 'not': return match(p.arg, (e as typeof p).arg, vars, s);
    case 'app': { const o = e as typeof p; return p.args.length === o.args.length && match(p.fn, o.fn, vars, s) && p.args.every((x, j) => match(x, o.args[j], vars, s)); }
  }
}

function subst(p: Node, s: Subst): Node {
  switch (p.k) {
    case 'atom': return s.get(p.text) ?? p;
    case 'op': return { ...p, l: subst(p.l, s), r: subst(p.r, s) };
    case 'succ': case 'not': return { ...p, arg: subst(p.arg, s) };
    case 'app': return { ...p, fn: subst(p.fn, s), args: p.args.map((a) => subst(a, s)) };
  }
}

const children = (n: Node): Node[] => (n.k === 'op' ? [n.l, n.r] : n.k === 'app' ? [n.fn, ...n.args] : n.k === 'atom' ? [] : [n.arg]);

function replaceChild(n: Node, idx: number, c: Node): Node {
  switch (n.k) {
    case 'op': return idx === 0 ? { ...n, l: c } : { ...n, r: c };
    case 'app': return idx === 0 ? { ...n, fn: c } : { ...n, args: n.args.map((a, j) => (j === idx - 1 ? c : a)) };
    case 'succ': case 'not': return { ...n, arg: c };
    case 'atom': return n;
  }
}

/** Pre-order, left to right: the order `rw` looks for its pattern. */
function preorder(n: Node, path: number[] = [], out: { n: Node; path: number[] }[] = []) {
  out.push({ n, path });
  children(n).forEach((c, j) => preorder(c, [...path, j], out));
  return out;
}

function at(n: Node, path: number[]): Node | null {
  let cur: Node | null = n;
  for (const j of path) cur = cur ? children(cur)[j] ?? null : null;
  return cur;
}

/** Split a rule's printed type `∀ (n m : Nat), lhs = rhs` into pattern variables and the two sides. */
export function ruleSides(type: string): { vars: string[]; lhs: Node; rhs: Node } | null {
  let rest = type.trim();
  const vars: string[] = [];
  const all = /^∀\s*((?:[({⦃\[][^)}⦄\]]*[)}⦄\]]\s*)+|[^,]+),\s*/.exec(rest);
  if (all) {
    const binders = all[1];
    const groups = [...binders.matchAll(/[({⦃\[]([^:)}⦄\]]+)(?::[^)}⦄\]]*)?[)}⦄\]]/g)];
    if (groups.length) groups.forEach((g) => vars.push(...g[1].trim().split(/\s+/)));
    else vars.push(...binders.split(':')[0].trim().split(/\s+/));
    rest = rest.slice(all[0].length);
  }
  const e = parseExpr(rest);
  if (!e || e.k !== 'op' || (e.op !== '=' && e.op !== '↔')) return null;
  return { vars, lhs: e.l, rhs: e.r };
}

export interface Highlight { from: number; to: number }

export interface RewriteMatch {
  /** Spans in the before-target of every rewritten occurrence. */
  before: Highlight[];
  /** Spans in the after-target of what replaced them. */
  after: Highlight[];
  /** The instantiated left side, as printed in the goal (the first occurrence). */
  instance: string;
  /** How the rule's variables were filled in, e.g. [['n', 'x + y'], ['m', 'z']]. */
  bindings: [string, string][];
  /** True when rewriting in TS reproduced the engine's goal exactly. */
  confirmed: boolean;
}

/**
 * Locate the rewrite: match `lhs` (pattern vars `vars`) in `beforeTarget`, replace every occurrence of the
 * instance by the instantiated `rhs`, and compare with `afterTarget` (the engine's). Null if no match.
 */
export function locateRewrite(beforeTarget: string, afterTarget: string, sides: { vars: string[]; lhs: Node; rhs: Node }, reverse: boolean): RewriteMatch | null {
  const b = parseExpr(beforeTarget);
  const a = parseExpr(afterTarget);
  if (!b) return null;
  const [from, to] = reverse ? [sides.rhs, sides.lhs] : [sides.lhs, sides.rhs];
  const vars = new Set(sides.vars);
  let s: Subst | null = null;
  let inst: Node | null = null;
  for (const { n } of preorder(b)) {
    const m: Subst = new Map();
    if (match(from, n, vars, m)) { s = m; inst = n; break; }
  }
  if (!s || !inst) return null;
  const instance = inst;
  const replacement = subst(to, s);
  // every occurrence of the instance, outermost first, not looking inside a replaced one
  const paths: number[][] = [];
  const walk = (n: Node, path: number[]) => {
    if (sameExpr(n, instance)) { paths.push(path); return; }
    children(n).forEach((c, j) => walk(c, [...path, j]));
  };
  walk(b, []);
  const rebuild = (n: Node, path: number[]): Node => {
    if (paths.some((p) => p.length === path.length && p.every((x, j) => x === path[j]))) return replacement;
    return children(n).reduce((acc, c, j) => replaceChild(acc, j, rebuild(c, [...path, j])), n);
  };
  const predicted = rebuild(b, []);
  const confirmed = !!a && sameExpr(predicted, a);
  const span = (n: Node) => ({ from: n.pfrom, to: n.pto });
  return {
    before: paths.map((p) => span(at(b, p)!)),
    after: confirmed ? paths.map((p) => at(a!, p)).filter((n): n is Node => !!n).map(span) : [],
    instance: beforeTarget.slice(instance.from, instance.to),
    bindings: sides.vars.filter((v) => s!.has(v)).map((v) => { const n = s!.get(v)!; return [v, beforeTarget.slice(n.from, n.to)] as [string, string]; }),
    confirmed,
  };
}

/** Fallback highlight: the differing middle of two strings (common prefix and suffix removed). */
export function textDiff(before: string, after: string): { before: Highlight; after: Highlight } {
  let p = 0;
  while (p < before.length && p < after.length && before[p] === after[p]) p++;
  let q = 0;
  while (q < before.length - p && q < after.length - p && before[before.length - 1 - q] === after[after.length - 1 - q]) q++;
  return { before: { from: p, to: before.length - q }, after: { from: p, to: after.length - q } };
}

/** Cut `text` into plain and marked pieces. Spans must not overlap. */
export function segments(text: string, marks: Highlight[]): { text: string; mark: boolean }[] {
  const ms = [...marks].filter((m) => m.to > m.from).sort((x, y) => x.from - y.from);
  const out: { text: string; mark: boolean }[] = [];
  let pos = 0;
  for (const m of ms) {
    if (m.from < pos) continue;
    if (m.from > pos) out.push({ text: text.slice(pos, m.from), mark: false });
    out.push({ text: text.slice(m.from, m.to), mark: true });
    pos = m.to;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), mark: false });
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Running a rewrite through the engine

export interface RewritePreset {
  id: string;
  label: string;
  /** Hypotheses as binders, e.g. "(a b : Nat) (h : a = b)". */
  binders: string;
  goal: string;
  rules: string[];
  /** The level this goal comes from. */
  level: string;
  note?: string;
}

export interface RewriteRun {
  ok: boolean;
  /** The goal as the engine prints it before the rewrite. */
  before: string;
  /** Its hypotheses (engine). */
  hyps: Hyp[];
  /** The pattern Lean looked for, when the rewrite failed to find it. */
  pattern: string | null;
  /** After `rewrite [rule]` (null on failure). */
  after: string | null;
  /** Lean's error when the rewrite fails. */
  error: string | null;
  /** The rule's type as the engine prints it. */
  ruleType: string | null;
  match: RewriteMatch | null;
  /** Spans to highlight when the match could not be confirmed. */
  fallback: { before: Highlight; after: Highlight } | null;
  /** `rw` (which tries `rfl` afterwards) closes the goal outright. */
  closedByRfl: boolean;
}

/** Rule text the exhibit accepts: a name with optional arguments, optionally preceded by ←. No brackets, no newlines. */
export function cleanRule(rule: string): string | null {
  const r = rule.trim().replace(/^<-\s*/, '← ');
  if (!r || /[\n\[\],;]|:=|\bby\b/.test(r)) return null;
  return r;
}

export function runRewrite(engine: Engine, env: Env, binders: string, goal: string, ruleText: string): RewriteRun {
  const rule = cleanRule(ruleText);
  const head = `example ${binders} : ${goal} := by\n  `;
  const base = engine.check(env, head + 'sorry');
  const g0 = engine.goalsAt(base, head.length)?.[0];
  const before = g0?.target ?? goal;
  const empty: RewriteRun = { ok: false, before, hyps: g0?.hyps ?? [], pattern: null, after: null, error: null, ruleType: null, match: null, fallback: null, closedByRfl: false };
  if (!rule) return { ...empty, error: 'Write a rule such as h, ← h, or Nat.add_comm x y.' };
  const reverse = rule.startsWith('←');
  const term = rule.replace(/^←\s*/, '');
  const src = `${head}rewrite [${rule}]\n  sorry`;
  const r = engine.check(env, src);
  const err = r.diagnostics.find((d) => d.severity === 'error');
  const typed = engine.elab(env, term, binders);
  const ruleType = typed.ok ? typed.type ?? null : null;
  if (err) return { ...empty, ruleType, error: err.message, pattern: err.code === 'rewrite-failed' ? err.data?.pattern ?? null : null };
  const after = engine.goalsAt(r, src.lastIndexOf('sorry'))?.[0]?.target ?? null;
  if (after === null) return { ...empty, ruleType, error: 'The rewrite left no goal to show.' };
  const sides = ruleType ? ruleSides(ruleType) : null;
  const match = sides ? locateRewrite(before, after, sides, reverse) : null;
  const closes = engine.check(env, `${head}rw [${rule}]`).complete;
  return {
    ...empty,
    ok: true,
    after,
    error: null,
    ruleType,
    match,
    fallback: match?.confirmed ? null : textDiff(before, after),
    closedByRfl: closes,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Compute: small-step reduction of closed Nat expressions

export type CExpr =
  | { k: 'num'; v: number }
  | { k: 'var'; x: string }
  | { k: 'add'; a: CExpr; b: CExpr }
  | { k: 'mul'; a: CExpr; b: CExpr }
  | { k: 'double'; a: CExpr }
  | { k: 'succ'; a: CExpr }
  | { k: 'beta'; x: string; body: CExpr; arg: CExpr };

export const num = (v: number): CExpr => ({ k: 'num', v });
export const add = (a: CExpr, b: CExpr): CExpr => ({ k: 'add', a, b });
export const mul = (a: CExpr, b: CExpr): CExpr => ({ k: 'mul', a, b });
export const dbl = (a: CExpr): CExpr => ({ k: 'double', a });

/** Print as Lean would: `+` (65) and `*` (70) left-associative, application tightest. Returns the span of `mark`. */
export function printC(e: CExpr, mark?: number[]): { text: string; span: Highlight | null } {
  let span: Highlight | null = null;
  const go = (e: CExpr, prec: number, path: number[], out: { s: string }) => {
    const marked = !!mark && mark.length === path.length && mark.every((x, j) => x === path[j]);
    const start = out.s.length;
    const paren = (p: number, body: () => void) => {
      if (p < prec) { out.s += '('; body(); out.s += ')'; } else body();
    };
    switch (e.k) {
      case 'num': out.s += String(e.v); break;
      case 'var': out.s += e.x; break;
      case 'add': paren(65, () => { go(e.a, 65, [...path, 0], out); out.s += ' + '; go(e.b, 66, [...path, 1], out); }); break;
      case 'mul': paren(70, () => { go(e.a, 70, [...path, 0], out); out.s += ' * '; go(e.b, 71, [...path, 1], out); }); break;
      case 'double': paren(1024, () => { out.s += 'double '; go(e.a, 1025, [...path, 0], out); }); break;
      case 'succ': paren(1024, () => { out.s += 'Nat.succ '; go(e.a, 1025, [...path, 0], out); }); break;
      case 'beta': paren(1024, () => { out.s += `(fun ${e.x} => `; go(e.body, 0, [...path, 0], out); out.s += ') '; go(e.arg, 1025, [...path, 1], out); }); break;
    }
    if (marked) span = { from: start, to: out.s.length };
  };
  const out = { s: '' };
  go(e, 0, [], out);
  return { text: out.s, span };
}

function substVar(e: CExpr, x: string, v: CExpr): CExpr {
  switch (e.k) {
    case 'var': return e.x === x ? v : e;
    case 'num': return e;
    case 'add': case 'mul': return { ...e, a: substVar(e.a, x, v), b: substVar(e.b, x, v) };
    case 'double': case 'succ': return { ...e, a: substVar(e.a, x, v) };
    case 'beta': return { ...e, body: e.x === x ? e.body : substVar(e.body, x, v), arg: substVar(e.arg, x, v) };
  }
}

export type Strategy = 'double' | 'add' | 'arith';

interface Redex { path: number[]; result: CExpr; label: string; resultPath: number[] }

const kids = (e: CExpr): CExpr[] => (e.k === 'add' || e.k === 'mul' ? [e.a, e.b] : e.k === 'double' || e.k === 'succ' ? [e.a] : e.k === 'beta' ? [e.body, e.arg] : []);

function findRedex(e: CExpr, strategy: Strategy, path: number[] = []): Redex | null {
  const here = (result: CExpr, label: string): Redex => ({ path, result, label, resultPath: path });
  // outermost first for unfolding (that is how the definition is read), innermost first for arithmetic
  if (e.k === 'beta') return here(substVar(e.body, e.x, e.arg), `β-reduce: put ${printC(e.arg).text} in for ${e.x}`);
  if (e.k === 'double' && e.a.k === 'num') {
    if (e.a.v === 0) return here(num(0), 'double 0 matches the first case: | 0 => 0');
    const k = e.a.v - 1;
    return here(add(dbl(num(k)), num(2)), `${e.a.v} is ${k} + 1, so the second case fires: | k + 1 => double k + 2, with k = ${k}`);
  }
  if (strategy === 'add' && e.k === 'add' && e.a.k === 'num' && e.b.k === 'num') {
    if (e.b.v === 0) return here(e.a, `n + 0 = n: the first case of Nat.add`);
    return here({ k: 'succ', a: add(e.a, num(e.b.v - 1)) }, `${e.b.v} is Nat.succ ${e.b.v - 1}, so n + Nat.succ m = Nat.succ (n + m)`);
  }
  for (const [j, c] of kids(e).entries()) {
    const r = findRedex(c, strategy, [...path, j]);
    if (r) return { ...r, path: r.path, resultPath: r.resultPath };
  }
  if (e.k === 'succ' && e.a.k === 'num') return here(num(e.a.v + 1), `Nat.succ ${e.a.v} is the numeral ${e.a.v + 1}`);
  if (e.k === 'add' && e.a.k === 'num' && e.b.k === 'num') return here(num(e.a.v + e.b.v), `${e.a.v} + ${e.b.v} computes to ${e.a.v + e.b.v}`);
  if (e.k === 'mul' && e.a.k === 'num' && e.b.k === 'num') return here(num(e.a.v * e.b.v), `${e.a.v} * ${e.b.v} computes to ${e.a.v * e.b.v}`);
  return null;
}

function replaceAt(e: CExpr, path: number[], v: CExpr): CExpr {
  if (!path.length) return v;
  const [j, ...rest] = path;
  switch (e.k) {
    case 'add': case 'mul': return j === 0 ? { ...e, a: replaceAt(e.a, rest, v) } : { ...e, b: replaceAt(e.b, rest, v) };
    case 'double': case 'succ': return { ...e, a: replaceAt(e.a, rest, v) };
    case 'beta': return j === 0 ? { ...e, body: replaceAt(e.body, rest, v) } : { ...e, arg: replaceAt(e.arg, rest, v) };
    default: return e;
  }
}

export interface CStep {
  /** The expression at this step, as Lean source. */
  text: string;
  /** In this step's text: the redex the NEXT step reduces. */
  redex: Highlight | null;
  /** In this step's text: what the previous step produced. */
  result: Highlight | null;
  /** Why this step follows from the previous one ('' for the first). */
  why: string;
}

/** All steps from `e` to a numeral (bounded). */
export function reduce(e: CExpr, strategy: Strategy, max = 40): CStep[] {
  const steps: CStep[] = [{ text: printC(e).text, redex: null, result: null, why: '' }];
  let cur = e;
  for (let n = 0; n < max; n++) {
    const r = findRedex(cur, strategy);
    if (!r) break;
    steps[steps.length - 1].redex = printC(cur, r.path).span;
    cur = replaceAt(cur, r.path, r.result);
    const p = printC(cur, r.resultPath);
    steps.push({ text: p.text, redex: null, result: p.span, why: r.label });
  }
  return steps;
}

export interface ComputeCheck {
  /** For each step i ≥ 1: did `rfl` prove `step_(i-1) = step_i`? Index 0 is always true. */
  stepOk: boolean[];
  /** `rfl` proves `first = last`. */
  endOk: boolean;
  /** The engine's `#reduce` output for the first expression. */
  reduced: string | null;
  /** The exact source checked. */
  source: string;
}

/** Check every equation `step_i = step_(i+1)` and `start = value` with `rfl`, in one engine call. */
export function checkSteps(engine: Engine, env: Env, steps: CStep[]): ComputeCheck {
  const lines: { text: string; at: number }[] = [];
  let source = '';
  const push = (t: string) => { lines.push({ text: t, at: source.length }); source += t + '\n'; };
  for (let i = 1; i < steps.length; i++) push(`example : ${steps[i - 1].text} = ${steps[i].text} := rfl`);
  push(`example : ${steps[0].text} = ${steps[steps.length - 1].text} := rfl`);
  const reduceAt = source.length;
  source += `#reduce ${steps[0].text}\n`;
  const r = engine.check(env, source);
  const bad = (k: number) => {
    const from = lines[k].at;
    const to = from + lines[k].text.length;
    return r.diagnostics.some((d) => d.severity === 'error' && d.from < to && d.to > from);
  };
  const stepOk = [true, ...steps.slice(1).map((_, i) => !bad(i))];
  const endOk = !bad(lines.length - 1) && r.decls.length >= lines.length;
  const out = r.diagnostics.find((d) => d.code === 'command-output' && d.from >= reduceAt);
  return { stepOk, endOk, reduced: out ? out.message.trim() : null, source };
}

/** Is `lhs = rhs` provable by `rfl`? (For the "your guess" box.) */
export function rflCheck(engine: Engine, env: Env, lhs: string, rhs: string): { ok: boolean; message: string | null } {
  if (/[\n]|:=|\bby\b/.test(rhs) || !rhs.trim()) return { ok: false, message: 'Type a Nat expression, such as 6 or double 2 + 2.' };
  const r = engine.check(env, `example : ${lhs} = ${rhs.trim()} := rfl`);
  const err = r.diagnostics.find((d) => d.severity === 'error');
  return { ok: !err && r.ok, message: err ? err.message : null };
}

// ---------------------------------------------------------------------------------------------------------
// Presets

export const RW_PRESETS: RewritePreset[] = [
  { id: 'comm', label: 'x + y + z', binders: '(x y z : Nat)', goal: 'x + y + z = z + y + x', rules: ['Nat.add_comm', 'Nat.add_comm x y', 'Nat.add_comm z y', 'Nat.add_comm y z', 'Nat.add_assoc'], level: 'nat-11', note: 'With no arguments, rw rewrites the first match it finds. Arguments pick the occurrence.' },
  { id: 'rev', label: 'b + 1 = 5', binders: '(a b : Nat) (h : a = b) (ha : a + 1 = 5)', goal: 'b + 1 = 5', rules: ['← h', 'h'], level: 'eq-04', note: 'h says a = b, so rw [h] looks for a. The goal has b, so it needs ← h.' },
  { id: 'zero', label: 'a + 0 = b', binders: '(a b : Nat) (h : a = b)', goal: 'a + 0 = b', rules: ['h', '← h', 'Nat.add_zero'], level: 'eq-06', note: 'The same goal, three different rules, three different results.' },
  { id: 'every', label: 'a + a = 2 * a', binders: '(a b : Nat) (h : a = b)', goal: 'a + a = 2 * a', rules: ['h', '← h'], level: 'eq-06', note: 'rw replaces every occurrence of the matched term at once.' },
  { id: 'succ', label: 'a + (b + 1) = 6', binders: '(a b : Nat) (h : a + b = 5)', goal: 'a + (b + 1) = 6', rules: ['h', 'Nat.add_succ'], level: 'nat-03', note: 'h needs a + b, which only shows up after Nat.add_succ. Rewrite, then continue from the result.' },
];

export interface ComputePreset {
  id: string;
  label: string;
  strategy: Strategy;
  make: (a: number, b: number) => CExpr;
  /** Ranges for the two adjustable numbers (b unused when null). */
  a: [number, number, number];
  b: [number, number, number] | null;
  level: string;
}

export const COMPUTE_PRESETS: ComputePreset[] = [
  { id: 'double', label: 'double 3', strategy: 'double', make: (a) => dbl(num(a)), a: [0, 6, 3], b: null, level: 'nat-02' },
  { id: 'add', label: '2 + 3', strategy: 'add', make: (a, b) => add(num(a), num(b)), a: [0, 9, 2], b: [0, 5, 3], level: 'nat-03' },
  {
    id: 'beta', label: '(fun x => x + 1) 2 * 2', strategy: 'arith',
    make: (a, b) => mul({ k: 'beta', x: 'x', body: add({ k: 'var', x: 'x' }, num(1)), arg: num(a) }, num(b)),
    a: [0, 9, 2], b: [0, 9, 2], level: 'eq-01',
  },
];

/** The game's own `double`, from level nat-02 (the UI reads it from content; this copy is for tests). */
export const DOUBLE_DEF = 'def double (n : Nat) : Nat :=\n  match n with\n  | 0 => 0\n  | k + 1 => double k + 2';
