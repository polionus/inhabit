/**
 * Tactic framework: proof state (a list of goal metavariables), tactic dispatch with
 * step recording for the infoview, error recovery like Lean (a failing tactic inside `·`,
 * `case` or an induction alternative admits that goal and checking continues), and the
 * structural combinators.
 */
import type { Expr } from '../kernel/expr.ts';
import { mkAppN, mkConst, mkFVar } from '../kernel/expr.ts';
import { TimeoutError } from '../kernel/reduce.ts';
import { MetaError } from '../meta/meta.ts';
import type { LocalDecl } from '../meta/lctx.ts';
import { LocalContext } from '../meta/lctx.ts';
import { goalsToString, ppGoal } from '../pp/print.ts';
import type { Tactic, TacticSeq, Term } from '../syntax/ast.ts';
import type { Goal } from '../types.ts';
import { ElabError } from '../elab/errors.ts';
import type { Elab } from '../elab/term.ts';

export type TacticFn = (t: Tactic, c: TacCtx) => void;

const registry = new Map<string, TacticFn>();

export function registerTactic(names: string[], fn: TacticFn): void {
  for (const n of names) registry.set(n, fn);
}

/** Canonical names of all implemented tactics. */
export function implementedTactics(): string[] {
  return [...registry.keys()].filter((n) => !STRUCTURAL.has(n)).sort();
}

/** Always allowed, never locked. */
export const STRUCTURAL = new Set(['·', '(', 'case', 'next', '<;>', 'done', 'skip', 'sorry', 'focus']);

/** Canonical name of a tactic syntax node. */
export function canonicalName(t: Tactic): string {
  switch (t.name) {
    case 'admit':
      return 'sorry';
    case 'nth_rw':
      return 'nth_rewrite';
    default:
      return t.name;
  }
}

export class TacticFailure extends ElabError {}

export class TacCtx {
  readonly el: Elab;
  goals: number[];
  /** recover from errors inside `·` / alternatives (off inside `first`, `try`, …) */
  recover = true;

  constructor(el: Elab, goals: number[]) {
    this.el = el;
    this.goals = goals;
  }

  get m() {
    return this.el.m;
  }

  /* ---------- goals ---------- */

  pruneGoals(): void {
    this.goals = this.goals.filter((g) => !this.m.isAssigned(g));
  }

  mainGoal(t: { from: number; to: number }): number {
    this.pruneGoals();
    if (this.goals.length === 0) throw new TacticFailure('no-goals', 'No goals to be solved', t.from, t.to);
    return this.goals[0];
  }

  replaceMainGoal(newGoals: number[]): void {
    this.goals = [...newGoals, ...this.goals.slice(1)];
    this.pruneGoals();
  }

  goalType(g: number): Expr {
    return this.m.instantiateMVars(this.m.decl(g).type);
  }

  goalLctx(g: number): LocalContext {
    return this.m.decl(g).lctx;
  }

  tag(g: number): string | undefined {
    return this.m.decl(g).userName;
  }

  /** New goal with the given context and type; inherits a case tag. */
  newGoal(lctx: LocalContext, type: Expr, tag?: string): number {
    const mv = this.m.mkFreshMVar(type, lctx, 'opaque', tag);
    return (mv as { id: number }).id;
  }

  assign(g: number, v: Expr): void {
    this.m.assignMVar(g, v);
  }

  ppGoals(ids: number[] = this.goals): Goal[] {
    return ids.map((g) => ppGoal(this.m, g));
  }

  goalString(g: number): string {
    return goalsToString(this.ppGoals([g]));
  }

  fail(code: ElabError['code'], msg: string, r: { from: number; to: number }, data?: ElabError['data']): never {
    throw new TacticFailure(code, msg, r.from, r.to, data);
  }

  /** Lean-style "Tactic `x` failed…" + goal. */
  failWithGoal(msg: string, g: number, r: { from: number; to: number }, tactic?: string): never {
    throw new TacticFailure('tactic-failed', `${msg}\n\n${this.goalString(g)}`, r.from, r.to, tactic ? { tactic } : undefined);
  }

