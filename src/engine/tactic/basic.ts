/**
 * Core tactics: intro, exact, apply, refine, have, show/change, constructor, left/right,
 * exfalso, assumption, contradiction, rfl, symm, use/exists, specialize, by_cases, by_contra,
 * ext/funext, revert/clear, calc, and the combinators.
 */
import type { Expr } from '../kernel/expr.ts';
import {
  getAppArgs,
  getAppFn,
  hasLooseBVar,
  instantiate1,
  mkApp,
  mkAppN,
  mkConst,
  mkFVar,
  mkLam,
  mkSort,
} from '../kernel/expr.ts';
import { lzero } from '../kernel/level.ts';
import type { Level } from '../kernel/level.ts';
import type { LocalDecl } from '../meta/lctx.ts';
import { LocalContext } from '../meta/lctx.ts';
import { goalsToString } from '../pp/print.ts';
import type { RPat, Tactic, TacticSeq, Term } from '../syntax/ast.ts';
import { ElabError } from '../elab/errors.ts';
import type { TacCtx } from './core.ts';
import { TacticFailure, attemptTactic, evalSeq, evalTactic, mentionsFVar, registerTactic, runFocused } from './core.ts';
import { rcasesFVar } from './cases.ts';

type T<K extends Tactic['k']> = Extract<Tactic, { k: K }>;

export function appendTag(parent: string | undefined, child: string | undefined): string | undefined {
  if (!child) return parent;
  if (!parent) return child;
  return `${parent}.${child}`;
}

const isAnonName = (n: string): boolean => n.includes('✝') || n === '' || n === '_';

/* ---------------- intro ---------------- */

registerTactic(['intro'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'intro'>;
  let g = c.mainGoal(t);
  if (tac.names.length === 0) {
    const r = c.introOne(g, null, true);
    if (!r) c.failWithGoal('Tactic `introN` failed: There are no additional binders or `let` bindings in the goal to introduce', g, t);
    c.replaceMainGoal([r.goal]);
    return;
  }
  const rest: { fvar: number; pat: Term }[] = [];
  for (const n of tac.names) {
    const r = c.introOne(g, n.pat ? null : n.name, n.pat !== undefined || n.name === '_');
    if (!r) c.failWithGoal('Tactic `introN` failed: There are no additional binders or `let` bindings in the goal to introduce', g, n);
    g = r.goal;
    if (n.pat) rest.push({ fvar: r.fvar, pat: n.pat });
  }
  let goals = [g];
  for (const p of rest) {
    const next: number[] = [];
    for (const gg of goals) next.push(...rcasesFVar(c, gg, p.fvar, termToRPat(p.pat), t, true));
    goals = next;
  }
  c.replaceMainGoal(goals);
});

/** `intro ⟨a, b⟩` patterns reuse rcases. */
export function termToRPat(t: Term): RPat {
  switch (t.k) {
    case 'ident':
      return { k: 'one', name: t.name, from: t.from, to: t.to };
    case 'hole':
      return { k: 'one', name: '_', from: t.from, to: t.to };
    case 'anon':
      return { k: 'tuple', elems: t.elems.map(termToRPat), from: t.from, to: t.to };
    case 'paren':
      return termToRPat(t.term);
    case 'ascription':
      return { k: 'typed', pat: termToRPat(t.term), type: t.type, from: t.from, to: t.to };
    default:
      throw new TacticFailure('parse', 'invalid pattern', t.from, t.to);
  }
}

registerTactic(['intros'], (t: Tactic, c: TacCtx) => {
  let g = c.mainGoal(t);
  const tac = t as T<'intro'>;
  if (tac.names.length > 0) {
    for (const n of tac.names) {
      const r = c.introOne(g, n.name, n.name === '_');
      if (!r) c.failWithGoal('Tactic `introN` failed: There are no additional binders or `let` bindings in the goal to introduce', g, n);
      g = r.goal;
    }
    c.replaceMainGoal([g]);
    return;
  }
  for (;;) {
    const ty = c.goalType(g);
    const w = c.m.whnfCore(ty);
    if (w.k !== 'pi' && w.k !== 'let') break;
    const r = c.introOne(g, null, true);
    if (!r) break;
    g = r.goal;
  }
  c.replaceMainGoal([g]);
});

/* ---------------- exact / apply / refine ---------------- */

registerTactic(['exact'], (t: Tactic, c: TacCtx) => {
  const g = c.mainGoal(t);
  const tac = t as T<'term'>;
  const { e } = atTactic(t, tac.term, () => c.elabTermWithHoles(g, tac.term, c.goalType(g), false, 'exact'));
  c.closeWith(g, e, t);
  c.replaceMainGoal([]);
});

/** Lean reports the final "Type mismatch" of `exact`-like tactics at the tactic, not the term. */
export function atTactic<R>(t: { from: number; to: number }, term: { from: number; to: number }, f: () => R): R {
  try {
    return f();
  } catch (e) {
    if (e instanceof ElabError && e.code === 'type-mismatch' && e.from === term.from && e.to === term.to && e.message.startsWith('Type mismatch')) {
      e.from = t.from;
      e.to = t.to;
    }
    throw e;
  }
}

function tagUntagged(c: TacCtx, parent: string | undefined, suffix: string, goals: number[]): void {
  const anon = goals.filter((g) => !c.m.decl(g).userName);
  let i = 1;
  for (const g of anon) {
    c.m.setMVarUserName(g, anon.length === 1 ? parent : appendTag(parent, `${suffix}_${i}`));
    i++;
  }
}

function refineCore(t: Tactic, c: TacCtx, stx: Term, allowNatural: boolean, name: string): void {
  const g = c.mainGoal(t);
  const { e, holes } = c.elabTermWithHoles(g, stx, c.goalType(g), true, name, allowNatural);
  c.closeWith(g, e, stx);
  tagUntagged(c, c.tag(g), 'refine', holes);
  c.replaceMainGoal(holes);
}

