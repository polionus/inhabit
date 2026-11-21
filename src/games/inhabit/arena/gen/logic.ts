/**
 * Formulas for the Arena generator: propositional connectives plus first-order quantifiers over a
 * single sort, printed as Lean 4 source; classical truth tables; and Dyckhoff's contraction-free
 * sequent calculus G4ip, a terminating decision procedure for intuitionistic propositional logic.
 */

/** `P` (no args), `p x`, `r x y`. In set mode an atom `A` with arg `x` means `x ∈ A`. */
export interface Atom {
  t: 'atom';
  p: string;
  args: string[];
}
export type F =
  | Atom
  | { t: 'bot' }
  | { t: 'top' }
  | { t: 'not'; a: F }
  | { t: 'and' | 'or' | 'imp' | 'iff'; a: F; b: F }
  | { t: 'all' | 'ex'; x: string; a: F };

export const atom = (p: string, ...args: string[]): F => ({ t: 'atom', p, args });
export const bot: F = { t: 'bot' };
export const top: F = { t: 'top' };
export const not = (a: F): F => ({ t: 'not', a });
export const and = (a: F, b: F): F => ({ t: 'and', a, b });
export const or = (a: F, b: F): F => ({ t: 'or', a, b });
export const imp = (a: F, b: F): F => ({ t: 'imp', a, b });
export const iff = (a: F, b: F): F => ({ t: 'iff', a, b });
export const all = (x: string, a: F): F => ({ t: 'all', x, a });
export const ex = (x: string, a: F): F => ({ t: 'ex', x, a });

/** `a → b → … → goal` */
export const imps = (hyps: F[], goal: F): F => hyps.reduceRight((acc, h) => imp(h, acc), goal);

const SYM: Record<string, string> = { and: '∧', or: '∨', imp: '→', iff: '↔' };

const keyCache = new WeakMap<F, string>();
/** Structural key, invariant under renaming of bound variables. */
export function key(f: F): string {
  const c = keyCache.get(f);
  if (c !== undefined) return c;
  const k = keyIn(f, []);
  keyCache.set(f, k);
  return k;
}
function keyIn(f: F, bound: string[]): string {
  switch (f.t) {
    case 'atom': {
      if (f.args.length === 0) return f.p;
      const args = f.args.map((a) => {
        const i = bound.lastIndexOf(a);
        return i < 0 ? a : '#' + (bound.length - 1 - i);
      });
      return f.p + '(' + args.join(',') + ')';
    }
    case 'bot':
      return '⊥';
    case 'top':
      return '⊤';
    case 'not':
      return '¬' + keyIn(f.a, bound);
    case 'all':
    case 'ex':
      return (f.t === 'all' ? '∀' : '∃') + '.' + keyIn(f.a, [...bound, f.x]);
    default:
      return '(' + keyIn(f.a, bound) + SYM[f.t] + keyIn(f.b, bound) + ')';
  }
}
export const same = (a: F, b: F) => key(a) === key(b);

/** Free element variables. */
export function freeVars(f: F, out: Set<string> = new Set(), bound: string[] = []): Set<string> {
  switch (f.t) {
    case 'atom':
      for (const a of f.args) if (!bound.includes(a)) out.add(a);
      break;
    case 'bot':
    case 'top':
      break;
    case 'not':
      freeVars(f.a, out, bound);
      break;
    case 'all':
    case 'ex':
      freeVars(f.a, out, [...bound, f.x]);
      break;
    default:
      freeVars(f.a, out, bound);
      freeVars(f.b, out, bound);
  }
  return out;
}

/** Capture-avoiding substitution of the element variable `x` by `y`. */
export function subst(f: F, x: string, y: string): F {
  switch (f.t) {
    case 'atom':
      return f.args.includes(x) ? { t: 'atom', p: f.p, args: f.args.map((a) => (a === x ? y : a)) } : f;
    case 'bot':
    case 'top':
      return f;
    case 'not':
      return not(subst(f.a, x, y));
    case 'all':
    case 'ex': {
      if (f.x === x) return f;
      if (f.x === y) {
        // rename the binder to avoid capture
        let z = y + "'";
        const fv = freeVars(f.a);
        while (fv.has(z) || z === x) z += "'";
        const body = subst(f.a, f.x, z);
        return { t: f.t, x: z, a: subst(body, x, y) };
      }
      return { t: f.t, x: f.x, a: subst(f.a, x, y) };
    }
    default:
      return { t: f.t, a: subst(f.a, x, y), b: subst(f.b, x, y) };
  }
}

