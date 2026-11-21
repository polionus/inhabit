/**
 * Core terms of the type theory (locally nameless):
 * bound variables are de Bruijn indices, free variables (`fvar`) are hypotheses of a local
 * context, `mvar`s are holes (goals, placeholders) owned by the elaborator.
 *
 * Every node caches a few flags so that traversals can skip closed subterms.
 */
import type { Level } from './level.ts';
import { hasLevelMVar, hasLevelParam, instantiateLevelParams, levelEqStruct } from './level.ts';

export type BinderInfo = 'default' | 'implicit' | 'strict' | 'inst';

interface Flags {
  /** loose bound variable range: every loose bvar index is < lb */
  readonly lb: number;
  readonly fv: boolean;
  /** contains expression metavariables */
  readonly mv: boolean;
  /** contains universe-level metavariables */
  readonly lmv: boolean;
  /** contains universe-level parameters */
  readonly lp: boolean;
}

interface BinderFields {
  readonly name: string;
  readonly bi: BinderInfo;
  readonly type: Expr;
  readonly body: Expr;
}

export type Expr =
  | (Flags & { readonly k: 'bvar'; readonly idx: number })
  | (Flags & { readonly k: 'fvar'; readonly id: number })
  | (Flags & { readonly k: 'mvar'; readonly id: number })
  | (Flags & { readonly k: 'sort'; readonly level: Level })
  | (Flags & { readonly k: 'const'; readonly name: string; readonly levels: readonly Level[] })
  | (Flags & { readonly k: 'app'; readonly fn: Expr; readonly arg: Expr })
  | (Flags & BinderFields & { readonly k: 'lam' })
  | (Flags & BinderFields & { readonly k: 'pi' })
  | (Flags & {
      readonly k: 'let';
      readonly name: string;
      readonly type: Expr;
      readonly value: Expr;
      readonly body: Expr;
    })
  | (Flags & { readonly k: 'lit'; readonly value: bigint | string });

export type BVar = Extract<Expr, { k: 'bvar' }>;
export type FVar = Extract<Expr, { k: 'fvar' }>;
export type MVar = Extract<Expr, { k: 'mvar' }>;
export type Sort = Extract<Expr, { k: 'sort' }>;
export type Const = Extract<Expr, { k: 'const' }>;
export type App = Extract<Expr, { k: 'app' }>;
export type Binder = Extract<Expr, { k: 'lam' | 'pi' }>;
export type Let = Extract<Expr, { k: 'let' }>;
export type Lit = Extract<Expr, { k: 'lit' }>;

const closed = { lb: 0, fv: false, mv: false, lmv: false, lp: false };

export const mkBVar = (idx: number): Expr => ({ k: 'bvar', idx, ...closed, lb: idx + 1 });
export const mkFVar = (id: number): Expr => ({ k: 'fvar', id, ...closed, fv: true });
export const mkMVar = (id: number): Expr => ({ k: 'mvar', id, ...closed, mv: true });
export const mkSort = (level: Level): Expr => ({
  k: 'sort',
  level,
  ...closed,
  lmv: hasLevelMVar(level),
  lp: hasLevelParam(level),
});
export function mkConst(name: string, levels: readonly Level[] = []): Expr {
  let lmv = false;
  let lp = false;
  for (const l of levels) {
    if (hasLevelMVar(l)) lmv = true;
    if (hasLevelParam(l)) lp = true;
  }
  return { k: 'const', name, levels, ...closed, lmv, lp };
}
export const mkApp = (fn: Expr, arg: Expr): Expr => ({
  k: 'app',
  fn,
  arg,
  lb: Math.max(fn.lb, arg.lb),
  fv: fn.fv || arg.fv,
  mv: fn.mv || arg.mv,
  lmv: fn.lmv || arg.lmv,
  lp: fn.lp || arg.lp,
});
export function mkAppN(fn: Expr, args: readonly Expr[]): Expr {
  let e = fn;
  for (const a of args) e = mkApp(e, a);
  return e;
}
function binder(k: 'lam' | 'pi', name: string, bi: BinderInfo, type: Expr, body: Expr): Expr {
  return {
    k,
    name,
    bi,
    type,
    body,
    lb: Math.max(type.lb, body.lb - 1),
    fv: type.fv || body.fv,
    mv: type.mv || body.mv,
    lmv: type.lmv || body.lmv,
    lp: type.lp || body.lp,
  } as Expr;
}
export const mkLam = (name: string, type: Expr, body: Expr, bi: BinderInfo = 'default'): Expr =>
  binder('lam', name, bi, type, body);
