/**
 * The meta layer: metavariables, type inference on open terms, weak-head normalisation,
 * and the unifier (`isDefEq`) that solves metavariables.
 */
import type { BinderInfo, Expr } from '../kernel/expr.ts';
import {
  abstractFVars,
  collectFVars,
  exprEq,
  getAppArgs,
  getAppFn,
  instantiate1,
  instantiateExprLevelParams,
  mkApp,
  mkAppN,
  mkConst,
  mkFVar,
  mkLam,
  mkLet,
  mkMVar,
  mkNatLit,
  mkPi,
  mkSort,
  replace,
  instantiateRev,
} from '../kernel/expr.ts';
import type { Level } from '../kernel/level.ts';
import { levelEqStruct, levelEquiv, limax, lmvar, lsucc, mapLevelMVars, toNat } from '../kernel/level.ts';
import type { Environment } from '../kernel/env.ts';
import type { Transparency } from '../kernel/reduce.ts';
import { Fuel, Reducer, headBeta, natCtorView } from '../kernel/reduce.ts';
import { freshFVarId, unfoldPair } from '../kernel/typecheck.ts';
import type { LocalDecl } from './lctx.ts';
import { LocalContext } from './lctx.ts';

export type MVarKind = 'natural' | 'synthetic' | 'opaque';

export interface MVarDecl {
  readonly id: number;
  readonly lctx: LocalContext;
  readonly type: Expr;
  readonly kind: MVarKind;
  /** case tag / user-facing name (`?a`) */
  userName?: string;
}

export class MetaError extends Error {}

let nextMVarId = 1;

interface Delayed {
  fvars: number[];
  pending: number;
}

export class Meta {
  readonly env: Environment;
  readonly fuel: Fuel;
  readonly red: Reducer;
  /** every fvar ever created in this session */
  readonly fvars = new Map<number, LocalDecl>();
  readonly mvars = new Map<number, MVarDecl>();
  private assign = new Map<number, Expr>();
  private lassign = new Map<number, Level>();
  private delayed = new Map<number, Delayed>();
  private trail: (() => void)[] = [];
  private nextLMVar = 1;
  /** universe params in scope */
  levelParams: string[] = [];
  /** when true, synthetic-opaque metavariables may be assigned by the unifier */
  assignOpaque = false;

  constructor(env: Environment, fuel: Fuel) {
    this.env = env;
    this.fuel = fuel;
    this.red = new Reducer(env, fuel, {
      mvarValue: (id) => this.mvarValue(id),
      fvarValue: (id) => this.fvars.get(id)?.value,
    });
  }

  /* ---------------- state: save / restore ---------------- */

  mark(): number {
    return this.trail.length;
  }

  rollback(m: number): void {
    while (this.trail.length > m) this.trail.pop()!();
  }

  /** Run `f`; if it returns false or throws, undo all assignments made. */
  attempt(f: () => boolean): boolean {
    const m = this.mark();
    try {
      if (f()) return true;
    } catch (e) {
      this.rollback(m);
      throw e;
    }
    this.rollback(m);
    return false;
  }

  /* ---------------- metavariables ---------------- */

  mkFreshMVar(type: Expr, lctx: LocalContext, kind: MVarKind = 'natural', userName?: string): Expr {
    const id = nextMVarId++;
    this.mvars.set(id, { id, lctx, type, kind, userName });
    return mkMVar(id);
  }

  mkFreshLevelMVar(): Level {
    return lmvar(this.nextLMVar++);
  }

  /** `?u` with `Sort ?u`, then `?m : Sort ?u` — a fresh type. */
  mkFreshTypeMVar(lctx: LocalContext): Expr {
    return this.mkFreshMVar(mkSort(this.mkFreshLevelMVar()), lctx);
  }

  decl(id: number): MVarDecl {
    const d = this.mvars.get(id);
    if (!d) throw new MetaError(`unknown metavariable ?${id}`);
    return d;
  }

  isAssigned(id: number): boolean {
    return this.assign.has(id) || this.delayed.has(id);
  }

  getAssignment(id: number): Expr | undefined {
    return this.assign.get(id);
  }

