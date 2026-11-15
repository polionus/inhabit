/**
 * Recognise the HEAD of a printed Lean expression (a proposition, or a set expression).
 *
 * Works on the engine's pretty-printed strings. It never builds a full syntax tree: it finds the
 * outermost connective respecting brackets, Lean's precedences and binders, and hands back the
 * two (or one) sub-strings so a caller can look deeper by calling `parse` again.
 *
 * Pure TypeScript, no DOM. Never throws.
 */

export type Kind =
  // propositions
  | 'forall' | 'exists' | 'imp' | 'iff' | 'or' | 'and' | 'not'
  | 'eq' | 'ne' | 'mem' | 'nmem' | 'subset' | 'dvd' | 'rel'
  | 'false' | 'true' | 'pred' | 'atom'
  // expressions (sets, functions)
  | 'inter' | 'union' | 'diff' | 'compl' | 'empty' | 'setof' | 'image' | 'preimage' | 'lambda';

export interface Parsed {
  kind: Kind;
  /** The (trimmed, de-parenthesised) text that was parsed. */
  text: string;
  /** Left operand / the single operand (`¬A` has `a = A`) / binder body (`∀ x, B` has `b = B`). */
  a?: string;
  b?: string;
  /** Binder text, e.g. `x`, `(x : α)`, `x y`. */
  binder?: string;
  /** Bound variable names. */
  vars?: string[];
  /** Operator symbol for `rel` (`<`, `≤`, …). */
  op?: string;
  /** Head identifier and the rest of the text for `pred` / `atom` applications. */
  head?: string;
  args?: string;
}

interface OpDef {
  sym: string;
  prec: number;
  kind: Kind;
  /** Left-associative operators split at the last occurrence, others at the first. */
  left?: boolean;
}

const OPS: OpDef[] = [
  { sym: '↔', prec: 20, kind: 'iff' },
  { sym: '→', prec: 25, kind: 'imp' },
  { sym: '∨', prec: 30, kind: 'or' },
  { sym: '∧', prec: 35, kind: 'and' },
  { sym: '≠', prec: 50, kind: 'ne' },
  { sym: '∉', prec: 50, kind: 'nmem' },
  { sym: '∈', prec: 50, kind: 'mem' },
  { sym: '⊆', prec: 50, kind: 'subset' },
  { sym: '⊂', prec: 50, kind: 'rel' },
  { sym: '∣', prec: 50, kind: 'dvd' },
  { sym: '≤', prec: 50, kind: 'rel' },
  { sym: '≥', prec: 50, kind: 'rel' },
  { sym: '<', prec: 50, kind: 'rel' },
  { sym: '>', prec: 50, kind: 'rel' },
  { sym: '=', prec: 50, kind: 'eq' },
  { sym: '∪', prec: 65, kind: 'union', left: true },
  { sym: '∩', prec: 70, kind: 'inter', left: true },
  { sym: '\\', prec: 70, kind: 'diff', left: true },
  { sym: "''", prec: 80, kind: 'image' },
  { sym: "⁻¹'", prec: 80, kind: 'preimage' },
];

const OPENERS = '([{⟨';
const CLOSERS = ')]}⟩';

const isIdent = (c: string | undefined) => !!c && /[\p{L}\p{N}_.'!?]/u.test(c);

export function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Remove one layer of parentheses while the first `(` matches the last `)`. */
export function stripParens(input: string): string {
  let s = norm(input);
  for (let guard = 0; guard < 20 && s.length >= 2 && s[0] === '(' && s[s.length - 1] === ')'; guard++) {
    let depth = 0;
    let closesAtEnd = true;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (OPENERS.includes(c)) depth++;
      else if (CLOSERS.includes(c)) {
        depth--;
        if (depth === 0 && i < s.length - 1) {
          closesAtEnd = false;
          break;
        }
      }
    }
    if (!closesAtEnd) break;
    s = norm(s.slice(1, -1));
  }
  return s;
}

interface Found {
  op: OpDef;
  pos: number;
}