export const mkPi = (name: string, type: Expr, body: Expr, bi: BinderInfo = 'default'): Expr =>
  binder('pi', name, bi, type, body);
export const mkArrow = (a: Expr, b: Expr): Expr => mkPi('a', a, liftLooseBVars(b, 0, 1));
export const mkLet = (name: string, type: Expr, value: Expr, body: Expr): Expr => ({
  k: 'let',
  name,
  type,
  value,
  body,
  lb: Math.max(type.lb, value.lb, body.lb - 1),
  fv: type.fv || value.fv || body.fv,
  mv: type.mv || value.mv || body.mv,
  lmv: type.lmv || value.lmv || body.lmv,
  lp: type.lp || value.lp || body.lp,
});
export const mkNatLit = (n: bigint | number): Expr => ({ k: 'lit', value: BigInt(n), ...closed });
export const mkStrLit = (s: string): Expr => ({ k: 'lit', value: s, ...closed });

/* ---------- application spine ---------- */

export function getAppFn(e: Expr): Expr {
  while (e.k === 'app') e = e.fn;
  return e;
}

export function getAppArgs(e: Expr): Expr[] {
  const args: Expr[] = [];
  while (e.k === 'app') {
    args.push(e.arg);
    e = e.fn;
  }
  return args.reverse();
}

export function getAppNumArgs(e: Expr): number {
  let n = 0;
  while (e.k === 'app') {
    n++;
    e = e.fn;
  }
  return n;
}

/** `c a₁ … aₙ` with head constant `name` and exactly `n` args (or any count if n < 0). */
export function isAppOf(e: Expr, name: string, n = -1): boolean {
  const f = getAppFn(e);
  return f.k === 'const' && f.name === name && (n < 0 || getAppNumArgs(e) === n);
}

export function constName(e: Expr): string | null {
  const f = getAppFn(e);
  return f.k === 'const' ? f.name : null;
}

/* ---------- generic traversal ---------- */

/**
 * Rebuild `e` bottom-up. `f(e, offset)` may return a replacement (not traversed further);
 * `offset` is the number of binders entered.
 */
export function replace(e: Expr, f: (e: Expr, offset: number) => Expr | undefined, offset = 0): Expr {
  const cache = new Map<Expr, Expr>();
  const go = (e: Expr, off: number): Expr => {
    const r = f(e, off);
    if (r !== undefined) return r;
    const key = off === 0 ? e : null;
    if (key) {
      const c = cache.get(key);
      if (c) return c;
    }
    let out: Expr;
    switch (e.k) {
      case 'app': {
        const fn = go(e.fn, off);
        const arg = go(e.arg, off);
        out = fn === e.fn && arg === e.arg ? e : mkApp(fn, arg);
        break;
      }
      case 'lam':
      case 'pi': {
        const t = go(e.type, off);
        const b = go(e.body, off + 1);
        out = t === e.type && b === e.body ? e : binder(e.k, e.name, e.bi, t, b);
        break;
      }
      case 'let': {
        const t = go(e.type, off);
        const v = go(e.value, off);
        const b = go(e.body, off + 1);
        out = t === e.type && v === e.value && b === e.body ? e : mkLet(e.name, t, v, b);
        break;
      }
      default:
        out = e;
    }
    if (key) cache.set(key, out);
    return out;
  };
  return go(e, offset);
}

