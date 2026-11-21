/**
 * The kernel: an independent type checker for closed, metavariable-free terms.
 * Every declaration is re-checked here after elaboration, so a bug in the elaborator or a
 * tactic cannot make a wrong proof "complete".
 */
import type { Expr } from './expr.ts';
import {
  exprEq,
  getAppArgs,
  getAppFn,
  instantiate1,
  instantiateExprLevelParams,
  mkApp,
  mkBVar,
  mkConst,
  mkFVar,
  mkLam,
  mkPi,
  mkSort,
  abstractFVars,
} from './expr.ts';
import type { Level } from './level.ts';
import { limax, levelEquiv, lsucc, lzero } from './level.ts';
import type { Environment } from './env.ts';
import { Fuel, Reducer, natCtorView } from './reduce.ts';

export class KernelError extends Error {}

let nextFVarId = 1_000_000;
export const freshFVarId = (): number => nextFVarId++;

interface KLocal {
  name: string;
  type: Expr;
  value?: Expr;
}

export class TypeChecker {
  readonly env: Environment;
  readonly fuel: Fuel;
  readonly red: Reducer;
  readonly lctx = new Map<number, KLocal>();
  /** universe parameters in scope */
  readonly levelParams: string[];
  private inferCache = new Map<Expr, Expr>();

  constructor(env: Environment, fuel: Fuel, levelParams: string[] = []) {
    this.env = env;
    this.fuel = fuel;
    this.levelParams = levelParams;
    this.red = new Reducer(env, fuel, { fvarValue: (id) => this.lctx.get(id)?.value }, 'all');
  }

  whnf(e: Expr): Expr {
    return this.red.whnf(e);
  }

  private pushLocal(name: string, type: Expr, value?: Expr): Expr {
    const id = freshFVarId();
    this.lctx.set(id, { name, type, value });
    return mkFVar(id);
  }

  ensureSort(e: Expr, ctx: Expr): Level {
    if (e.k === 'sort') return e.level;
    const w = this.whnf(e);
    if (w.k === 'sort') return w.level;
    throw new KernelError(`type expected (kernel), got a term whose type is not a sort`);
    void ctx;
  }

  ensurePi(e: Expr): Expr & { k: 'pi' } {
    if (e.k === 'pi') return e;
    const w = this.whnf(e);
    if (w.k === 'pi') return w;
    throw new KernelError('function expected (kernel)');
  }

  /** Infer and check. */
  infer(e: Expr): Expr {
    const c = this.inferCache.get(e);
    if (c) return c;
    this.fuel.tick();
    const t = this.inferCore(e);
    if (e.lb === 0) this.inferCache.set(e, t);
    return t;
  }

  private inferCore(e: Expr): Expr {
    switch (e.k) {
      case 'bvar':
        throw new KernelError('unexpected bound variable');
      case 'mvar':
        throw new KernelError('unexpected metavariable in kernel term');
      case 'fvar': {
        const d = this.lctx.get(e.id);
        if (!d) throw new KernelError('unknown free variable');
        return d.type;
      }
      case 'sort':
        return mkSort(lsucc(e.level));
      case 'const': {
        const d = this.env.get(e.name);
        if (!d) throw new KernelError(`unknown constant '${e.name}'`);
        if (d.levelParams.length !== e.levels.length) {
          throw new KernelError(`incorrect number of universe levels for '${e.name}'`);
        }
        return instantiateExprLevelParams(d.type, d.levelParams, e.levels);
      }
      case 'lit':
        return mkConst(typeof e.value === 'bigint' ? 'Nat' : 'String');
      case 'app': {
        const fnType = this.ensurePi(this.infer(e.fn));
        const argType = this.infer(e.arg);
        if (!this.isDefEq(argType, fnType.type)) {
          throw new KernelError('application type mismatch (kernel)');
        }
        return instantiate1(fnType.body, e.arg);
      }
      case 'lam': {
        this.ensureSort(this.infer(e.type), e.type);
        const x = this.pushLocal(e.name, e.type);
        const bodyType = this.infer(instantiate1(e.body, x));
        return mkPi(e.name, e.type, abstractFVars(bodyType, [x.k === 'fvar' ? x.id : -1]), e.bi);
      }
      case 'pi': {
        const u = this.ensureSort(this.infer(e.type), e.type);
        const x = this.pushLocal(e.name, e.type);
        const v = this.ensureSort(this.infer(instantiate1(e.body, x)), e.body);
        return mkSort(limax(u, v));
      }
      case 'let': {
        this.ensureSort(this.infer(e.type), e.type);
        const vt = this.infer(e.value);
        if (!this.isDefEq(vt, e.type)) throw new KernelError('let value type mismatch (kernel)');
        return this.infer(instantiate1(e.body, e.value));
      }
    }
  }