  assignMVar(id: number, v: Expr): void {
    this.assign.set(id, v);
    this.trail.push(() => this.assign.delete(id));
  }

  assignDelayed(id: number, fvars: number[], pending: number): void {
    this.delayed.set(id, { fvars, pending });
    this.trail.push(() => this.delayed.delete(id));
  }

  private assignLevel(id: number, l: Level): void {
    this.lassign.set(id, l);
    this.trail.push(() => this.lassign.delete(id));
  }

  setMVarUserName(id: number, name: string | undefined): void {
    const d = this.decl(id);
    const old = d.userName;
    d.userName = name;
    this.trail.push(() => {
      d.userName = old;
    });
  }

  private mvarValue(id: number): Expr | undefined {
    const v = this.assign.get(id);
    if (v) return v;
    const d = this.delayed.get(id);
    if (d) {
      const p = this.instantiateMVars(mkMVar(d.pending));
      if (p.mv) return undefined;
      return this.mkLambdaFVarsRaw(d.fvars, p);
    }
    return undefined;
  }

  /* ---------------- local declarations ---------------- */

  /** Create a fresh local and register it. Returns the fvar and its declaration. */
  mkLocal(userName: string, type: Expr, bi: BinderInfo = 'default', value?: Expr, inaccessible = false): LocalDecl {
    const id = freshFVarId();
    const d: LocalDecl = { id, userName, type, bi, value, inaccessible };
    this.fvars.set(id, d);
    return d;
  }

  registerLocal(d: LocalDecl): void {
    this.fvars.set(d.id, d);
  }

  fvarDecl(id: number): LocalDecl {
    const d = this.fvars.get(id);
    if (!d) throw new MetaError('unknown free variable');
    return d;
  }

  /* ---------------- instantiation ---------------- */

  instantiateLevel(l: Level): Level {
    return mapLevelMVars(l, (id) => this.lassign.get(id));
  }

  instantiateMVars(e: Expr): Expr {
    if (!e.mv && !e.lmv) return e;
    return replace(e, (x) => {
      if (!x.mv && !x.lmv) return x;
      if (x.k === 'sort' && x.lmv) return mkSort(this.instantiateLevel(x.level));
      if (x.k === 'const' && x.lmv) return mkConst(x.name, x.levels.map((l) => this.instantiateLevel(l)));
      if (x.k === 'mvar') {
        const v = this.assign.get(x.id);
        if (v) {
          const r = this.instantiateMVars(v);
          if (r !== v) this.assign.set(x.id, r); // path compression (same value)
          return r;
        }
        const dv = this.mvarValue(x.id);
        return dv ? this.instantiateMVars(dv) : x;
      }
      if (x.k === 'app') {
        const f = getAppFn(x);
        if (f.k === 'mvar' && (this.assign.has(f.id) || this.delayed.has(f.id))) {
          const fv = this.instantiateMVars(f);
          if (fv !== f) {
            const args = getAppArgs(x).map((a) => this.instantiateMVars(a));
            return headBeta(mkAppN(fv, args));
          }
        }
      }
      return undefined;
    });
  }

  /* ---------------- abstraction with metavariable dependencies ---------------- */

  /**
   * Replace unassigned metavariables whose context contains any of `xs` by applications
   * `?n xs'` (natural: assigned; opaque: delayed), so that `xs` can be abstracted.
   */
  private elimMVarDeps(xs: number[], e: Expr): Expr {
    if (!e.mv) return e;
    const xset = new Set(xs);
    return replace(e, (x) => {
      if (!x.mv) return x;
      if (x.k !== 'mvar') return undefined;
      if (this.isAssigned(x.id)) return undefined;
      const d = this.decl(x.id);
      const deps = d.lctx.decls.filter((ld) => xset.has(ld.id)).map((ld) => ld.id);
      if (deps.length === 0) return x;
      const newLctx = d.lctx.remove(new Set(deps));
      const depsSet = new Set(deps);
      // type of the new mvar: Π deps, type
      const ty = this.mkForallFVars(deps, this.elimMVarDeps(deps, this.instantiateMVars(d.type)));
      void depsSet;
      const n = this.mkFreshMVar(ty, newLctx, d.kind === 'opaque' ? 'opaque' : d.kind, d.userName);
      const app = mkAppN(n, deps.map(mkFVar));
      if (d.kind === 'opaque') {
        this.assignDelayed(n.k === 'mvar' ? n.id : -1, deps, x.id);
      } else {
        this.assignMVar(x.id, app);
      }
      return app;
    });
  }