/** Visit every subterm (pre-order). Return false from `f` to skip children. */
export function forEachExpr(e: Expr, f: (e: Expr, offset: number) => boolean | void): void {
  const seen = new Set<Expr>();
  const go = (e: Expr, off: number) => {
    if (off === 0) {
      if (seen.has(e)) return;
      seen.add(e);
    }
    if (f(e, off) === false) return;
    switch (e.k) {
      case 'app':
        go(e.fn, off);
        go(e.arg, off);
        break;
      case 'lam':
      case 'pi':
        go(e.type, off);
        go(e.body, off + 1);
        break;
      case 'let':
        go(e.type, off);
        go(e.value, off);
        go(e.body, off + 1);
        break;
    }
  };
  go(e, 0);
}

/* ---------- de Bruijn operations ---------- */

/** Shift loose bvars `>= start` by `d`. */
export function liftLooseBVars(e: Expr, start: number, d: number): Expr {
  if (d === 0 || e.lb <= start) return e;
  return replace(e, (x, off) => {
    if (x.lb <= start + off) return x;
    if (x.k === 'bvar') return mkBVar(x.idx + d);
    return undefined;
  });
}

/** Lower loose bvars `>= start` by `d` (caller guarantees none in [start-d, start)). */
export function lowerLooseBVars(e: Expr, start: number, d: number): Expr {
  if (d === 0 || e.lb <= start) return e;
  return replace(e, (x, off) => {
    if (x.lb <= start + off) return x;
    if (x.k === 'bvar') return mkBVar(x.idx - d);
    return undefined;
  });
}

/**
 * Replace loose bvars `0..subst.length-1` (bvar i ↦ subst[subst.length-1-i], i.e. "rev")
 * and lower the remaining ones.
 */
export function instantiateRev(e: Expr, subst: readonly Expr[]): Expr {
  if (e.lb === 0 || subst.length === 0) return e;
  const n = subst.length;
  const go = (x: Expr, off: number): Expr | undefined => {
    if (x.lb <= off) return x;
    if (x.k === 'bvar') {
      const i = x.idx - off;
      if (i < n) return liftLooseBVars(subst[n - 1 - i], 0, off);
      return mkBVar(x.idx - n);
    }
    if (x.k === 'app') {
      // like Lean's `instantiateBetaRevRange`: β-reduce when a λ lands in head position
      const h = getAppFn(x);
      if (h.k === 'bvar' && h.idx - off < n && h.idx >= off) {
        const v = subst[n - 1 - (h.idx - off)];
        if (v.k === 'lam') {
          const args = getAppArgs(x).map((a) => replace(a, go, off));
          return betaN(liftLooseBVars(v, 0, off), args);
        }
      }
    }
    return undefined;
  };
  return replace(e, go);
}

/** β-reduce `f a₁ … aₙ` where `f` is a λ (as many binders as there are arguments). */
export function betaN(f: Expr, args: readonly Expr[]): Expr {
  let i = 0;
  let b = f;
  while (b.k === 'lam' && i < args.length) {
    b = b.body;
    i++;
  }
  const res = instantiateRev(b, args.slice(0, i));
  return mkAppN(res, args.slice(i));
}

/** Instantiate the outermost loose bvar (index 0) with `v`. */
export const instantiate1 = (body: Expr, v: Expr): Expr => instantiateRev(body, [v]);

/** `instantiate(e, [a0, a1, ...])`: bvar i ↦ subst[i]. */
export function instantiate(e: Expr, subst: readonly Expr[]): Expr {
  return instantiateRev(e, [...subst].reverse());
}

export function hasLooseBVar(e: Expr, i: number): boolean {
  if (e.lb <= i) return false;
  let found = false;
  forEachExpr(e, (x, off) => {
    if (found || x.lb <= i + off) return false;
    if (x.k === 'bvar' && x.idx === i + off) found = true;
    return undefined;
  });
  return found;
}

/**
 * Abstract the given fvars: fvars[j] becomes bvar (n-1-j) (+ binder offset),
 * so that `mkLambda(fvars, abstract(e, fvars))` binds them left to right.
 */