  /** Run `f` with the elaborator's local context set to goal `g`'s. */
  inGoal<T>(g: number, f: () => T): T {
    const old = this.el.lctx;
    this.el.lctx = this.goalLctx(g);
    try {
      return f();
    } finally {
      this.el.lctx = old;
    }
  }

  /** Elaborate a term in goal `g`'s context, completing postponed problems and nested `by`. */
  elabTerm(g: number, stx: Term, expected: Expr | null): Expr {
    return this.inGoal(g, () => {
      const e = this.el.elabTermEnsuring(stx, expected);
      this.el.synthesize();
      return this.m.instantiateMVars(e);
    });
  }

  /**
   * Elaborate a term; unassigned natural holes are errors; `?_` holes are returned as new goals
   * (only when `allowHoles`).
   */
  elabTermWithHoles(g: number, stx: Term, expected: Expr | null, allowHoles: boolean, tactic: string, allowNatural = false): { e: Expr; holes: number[] } {
    const holesBefore = this.el.syntheticHoles.length;
    const natBefore = this.el.naturalHoles.length;
    const e = this.elabTerm(g, stx, expected);
    const created = this.el.syntheticHoles.slice(holesBefore);
    this.el.syntheticHoles.length = holesBefore;
    const nat = this.el.naturalHoles.slice(natBefore);
    this.el.naturalHoles.length = natBefore;
    const unassigned = this.m.unassignedMVars(e);
    const holes: number[] = [];
    for (const id of unassigned) {
      const d = this.m.decl(id);
      if (d.kind === 'opaque') {
        if (!allowHoles) {
          const ctx = this.goalContextString(d.lctx, d.type);
          this.fail('unification', `don't know how to synthesize placeholder\ncontext:\n${ctx}`, stx);
        }
        holes.push(id);
      } else if (allowNatural) {
        holes.push(id);
      } else {
        const userHole = nat.find((h) => h.id === id);
        const ctx = this.goalContextString(d.lctx, d.type);
        if (userHole) this.fail('unification', `don't know how to synthesize placeholder\ncontext:\n${ctx}`, userHole);
        this.fail('unification', `don't know how to synthesize implicit argument\ncontext:\n${ctx}`, stx);
      }
    }
    // keep creation order for `?_` holes
    holes.sort((a, b) => {
      const ia = created.indexOf(a);
      const ib = created.indexOf(b);
      return (ia < 0 ? 1e9 + a : ia) - (ib < 0 ? 1e9 + b : ib);
    });
    void tactic;
    return { e, holes };
  }

  goalContextString(lctx: LocalContext, type: Expr): string {
    const tmp = this.m.mkFreshMVar(type, lctx, 'natural');
    return goalsToString([ppGoal(this.m, (tmp as { id: number }).id)]);
  }

  /** Close goal `g` with `e` after checking its type. */
  closeWith(g: number, e: Expr, r: { from: number; to: number }): void {
    const t = this.goalType(g);
    const et = this.m.inferType(e);
    if (!this.el.isDefEq(et, t)) {
      const exp = this.el.pp(t);
      const act = this.el.pp(et);
      this.fail('type-mismatch', `Type mismatch\n  ${this.el.pp(e)}\nhas type\n  ${act}\nbut is expected to have type\n  ${exp}`, r, { expected: exp, actual: act });
    }
    this.assign(g, e);
  }

  /** Admit a goal (after an error was reported). */
  admit(g: number): void {
    if (this.m.isAssigned(g)) return;
    const t = this.goalType(g);
    let u;
    try {
      u = this.m.inferSortLevel(t);
    } catch {
      u = this.m.mkFreshLevelMVar();
    }
    this.assign(g, mkAppN(mkConst('sorryAx', [u]), [t]));
  }

  /* ---------- local context manipulation ---------- */

  /** Add a hypothesis `name : type` (value `v`) to goal `g`: returns the new goal and fvar. */
  assertHyp(g: number, name: string, type: Expr, v: Expr, inaccessible = false): { goal: number; fvar: number } {
    const d = this.m.mkLocal(name, type, 'default', undefined, inaccessible);
    const lctx = this.goalLctx(g).push(d);
    const ng = this.newGoal(lctx, this.goalType(g), this.tag(g));
    // assign g := (fun name => ?ng) v
    const body = this.m.mkLambdaFVars([d.id], this.mvarExpr(ng));
    this.assign(g, mkAppN(body, [v]));
    return { goal: ng, fvar: d.id };
  }