/** Substitute propositional atoms (by name, args ignored) with formulas. */
export function substAtoms(f: F, m: Record<string, F>): F {
  switch (f.t) {
    case 'atom':
      return m[f.p] ?? f;
    case 'bot':
    case 'top':
      return f;
    case 'not':
      return not(substAtoms(f.a, m));
    case 'all':
    case 'ex':
      return { t: f.t, x: f.x, a: substAtoms(f.a, m) };
    default:
      return { t: f.t, a: substAtoms(f.a, m), b: substAtoms(f.b, m) };
  }
}

/** Predicate / proposition names in order of first occurrence. */
export function atomNames(f: F, out: string[] = []): string[] {
  switch (f.t) {
    case 'atom':
      if (!out.includes(f.p)) out.push(f.p);
      break;
    case 'bot':
    case 'top':
      break;
    case 'not':
    case 'all':
    case 'ex':
      atomNames(f.a, out);
      break;
    default:
      atomNames(f.a, out);
      atomNames(f.b, out);
  }
  return out;
}

export function size(f: F): number {
  switch (f.t) {
    case 'atom':
    case 'bot':
    case 'top':
      return 0;
    case 'not':
    case 'all':
    case 'ex':
      return 1 + size(f.a);
    default:
      return 1 + size(f.a) + size(f.b);
  }
}
export function depth(f: F): number {
  switch (f.t) {
    case 'atom':
    case 'bot':
    case 'top':
      return 0;
    case 'not':
    case 'all':
    case 'ex':
      return 1 + depth(f.a);
    default:
      return 1 + Math.max(depth(f.a), depth(f.b));
  }
}
/** Count nodes satisfying `pred`. */
export function count(f: F, pred: (g: F) => boolean): number {
  const here = pred(f) ? 1 : 0;
  switch (f.t) {
    case 'atom':
    case 'bot':
    case 'top':
      return here;
    case 'not':
    case 'all':
    case 'ex':
      return here + count(f.a, pred);
    default:
      return here + count(f.a, pred) + count(f.b, pred);
  }
}

/* ------------------------------------------------------------------ printing */

export interface Style {
  /** Print an atom. Default: `P`, `p x`, `r x y`. */
  atom?(a: Atom): string;
  /** Print `¬a` for an atom specially (e.g. `x ∉ A`); return undefined for the default. */
  notAtom?(a: Atom): string | undefined;
  /** Print `∧` as `×` (Type mode). */
  prod?: boolean;
}

/** Sort of element variables, used to annotate binders whose type Lean cannot infer. */
export const ELEM_SORT = 'α';

/** `¬¬∀ x, …`: does the printed form end in an open-ended binder? */
const endsInBinder = (f: F): boolean => f.t === 'all' || f.t === 'ex' || (f.t === 'not' && endsInBinder(f.a));

type Pos = 'top' | 'not' | 'andL' | 'andR' | 'orL' | 'orR' | 'impL' | 'impR' | 'iff';

function needParens(f: F, pos: Pos): boolean {
  switch (f.t) {
    case 'atom':
    case 'bot':
    case 'top':
      return false;
    case 'not':
      // `¬∀ x, …` extends as far right as a quantifier does
      return endsInBinder(f.a) && pos !== 'top' && pos !== 'impR' && pos !== 'not';
    case 'and':
      return pos === 'not' || pos === 'andL' || pos === 'orL' || pos === 'orR';
    case 'or':
      return pos === 'not' || pos === 'andL' || pos === 'andR' || pos === 'orL';
    case 'imp':
      return pos !== 'top' && pos !== 'impR';
    case 'iff':
      return pos !== 'top';
    case 'all':
    case 'ex':
      return pos !== 'top' && pos !== 'impR' && pos !== 'not';
  }
}

export const defaultAtom = (a: Atom) => (a.args.length ? a.p + ' ' + a.args.join(' ') : a.p);