export function abstractFVars(e: Expr, fvarIds: readonly number[]): Expr {
  if (!e.fv || fvarIds.length === 0) return e;
  const n = fvarIds.length;
  const pos = new Map<number, number>();
  fvarIds.forEach((id, j) => pos.set(id, j));
  return replace(e, (x, off) => {
    if (!x.fv) return x;
    if (x.k === 'fvar') {
      const j = pos.get(x.id);
      return j === undefined ? x : mkBVar(off + n - 1 - j);
    }
    return undefined;
  });
}

/** Replace fvars by expressions. */
export function replaceFVars(e: Expr, map: Map<number, Expr>): Expr {
  if (!e.fv || map.size === 0) return e;
  return replace(e, (x, off) => {
    if (!x.fv) return x;
    if (x.k === 'fvar') {
      const v = map.get(x.id);
      return v ? liftLooseBVars(v, 0, off) : x;
    }
    return undefined;
  });
}

export function hasFVar(e: Expr, id: number): boolean {
  if (!e.fv) return false;
  let found = false;
  forEachExpr(e, (x) => {
    if (found || !x.fv) return false;
    if (x.k === 'fvar' && x.id === id) found = true;
    return undefined;
  });
  return found;
}

export function collectFVars(e: Expr, out: Set<number>): void {
  if (!e.fv) return;
  forEachExpr(e, (x) => {
    if (!x.fv) return false;
    if (x.k === 'fvar') out.add(x.id);
    return undefined;
  });
}

export function collectMVars(e: Expr, out: Set<number>): void {
  if (!e.mv) return;
  forEachExpr(e, (x) => {
    if (!x.mv) return false;
    if (x.k === 'mvar') out.add(x.id);
    return undefined;
  });
}

export function instantiateExprLevelParams(e: Expr, names: readonly string[], vals: readonly Level[]): Expr {
  if (!e.lp || names.length === 0) return e;
  const ns = [...names];
  const vs = [...vals];
  return replace(e, (x) => {
    if (!x.lp) return x;
    if (x.k === 'sort') return mkSort(instantiateLevelParams(x.level, ns, vs));
    if (x.k === 'const') return mkConst(x.name, x.levels.map((l) => instantiateLevelParams(l, ns, vs)));
    return undefined;
  });
}

/** Structural equality (alpha-equivalence, since binder names are irrelevant). */
export function exprEq(a: Expr, b: Expr): boolean {
  if (a === b) return true;
  if (a.k !== b.k || a.lb !== b.lb) return false;
  switch (a.k) {
    case 'bvar':
      return a.idx === (b as typeof a).idx;
    case 'fvar':
    case 'mvar':
      return a.id === (b as typeof a).id;
    case 'sort':
      return levelEqStruct(a.level, (b as typeof a).level);
    case 'const': {
      const bb = b as typeof a;
      if (a.name !== bb.name || a.levels.length !== bb.levels.length) return false;
      return a.levels.every((l, i) => levelEqStruct(l, bb.levels[i]));
    }
    case 'app': {
      const bb = b as typeof a;
      return exprEq(a.fn, bb.fn) && exprEq(a.arg, bb.arg);
    }
    case 'lam':
    case 'pi': {
      const bb = b as typeof a;
      return exprEq(a.type, bb.type) && exprEq(a.body, bb.body);
    }
    case 'let': {
      const bb = b as typeof a;
      return exprEq(a.type, bb.type) && exprEq(a.value, bb.value) && exprEq(a.body, bb.body);
    }
    case 'lit':
      return a.value === (b as typeof a).value;
  }
}

/** Telescope helpers on closed binders. */
export function binderCount(e: Expr, k: 'lam' | 'pi'): number {
  let n = 0;
  while (e.k === k) {
    n++;
    e = e.body;
  }
  return n;
}

export const isProp = (e: Expr): boolean => e.k === 'sort' && e.level.k === 'zero';