  mvarExpr(id: number): Expr {
    return { k: 'mvar', id, lb: 0, fv: false, mv: true, lmv: false, lp: false } as Expr;
  }

  /** Introduce one binder of the goal (after whnf). Returns null when there is none. */
  introOne(g: number, name: string | null, inaccessible = false): { goal: number; fvar: number } | null {
    let t = this.goalType(g);
    if (t.k !== 'pi' && t.k !== 'let') {
      t = this.m.whnfCore(t);
      if (t.k !== 'pi' && t.k !== 'let') t = this.m.whnf(t);
    }
    if (t.k === 'pi') {
      const n = name ?? t.name;
      const d = this.m.mkLocal(n === '_' ? t.name : n, t.type, 'default', undefined, inaccessible || n === '_' || name === null);
      const lctx = this.goalLctx(g).push(d);
      const body = instantiateBody(t.body, d.id);
      const ng = this.newGoal(lctx, body, this.tag(g));
      this.assign(g, this.m.mkLambdaFVars([d.id], this.mvarExpr(ng)));
      return { goal: ng, fvar: d.id };
    }
    if (t.k === 'let') {
      const n = name ?? t.name;
      const d = this.m.mkLocal(n, t.type, 'default', t.value, inaccessible || name === null);
      const lctx = this.goalLctx(g).push(d);
      const ng = this.newGoal(lctx, instantiateBody(t.body, d.id), this.tag(g));
      this.assign(g, this.m.mkLambdaFVars([d.id], this.mvarExpr(ng)));
      return { goal: ng, fvar: d.id };
    }
    return null;
  }

  /**
   * Replace the type of hypothesis `h` in goal `g` by `newType`, given `proof : newType`
   * (a term in g's context; defaults to `h` itself for definitional changes).
   */
  replaceHyp(g: number, h: number, newType: Expr, proof?: Expr): { goal: number; fvar: number } {
    const lctx = this.goalLctx(g);
    const old = lctx.get(h)!;
    const d: LocalDecl = this.m.mkLocal(old.userName, newType, old.bi, undefined, old.inaccessible);
    const idx = lctx.indexOf(h);
    const decls = [...lctx.decls];
    // hypotheses after h that depend on h keep referring to the old one: keep it hidden then
    const dependents = decls.slice(idx + 1).some((x) => mentionsFVar(this.m.instantiateMVars(x.type), h));
    const target = this.goalType(g);
    const targetDeps = mentionsFVar(target, h);
    let newDecls: LocalDecl[];
    if (dependents || targetDeps) {
      newDecls = [...decls.slice(0, idx), { ...old, hidden: true }, ...decls.slice(idx + 1), d];
    } else {
      newDecls = [...decls.slice(0, idx), d, ...decls.slice(idx + 1)];
    }
    // the new local must come after everything newType depends on
    const nl = new LocalContext(orderDecls(newDecls, (x) => this.m.instantiateMVars(x.type)));
    const ng = this.newGoal(nl, target, this.tag(g));
    const fn = this.m.mkLambdaFVars([d.id], this.mvarExpr(ng));
    this.assign(g, mkAppN(fn, [proof ?? mkFVar(h)]));
    return { goal: ng, fvar: d.id };
  }

  /** Change the target of `g` to a definitionally equal (or proven-equal via `proof`) type. */
  replaceTarget(g: number, newType: Expr, proofOfOld?: (ng: Expr) => Expr): number {
    const ng = this.newGoal(this.goalLctx(g), newType, this.tag(g));
    this.assign(g, proofOfOld ? proofOfOld(this.mvarExpr(ng)) : this.mvarExpr(ng));
    return ng;
  }