  private mkBinderFVarsRaw(k: 'lam' | 'pi', xs: number[], e: Expr): Expr {
    let r = abstractFVars(e, xs);
    for (let i = xs.length - 1; i >= 0; i--) {
      const d = this.fvarDecl(xs[i]);
      const ty = abstractFVars(this.instantiateMVars(d.type), xs.slice(0, i));
      if (d.value !== undefined) {
        const v = abstractFVars(this.instantiateMVars(d.value), xs.slice(0, i));
        r = mkLet(d.userName, ty, v, r);
      } else {
        r = k === 'lam' ? mkLam(d.userName, ty, r, d.bi) : mkPi(d.userName, ty, r, d.bi);
      }
    }
    return r;
  }

  private mkLambdaFVarsRaw(xs: number[], e: Expr): Expr {
    return this.mkBinderFVarsRaw('lam', xs, e);
  }

  mkLambdaFVars(xs: number[], e: Expr): Expr {
    if (xs.length === 0) return e;
    const ei = this.instantiateMVars(e);
    return this.mkBinderFVarsRaw('lam', xs, this.elimMVarDeps(xs, ei));
  }

  mkForallFVars(xs: number[], e: Expr): Expr {
    if (xs.length === 0) return e;
    const ei = this.instantiateMVars(e);
    return this.mkBinderFVarsRaw('pi', xs, this.elimMVarDeps(xs, ei));
  }

  /* ---------------- reduction ---------------- */

  whnf(e: Expr): Expr {
    return this.red.whnf(e);
  }

  whnfCore(e: Expr): Expr {
    return this.red.whnfCore(e);
  }

  whnfR(e: Expr): Expr {
    return this.red.withTransparency('reducible', () => this.red.whnf(e));
  }

  withTransparency<T>(t: Transparency, f: () => T): T {
    return this.red.withTransparency(t, f);
  }

  /** Unfold definitions until the head is a Π, or return null. */
  whnfToPi(e: Expr): (Expr & { k: 'pi' }) | null {
    if (e.k === 'pi') return e;
    const w = this.whnf(e);
    return w.k === 'pi' ? w : null;
  }

  /* ---------------- type inference ---------------- */

  inferType(e: Expr): Expr {
    this.fuel.tick();
    switch (e.k) {
      case 'bvar':
        throw new MetaError('unexpected bound variable');
      case 'fvar':
        return this.fvarDecl(e.id).type;
      case 'mvar':
        return this.decl(e.id).type;
      case 'sort':
        return mkSort(lsucc(e.level));
      case 'const': {
        const d = this.env.get(e.name);
        if (!d) throw new MetaError(`unknown constant '${e.name}'`);
        return instantiateExprLevelParams(d.type, d.levelParams, e.levels);
      }
      case 'lit':
        return mkConst(typeof e.value === 'bigint' ? 'Nat' : 'String');
      case 'app': {
        const f = getAppFn(e);
        const args = getAppArgs(e);
        let t = this.inferType(f);
        let j = 0;
        for (let i = 0; i < args.length; i++) {
          if (t.k !== 'pi') {
            t = instantiateRevArgs(t, args, j, i);
            j = i;
            const w = this.whnf(t);
            if (w.k !== 'pi') throw new MetaError('function expected');
            t = w;
          }
          t = (t as Expr & { k: 'pi' }).body;
        }
        return instantiateRevArgs(t, args, j, args.length);
      }
      case 'lam': {
        const d = this.mkLocal(e.name, e.type, e.bi);
        const x = mkFVar(d.id);
        const bt = this.inferType(instantiate1(e.body, x));
        return this.mkForallFVars([d.id], bt);
      }
      case 'pi': {
        const u = this.inferSortLevel(e.type);
        const d = this.mkLocal(e.name, e.type, e.bi);
        const v = this.inferSortLevel(instantiate1(e.body, mkFVar(d.id)));
        return mkSort(limax(u, v));
      }
      case 'let':
        return this.inferType(instantiate1(e.body, e.value));
    }
  }

