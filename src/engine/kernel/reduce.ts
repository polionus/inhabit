/**
 * Weak-head reduction shared by the kernel type checker and the elaborator:
 * β (application of λ), ζ (let), δ (unfolding definitions, respecting transparency),
 * ι (recursor on constructor, equation-compiled definitions on constructor patterns),
 * plus accelerated arithmetic on Nat literals.
 */
import type { Expr } from './expr.ts';
import {
  getAppArgs,
  getAppFn,
  instantiate1,
  instantiateExprLevelParams,
  instantiateRev,
  mkApp,
  mkAppN,
  mkConst,
  mkNatLit,
} from './expr.ts';
import type { ConstDecl, Environment, MatchDef, Pat, Reducibility } from './env.ts';

export type Transparency = 'all' | 'default' | 'instances' | 'reducible';

export class TimeoutError extends Error {
  constructor() {
    super('(deterministic) timeout: maximum number of reduction steps exceeded');
  }
}

export class Fuel {
  n: number;
  constructor(n: number) {
    this.n = n;
  }
  tick(k = 1): void {
    this.n -= k;
    if (this.n < 0) throw new TimeoutError();
  }
}

export interface ReduceHooks {
  /** value of an assigned metavariable, if any */
  mvarValue?(id: number): Expr | undefined;
  /** value of a let-bound local, if any */
  fvarValue?(id: number): Expr | undefined;
}

const NAT_BIN: Record<string, (a: bigint, b: bigint) => bigint> = {
  'Nat.add': (a, b) => a + b,
  'Nat.mul': (a, b) => a * b,
  'Nat.sub': (a, b) => (a > b ? a - b : 0n),
  'Nat.div': (a, b) => (b === 0n ? 0n : a / b),
  'Nat.mod': (a, b) => (b === 0n ? a : a % b),
  'Nat.pow': (a, b) => a ** b,
};

export function canUnfold(d: ConstDecl, t: Transparency): boolean {
  if (d.value === undefined && d.matchDef === undefined) return false;
  if (d.kind !== 'def') return false;
  const r: Reducibility = d.reducibility ?? 'default';
  switch (t) {
    case 'all':
      return true;
    case 'default':
      return r !== 'irreducible';
    case 'instances':
      return r === 'reducible' || r === 'instance';
    case 'reducible':
      return r === 'reducible';
  }
}

/** `Nat` constructor view of a term (without reduction): zero / succ x / null. */
export function natCtorView(e: Expr): { k: 'zero' } | { k: 'succ'; pred: Expr } | null {
  if (e.k === 'lit' && typeof e.value === 'bigint') {
    return e.value === 0n ? { k: 'zero' } : { k: 'succ', pred: mkNatLit(e.value - 1n) };
  }
  const f = getAppFn(e);
  if (f.k !== 'const') return null;
  if (f.name === 'Nat.zero' && e.k === 'const') return { k: 'zero' };
  if (f.name === 'Nat.succ' && e.k === 'app' && e.fn === f) return { k: 'succ', pred: e.arg };
  if (f.name === 'Nat.add' && e.k === 'app') {
    const args = getAppArgs(e);
    if (args.length === 2 && args[1].k === 'lit' && typeof args[1].value === 'bigint' && args[1].value > 0n) {
      const n = args[1].value;
      return { k: 'succ', pred: n === 1n ? args[0] : mkAppN(f, [args[0], mkNatLit(n - 1n)]) };
    }
  }
  return null;
}

export class Reducer {
  readonly env: Environment;
  transparency: Transparency;
  readonly fuel: Fuel;
  readonly hooks: ReduceHooks;

  constructor(env: Environment, fuel: Fuel, hooks: ReduceHooks = {}, transparency: Transparency = 'default') {
    this.env = env;
    this.fuel = fuel;
    this.hooks = hooks;
    this.transparency = transparency;
  }

  withTransparency<T>(t: Transparency, f: () => T): T {
    const old = this.transparency;
    this.transparency = t;
    try {
      return f();
    } finally {
      this.transparency = old;
    }
  }

  /** β, ζ, ι, mvar/let-fvar instantiation — no δ. */
  whnfCore(e: Expr): Expr {
    for (;;) {
      this.fuel.tick();
      switch (e.k) {
        case 'let':
          e = instantiate1(e.body, e.value);
          continue;
        case 'mvar': {
          const v = this.hooks.mvarValue?.(e.id);
          if (v) {
            e = v;
            continue;
          }
          return e;
        }
        case 'fvar': {
          const v = this.hooks.fvarValue?.(e.id);
          if (v) {
            e = v;
            continue;
          }
          return e;
        }
        case 'app': {
          const f0 = getAppFn(e);
          const f = this.whnfCore(f0);
          if (f.k === 'lam') {
            e = betaRev(f, getAppArgs(e));
            continue;
          }
          if (f.k === 'const') {
            const d = this.env.get(f.name);
            if (d?.rec) {
              const r = this.iota(d, f, getAppArgs(e));
              if (r) {
                e = r;
                continue;
              }
            }
          }
          return f === f0 ? e : mkAppN(f, getAppArgs(e));
        }
        default:
          return e;
      }
    }
  }