  /** Remove hypotheses (they must not be used by the target or other hyps). */
  clearHyps(g: number, ids: number[], r: { from: number; to: number }): number {
    const lctx = this.goalLctx(g);
    const set = new Set(ids);
    const rest = lctx.decls.filter((d) => !set.has(d.id));
    for (const id of ids) {
      const d = lctx.get(id);
      if (!d) continue;
      const users = rest.filter((x) => mentionsFVar(this.m.instantiateMVars(x.type), id) || (x.value && mentionsFVar(x.value, id)));
      if (users.length > 0 || mentionsFVar(this.goalType(g), id)) {
        this.failWithGoal(`Tactic \`clear\` failed: variable \`${d.userName}\` depends on other hypotheses or the goal`, g, r);
      }
    }
    const ng = this.newGoal(new LocalContext(rest), this.goalType(g), this.tag(g));
    this.assign(g, this.mvarExpr(ng));
    return ng;
  }

  findHyp(g: number, name: string, r: { from: number; to: number }): LocalDecl {
    const d = this.goalLctx(g).findByName(name);
    if (!d) this.el.unknownIdent(name, r);
    return d;
  }
}

function instantiateBody(body: Expr, fvarId: number): Expr {
  return instantiate1Local(body, mkFVar(fvarId));
}

import { instantiate1 as instantiate1Local, forEachExpr } from '../kernel/expr.ts';

export function mentionsFVar(e: Expr, id: number): boolean {
  if (!e.fv) return false;
  let found = false;
  forEachExpr(e, (x) => {
    if (found || !x.fv) return false;
    if (x.k === 'fvar' && x.id === id) found = true;
    return undefined;
  });
  return found;
}

/** Stable topological order: each decl after the decls its type mentions. */
function orderDecls(decls: LocalDecl[], typeOf: (d: LocalDecl) => Expr): LocalDecl[] {
  const out: LocalDecl[] = [];
  const placed = new Set<number>();
  const pending = [...decls];
  let guard = 0;
  while (pending.length > 0 && guard++ < 10_000) {
    const i = pending.findIndex((d) => pending.every((o) => o === d || !mentionsFVar(typeOf(d), o.id)));
    const d = pending.splice(i < 0 ? 0 : i, 1)[0];
    out.push(d);
    placed.add(d.id);
  }
  return out;
}

/* ---------------- running blocks ---------------- */

const STEP_LIMIT = 5000;

export function evalSeq(c: TacCtx, seq: TacticSeq): void {
  for (const t of seq.tactics) evalTactic(c, t);
}

export function evalTactic(c: TacCtx, t: Tactic): void {
  const el = c.el;
  const name = canonicalName(t);
  el.m.fuel.tick(10);
  if (el.steps.length > STEP_LIMIT) throw new TacticFailure('timeout', 'maximum number of tactic steps exceeded', t.from, t.to);
  const fn = registry.get(name);
  if (!STRUCTURAL.has(name)) {
    el.usedTactics.add(name);
    if (!el.tacticAllowed(name)) {
      if (!fn && !el.opts.allowedTactics) {
        // fall through to "not supported"
      } else {
        c.fail('tactic-locked', `The tactic \`${name}\` is not available in this level yet.`, { from: t.from, to: t.nameTo }, { tactic: name });
      }
    }
  }
  if (!fn) {
    c.fail('unknown-tactic', `The tactic \`${name}\` is not supported by this game's Lean engine.`, { from: t.from, to: t.nameTo }, { tactic: name, suggestions: [] });
  }
  c.pruneGoals();
  const before = safePP(c);
  const stepIdx = el.steps.length;
  el.steps.push({ from: t.from, to: t.to, tactic: name, before, after: before, ok: false });
  try {
    el.guard(t, () => fn(t, c));
  } catch (e) {
    el.steps[stepIdx].ok = false;
    el.steps[stepIdx].after = before;
    throw normalizeError(e, t);
  }
  c.pruneGoals();
  el.steps[stepIdx].ok = true;
  el.steps[stepIdx].after = safePP(c);
}

function safePP(c: TacCtx): Goal[] {
  try {
    c.pruneGoals();
    return c.ppGoals();
  } catch {
    return [];
  }
}