registerTactic(['refine'], (t: Tactic, c: TacCtx) => refineCore(t, c, (t as T<'term'>).term, false, 'refine'));
registerTactic(["refine'"], (t: Tactic, c: TacCtx) => refineCore(t, c, (t as T<'term'>).term, true, "refine'"));

function countPis(c: TacCtx, t: Expr): number {
  let n = 0;
  let x = t;
  for (let i = 0; i < 64; i++) {
    if (x.k !== 'pi') x = c.m.whnf(x);
    if (x.k !== 'pi') break;
    n++;
    const d = c.m.mkLocal(x.name, x.type);
    x = instantiate1(x.body, mkFVar(d.id));
  }
  return n;
}

/** `apply e`: unify the conclusion of `e` with the goal; remaining arguments become goals. */
export function applyExpr(c: TacCtx, g: number, e: Expr, r: { from: number; to: number }, eStr?: string): number[] {
  const m = c.m;
  const et = m.instantiateMVars(m.inferType(e));
  const target = c.goalType(g);
  const nE = countPis(c, et);
  const nT = countPis(c, target);
  const order: number[] = [];
  if (nE - nT >= 0) order.push(nE - nT);
  for (let k = 0; k <= nE; k++) if (!order.includes(k)) order.push(k);
  let lastConcl: Expr | null = null;
  for (const k of order) {
    const mark = m.mark();
    const mvars: { e: Expr; bi: string; name: string }[] = [];
    let ty = et;
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (ty.k !== 'pi') ty = m.whnf(ty);
      if (ty.k !== 'pi') {
        ok = false;
        break;
      }
      const mv = m.mkFreshMVar(m.instantiateMVars(ty.type), c.goalLctx(g), 'natural', isAnonName(ty.name) ? undefined : ty.name);
      mvars.push({ e: mv, bi: ty.bi, name: ty.name });
      ty = instantiate1(ty.body, mv);
    }
    if (!ok) {
      m.rollback(mark);
      continue;
    }
    if (k === nE - nT || lastConcl === null) lastConcl = ty;
    if (c.el.isDefEq(ty, target)) {
      c.assign(g, mkAppN(e, mvars.map((x) => x.e)));
      // new goals: unassigned, non-dependent first
      const unassigned = mvars.filter((x) => !m.isAssigned((x.e as { id: number }).id));
      const isDep = (x: { e: Expr }) =>
        unassigned.some((y) => y !== x && mentionsMVar(m.instantiateMVars(m.decl((y.e as { id: number }).id).type), (x.e as { id: number }).id));
      const nonDep = unassigned.filter((x) => !isDep(x));
      const dep = unassigned.filter((x) => isDep(x));
      const goals = [...nonDep, ...dep].map((x) => (x.e as { id: number }).id);
      // tags (Lean's appendParentTag)
      const parent = c.tag(g);
      if (mvars.length === 1 && goals.length === 1) m.setMVarUserName(goals[0], parent);
      else if (parent) for (const id of goals) m.setMVarUserName(id, appendTag(parent, m.decl(id).userName));
      // goals become opaque-like: keep natural (Lean semantics) but they are goals now
      return goals;
    }
    m.rollback(mark);
  }
  // failure message
  const mark = m.mark();
  let ty = et;
  for (let i = 0; i < Math.max(0, nE - nT); i++) {
    if (ty.k !== 'pi') ty = m.whnf(ty);
    if (ty.k !== 'pi') break;
    const mv = m.mkFreshMVar(ty.type, c.goalLctx(g), 'natural', isAnonName(ty.name) ? undefined : ty.name);
    ty = instantiate1(ty.body, mv);
  }
  const concl = c.el.pp(ty);
  const name = eStr ?? c.el.pp(e);
  const full = c.el.pp(et);
  m.rollback(mark);
  if (nE === 0) {
    c.failWithGoal(`Tactic \`apply\` failed: could not unify the type of \`${name}\`\n  ${full}\nwith the goal\n  ${c.el.pp(target)}`, g, r, 'apply');
  }
  c.failWithGoal(
    `Tactic \`apply\` failed: could not unify the conclusion of \`${name}\`\n  ${concl}\nwith the goal\n  ${c.el.pp(target)}\n\nNote: The full type of \`${name}\` is\n  ${full}`,
    g,
    r,
    'apply',
  );
}

function mentionsMVar(e: Expr, id: number): boolean {
  if (!e.mv) return false;
  let found = false;
  const go = (x: Expr): void => {
    if (found || !x.mv) return;
    if (x.k === 'mvar' && x.id === id) found = true;
    else if (x.k === 'app') {
      go(x.fn);
      go(x.arg);
    } else if (x.k === 'lam' || x.k === 'pi') {
      go(x.type);
      go(x.body);
    } else if (x.k === 'let') {
      go(x.type);
      go(x.value);
      go(x.body);
    }
  };
  go(e);
  return found;
}

registerTactic(['apply'], (t: Tactic, c: TacCtx) => {
  const g = c.mainGoal(t);
  const tac = t as T<'term'>;
  const { e } = c.elabTermWithHoles(g, tac.term, null, true, 'apply', true);
  const isConst = (tac.term.k === 'ident' && !c.goalLctx(g).findByName(tac.term.name)) || tac.term.k === 'explicit';
  const name = isConst ? `@${c.el.src.slice(tac.term.from, tac.term.to).replace(/^@/, '')}` : undefined;
  const goals = applyExpr(c, g, e, t, name);
  c.replaceMainGoal(goals);
});

/* ---------------- have / let / suffices / show / change ---------------- */