  inferSortLevel(type: Expr): Level {
    const s = this.whnf(this.inferType(type));
    if (s.k === 'sort') return this.instantiateLevel(s.level);
    if (s.k === 'mvar') {
      const l = this.mkFreshLevelMVar();
      if (this.isDefEq(s, mkSort(l))) return this.instantiateLevel(l);
    }
    throw new MetaError('type expected');
  }

  /** Is `type` a proposition (its type is `Prop`)? */
  isProp(type: Expr): boolean {
    try {
      const s = this.whnf(this.inferType(type));
      return s.k === 'sort' && this.instantiateLevel(s.level).k === 'zero';
    } catch (e) {
      if (e instanceof MetaError) return false;
      throw e;
    }
  }

  isProof(e: Expr): boolean {
    try {
      return this.isProp(this.inferType(e));
    } catch (err) {
      if (err instanceof MetaError) return false;
      throw err;
    }
  }

  /* ---------------- unification ---------------- */

  isLevelDefEq(a: Level, b: Level): boolean {
    a = this.instantiateLevel(a);
    b = this.instantiateLevel(b);
    if (levelEqStruct(a, b)) return true;
    if (a.k === 'mvar') return this.assignLevelChecked(a.id, b);
    if (b.k === 'mvar') return this.assignLevelChecked(b.id, a);
    if (a.k === 'succ' && b.k === 'succ') return this.isLevelDefEq(a.l, b.l);
    if (a.k === 'succ' && b.k !== 'succ') {
      const n = toNat(b);
      if (n !== null) return false;
    }
    if (levelEquiv(a, b)) return true;
    // constraints involving max/imax with unknowns: accept (lenient; the kernel re-checks)
    if (hasMV(a) || hasMV(b)) return true;
    return false;
  }

  private assignLevelChecked(id: number, l: Level): boolean {
    if (hasMVId(l, id)) return levelEqStruct(l, lmvar(id));
    this.assignLevel(id, l);
    return true;
  }

  isDefEq(a: Expr, b: Expr): boolean {
    this.fuel.tick();
    if (a === b || exprEq(a, b)) return true;
    // instantiate assigned heads
    a = this.instHead(a);
    b = this.instHead(b);
    if (exprEq(a, b)) return true;
    if (a.k === 'sort' && b.k === 'sort') return this.isLevelDefEq(a.level, b.level);
    if ((a.k === 'lam' && b.k === 'lam') || (a.k === 'pi' && b.k === 'pi')) return this.isDefEqBinders(a, b);
    // metavariable assignment
    const ra = this.tryAssign(a, b);
    if (ra !== null) return ra;
    const rb = this.tryAssign(b, a);
    if (rb !== null) return rb;
    const a1 = this.whnfCore(a);
    const b1 = this.whnfCore(b);
    if (a1 !== a || b1 !== b) return this.isDefEq(a1, b1);
    // Nat offsets: `k + 1 =?= Nat.succ ?n`, `?n + 1 =?= 5`
    const off = this.isDefEqOffsetNat(a, b);
    if (off !== null) return off;
    if (this.isDefEqProofIrrel(a, b)) return true;
    return this.lazyDelta(a, b);
  }

  private instHead(e: Expr): Expr {
    const f = getAppFn(e);
    if (f.k !== 'mvar') return e;
    if (!this.assign.has(f.id) && !this.delayed.has(f.id)) return e;
    const v = this.mvarValue(f.id);
    if (!v) return e;
    return this.instHead(headBeta(mkAppN(v, getAppArgs(e))));
  }

  private isDefEqBinders(a: Expr & { k: 'lam' | 'pi' }, b: Expr & { k: 'lam' | 'pi' }): boolean {
    if (!this.isDefEq(a.type, b.type)) return false;
    const d = this.mkLocal(a.name, a.type, a.bi);
    const x = mkFVar(d.id);
    return this.isDefEq(instantiate1(a.body, x), instantiate1(b.body, x));
  }