  /** ι-reduction of a recursor application. */
  private iota(d: ConstDecl, fn: Expr & { k: 'const' }, args: Expr[]): Expr | null {
    const rec = d.rec!;
    const majorIdx = rec.numParams + 1 + rec.numMinors + rec.numIndices;
    if (args.length <= majorIdx) return null;
    let major = this.whnf(args[majorIdx]);
    const view = this.toCtorApp(major);
    if (!view) return null;
    major = view;
    const mf = getAppFn(major);
    if (mf.k !== 'const') return null;
    const rule = rec.rules.find((r) => r.ctor === mf.name);
    if (!rule) return null;
    const margs = getAppArgs(major);
    const ctorDecl = this.env.get(mf.name)!;
    const np = ctorDecl.ctor!.numParams;
    if (margs.length !== np + rule.numFields) return null;
    const rhs = instantiateExprLevelParams(rule.rhs, d.levelParams, fn.levels);
    const head = args.slice(0, rec.numParams + 1 + rec.numMinors);
    const fields = margs.slice(np);
    const rest = args.slice(majorIdx + 1);
    return headBeta(mkAppN(mkAppN(mkAppN(rhs, head), fields), rest));
  }

  /** Nat literals as constructor applications. */
  private toCtorApp(e: Expr): Expr | null {
    if (e.k === 'lit' && typeof e.value === 'bigint') {
      return e.value === 0n ? mkConst('Nat.zero') : mkApp(mkConst('Nat.succ'), mkNatLit(e.value - 1n));
    }
    const f = getAppFn(e);
    if (f.k === 'const' && this.env.get(f.name)?.ctor) return e;
    return null;
  }

  /** One δ-step at the head (definition unfolding or equation-compiled match), after whnfCore. */
  unfoldHead(e: Expr): Expr | null {
    const f = getAppFn(e);
    if (f.k !== 'const') return null;
    const d = this.env.get(f.name);
    if (!d || !canUnfold(d, this.transparency)) return null;
    const args = getAppArgs(e);
    const nat = NAT_BIN[f.name];
    if (nat && args.length === 2) {
      const a = this.whnf(args[0]);
      const b = this.whnf(args[1]);
      if (a.k === 'lit' && b.k === 'lit' && typeof a.value === 'bigint' && typeof b.value === 'bigint') {
        return mkNatLit(nat(a.value, b.value));
      }
    }
    if (d.matchDef) return this.unfoldMatch(d, f, args);
    const v = instantiateExprLevelParams(d.value!, d.levelParams, f.levels);
    return headBeta(mkAppN(v, args));
  }

  private unfoldMatch(d: ConstDecl, fn: Expr & { k: 'const' }, args: Expr[]): Expr | null {
    const md: MatchDef = d.matchDef!;
    if (args.length < md.arity) return null;
    const fixed = args.slice(0, md.numFixed);
    const discrs = args.slice(md.numFixed, md.arity);
    for (const alt of md.alts) {
      const binds: Expr[] = [];
      let res: 'ok' | 'fail' | 'stuck' = 'ok';
      for (let i = 0; i < alt.pats.length && res === 'ok'; i++) res = this.matchPat(alt.pats[i], discrs[i], binds);
      if (res === 'stuck') return null;
      if (res === 'fail') continue;
      const rhs = instantiateExprLevelParams(alt.rhs, d.levelParams, fn.levels);
      return headBeta(mkAppN(rhs, [...fixed, ...binds, ...args.slice(md.arity)]));
    }
    return null;
  }

  private matchPat(p: Pat, e: Expr, binds: Expr[]): 'ok' | 'fail' | 'stuck' {
    switch (p.k) {
      case 'var':
        binds.push(e);
        return 'ok';
      case 'wild':
        return 'ok';
      case 'lit': {
        const w = this.whnf(e);
        if (w.k === 'lit') return w.value === p.value ? 'ok' : 'fail';
        const v = natCtorView(w);
        if (!v) return 'stuck';
        if (p.value === 0n) return v.k === 'zero' ? 'ok' : 'fail';
        if (v.k === 'zero') return 'fail';
        return this.matchPat({ k: 'lit', value: p.value - 1n }, v.pred, binds);
      }
      case 'ctor': {
        let v = natCtorView(e);
        if (!v && (p.name === 'Nat.succ' || p.name === 'Nat.zero')) v = natCtorView(this.whnf(e));
        if (v) {
          if (p.name === 'Nat.zero') return v.k === 'zero' ? 'ok' : 'fail';
          if (p.name === 'Nat.succ') return v.k === 'succ' ? this.matchPat(p.args[0], v.pred, binds) : 'fail';
          return 'stuck';
        }
        const w = this.whnf(e);
        const f = getAppFn(w);
        if (f.k !== 'const' || !this.env.get(f.name)?.ctor) return 'stuck';
        if (f.name !== p.name) return 'fail';
        const wargs = getAppArgs(w).slice(p.numParams);
        for (let i = 0; i < p.args.length; i++) {
          const r = this.matchPat(p.args[i], wargs[i], binds);
          if (r !== 'ok') return r;
        }
        return 'ok';
      }
    }
  }

  whnf(e: Expr): Expr {
    for (;;) {
      e = this.whnfCore(e);
      const u = this.unfoldHead(e);
      if (!u) return e;
      e = u;
    }
  }
}

/** Apply a λ to arguments (as many as it has binders), then the rest. */
export function betaRev(f: Expr, args: readonly Expr[]): Expr {
  let i = 0;
  let b = f;
  while (b.k === 'lam' && i < args.length) {
    b = b.body;
    i++;
  }
  const res = instantiateRev(b, args.slice(0, i));
  return mkAppN(res, args.slice(i));
}

export function headBeta(e: Expr): Expr {
  const f = getAppFn(e);
  if (f.k !== 'lam' || e.k !== 'app') return e;
  return headBeta(betaRev(f, getAppArgs(e)));
}