registerTactic(['have', 'let', 'suffices'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'have'>;
  const g = c.mainGoal(t);
  let typeStx = tac.type;
  let valStx = tac.value;
  if (tac.binders.length > 0) {
    if (typeStx) typeStx = { k: 'forall', binders: tac.binders, body: typeStx, from: typeStx.from, to: typeStx.to };
    if (valStx) valStx = { k: 'fun', binders: tac.binders.map((b) => ({ k: 'group' as const, group: b })), body: valStx, from: valStx.from, to: valStx.to };
  }
  const type = typeStx ? c.inGoal(g, () => c.el.elabType(typeStx!)) : null;
  if (t.name === 'suffices') {
    // suffices h : T  — new main goal T, then the original with h
    if (!type) c.fail('parse', 'suffices requires a type', t);
    const name = tac.hname ?? 'this';
    const d = c.m.mkLocal(name, type);
    const g1 = c.newGoal(c.goalLctx(g).push(d), c.goalType(g), c.tag(g));
    const g2 = c.newGoal(c.goalLctx(g), type, c.tag(g));
    c.assign(g, mkApp(c.m.mkLambdaFVars([d.id], c.mvarExpr(g1)), c.mvarExpr(g2)));
    if (valStx) {
      const { e } = c.elabTermWithHoles(g1, valStx, c.goalType(g1), false, 'suffices');
      c.closeWith(g1, e, valStx);
      c.replaceMainGoal([g2]);
    } else c.replaceMainGoal([g2, g1]);
    return;
  }
  if (!valStx) {
    // `have h : T` — prove T first
    if (!type) c.fail('parse', "expected ':='", t);
    const name = tac.hname ?? 'this';
    const g2 = c.newGoal(c.goalLctx(g), type, c.tag(g));
    const r = c.assertHyp(g, name, type, c.mvarExpr(g2));
    c.replaceMainGoal([g2, r.goal]);
    return;
  }
  const holesBefore = c.el.syntheticHoles.length;
  const { e, holes } = c.elabTermWithHoles(g, valStx, type, true, 'have');
  void holesBefore;
  const ty = type ?? c.m.instantiateMVars(c.m.inferType(e));
  if (tac.pat) {
    const r = c.assertHyp(g, '_h', ty, e, true);
    const goals = rcasesFVar(c, r.goal, r.fvar, tac.pat, t, false);
    c.replaceMainGoal([...goals, ...holes]);
    return;
  }
  const name = tac.hname === '_' ? 'this' : tac.hname ?? 'this';
  if (tac.isLet) {
    const d = c.m.mkLocal(name, ty, 'default', e);
    const ng = c.newGoal(c.goalLctx(g).push(d), c.goalType(g), c.tag(g));
    c.assign(g, c.m.mkLambdaFVars([d.id], c.mvarExpr(ng)));
    c.replaceMainGoal([ng, ...holes]);
    return;
  }
  const r = c.assertHyp(g, name, ty, e, tac.hname === '_');
  c.replaceMainGoal([r.goal, ...holes]);
});

registerTactic(['show'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'term'>;
  c.pruneGoals();
  if (c.goals.length === 0) c.fail('no-goals', 'No goals to be solved', t);
  let lastErr: string | null = null;
  for (let i = 0; i < c.goals.length; i++) {
    const g = c.goals[i];
    const mark = c.m.mark();
    let ty: Expr;
    try {
      ty = c.inGoal(g, () => {
        const e = c.el.elabType(tac.term);
        c.el.synthesize();
        return c.m.instantiateMVars(e);
      });
    } catch (e) {
      c.m.rollback(mark);
      throw e;
    }
    if (c.el.isDefEq(ty, c.goalType(g))) {
      const ng = c.replaceTarget(g, c.m.instantiateMVars(ty));
      c.goals = [ng, ...c.goals.filter((x) => x !== g)];
      return;
    }
    if (lastErr === null) lastErr = `'show' tactic failed, pattern\n  ${c.el.pp(ty)}\nis not definitionally equal to target\n  ${c.el.pp(c.goalType(g))}`;
    c.m.rollback(mark);
  }
  c.fail('type-mismatch', lastErr ?? 'show failed', t);
});

registerTactic(['change'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'change'>;
  const g = c.mainGoal(t);
  if (tac.loc && !tac.loc.goal && !tac.loc.wildcard) {
    let goal = g;
    for (const h of tac.loc.hyps) {
      const d = c.findHyp(goal, h.name, h);
      const ty = c.inGoal(goal, () => c.m.instantiateMVars(c.el.elabType(tac.term)));
      if (!c.el.isDefEq(ty, c.m.instantiateMVars(d.type))) {
        c.fail('type-mismatch', `Tactic \`change\` failed: The given type\n  ${c.el.pp(ty)}\nis not definitionally equal to the type of \`${d.userName}\`\n  ${c.el.pp(d.type)}`, t);
      }
      goal = c.replaceHyp(goal, d.id, c.m.instantiateMVars(ty)).goal;
    }
    c.replaceMainGoal([goal]);
    return;
  }
  const ty = c.inGoal(g, () => {
    const e = c.el.elabType(tac.term);
    c.el.synthesize();
    return c.m.instantiateMVars(e);
  });
  if (!c.el.isDefEq(ty, c.goalType(g))) {
    c.fail(
      'type-mismatch',
      `Tactic \`change\` failed: The given type\n  ${c.el.pp(ty)}\nis not definitionally equal to the goal\n  ${c.el.pp(c.goalType(g))}`,
      t,
    );
  }
  c.replaceMainGoal([c.replaceTarget(g, c.m.instantiateMVars(ty))]);
});

/* ---------------- constructors ---------------- */

function targetInductive(c: TacCtx, g: number): { name: string; ctors: string[]; type: Expr } | null {
  const w = c.m.whnf(c.goalType(g));
  const h = getAppFn(w);
  if (h.k !== 'const') return null;
  const ind = c.m.env.get(h.name)?.ind;
  if (!ind) return null;
  return { name: h.name, ctors: ind.ctors, type: w };
}

function applyCtor(c: TacCtx, g: number, ctor: string, r: { from: number; to: number }): number[] {
  const ci = c.el.mkConstInst(ctor);
  return applyExpr(c, g, ci.e, r);
}

registerTactic(['constructor'], (t: Tactic, c: TacCtx) => {
  const g = c.mainGoal(t);
  const ind = targetInductive(c, g);
  if (!ind) c.failWithGoal('Tactic `constructor` failed: target is not an inductive datatype', g, t, 'constructor');
  for (const ctor of ind.ctors) {
    let res: number[] | null = null;
    if (attemptTactic(c, () => {
      res = applyCtor(c, g, ctor, t);
    }) && res) {
      c.replaceMainGoal(res);
      return;
    }
  }
  c.failWithGoal('Tactic `constructor` failed: no applicable constructor found', g, t, 'constructor');
});