function normalizeError(e: unknown, t: { from: number; to: number }): unknown {
  if (e instanceof ElabError) {
    if (e.from === 0 && e.to === 0) {
      e.from = t.from;
      e.to = t.to;
    }
    return e;
  }
  if (e instanceof TimeoutError) return new TacticFailure('timeout', e.message, t.from, t.to);
  if (e instanceof MetaError) return new TacticFailure('other', e.message, t.from, t.to);
  return e;
}

/** Run a nested block on exactly the goals `goals`; on failure (with recovery on) admit them. */
export function runFocused(c: TacCtx, goals: number[], seq: TacticSeq, closeRange: { from: number; to: number }, mustClose: boolean): number[] {
  const saved = c.goals;
  c.goals = goals;
  try {
    evalSeq(c, seq);
    c.pruneGoals();
    if (mustClose && c.goals.length > 0) {
      const gs = c.ppGoals();
      throw new TacticFailure('unsolved-goals', `unsolved goals\n${goalsToString(gs)}`, closeRange.from, closeRange.to, { goals: gs });
    }
    return c.goals;
  } catch (e) {
    if (!c.recover || !(e instanceof ElabError)) throw e;
    c.el.report(e);
    for (const g of c.goals) c.admit(g);
    for (const g of goals) c.admit(g);
    return [];
  } finally {
    c.goals = saved;
  }
}

/** Backtracking: run `f`; on failure restore the state and return false. */
export function attemptTactic(c: TacCtx, f: () => void): boolean {
  const mark = c.m.mark();
  const goals = c.goals;
  const nsteps = c.el.steps.length;
  const ndiags = c.el.diags.length;
  const oldRecover = c.recover;
  const pending = c.el.pending.length;
  c.recover = false;
  try {
    f();
    return true;
  } catch (e) {
    if (!(e instanceof ElabError)) throw e;
    c.m.rollback(mark);
    c.goals = goals;
    c.el.steps.length = nsteps;
    c.el.diags.length = ndiags;
    c.el.pending.length = Math.min(c.el.pending.length, pending);
    return false;
  } finally {
    c.recover = oldRecover;
  }
}

/** Entry point used by the term elaborator for `by` blocks. */
export function runTacticBlock(el: Elab, mvarId: number, seq: TacticSeq, byFrom: number, byTo: number): void {
  const c = new TacCtx(el, [mvarId]);
  const initial = c.ppGoals();
  el.tacticBlocks.push({ from: byFrom, to: Math.max(byTo, seq.to), initial });
  if (seq.tactics.length === 0) {
    // the block was cut short by a parse error: like Lean, the goal is reported as unsolved
    const gs = c.ppGoals();
    el.report(new ElabError('unsolved-goals', `unsolved goals\n${goalsToString(gs)}`, byFrom, byFrom + 2, { goals: gs }));
    c.admit(mvarId);
    return;
  }
  try {
    evalSeq(c, seq);
    c.pruneGoals();
    if (c.goals.length > 0 && !seq.truncated) {
      const gs = c.ppGoals();
      el.report(new ElabError('unsolved-goals', `unsolved goals\n${goalsToString(gs)}`, byFrom, Math.max(byTo, seq.to), { goals: gs }));
    } else if (c.goals.length > 0) {
      // the block was cut short by a parse error (already reported); Lean also reports the goals
      const gs = c.ppGoals();
      el.report(new ElabError('unsolved-goals', `unsolved goals\n${goalsToString(gs)}`, byFrom, byFrom + 2, { goals: gs }));
    }
  } catch (e) {
    if (!(e instanceof ElabError)) throw e;
    el.report(e);
  }
  c.pruneGoals();
  for (const g of c.goals) c.admit(g);
  if (!el.m.isAssigned(mvarId)) c.admit(mvarId);
  if (el.hadError) {
    // after an error, close every goal the failed tactic left behind (they are not reported)
    for (const id of el.m.unassignedMVars(el.m.instantiateMVars({ k: 'mvar', id: mvarId, lb: 0, fv: false, mv: true, lmv: false, lp: false } as Expr))) {
      if (el.m.decl(id).kind === 'opaque') c.admit(id);
    }
  }
}