  private assignable(id: number): boolean {
    if (this.isAssigned(id)) return false;
    const d = this.decl(id);
    return d.kind !== 'opaque' || this.assignOpaque;
  }

  /** `?m a₁ … aₙ =?= t`. Returns null when `lhs` is not an assignable metavariable application. */
  private tryAssign(lhs: Expr, rhs: Expr): boolean | null {
    const f = getAppFn(lhs);
    if (f.k !== 'mvar' || !this.assignable(f.id)) return null;
    const args = getAppArgs(lhs);
    // both sides flex: assign the newer one to the older one when possible
    const g = getAppFn(rhs);
    if (g.k === 'mvar' && args.length === 0 && getAppArgs(rhs).length === 0 && this.assignable(g.id) && g.id > f.id) {
      return this.checkAndAssign(g.id, [], lhs);
    }
    const isPattern = args.every((a, i) => a.k === 'fvar' && args.findIndex((b) => b.k === 'fvar' && b.id === a.id) === i);
    if (isPattern) {
      const r = this.attempt(() => this.checkAndAssign(f.id, args.map((a) => (a as { id: number }).id), rhs));
      if (r) return true;
    }
    // first-order approximation
    const rargs = getAppArgs(rhs);
    if (args.length > 0 && rargs.length >= args.length) {
      const k = rargs.length - args.length;
      const r = this.attempt(() => {
        if (!this.isDefEq(f, mkAppN(getAppFn(rhs), rargs.slice(0, k)))) return false;
        for (let i = 0; i < args.length; i++) if (!this.isDefEq(args[i], rargs[k + i])) return false;
        return true;
      });
      if (r) return true;
    }
    if (isPattern) {
      // maybe rhs reduces to something assignable
      const w = this.whnf(rhs);
      if (w !== rhs && !exprEq(w, rhs)) {
        return this.attempt(() => this.checkAndAssign(f.id, args.map((a) => (a as { id: number }).id), w));
      }
    }
    return false;
  }

  private checkAndAssign(id: number, xs: number[], rhs: Expr): boolean {
    const d = this.decl(id);
    let v = this.instantiateMVars(rhs);
    // occurs check
    if (v.mv && occursMVar(v, id)) return false;
    // scope check: free variables of v must be in ?m's context or among xs
    if (v.fv) {
      const fvs = new Set<number>();
      collectFVars(v, fvs);
      for (const fv of fvs) {
        if (!d.lctx.has(fv) && !xs.includes(fv)) {
          const ld = this.fvars.get(fv);
          if (ld?.value !== undefined) {
            v = replace(v, (x) => (x.k === 'fvar' && x.id === fv ? ld.value : undefined));
            continue;
          }
          return false;
        }
      }
    }
    if (xs.length > 0) v = this.mkLambdaFVars(xs, v);
    // type check (cheap cases skipped)
    if (!this.checkAssignmentType(d.type, v)) return false;
    this.assignMVar(id, v);
    return true;
  }

  private checkAssignmentType(mvType: Expr, v: Expr): boolean {
    try {
      const vt = this.inferType(v);
      return this.isDefEq(mvType, vt);
    } catch (e) {
      if (e instanceof MetaError) return false;
      throw e;
    }
  }

  /** View `e` as `base + k` with k > 0 (Nat literal, `Nat.succ`, `x + lit`). */
  private natOffset(e: Expr): { base: Expr | null; k: bigint } | null {
    if (e.k === 'lit' && typeof e.value === 'bigint') return { base: null, k: e.value };
    let k = 0n;
    let x = e;
    for (;;) {
      const f = getAppFn(x);
      if (f.k !== 'const') break;
      if (f.name === 'Nat.succ' && x.k === 'app' && x.fn === f) {
        k += 1n;
        x = x.arg;
        continue;
      }
      if (f.name === 'Nat.add' && x.k === 'app') {
        const args = getAppArgs(x);
        if (args.length === 2 && args[1].k === 'lit' && typeof args[1].value === 'bigint') {
          k += args[1].value;
          x = args[0];
          continue;
        }
      }
      break;
    }
    if (k === 0n) return null;
    if (x.k === 'lit' && typeof x.value === 'bigint') return { base: null, k: k + x.value };
    return { base: x, k };
  }