  isProp(type: Expr): boolean {
    const s = this.whnf(this.infer(type));
    return s.k === 'sort' && s.level.k === 'zero';
  }

  isProof(e: Expr): boolean {
    try {
      return this.isProp(this.infer(e));
    } catch (err) {
      if (err instanceof KernelError) return false;
      throw err;
    }
  }

  isDefEq(a: Expr, b: Expr): boolean {
    this.fuel.tick();
    if (exprEq(a, b)) return true;
    if (a.k === 'sort' && b.k === 'sort') return levelEquiv(a.level, b.level);
    const a1 = this.red.whnfCore(a);
    const b1 = this.red.whnfCore(b);
    if (exprEq(a1, b1)) return true;
    if (this.proofIrrel(a1, b1)) return true;
    return this.lazyDelta(a1, b1);
  }

  private proofIrrel(a: Expr, b: Expr): boolean {
    if (a.k === 'sort' || a.k === 'pi' || b.k === 'sort' || b.k === 'pi') return false;
    let ta: Expr;
    try {
      ta = this.infer(a);
      if (!this.isProp(ta)) return false;
    } catch (err) {
      if (err instanceof KernelError) return false;
      throw err;
    }
    return this.isDefEq(ta, this.infer(b));
  }

  private height(e: Expr): number {
    const f = getAppFn(e);
    if (f.k !== 'const') return -1;
    const d = this.env.get(f.name);
    if (!d || (d.value === undefined && !d.matchDef) || d.kind !== 'def') return -1;
    return d.height ?? 0;
  }

  private lazyDelta(a: Expr, b: Expr): boolean {
    for (;;) {
      this.fuel.tick();
      const ha = this.height(a);
      const hb = this.height(b);
      if (ha < 0 && hb < 0) return this.structural(a, b);
      const fa = getAppFn(a);
      const fb = getAppFn(b);
      if (ha >= 0 && hb >= 0 && fa.k === 'const' && fb.k === 'const' && fa.name === fb.name) {
        if (this.sameArgs(a, b)) return true;
      }
      const [a2, b2] = unfoldPair(this.red, a, b, ha, hb);
      if (a2 === null && b2 === null) return this.structural(a, b);
      a = this.red.whnfCore(a2 ?? a);
      b = this.red.whnfCore(b2 ?? b);
      if (exprEq(a, b)) return true;
    }
  }

  private sameArgs(a: Expr, b: Expr): boolean {
    const fa = getAppFn(a);
    const fb = getAppFn(b);
    if (fa.k !== 'const' || fb.k !== 'const') return false;
    if (fa.levels.length !== fb.levels.length || !fa.levels.every((l, i) => levelEquiv(l, fb.levels[i]))) return false;
    const xa = getAppArgs(a);
    const xb = getAppArgs(b);
    if (xa.length !== xb.length) return false;
    for (let i = 0; i < xa.length; i++) if (!this.isDefEq(xa[i], xb[i])) return false;
    return true;
  }