for (const [name, idx] of [
  ['left', 0],
  ['right', 1],
] as const) {
  registerTactic([name], (t: Tactic, c: TacCtx) => {
    const g = c.mainGoal(t);
    const ind = targetInductive(c, g);
    if (!ind) c.failWithGoal(`Tactic \`${name}\` failed: target is not an inductive datatype`, g, t, name);
    if (ind.ctors.length !== 2) {
      c.failWithGoal(`Tactic \`${name}\` failed: The goal must be an inductive type with exactly two constructors, but it has ${ind.ctors.length}`, g, t, name);
    }
    c.replaceMainGoal(applyCtor(c, g, ind.ctors[idx], t));
  });
}

registerTactic(['exfalso'], (t: Tactic, c: TacCtx) => {
  const g = c.mainGoal(t);
  const target = c.goalType(g);
  const u = c.m.inferSortLevel(target);
  const ng = c.newGoal(c.goalLctx(g), mkConst('False'), c.tag(g));
  c.assign(g, mkAppN(mkConst('False.elim', [u]), [target, c.mvarExpr(ng)]));
  c.replaceMainGoal([ng]);
});

/* ---------------- assumption / contradiction / trivial ---------------- */

function tryAssumption(c: TacCtx, g: number): boolean {
  const target = c.goalType(g);
  const decls = c.goalLctx(g).decls;
  for (let i = decls.length - 1; i >= 0; i--) {
    const d = decls[i];
    if (d.hidden) continue;
    const mark = c.m.mark();
    if (c.el.isDefEq(c.m.instantiateMVars(d.type), target)) {
      c.assign(g, mkFVar(d.id));
      return true;
    }
    c.m.rollback(mark);
  }
  return false;
}

registerTactic(['assumption'], (t: Tactic, c: TacCtx) => {
  const g = c.mainGoal(t);
  if (!tryAssumption(c, g)) c.failWithGoal('Tactic `assumption` failed', g, t, 'assumption');
  c.replaceMainGoal([]);
});

/** A proof of False from `h : lhs = rhs` with different constructors / literals, or null. */
export function disproveEq(c: TacCtx, h: Expr, type: Expr): Expr | null {
  const w = c.m.whnf(type);
  if (!(getAppFn(w).k === 'const' && (getAppFn(w) as { name: string }).name === 'Eq' && getAppArgs(w).length === 3)) return null;
  const [alpha, a, b] = getAppArgs(w);
  const aw = c.m.whnf(a);
  const bw = c.m.whnf(b);
  // Nat literals
  const lit = (x: Expr): bigint | null => {
    if (x.k === 'lit' && typeof x.value === 'bigint') return x.value;
    if (x.k === 'const' && x.name === 'Nat.zero') return 0n;
    return null;
  };
  const la = lit(aw);
  const lb = lit(bw);
  const natT = c.m.whnf(alpha);
  if (natT.k === 'const' && natT.name === 'Nat' && la !== null && lb !== null && la !== lb) {
    // congrArg (Nat.beq a) h : Nat.beq a a = Nat.beq a b, which computes to `true = false`
    const bv = { k: 'bvar', idx: 0, lb: 1, fv: false, mv: false, lmv: false, lp: false } as Expr;
    const f = mkLam('x', mkConst('Nat'), mkAppN(mkConst('Nat.beq'), [a, bv]));
    const one: Level = { k: 'succ', l: { k: 'zero' } };
    const eq = mkAppN(mkConst('congrArg', [one, one]), [mkConst('Nat'), mkConst('Bool'), a, b, f, h]);
    const fa = mkAppN(mkConst('Nat.beq'), [a, a]);
    const fb = mkAppN(mkConst('Nat.beq'), [a, b]);
    return ctorMismatch(c, eq, mkConst('Bool'), fa, fb, 'Bool.true', 'Bool.false');
  }
  const ctorOf = (x: Expr): string | null => {
    const l = lit(x);
    if (l !== null) return l === 0n ? 'Nat.zero' : 'Nat.succ';
    const f = getAppFn(x);
    return f.k === 'const' && c.m.env.get(f.name)?.ctor ? f.name : null;
  };
  const na = ctorOf(aw);
  const nb = ctorOf(bw);
  if (!na || !nb || na === nb) return null;
  if (c.m.env.get(na)!.ctor!.induct !== c.m.env.get(nb)!.ctor!.induct) return null;
  return ctorMismatch(c, h, alpha, a, b, na, nb);
}


/** `False` from `h : a = b` where `a`, `b` start with different constructors. */
function ctorMismatch(c: TacCtx, h: Expr, alpha: Expr, a: Expr, b: Expr, ctorA: string, ctorB: string): Expr | null {
  const cd = c.m.env.get(ctorA)!.ctor!;
  void ctorB;
  const ind = c.m.env.get(cd.induct)!;
  if (!ind.ind!.largeElim) return null;
  const at = c.m.whnf(alpha);
  const params = getAppArgs(at).slice(0, ind.ind!.numParams);
  const levels = (getAppFn(at) as { levels: readonly Level[] }).levels ?? [];
  // D x := I.casesOn (motive := fun _ => Prop) x (fun … => True) (fun … => False) …
  const x = c.m.mkLocal('x', alpha);
  const motive = mkLam('t', alpha, mkSort(lzero));
  const minors: Expr[] = [];
  for (const ctor of ind.ind!.ctors) {
    const cdecl = c.m.env.get(ctor)!;
    let ct = c.m.instantiateMVars(cdecl.type);
    // instantiate params
    for (const p of params) {
      if (ct.k !== 'pi') break;
      ct = instantiate1(ct.body, p);
    }
    const fieldIds: number[] = [];
    while (ct.k === 'pi') {
      const d = c.m.mkLocal(ct.name, ct.type);
      fieldIds.push(d.id);
      ct = instantiate1(ct.body, mkFVar(d.id));
    }
    minors.push(c.m.mkLambdaFVars(fieldIds, mkConst(ctor === ctorA ? 'True' : 'False')));
  }
  const one = { k: 'succ', l: { k: 'zero' } } as const;
  const dBody = mkAppN(mkConst(`${cd.induct}.casesOn`, [one, ...levels]), [...params, motive, mkFVar(x.id), ...minors]);
  const D = c.m.mkLambdaFVars([x.id], dBody);
  const u = c.m.inferSortLevel(alpha);
  const congr = mkAppN(mkConst('congrArg', [u, { k: 'succ', l: { k: 'zero' } }]), [alpha, mkSort(lzero), a, b, D, h]);
  // congr : D a = D b  ≡  True = False
  return mkAppN(mkConst('Eq.mp', [lzero]), [mkConst('True'), mkConst('False'), congr, mkConst('True.intro')]);
}