/** Lean source for a formula (readable parentheses: `∧` inside `∨` is bracketed). */
export function show(f: F, st: Style = {}, pos: Pos = 'top'): string {
  const s = showRaw(f, st);
  return needParens(f, pos) ? '(' + s + ')' : s;
}
function showRaw(f: F, st: Style): string {
  switch (f.t) {
    case 'atom':
      return (st.atom ?? defaultAtom)(f);
    case 'bot':
      return 'False';
    case 'top':
      return 'True';
    case 'not': {
      if (f.a.t === 'atom' && st.notAtom) {
        const s = st.notAtom(f.a);
        if (s !== undefined) return s;
      }
      return '¬' + show(f.a, st, 'not');
    }
    case 'and':
      return show(f.a, st, 'andL') + (st.prod ? ' × ' : ' ∧ ') + show(f.b, st, 'andR');
    case 'or':
      return show(f.a, st, 'orL') + ' ∨ ' + show(f.b, st, 'orR');
    case 'imp':
      return show(f.a, st, 'impL') + ' → ' + show(f.b, st, 'impR');
    case 'iff':
      return show(f.a, st, 'iff') + ' ↔ ' + show(f.b, st, 'iff');
    case 'all':
    case 'ex': {
      // a binder not used in its body gets a type ascription (Lean cannot infer it)
      if (!freeVars(f.a).has(f.x)) {
        return (f.t === 'all' ? '∀ (' : '∃ (') + f.x + ' : ' + ELEM_SORT + '), ' + show(f.a, st, 'top');
      }
      const xs = [f.x];
      let body = f.a;
      while (body.t === f.t && freeVars(body.a).has(body.x)) {
        xs.push(body.x);
        body = body.a;
      }
      return (f.t === 'all' ? '∀ ' : '∃ ') + xs.join(' ') + ', ' + show(body, st, 'top');
    }
  }
}

/* ------------------------------------------------------------------ truth tables */

export function evalF(f: F, v: Record<string, boolean>): boolean {
  switch (f.t) {
    case 'atom':
      return !!v[defaultAtom(f)];
    case 'bot':
      return false;
    case 'top':
      return true;
    case 'not':
      return !evalF(f.a, v);
    case 'and':
      return evalF(f.a, v) && evalF(f.b, v);
    case 'or':
      return evalF(f.a, v) || evalF(f.b, v);
    case 'imp':
      return !evalF(f.a, v) || evalF(f.b, v);
    case 'iff':
      return evalF(f.a, v) === evalF(f.b, v);
    default:
      throw new Error('evalF: quantifier');
  }
}

/** Propositional atoms as printed strings (for truth tables). */
function propAtoms(f: F, out: string[] = []): string[] {
  switch (f.t) {
    case 'atom': {
      const s = defaultAtom(f);
      if (!out.includes(s)) out.push(s);
      break;
    }
    case 'bot':
    case 'top':
      break;
    case 'not':
      propAtoms(f.a, out);
      break;
    case 'all':
    case 'ex':
      throw new Error('propAtoms: quantifier');
    default:
      propAtoms(f.a, out);
      propAtoms(f.b, out);
  }
  return out;
}

/** A falsifying assignment, or null when the formula is a classical tautology. */
export function countermodel(f: F): Record<string, boolean> | null {
  const as = propAtoms(f);
  for (let m = 0; m < 1 << as.length; m++) {
    const v: Record<string, boolean> = {};
    as.forEach((a, i) => (v[a] = !!(m & (1 << i))));
    if (!evalF(f, v)) return v;
  }
  return null;
}

/* ------------------------------------------------------------------ G4ip */

/** Desugar to {atom, ⊥, ∧, ∨, →}. */
function core(f: F): F {
  switch (f.t) {
    case 'atom':
    case 'bot':
      return f;
    case 'top':
      return imp(bot, bot);
    case 'not':
      return imp(core(f.a), bot);
    case 'iff': {
      const a = core(f.a);
      const b = core(f.b);
      return and(imp(a, b), imp(b, a));
    }
    case 'and':
    case 'or':
    case 'imp':
      return { t: f.t, a: core(f.a), b: core(f.b) };
    default:
      throw new Error('G4ip: quantifier');
  }
}

/**
 * Intuitionistic provability of `hyps ⊢ goal` (propositional) by G4ip. Terminates on every input;
 * `budget` caps the number of sequents visited (returns null when exceeded).
 */