  private structural(a: Expr, b: Expr): boolean {
    if (exprEq(a, b)) return true;
    if (a.k === 'sort' && b.k === 'sort') return levelEquiv(a.level, b.level);
    if ((a.k === 'lam' && b.k === 'lam') || (a.k === 'pi' && b.k === 'pi')) {
      if (!this.isDefEq(a.type, b.type)) return false;
      const x = this.pushLocal(a.name, a.type);
      return this.isDefEq(instantiate1(a.body, x), instantiate1(b.body, x));
    }
    // η
    if (a.k === 'lam' && b.k !== 'lam') return this.etaExpand(a, b);
    if (b.k === 'lam' && a.k !== 'lam') return this.etaExpand(b, a);
    // Nat literals vs constructors
    const na = natCtorView(a);
    const nb = natCtorView(b);
    if (na && nb && (a.k === 'lit' || b.k === 'lit')) {
      if (na.k === 'zero' || nb.k === 'zero') return na.k === nb.k;
      return this.isDefEq(na.pred, nb.pred);
    }
    if (a.k === 'app' && b.k === 'app') {
      const fa = getAppFn(a);
      const fb = getAppFn(b);
      const xa = getAppArgs(a);
      const xb = getAppArgs(b);
      if (xa.length === xb.length && this.isDefEq(fa, fb)) {
        let ok = true;
        for (let i = 0; i < xa.length && ok; i++) ok = this.isDefEq(xa[i], xb[i]);
        if (ok) return true;
      }
    }
    if (a.k === 'const' && b.k === 'const') {
      return a.name === b.name && a.levels.length === b.levels.length && a.levels.every((l, i) => levelEquiv(l, b.levels[i]));
    }
    if (a.k === 'fvar' && b.k === 'fvar') return a.id === b.id;
    // unit-like / proof irrelevance was already tried
    return false;
  }

  private etaExpand(lam: Expr & { k: 'lam' }, other: Expr): boolean {
    const t = this.whnf(this.infer(other));
    if (t.k !== 'pi') return false;
    const x = this.pushLocal(lam.name, lam.type);
    return this.isDefEq(instantiate1(lam.body, x), mkApp(other, x));
  }

  /** Check a closed declaration value against its type. */
  checkDecl(type: Expr, value: Expr | undefined): void {
    this.ensureSort(this.infer(type), type);
    if (value !== undefined) {
      const vt = this.infer(value);
      if (!this.isDefEq(vt, type)) throw new KernelError('declaration type mismatch (kernel)');
    }
  }
}

/** Build `Π (xs), body` / `λ (xs), body` from fvars of a kernel checker. */
export function closeOver(tc: TypeChecker, k: 'lam' | 'pi', xs: Expr[], body: Expr): Expr {
  let r = abstractFVars(body, xs.map((x) => (x.k === 'fvar' ? x.id : -1)));
  for (let i = xs.length - 1; i >= 0; i--) {
    const x = xs[i];
    if (x.k !== 'fvar') throw new KernelError('closeOver: not a free variable');
    const d = tc.lctx.get(x.id)!;
    const ty = abstractFVars(d.type, xs.slice(0, i).map((y) => (y.k === 'fvar' ? y.id : -1)));
    r = k === 'lam' ? mkLam(d.name, ty, r) : mkPi(d.name, ty, r);
  }
  return r;
}

/**
 * Lazy δ: unfold the side with the greater definitional height (both when equal);
 * if that side is stuck (e.g. an equation-compiled definition on a variable), try the other.
 */
export function unfoldPair(red: Reducer, a: Expr, b: Expr, ha: number, hb: number): [Expr | null, Expr | null] {
  let a2: Expr | null = null;
  let b2: Expr | null = null;
  if (ha >= hb) {
    a2 = ha >= 0 ? red.unfoldHead(a) : null;
    if (ha === hb || a2 === null) b2 = hb >= 0 ? red.unfoldHead(b) : null;
  } else {
    b2 = red.unfoldHead(b);
    if (b2 === null && ha >= 0) a2 = red.unfoldHead(a);
  }
  return [a2, b2];
}

export const PROP = mkSort(lzero);
export { mkBVar };