registerTactic(['contradiction'], (t: Tactic, c: TacCtx) => {
  const g = c.mainGoal(t);
  const target = c.goalType(g);
  const u = c.m.inferSortLevel(target);
  const elimFalse = (p: Expr) => mkAppN(mkConst('False.elim', [u]), [target, p]);
  const decls = c.goalLctx(g).decls.filter((d) => !d.hidden);
  for (const d of decls) {
    const ty = c.m.instantiateMVars(d.type);
    const w = c.m.whnf(ty);
    // empty inductive (False)
    const h = getAppFn(w);
    if (h.k === 'const') {
      const ind = c.m.env.get(h.name)?.ind;
      if (ind && ind.ctors.length === 0 && h.name === 'False') {
        c.assign(g, elimFalse(mkFVar(d.id)));
        c.replaceMainGoal([]);
        return;
      }
    }
    // constructor mismatch in an equation
    const mark = c.m.mark();
    try {
      const p = disproveEq(c, mkFVar(d.id), ty);
      if (p) {
        c.assign(g, elimFalse(p));
        c.replaceMainGoal([]);
        return;
      }
    } catch (e) {
      if (!(e instanceof ElabError)) throw e;
    }
    c.m.rollback(mark);
    // ¬ (a = a)
    if (w.k === 'pi' && !hasLooseBVar(w.body, 0)) {
      const concl = c.m.whnf(w.body);
      if (concl.k === 'const' && concl.name === 'False') {
        const prem = c.m.whnf(w.type);
        if (getAppFn(prem).k === 'const' && (getAppFn(prem) as { name: string }).name === 'Eq') {
          const [, a, b] = getAppArgs(prem);
          const mk = c.m.mark();
          if (c.el.isDefEq(a, b)) {
            const ul = c.m.inferSortLevel(c.m.inferType(a));
            c.assign(g, elimFalse(mkApp(mkFVar(d.id), mkAppN(mkConst('Eq.refl', [ul]), [c.m.inferType(a), a]))));
            c.replaceMainGoal([]);
            return;
          }
          c.m.rollback(mk);
        }
        // h : ¬P with some h' : P
        for (const d2 of decls) {
          if (d2 === d) continue;
          const mk = c.m.mark();
          if (c.el.isDefEq(c.m.instantiateMVars(d2.type), w.type)) {
            c.assign(g, elimFalse(mkApp(mkFVar(d.id), mkFVar(d2.id))));
            c.replaceMainGoal([]);
            return;
          }
          c.m.rollback(mk);
        }
      }
    }
  }
  c.failWithGoal('Tactic `contradiction` failed', g, t, 'contradiction');
});

function tryRfl(c: TacCtx, g: number, transparency: 'default' | 'reducible'): boolean {
  const target = c.goalType(g);
  const w = transparency === 'reducible' ? c.m.whnfR(target) : c.m.whnf(target);
  const h = getAppFn(w);
  if (h.k !== 'const') return false;
  const args = getAppArgs(w);
  const mark = c.m.mark();
  const run = (f: () => boolean) => c.m.withTransparency(transparency, f);
  if (h.name === 'Eq' && args.length === 3) {
    if (run(() => c.el.isDefEq(args[1], args[2]))) {
      c.assign(g, mkAppN(mkConst('Eq.refl', h.levels), [args[0], args[1]]));
      return true;
    }
  } else if (h.name === 'Iff' && args.length === 2) {
    if (run(() => c.el.isDefEq(args[0], args[1]))) {
      c.assign(g, mkAppN(mkConst('Iff.refl'), [args[0]]));
      return true;
    }
  } else if (h.name === 'HEq' && args.length === 4) {
    if (run(() => c.el.isDefEq(args[0], args[2]) && c.el.isDefEq(args[1], args[3]))) {
      c.assign(g, mkAppN(mkConst('HEq.refl', h.levels), [args[0], args[1]]));
      return true;
    }
  } else if (h.name === 'Nat.le' && args.length === 2) {
    if (run(() => c.el.isDefEq(args[0], args[1]))) {
      c.assign(g, mkAppN(mkConst('Nat.le.refl'), [args[0]]));
      return true;
    }
  }
  c.m.rollback(mark);
  return false;
}

export function tryRflReducible(c: TacCtx, g: number): boolean {
  return tryRfl(c, g, 'reducible');
}

registerTactic(['rfl'], (t: Tactic, c: TacCtx) => {
  const g = c.mainGoal(t);
  if (tryRfl(c, g, 'default')) {
    c.replaceMainGoal([]);
    return;
  }
  const w = c.m.whnfR(c.goalType(g));
  const h = getAppFn(w);
  const args = getAppArgs(w);
  if (h.k === 'const' && (h.name === 'Eq' || h.name === 'Iff' || h.name === 'HEq')) {
    const [l, r] = h.name === 'Eq' ? [args[1], args[2]] : h.name === 'HEq' ? [args[1], args[3]] : [args[0], args[1]];
    c.failWithGoal(
      `Tactic \`rfl\` failed: The left-hand side\n  ${c.el.pp(l)}\nis not definitionally equal to the right-hand side\n  ${c.el.pp(r)}`,
      g,
      t,
      'rfl',
    );
  }
  c.failWithGoal('Tactic `rfl` failed: The goal is not a reflexive relation (an equation `a = b` or `a ↔ b`)', g, t, 'rfl');
});