/** Depth-0 operators before the first binder, and the position of that binder (-1 if none). */
function scan(s: string): { found: Found[]; binderPos: number } {
  const found: Found[] = [];
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (OPENERS.includes(c)) {
      depth++;
      continue;
    }
    if (CLOSERS.includes(c)) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;
    if (c === '∃' && found.length > 0 && (found[found.length - 1].op.kind === 'or' || found[found.length - 1].op.kind === 'and')) {
      // The printer does not always bracket a trailing `∃` that sits inside a larger implication, as in
      // `(∃ x, P x) ∨ ∃ x, Q x → R`. Read the binder as ending at the first arrow, which is how people mean it.
      const arrow = trailingArrow(s, i);
      if (arrow) {
        found.push(arrow);
        return { found, binderPos: -1 };
      }
    }
    if (c === '∀' || c === '∃' || c === 'λ') return { found, binderPos: i };
    if (c === 'f' && s.startsWith('fun', i) && !isIdent(s[i - 1]) && !isIdent(s[i + 3])) return { found, binderPos: i };
    // `=>` and `↦` belong to lambdas, and `:=` to let/defs: not an equation
    if (c === '=' && (s[i + 1] === '>' || s[i - 1] === ':')) continue;
    if (c === '<' && s[i - 1] === '←') continue;
    for (const op of OPS) {
      if (s.startsWith(op.sym, i)) {
        // set-builder bars and primes inside identifiers are not operators
        if (op.sym === "''" && !(s[i - 1] === ' ' && s[i + 2] === ' ')) continue;
        if (op.sym === '\\' && !(s[i - 1] === ' ')) continue;
        found.push({ op, pos: i });
        i += op.sym.length - 1;
        break;
      }
    }
  }
  return { found, binderPos: -1 };
}

/** After the comma of the binder at `from`, the first depth-0 `→` or `↔`. */
function trailingArrow(s: string, from: number): Found | null {
  let depth = 0;
  let afterComma = false;
  for (let j = from + 1; j < s.length; j++) {
    const ch = s[j];
    if (OPENERS.includes(ch)) depth++;
    else if (CLOSERS.includes(ch)) depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      if (ch === ',') afterComma = true;
      else if (afterComma && (ch === '→' || ch === '↔')) return { op: OPS.find((o) => o.sym === ch)!, pos: j };
    }
  }
  return null;
}

function splitBinder(s: string, binderPos: number): { binder: string; body: string; kind: Kind } | null {
  const start = s[binderPos];
  const isFun = start === 'λ' || start === 'f';
  let i = binderPos + (start === 'f' ? 3 : 1);
  if (s[i] === '!') i++; // ∃!
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (OPENERS.includes(c)) depth++;
    else if (CLOSERS.includes(c)) depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      if (!isFun && c === ',') return { binder: norm(s.slice(i, j)), body: norm(s.slice(j + 1)), kind: start === '∀' ? 'forall' : 'exists' };
      if (isFun && (s.startsWith('=>', j) || c === '↦')) return { binder: norm(s.slice(i, j)), body: norm(s.slice(j + (c === '↦' ? 1 : 2))), kind: 'lambda' };
    }
  }
  return null;
}