export function g4ip(hyps: F[], goal: F, budget = 200000): boolean | null {
  const memo = new Map<string, boolean>();
  let visits = 0;
  const seqKey = (g: F[], c: F) => g.map(key).sort().join(',') + '⊢' + key(c);
  const without = (g: F[], i: number) => g.slice(0, i).concat(g.slice(i + 1));

  function prove(g: F[], c: F): boolean {
    const k = seqKey(g, c);
    const m = memo.get(k);
    if (m !== undefined) return m;
    if (++visits > budget) throw new Error('budget');
    memo.set(k, false); // cycle guard (G4ip never cycles, but be safe)
    const r = step(g, c);
    memo.set(k, r);
    return r;
  }

  function step(g: F[], c: F): boolean {
    const ck = key(c);
    for (const a of g) {
      if (a.t === 'bot') return true;
      if (a.t === 'atom' && key(a) === ck) return true;
    }
    // invertible left rules
    for (let i = 0; i < g.length; i++) {
      const a = g[i];
      const rest = without(g, i);
      if (a.t === 'and') return prove([...rest, a.a, a.b], c);
      if (a.t === 'or') return prove([...rest, a.a], c) && prove([...rest, a.b], c);
      if (a.t === 'imp') {
        const ant = a.a;
        if (ant.t === 'bot') return prove(rest, c);
        if (ant.t === 'atom' && g.some((h) => h.t === 'atom' && key(h) === key(ant))) return prove([...rest, a.b], c);
        if (ant.t === 'and') return prove([...rest, imp(ant.a, imp(ant.b, a.b))], c);
        if (ant.t === 'or') return prove([...rest, imp(ant.a, a.b), imp(ant.b, a.b)], c);
      }
    }
    // invertible right rules
    if (c.t === 'and') return prove(g, c.a) && prove(g, c.b);
    if (c.t === 'imp') return prove([...g, c.a], c.b);
    // non-invertible
    if (c.t === 'or' && (prove(g, c.a) || prove(g, c.b))) return true;
    for (let i = 0; i < g.length; i++) {
      const a = g[i];
      if (a.t === 'imp' && a.a.t === 'imp') {
        const rest = without(g, i);
        const { a: cc, b: d } = a.a;
        if (prove([...rest, imp(d, a.b)], imp(cc, d)) && prove([...rest, a.b], c)) return true;
      }
    }
    return false;
  }

  try {
    return prove(hyps.map(core), core(goal));
  } catch {
    return null;
  }
}

export type Validity = 'intuitionistic' | 'classical' | 'invalid';

/** Classify a propositional formula. */
export function classify(f: F): Validity {
  if (countermodel(f)) return 'invalid';
  return g4ip([], f) ? 'intuitionistic' : 'classical';
}

/* ------------------------------------------------------------------ parser (for schema literals) */

/**
 * Parse a formula written like Lean: `¬ ∧ ∨ → ↔ False True ∀ ∃`, atoms `P` or `p x y`.
 * Throws on malformed input (only used on literals in this directory).
 */
export function parse(src: string): F {
  const toks = src.match(/[A-Za-z_][A-Za-z0-9_']*|[¬∧∨→↔∀∃(),]/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const eat = (t?: string) => {
    const x = toks[i++];
    if (t !== undefined && x !== t) throw new Error(`parse: expected ${t}, got ${x} in ${src}`);
    return x;
  };
  const isIdent = (t: string | undefined) => t !== undefined && /^[A-Za-z_]/.test(t);
  function pIff(): F {
    const a = pImp();
    if (peek() === '↔') {
      eat();
      return iff(a, pImp());
    }
    return a;
  }
  function pImp(): F {
    const a = pOr();
    if (peek() === '→') {
      eat();
      return imp(a, pImp());
    }
    return a;
  }
  function pOr(): F {
    const a = pAnd();
    if (peek() === '∨') {
      eat();
      return or(a, pOr());
    }
    return a;
  }
  function pAnd(): F {
    const a = pUn();
    if (peek() === '∧') {
      eat();
      return and(a, pAnd());
    }
    return a;
  }
  function pUn(): F {
    const t = peek();
    if (t === '¬') {
      eat();
      return not(pUn());
    }
    if (t === '∀' || t === '∃') {
      eat();
      const xs: string[] = [];
      while (isIdent(peek())) xs.push(eat());
      eat(',');
      const body = pIff();
      return xs.reduceRight((acc, x) => (t === '∀' ? all(x, acc) : ex(x, acc)), body);
    }
    if (t === '(') {
      eat();
      const f = pIff();
      eat(')');
      return f;
    }
    if (t === 'False') {
      eat();
      return bot;
    }
    if (t === 'True') {
      eat();
      return top;
    }
    if (isIdent(t)) {
      const p = eat();
      const args: string[] = [];
      // lower-case predicate names take lower-case arguments
      if (/^[a-z]/.test(p)) while (isIdent(peek()) && /^[a-z]/.test(peek()!) && peek() !== 'False') args.push(eat());
      return { t: 'atom', p, args };
    }
    throw new Error(`parse: unexpected ${t} in ${src}`);
  }
  const f = pIff();
  if (i !== toks.length) throw new Error(`parse: trailing input in ${src}`);
  return f;
}