  private isDefEqOffsetNat(a: Expr, b: Expr): boolean | null {
    const oa = this.natOffset(a);
    const ob = this.natOffset(b);
    if (!oa || !ob) return null;
    if (oa.base === null && ob.base === null) return oa.k === ob.k;
    const m = oa.k < ob.k ? oa.k : ob.k;
    const mk = (o: { base: Expr | null; k: bigint }): Expr => {
      const r = o.k - m;
      if (o.base === null) return mkNatLit(r);
      return r === 0n ? o.base : mkAppN(mkConst('Nat.add'), [o.base, mkNatLit(r)]);
    };
    return this.isDefEq(mk(oa), mk(ob));
  }

  private isDefEqProofIrrel(a: Expr, b: Expr): boolean {
    if (a.k === 'sort' || a.k === 'pi' || b.k === 'sort' || b.k === 'pi') return false;
    let ta: Expr;
    try {
      ta = this.inferType(a);
      if (!this.isProp(ta)) return false;
      return this.isDefEq(ta, this.inferType(b));
    } catch (e) {
      if (e instanceof MetaError) return false;
      throw e;
    }
  }

  private height(e: Expr): number {
    const f = getAppFn(e);
    if (f.k !== 'const') return -1;
    const d = this.env.get(f.name);
    if (!d || d.kind !== 'def' || (d.value === undefined && !d.matchDef)) return -1;
    const t = this.red.transparency;
    const r = d.reducibility ?? 'default';
    if (t === 'reducible' && r !== 'reducible') return -1;
    if (t === 'instances' && r !== 'reducible' && r !== 'instance') return -1;
    if (t === 'default' && r === 'irreducible') return -1;
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
        if (this.attempt(() => this.sameHeadArgs(a, b))) return true;
      }
      const [a2, b2] = unfoldPair(this.red, a, b, ha, hb);
      if (a2 === null && b2 === null) return this.structural(a, b);
      a = this.instHead(this.whnfCore(a2 ?? a));
      b = this.instHead(this.whnfCore(b2 ?? b));
      if (exprEq(a, b)) return true;
      if (getAppFn(a).k === 'mvar' || getAppFn(b).k === 'mvar') return this.isDefEq(a, b);
      if (a.k !== 'app' && a.k !== 'const' || b.k !== 'app' && b.k !== 'const') return this.isDefEq(a, b);
      const off = this.isDefEqOffsetNat(a, b);
      if (off !== null) return off;
    }
  }

  private sameHeadArgs(a: Expr, b: Expr): boolean {
    const fa = getAppFn(a);
    const fb = getAppFn(b);
    if (fa.k !== 'const' || fb.k !== 'const') return false;
    if (fa.levels.length !== fb.levels.length) return false;
    for (let i = 0; i < fa.levels.length; i++) if (!this.isLevelDefEq(fa.levels[i], fb.levels[i])) return false;
    const xa = getAppArgs(a);
    const xb = getAppArgs(b);
    if (xa.length !== xb.length) return false;
    for (let i = 0; i < xa.length; i++) if (!this.isDefEq(xa[i], xb[i])) return false;
    return true;
  }

  private structural(a: Expr, b: Expr): boolean {
    if (exprEq(a, b)) return true;
    if (a.k === 'sort' && b.k === 'sort') return this.isLevelDefEq(a.level, b.level);
    if ((a.k === 'lam' && b.k === 'lam') || (a.k === 'pi' && b.k === 'pi')) return this.isDefEqBinders(a, b);
    if (a.k === 'lam' && b.k !== 'lam') return this.etaExpand(a, b);
    if (b.k === 'lam' && a.k !== 'lam') return this.etaExpand(b, a);
    const na = natCtorView(a);
    const nb = natCtorView(b);
    if (na && nb && (a.k === 'lit' || b.k === 'lit')) {
      if (na.k === 'zero' || nb.k === 'zero') return na.k === nb.k;
      return this.isDefEq(na.pred, nb.pred);
    }
    if (a.k === 'const' && b.k === 'const') {
      if (a.name !== b.name || a.levels.length !== b.levels.length) return false;
      return a.levels.every((l, i) => this.isLevelDefEq(l, b.levels[i]));
    }
    if (a.k === 'fvar' && b.k === 'fvar') return a.id === b.id;
    if (a.k === 'app' && b.k === 'app') {
      const fa = getAppFn(a);
      const fb = getAppFn(b);
      const xa = getAppArgs(a);
      const xb = getAppArgs(b);
      if (xa.length === xb.length) {
        const ok = this.attempt(() => {
          if (!this.isDefEq(fa, fb)) return false;
          for (let i = 0; i < xa.length; i++) if (!this.isDefEq(xa[i], xb[i])) return false;
          return true;
        });
        if (ok) return true;
      }
      // stuck metavariable applications: try full whnf once more
    }
    // last resort: full whnf (handles stuck heads that unfold under default transparency)
    const wa = this.whnf(a);
    const wb = this.whnf(b);
    if (!exprEq(wa, a) || !exprEq(wb, b)) return this.isDefEq(wa, wb);
    return false;
  }

  private etaExpand(lam: Expr & { k: 'lam' }, other: Expr): boolean {
    let t: Expr;
    try {
      t = this.whnf(this.inferType(other));
    } catch (e) {
      if (e instanceof MetaError) return false;
      throw e;
    }
    if (t.k !== 'pi') return false;
    const d = this.mkLocal(lam.name, lam.type, lam.bi);
    const x = mkFVar(d.id);
    return this.isDefEq(instantiate1(lam.body, x), mkApp(other, x));
  }

  /* ---------------- misc helpers ---------------- */

  /** All unassigned metavariables in `e` (after instantiation). */
  unassignedMVars(e: Expr): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    const go = (x: Expr) => {
      const xi = this.instantiateMVars(x);
      if (!xi.mv) return;
      replace(xi, (y) => {
        if (!y.mv) return y;
        if (y.k === 'mvar' && !seen.has(y.id)) {
          seen.add(y.id);
          out.push(y.id);
          go(this.decl(y.id).type);
          return y;
        }
        return undefined;
      });
    };
    go(e);
    return out;
  }

  /** Assign remaining universe metavariables to `0`… no: generalize to params `u_1, …`. */
  levelMVarsToParams(e: Expr, used: string[]): { e: Expr; params: string[] } {
    const params: string[] = [];
    const mapping = new Map<number, Level>();
    const r = replace(e, (x) => {
      if (!x.lmv) return x;
      const fix = (l: Level): Level =>
        mapLevelMVars(this.instantiateLevel(l), (id) => {
          let p = mapping.get(id);
          if (!p) {
            let i = params.length + 1;
            while (used.includes(`u_${i}`) || params.includes(`u_${i}`)) i++;
            const name = `u_${i}`;
            params.push(name);
            p = { k: 'param', name };
            mapping.set(id, p);
          }
          return p;
        });
      if (x.k === 'sort') return mkSort(fix(x.level));
      if (x.k === 'const') return mkConst(x.name, x.levels.map(fix));
      return undefined;
    });
    return { e: r, params };
  }
}

function instantiateRevArgs(t: Expr, args: Expr[], from: number, to: number): Expr {
  if (from === to) return t;
  return instantiateRev(t, args.slice(from, to));
}

function occursMVar(e: Expr, id: number): boolean {
  let found = false;
  replace(e, (x) => {
    if (found || !x.mv) return x;
    if (x.k === 'mvar' && x.id === id) {
      found = true;
      return x;
    }
    return undefined;
  });
  return found;
}

function hasMV(l: Level): boolean {
  switch (l.k) {
    case 'mvar':
      return true;
    case 'succ':
      return hasMV(l.l);
    case 'max':
    case 'imax':
      return hasMV(l.a) || hasMV(l.b);
    default:
      return false;
  }
}

function hasMVId(l: Level, id: number): boolean {
  switch (l.k) {
    case 'mvar':
      return l.id === id;
    case 'succ':
      return hasMVId(l.l, id);
    case 'max':
    case 'imax':
      return hasMVId(l.a, id) || hasMVId(l.b, id);
    default:
      return false;
  }
}

export { LocalContext };