/** Names bound by a binder text such as `x`, `x y`, `(x : α)`, `(x y : α) (z : β)`, `x ∈ A`. */
export function binderVars(binder: string): string[] {
  const out: string[] = [];
  const groups: string[] = [];
  let m: RegExpExecArray | null;
  if (binder.includes('(')) {
    const re2 = /[({\[]\s*([^:(){}\[\]]*?)\s*:/gu;
    while ((m = re2.exec(binder))) groups.push(m[1]);
  } else {
    const head = binder.split(/[:∈<>≤≥]/u)[0];
    groups.push(head);
  }
  for (const g of groups) for (const n of g.split(/\s+/)) if (n && n !== '_') out.push(n);
  return out;
}

/** Local definitions the learner can unfold (or `intro` through), with what they mean. */
export interface PredInfo {
  /** One phrase for "what the definition says", with `{0}`, `{1}` for the arguments. */
  means: string;
  /** How a learner gets into it. */
  intro?: string[];
  /** What unfolding gives, for descriptions. */
  unfolds?: string;
}

export const PREDICATES: Record<string, PredInfo> = {
  'Function.Injective': { means: 'different inputs of `{0}` never give the same output: from `{0} a = {0} b` you can conclude `a = b`', intro: ['a', 'b', 'h'] },
  'Function.Surjective': { means: 'every output `b` is hit: there is an `a` with `{0} a = b`', intro: ['b'] },
  'Function.Bijective': { means: '`{0}` is both injective and surjective', intro: [] },
  'Function.LeftInverse': { means: '`{0}` undoes `{1}`: `{0} ({1} x) = x` for every `x`', intro: ['x'] },
  'Function.RightInverse': { means: '`{1}` undoes `{0}`: `{1} ({0} x) = x` for every `x`', intro: ['x'] },
  Even: { means: '`{0}` is a double: `{0} = r + r` for some `r`' },
  Odd: { means: '`{0}` is one more than a double: `{0} = 2 * r + 1` for some `r`' },
  Monotone: { means: '`{0}` never decreases as its input grows', intro: ['a', 'b', 'h'] },
  Disjoint: { means: 'the two sets share no element' },
  Set: { means: 'a type of sets' },
};

const IDENT_RE = /^[\p{L}_][\p{L}\p{N}_.'!?₀-₉]*/u;

/** Parse the head of `input`. `locals` are variable names in scope (a local `P x` is an atom, not a definition). */
export function parse(input: string, locals?: ReadonlySet<string>): Parsed {
  try {
    return parseInner(input, locals);
  } catch {
    return { kind: 'atom', text: norm(input) };
  }
}

function parseInner(input: string, locals?: ReadonlySet<string>): Parsed {
  const s = stripParens(input);
  const text = s;
  if (!s) return { kind: 'atom', text };
  const { found, binderPos } = scan(s);
  const startsNot = s.startsWith('¬');
  const usable = startsNot ? found.filter((f) => f.op.prec <= 40) : found;

  if (usable.length) {
    const lowest = Math.min(...usable.map((f) => f.op.prec));
    const cands = usable.filter((f) => f.op.prec === lowest);
    const pick = cands[0].op.left ? cands[cands.length - 1] : cands[0];
    const a = norm(s.slice(0, pick.pos));
    const b = norm(s.slice(pick.pos + pick.op.sym.length));
    const p: Parsed = { kind: pick.op.kind, text, a, b };
    if (pick.op.kind === 'rel') p.op = pick.op.sym;
    return p;
  }
  if (startsNot) return { kind: 'not', text, a: norm(s.slice(1)) };
  if (binderPos === 0) {
    const sb = splitBinder(s, 0);
    if (sb) return { kind: sb.kind, text, binder: sb.binder, vars: binderVars(sb.binder), b: sb.body };
  }
  if (s === 'False') return { kind: 'false', text };
  if (s === 'True') return { kind: 'true', text };
  if (s === '∅') return { kind: 'empty', text };
  if (s.startsWith('{') && s.endsWith('}') && /\|/.test(s)) return { kind: 'setof', text };
  if (s.endsWith('ᶜ')) return { kind: 'compl', text, a: norm(s.slice(0, -1)) };
  const m = IDENT_RE.exec(s);
  if (m) {
    const head = m[0];
    const args = norm(s.slice(head.length));
    const known = Object.prototype.hasOwnProperty.call(PREDICATES, head) && !locals?.has(head);
    if (known) return { kind: 'pred', text, head, args };
    return { kind: 'atom', text, head, args };
  }
  return { kind: 'atom', text };
}

export interface TBinder {
  name: string;
  /** Implicit binders are not written when applying (`h : A ⊆ B` is used as `h hx`). */
  implicit: boolean;
}

/** Split a top-level argument string into arguments, respecting brackets. */
export function splitArgs(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of args) {
    if (OPENERS.includes(ch)) depth++;
    else if (CLOSERS.includes(ch)) depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const wrap = (t: string) => (/[\s]/.test(t) && !/^\(.*\)$/.test(t) ? `(${t})` : t);

/** What a definition says, as a plain proposition (only for the few that are used as ∀/→ chains). */
export function unfoldPred(p: Parsed): { text: string; implicit: string[] } | null {
  if (p.kind !== 'pred' || !p.head) return null;
  const a = splitArgs(p.args ?? '').map(wrap);
  switch (p.head) {
    case 'Function.Injective':
      return a.length >= 1 ? { text: `∀ a b, ${a[0]} a = ${a[0]} b → a = b`, implicit: ['a', 'b'] } : null;
    case 'Function.Surjective':
      return a.length >= 1 ? { text: `∀ b, ∃ a, ${a[0]} a = b`, implicit: [] } : null;
    case 'Function.LeftInverse':
      return a.length >= 2 ? { text: `∀ x, ${a[0]} (${a[1]} x) = x`, implicit: [] } : null;
    case 'Function.RightInverse':
      return a.length >= 2 ? { text: `∀ x, ${a[1]} (${a[0]} x) = x`, implicit: [] } : null;
    default:
      return null;
  }
}

/** Split `A → B → C` into premises `[A, B]` and the final conclusion `C`, descending through `∀`. */
export function telescope(input: string, locals?: ReadonlySet<string>): { binders: TBinder[]; premises: string[]; conclusion: string } {
  const binders: TBinder[] = [];
  const premises: string[] = [];
  let cur = stripParens(input);
  let implicit = new Set<string>();
  for (let guard = 0; guard < 12; guard++) {
    const p = parse(cur, locals);
    if (p.kind === 'imp' && p.a !== undefined && p.b !== undefined) {
      premises.push(p.a);
      cur = p.b;
    } else if (p.kind === 'forall' && p.b !== undefined) {
      for (const v of p.vars ?? []) binders.push({ name: v, implicit: implicit.has(v) });
      cur = p.b;
    } else if (p.kind === 'subset' && p.a !== undefined && p.b !== undefined) {
      binders.push({ name: 'x', implicit: true });
      premises.push(`x ∈ ${p.a}`);
      cur = `x ∈ ${p.b}`;
    } else if (p.kind === 'not' && p.a !== undefined) {
      premises.push(p.a);
      cur = 'False';
    } else if (p.kind === 'pred') {
      const u = unfoldPred(p);
      if (!u) break;
      implicit = new Set(u.implicit);
      cur = u.text;
    } else break;
  }
  return { binders, premises, conclusion: cur };
}

/** Does `needle` occur in `hay` as a whole expression (not inside a longer identifier)? */
export function occurs(needle: string, hay: string): boolean {
  const n = norm(needle);
  if (!n) return false;
  let from = 0;
  for (;;) {
    const i = hay.indexOf(n, from);
    if (i < 0) return false;
    const before = hay[i - 1];
    const after = hay[i + n.length];
    const okBefore = !isIdent(n[0]) || !isIdent(before);
    const okAfter = !isIdent(n[n.length - 1]) || !isIdent(after);
    if (okBefore && okAfter) return true;
    from = i + 1;
  }
}

/**
 * Could `pattern` (whose `vars` are wildcards) match `target` exactly? Returns the bindings, or null.
 */
export function matchBind(pattern: string, vars: readonly string[], target: string): Record<string, string> | null {
  const p = stripParens(pattern);
  const t = stripParens(target);
  if (p === t) {
    const same: Record<string, string> = {};
    for (const v of vars) if (occurs(v, p)) same[v] = v;
    return same;
  }
  if (!vars.length) return null;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = new Set(vars);
  const order: string[] = [];
  const parts = p.split(/([\p{L}_][\p{L}\p{N}_.'₀-₉]*)/u);
  const rx = parts
    .map((part) => {
      if (names.has(part)) {
        order.push(part);
        return '(.+?)';
      }
      return esc(part).replace(/\s+/g, '\\s+');
    })
    .join('');
  try {
    const m = new RegExp('^' + rx + '$', 'u').exec(t);
    if (!m) return null;
    const out: Record<string, string> = {};
    for (let i = 0; i < order.length; i++) {
      const v = norm(m[i + 1]);
      if (out[order[i]] !== undefined && out[order[i]] !== v) return null;
      out[order[i]] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/** Replace whole-expression occurrences of `from` by `to` in `text`. */
export function replaceAll(text: string, from: string, to: string): string {
  const n = norm(from);
  if (!n) return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf(n, i);
    if (at < 0) break;
    const before = text[at - 1];
    const after = text[at + n.length];
    const ok = (!isIdent(n[0]) || !isIdent(before)) && (!isIdent(n[n.length - 1]) || !isIdent(after));
    if (ok) {
      out += text.slice(i, at) + to;
      i = at + n.length;
    } else {
      out += text.slice(i, at + 1);
      i = at + 1;
    }
  }
  return out + text.slice(i);
}