registerTactic(['symm'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'names'>;
  const g = c.mainGoal(t);
  const symmOf = (ty: Expr): string | null => {
    const w = c.m.whnfR(ty);
    const h = getAppFn(w);
    if (h.k !== 'const') return null;
    if (h.name === 'Eq') return 'Eq.symm';
    if (h.name === 'Iff') return 'Iff.symm';
    if (h.name === 'Ne') return 'Ne.symm';
    return null;
  };
  if (tac.loc && tac.loc.hyps.length > 0) {
    let goal = g;
    for (const hn of tac.loc.hyps) {
      const d = c.findHyp(goal, hn.name, hn);
      const lemma = symmOf(c.m.instantiateMVars(d.type));
      if (!lemma) c.failWithGoal('Tactic `symm` failed: the hypothesis is not a symmetric relation', goal, t, 'symm');
      const ci = c.el.mkConstInst(lemma);
      const p = c.inGoal(goal, () => c.el.elabAppArgsExprs(ci.e, ci.type, [mkFVar(d.id)]));
      goal = c.replaceHyp(goal, d.id, c.m.instantiateMVars(c.m.inferType(p)), p).goal;
    }
    c.replaceMainGoal([goal]);
    return;
  }
  const lemma = symmOf(c.goalType(g));
  if (!lemma) c.failWithGoal('Tactic `symm` failed: the goal is not a symmetric relation', g, t, 'symm');
  const ci = c.el.mkConstInst(lemma);
  const goals = applyExpr(c, g, ci.e, t);
  c.replaceMainGoal(goals);
});

function tryTrivial(c: TacCtx, g: number): boolean {
  if (tryAssumption(c, g)) return true;
  if (tryRfl(c, g, 'default')) return true;
  const w = c.m.whnf(c.goalType(g));
  const h = getAppFn(w);
  if (h.k === 'const' && h.name === 'True') {
    c.assign(g, mkConst('True.intro'));
    return true;
  }
  if (h.k === 'const' && h.name === 'And') {
    const mark = c.m.mark();
    const [a, b] = getAppArgs(w);
    const g1 = c.newGoal(c.goalLctx(g), a);
    const g2 = c.newGoal(c.goalLctx(g), b);
    if (tryTrivial(c, g1) && tryTrivial(c, g2)) {
      c.assign(g, mkAppN(mkConst('And.intro'), [a, b, c.mvarExpr(g1), c.mvarExpr(g2)]));
      return true;
    }
    c.m.rollback(mark);
  }
  if (h.k === 'const' && h.name === 'Not') return false;
  // decide for closed Nat equalities is covered by rfl
  return false;
}

registerTactic(['trivial'], (t: Tactic, c: TacCtx) => {
  const g = c.mainGoal(t);
  if (!tryTrivial(c, g)) c.failWithGoal('Tactic `trivial` failed', g, t, 'trivial');
  c.replaceMainGoal([]);
});

registerTactic(['sorry'], (t: Tactic, c: TacCtx) => {
  const g = c.mainGoal(t);
  c.el.usesSorry = true;
  c.admit(g);
  c.replaceMainGoal([]);
});

registerTactic(['done'], (t: Tactic, c: TacCtx) => {
  c.pruneGoals();
  if (c.goals.length > 0) {
    const gs = c.ppGoals();
    throw new TacticFailure('unsolved-goals', `unsolved goals\n${goalsToString(gs)}`, t.from, t.to, { goals: gs });
  }
});

registerTactic(['skip'], () => {});

/* ---------------- use / exists ---------------- */

function anonOf(terms: Term[], last: Term): Term {
  const elems = [...terms, last];
  return { k: 'anon', elems, from: terms[0].from, to: terms[terms.length - 1].to };
}

registerTactic(['use'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'terms'>;
  const g = c.mainGoal(t);
  const hole: Term = { k: 'synthHole', name: null, from: t.to, to: t.to };
  const stx = anonOf(tac.terms, hole);
  const { e, holes } = c.elabTermWithHoles(g, stx, c.goalType(g), true, 'use');
  c.closeWith(g, e, t);
  tagUntagged(c, c.tag(g), 'refine', holes);
  const rest: number[] = [];
  for (const h of holes) {
    if (!attemptTactic(c, () => {
      if (!tryRflReducible(c, h)) throw new TacticFailure('tactic-failed', 'rfl', t.from, t.to);
    })) rest.push(h);
  }
  c.replaceMainGoal(rest);
});

registerTactic(['exists'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'terms'>;
  const g = c.mainGoal(t);
  const hole: Term = { k: 'synthHole', name: null, from: t.to, to: t.to };
  const stx = anonOf(tac.terms, hole);
  const { e, holes } = c.elabTermWithHoles(g, stx, c.goalType(g), true, 'exists');
  c.closeWith(g, e, t);
  const rest: number[] = [];
  for (const h of holes) {
    if (!attemptTactic(c, () => {
      if (!tryTrivial(c, h)) throw new TacticFailure('tactic-failed', 'trivial', t.from, t.to);
    })) rest.push(h);
  }
  tagUntagged(c, c.tag(g), 'refine', rest);
  c.replaceMainGoal(rest);
});

/* ---------------- specialize ---------------- */

registerTactic(['specialize'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'specialize'>;
  const g = c.mainGoal(t);
  let head = tac.term;
  while (head.k === 'app') head = head.fn;
  if (head.k !== 'ident') c.fail('tactic-failed', "'specialize' requires a term of the form `h a b`", t, { tactic: 'specialize' });
  const d = c.findHyp(g, head.name, head);
  const { e } = c.elabTermWithHoles(g, tac.term, null, false, 'specialize');
  const ty = c.m.instantiateMVars(c.m.inferType(e));
  const r = c.replaceHyp(g, d.id, ty, e);
  c.replaceMainGoal([r.goal]);
});

/* ---------------- classical ---------------- */

registerTactic(['by_cases'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'byCases'>;
  const g = c.mainGoal(t);
  const p = c.inGoal(g, () => c.m.instantiateMVars(c.el.elabTermEnsuring(tac.prop, mkSort(lzero))));
  const target = c.goalType(g);
  const name = tac.hname ?? 'h';
  const notP = mkApp(mkConst('Not'), p);
  const d1 = c.m.mkLocal(name, p);
  const d2 = c.m.mkLocal(name, notP);
  const g1 = c.newGoal(c.goalLctx(g).push(d1), target, 'pos');
  const g2 = c.newGoal(c.goalLctx(g).push(d2), target, 'neg');
  const em = mkAppN(mkConst('Classical.em'), [p]);
  const u = c.m.inferSortLevel(target);
  if (u.k !== 'zero' && c.m.instantiateLevel(u).k !== 'zero') {
    // data: use Classical.byCases-like dite via propDecidable is not available; Or.elim needs Prop
    c.fail('tactic-failed', '`by_cases` is only supported when the goal is a proposition', t, { tactic: 'by_cases' });
  }
  c.assign(g, mkAppN(mkConst('Or.elim'), [p, notP, target, em, c.m.mkLambdaFVars([d1.id], c.mvarExpr(g1)), c.m.mkLambdaFVars([d2.id], c.mvarExpr(g2))]));
  c.replaceMainGoal([g1, g2]);
});

registerTactic(['by_contra'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'byContra'>;
  const g = c.mainGoal(t);
  const ci = c.el.mkConstInst('Classical.byContradiction');
  const goals = applyExpr(c, g, ci.e, t);
  // intro h
  const ng = goals[0];
  const r = c.introOne(ng, tac.hname ?? 'this', tac.hname === '_');
  if (!r) c.failWithGoal('by_contra failed', ng, t, 'by_contra');
  c.replaceMainGoal([r.goal, ...goals.slice(1)]);
});

/* ---------------- extensionality ---------------- */

function extOnce(c: TacCtx, g: number, name: string | null, r: { from: number; to: number }, tac: string): number {
  const target = c.goalType(g);
  const w = c.m.whnfR(target);
  if (!(getAppFn(w).k === 'const' && (getAppFn(w) as { name: string }).name === 'Eq')) {
    c.failWithGoal(`Tactic \`${tac}\` failed: the goal is not an equation`, g, r, tac);
  }
  const [alpha] = getAppArgs(w);
  const at = c.m.instantiateMVars(alpha);
  const isSet = getAppFn(at).k === 'const' && (getAppFn(at) as { name: string }).name === 'Set';
  let lemma: string;
  if (isSet && tac === 'ext') lemma = 'Set.ext';
  else {
    const aw = c.m.whnf(at);
    if (aw.k !== 'pi') c.failWithGoal(`Tactic \`${tac}\` failed: no applicable extensionality lemma`, g, r, tac);
    lemma = 'funext';
  }
  const ci = c.el.mkConstInst(lemma);
  const goals = applyExpr(c, g, ci.e, r);
  const ng = goals[0];
  const intro = c.introOne(ng, name, name === null || name === '_');
  if (!intro) c.failWithGoal(`Tactic \`${tac}\` failed`, ng, r, tac);
  return intro.goal;
}

registerTactic(['ext', 'funext'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'names'>;
  let g = c.mainGoal(t);
  if (tac.names.length === 0) {
    g = extOnce(c, g, null, t, t.name);
  } else {
    for (const n of tac.names) g = extOnce(c, g, n.name, n, t.name);
  }
  c.replaceMainGoal([g]);
});

/* ---------------- revert / clear / rename_i ---------------- */

export function revertHyps(c: TacCtx, g: number, ids: number[]): { goal: number; reverted: LocalDecl[] } {
  const lctx = c.goalLctx(g);
  // close under dependencies (later hyps mentioning reverted ones)
  const set = new Set(ids);
  for (const d of lctx.decls) {
    if (set.has(d.id)) continue;
    for (const id of [...set]) {
      if (mentionsFVar(c.m.instantiateMVars(d.type), id) && lctx.indexOf(d.id) > lctx.indexOf(id)) {
        set.add(d.id);
        break;
      }
    }
  }
  const reverted = lctx.decls.filter((d) => set.has(d.id));
  const rest = lctx.decls.filter((d) => !set.has(d.id));
  const newType = c.m.mkForallFVars(reverted.map((d) => d.id), c.goalType(g));
  const ng = c.newGoal(new LocalContext(rest), newType, c.tag(g));
  c.assign(g, mkAppN(c.mvarExpr(ng), reverted.map((d) => mkFVar(d.id))));
  return { goal: ng, reverted };
}

registerTactic(['revert'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'names'>;
  const g = c.mainGoal(t);
  const ids = tac.names.map((n) => c.findHyp(g, n.name, n).id);
  c.replaceMainGoal([revertHyps(c, g, ids).goal]);
});

registerTactic(['clear'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'names'>;
  const g = c.mainGoal(t);
  const ids = tac.names.map((n) => c.findHyp(g, n.name, n).id);
  c.replaceMainGoal([c.clearHyps(g, ids, t)]);
});

registerTactic(['rename_i'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'names'>;
  const g = c.mainGoal(t);
  const lctx = c.goalLctx(g);
  const inacc = lctx.decls.filter((d) => d.inaccessible && !d.hidden);
  const n = tac.names.length;
  if (inacc.length < n) c.failWithGoal('Tactic `rename_i` failed: too many variable names provided', g, t, 'rename_i');
  const targets = inacc.slice(inacc.length - n);
  const map = new Map<number, string>();
  targets.forEach((d, i) => {
    if (tac.names[i].name !== '_') map.set(d.id, tac.names[i].name);
  });
  const decls = lctx.decls.map((d) => {
    const nn = map.get(d.id);
    if (!nn) return d;
    const nd = { ...d, userName: nn, inaccessible: false };
    c.m.registerLocal(nd);
    return nd;
  });
  const ng = c.newGoal(new LocalContext(decls), c.goalType(g), c.tag(g));
  c.assign(g, c.mvarExpr(ng));
  c.replaceMainGoal([ng]);
});

/* ---------------- calc ---------------- */

registerTactic(['calc'], (t: Tactic, c: TacCtx) => {
  const tac = t as Extract<Tactic, { k: 'calc' }>;
  const g = c.mainGoal(t);
  const e = c.inGoal(g, () => {
    const v = c.el.elabCalc(tac.steps, null, t);
    c.el.synthesize();
    return c.m.instantiateMVars(v);
  });
  c.closeWith(g, e, t);
  c.replaceMainGoal([]);
});

/* ---------------- structure & combinators ---------------- */

registerTactic(['·'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'focus'>;
  const g = c.mainGoal(t);
  runFocused(c, [g], tac.tactics, { from: t.from, to: t.to }, true);
  c.goals = c.goals.filter((x) => x !== g);
  c.pruneGoals();
});

registerTactic(['focus'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'combinator'>;
  const g = c.mainGoal(t);
  const rest = runFocused(c, [g], tac.tactics, t, false);
  c.goals = [...rest, ...c.goals.filter((x) => x !== g)];
  c.pruneGoals();
});

registerTactic(['('], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'paren'>;
  evalSeq(c, tac.tactics);
});

function findCaseGoal(c: TacCtx, tag: string): number | undefined {
  c.pruneGoals();
  if (tag === '_') return c.goals[0];
  const exact = c.goals.find((g) => c.tag(g) === tag);
  if (exact !== undefined) return exact;
  return c.goals.find((g) => {
    const tg = c.tag(g);
    return tg !== undefined && (tg.endsWith('.' + tag) || tg.startsWith(tag + '.') || tg.split('.').includes(tag));
  });
}

/** Rename the most recent inaccessible hypotheses (for `case tag x y`, `next x y`). */
export function renameInaccessible(c: TacCtx, g: number, names: { name: string }[]): number {
  if (names.length === 0) return g;
  const lctx = c.goalLctx(g);
  const inacc = lctx.decls.filter((d) => d.inaccessible && !d.hidden);
  const targets = inacc.slice(Math.max(0, inacc.length - names.length));
  const offset = names.length - targets.length;
  const map = new Map<number, string>();
  targets.forEach((d, i) => {
    const n = names[i + offset].name;
    if (n !== '_') map.set(d.id, n);
  });
  const decls = lctx.decls.map((d) => {
    const nn = map.get(d.id);
    if (!nn) return d;
    const nd = { ...d, userName: nn, inaccessible: false };
    c.m.registerLocal(nd);
    return nd;
  });
  const ng = c.newGoal(new LocalContext(decls), c.goalType(g), c.tag(g));
  c.assign(g, c.mvarExpr(ng));
  return ng;
}

registerTactic(['case', 'next'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'case'>;
  c.pruneGoals();
  const g = t.name === 'next' ? c.goals[0] : findCaseGoal(c, tac.tag);
  if (g === undefined) {
    if (c.goals.length === 0) c.fail('no-goals', 'No goals to be solved', t);
    c.fail('tactic-failed', `Case tag \`${tac.tag}\` not found.\n\nAvailable tags:${c.goals.map((x) => `\n  ${c.tag(x) ?? '(anonymous)'}`).join('')}`, t, { tactic: 'case' });
  }
  const ng = renameInaccessible(c, g, tac.vars);
  c.goals = c.goals.filter((x) => x !== g);
  runFocused(c, [ng], tac.tactics, { from: t.from, to: t.to }, true);
  c.pruneGoals();
});

registerTactic(['all_goals'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'combinator'>;
  c.pruneGoals();
  const out: number[] = [];
  for (const g of c.goals) {
    if (c.m.isAssigned(g)) continue;
    const saved = c.goals;
    c.goals = [g];
    try {
      evalSeq(c, tac.tactics);
      c.pruneGoals();
      out.push(...c.goals);
    } finally {
      c.goals = saved;
    }
  }
  c.goals = out;
});

registerTactic(['any_goals'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'combinator'>;
  c.pruneGoals();
  const out: number[] = [];
  let any = false;
  for (const g of [...c.goals]) {
    const saved = c.goals;
    c.goals = [g];
    let ok = false;
    try {
      ok = attemptTactic(c, () => evalSeq(c, tac.tactics));
      c.pruneGoals();
      out.push(...(ok ? c.goals : [g]));
    } finally {
      c.goals = saved;
    }
    if (ok) any = true;
  }
  if (!any) c.fail('tactic-failed', 'Tactic `any_goals` failed: the tactic failed on every goal', t, { tactic: 'any_goals' });
  c.goals = out;
});

registerTactic(['try'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'combinator'>;
  attemptTactic(c, () => evalSeq(c, tac.tactics));
});

registerTactic(['repeat'], (t: Tactic, c: TacCtx) => {
  // Lean: `repeat tac` = `first | (tac; repeat tac) | skip` — the recursion acts on the main goal
  const tac = t as T<'combinator'>;
  for (let i = 0; i < 500; i++) {
    c.pruneGoals();
    if (c.goals.length === 0) return;
    if (!attemptTactic(c, () => evalSeq(c, tac.tactics))) return;
  }
});

registerTactic(['first'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'first'>;
  for (const alt of tac.alts) {
    if (attemptTactic(c, () => evalSeq(c, alt))) return;
  }
  // re-run the last to report its error
  evalSeq(c, tac.alts[tac.alts.length - 1]);
});

registerTactic(['<;>'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'seqAll'>;
  const g = c.mainGoal(t);
  const saved = c.goals.slice(1);
  c.goals = [g];
  evalTactic(c, tac.first);
  c.pruneGoals();
  const produced = [...c.goals];
  const out: number[] = [];
  for (const ng of produced) {
    c.goals = [ng];
    evalTactic(c, tac.then);
    c.pruneGoals();
    out.push(...c.goals);
  }
  c.goals = [...out, ...saved];
});

export type { TacticSeq };
