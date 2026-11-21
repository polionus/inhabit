/**
 * Rewriting: `rw`/`rewrite`/`rwa`/`nth_rewrite`, `unfold`, and a small `simp only`.
 *
 * Follows Lean's `kabstract`: the pattern (the instantiated left-hand side) is matched against
 * subterms in pre-order, comparing head symbol and arity first, then `isDefEq` at `instances`
 * transparency; the first match fixes the pattern's metavariables, and every later instance of the
 * now-instantiated pattern is abstracted too. The proof is `Eq.mpr (congrArg motive h) ?new`.
 */
import type { Expr } from '../kernel/expr.ts';
import {
  getAppArgs,
  getAppFn,
  getAppNumArgs,
  instantiate1,
  instantiateExprLevelParams,
  mkApp,
  mkAppN,
  mkBVar,
  mkConst,
  mkLam,
  mkPi,
  mkLet,
  mkFVar,
  replace,
} from '../kernel/expr.ts';
import type { Level } from '../kernel/level.ts';
import { lsucc } from '../kernel/level.ts';
import { headBeta } from '../kernel/reduce.ts';
import type { Location, RwRule, Tactic } from '../syntax/ast.ts';
import type { TacCtx } from './core.ts';
import { TacticFailure, attemptTactic, registerTactic } from './core.ts';
import { tryRflReducible } from './basic.ts';
import { ElabError } from '../elab/errors.ts';

type T<K extends Tactic['k']> = Extract<Tactic, { k: K }>;

interface Equation {
  /** proof of lhs = rhs */
  proof: Expr;
  lhs: Expr;
  rhs: Expr;
  alpha: Expr;
  level: Level;
  /** metavariables created for the rule's arguments */
  mvars: number[];
  /** printed form of the rule's equation (for errors) */
}

/** Elaborate a rewrite rule into an equation `lhs = rhs` (iff via propext), reversed if `←`. */
function elabEquation(c: TacCtx, g: number, rule: RwRule): Equation {
  const m = c.m;
  const { e } = c.elabTermWithHoles(g, rule.term, null, true, 'rw', true);
  let t = m.instantiateMVars(m.inferType(e));
  let proof = e;
  const mvars: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (t.k !== 'pi') {
      const w = m.whnf(t);
      if (w.k !== 'pi') break;
      t = w;
    }
    const mv = m.mkFreshMVar(t.type, c.goalLctx(g), 'natural', t.name.includes('✝') ? undefined : t.name);
    mvars.push((mv as { id: number }).id);
    proof = mkApp(proof, mv);
    t = instantiate1(t.body, mv);
  }
  t = m.instantiateMVars(t);
  let h = getAppFn(t);
  let args = getAppArgs(t);
  if (!(h.k === 'const' && (h.name === 'Eq' || h.name === 'Iff'))) {
    const w = m.whnfR(t);
    h = getAppFn(w);
    args = getAppArgs(w);
  }
  let eq: Equation;
  if (h.k === 'const' && h.name === 'Eq' && args.length === 3) {
    eq = { proof, alpha: args[0], lhs: args[1], rhs: args[2], level: h.levels[0], mvars };
  } else if (h.k === 'const' && h.name === 'Iff' && args.length === 2) {
    const p = mkAppN(mkConst('propext'), [args[0], args[1], proof]);
    eq = { proof: p, alpha: mkSortProp(), lhs: args[0], rhs: args[1], level: lsucc({ k: 'zero' }), mvars };
  } else if (c.m.isProp(t)) {
    // `h : p` rewrites `p` to `True`
    const p = mkAppN(mkConst('eq_true'), [t, proof]);
    eq = { proof: p, alpha: mkSortProp(), lhs: t, rhs: mkConst('True'), level: lsucc({ k: 'zero' }), mvars };
  } else {
    c.fail('rewrite-failed', `Tactic \`rewrite\` failed: equality or iff proof expected\n  ${c.el.pp(t)}`, rule.term);
  }
  if (rule.rev) {
    const symm = eq.alpha.k === 'sort' && eq.alpha.level.k === 'zero' && h.k === 'const' && h.name === 'Iff' ? null : null;
    void symm;
    eq = {
      ...eq,
      proof: mkAppN(mkConst('Eq.symm', [eq.level]), [eq.alpha, eq.lhs, eq.rhs, eq.proof]),
      lhs: eq.rhs,
      rhs: eq.lhs,
    };
  }
  return eq;
}

function mkSortProp(): Expr {
  return { k: 'sort', level: { k: 'zero' }, lb: 0, fv: false, mv: false, lmv: false, lp: false } as Expr;
}

/**
 * Lean's `kabstract`: abstract instances of `p` in `e` (bvar 0 at the top). `occs`: which
 * occurrences (1-based) to abstract; all when undefined. Returns null if nothing matched.
 */
export function kabstract(c: TacCtx, e: Expr, p: Expr, occs?: number[]): Expr | null {
  const m = c.m;
  const pi = m.instantiateMVars(p);
  const ph = getAppFn(pi);
  const pn = getAppNumArgs(pi);
  let count = 0;
  let found = false;
  const sameHead = (x: Expr): boolean => {
    const xh = getAppFn(x);
    if (getAppNumArgs(x) !== pn) return false;
    if (ph.k === 'const') return xh.k === 'const' && xh.name === ph.name;
    if (ph.k === 'fvar') return xh.k === 'fvar' && xh.id === ph.id;
    if (ph.k === 'mvar') return true;
    if (ph.k === 'lit') return xh.k === 'lit' && xh.value === ph.value;
    if (ph.k === 'sort') return xh.k === 'sort';
    return ph.k === xh.k;
  };
  const visit = (x: Expr, off: number): Expr => {
    const children = (): Expr => {
      switch (x.k) {
        case 'app': {
          const f = visit(x.fn, off);
          const a = visit(x.arg, off);
          return f === x.fn && a === x.arg ? x : mkApp(f, a);
        }
        case 'lam': {
          const t = visit(x.type, off);
          const b = visit(x.body, off + 1);
          return t === x.type && b === x.body ? x : mkLam(x.name, t, b, x.bi);
        }
        case 'pi': {
          const t = visit(x.type, off);
          const b = visit(x.body, off + 1);
          return t === x.type && b === x.body ? x : mkPi(x.name, t, b, x.bi);
        }
        case 'let': {
          const t = visit(x.type, off);
          const v = visit(x.value, off);
          const b = visit(x.body, off + 1);
          return mkLet(x.name, t, v, b);
        }
        default:
          return x;
      }
    };
    if (x.lb > 0) return children();
    if (!sameHead(x)) return children();
    const mark = m.mark();
    const ok = m.withTransparency('instances', () => c.el.isDefEq(x, pi));
    if (ok) {
      count++;
      if (!occs || occs.includes(count)) {
        found = true;
        return mkBVar(off);
      }
      // keep the assignment from the first match only when it is abstracted
      if (occs && count < Math.min(...occs)) m.rollback(mark);
      return children();
    }
    m.rollback(mark);
    return children();
  };
  const r = visit(m.instantiateMVars(e), 0);
  return found ? r : null;
}

interface RewriteResult {
  eNew: Expr;
  /** proof of `e = eNew` */
  eqProof: Expr;
  newGoals: number[];
}

function rewriteExpr(c: TacCtx, g: number, e: Expr, rule: RwRule, occs?: number[]): RewriteResult {
  const m = c.m;
  const eq = elabEquation(c, g, rule);
  const lhs = m.instantiateMVars(eq.lhs);
  if (getAppFn(lhs).k === 'mvar') {
    c.fail('rewrite-failed', `Tactic \`rewrite\` failed: Pattern is a metavariable\n  ${c.el.pp(lhs)}\nfrom equation\n  ${c.el.pp(eq.lhs)} = ${c.el.pp(eq.rhs)}`, rule.term, {
      pattern: c.el.pp(lhs),
    });
  }
  const abst = kabstract(c, e, lhs, occs);
  if (!abst) {
    const pat = c.el.pp(lhs);
    c.fail(
      'rewrite-failed',
      `Tactic \`rewrite\` failed: Did not find an occurrence of the pattern\n  ${pat}\nin the target expression\n  ${c.el.pp(e)}\n\n${c.goalString(g)}`,
      rule.term,
      { pattern: pat },
    );
  }
  const alpha = m.instantiateMVars(eq.alpha);
  const motive = mkLam('_a', alpha, abst);
  const eNew = m.instantiateMVars(instantiate1(abst, eq.rhs));
  // type of e: Sort u; congrArg {α} {β := Sort u} {lhs} {rhs} motive h : e = eNew
  const eType = m.instantiateMVars(m.inferType(e));
  let v: Level;
  try {
    v = m.inferSortLevel(eType);
  } catch {
    v = m.mkFreshLevelMVar();
  }
  // check that the motive is type correct
  try {
    m.inferType(mkApp(motive, eq.rhs));
  } catch {
    c.fail('rewrite-failed', `Tactic \`rewrite\` failed: motive is not type correct`, rule.term);
  }
  const eqProof = mkAppN(mkConst('congrArg', [eq.level, v]), [alpha, eType, m.instantiateMVars(eq.lhs), m.instantiateMVars(eq.rhs), motive, eq.proof]);
  const newGoals = eq.mvars.filter((id) => !m.isAssigned(id) && m.isProp(m.instantiateMVars(m.decl(id).type)));
  return { eNew, eqProof, newGoals };
}

/** Rewrite the target of `g`; returns [new main goal, side goals]. */
function rewriteTarget(c: TacCtx, g: number, rule: RwRule, occs?: number[]): number[] {
  const target = c.goalType(g);
  const r = rewriteExpr(c, g, target, rule, occs);
  const u = c.m.inferSortLevel(target);
  const ng = c.replaceTarget(g, r.eNew, (n) => mkAppN(mkConst('Eq.mpr', [u]), [target, r.eNew, r.eqProof, n]));
  for (const sg of r.newGoals) c.m.setMVarUserName(sg, undefined);
  return [ng, ...r.newGoals.map(toGoal(c))];
}

function toGoal(c: TacCtx) {
  return (id: number): number => {
    // side conditions become proper goals (opaque mvars assigned to the natural ones)
    const d = c.m.decl(id);
    const ng = c.newGoal(d.lctx, c.m.instantiateMVars(d.type), d.userName);
    c.assign(id, c.mvarExpr(ng));
    return ng;
  };
}

function rewriteHyp(c: TacCtx, g: number, hId: number, rule: RwRule, occs?: number[]): number[] {
  const d = c.goalLctx(g).get(hId)!;
  const ty = c.m.instantiateMVars(d.type);
  const r = rewriteExpr(c, g, ty, rule, occs);
  const proof = mkAppN(mkConst('Eq.mp', [c.m.inferSortLevel(ty)]), [ty, r.eNew, r.eqProof, mkFVar(hId)]);
  const res = c.replaceHyp(g, hId, r.eNew, proof);
  return [res.goal, ...r.newGoals.map(toGoal(c))];
}

function locations(c: TacCtx, g: number, loc: Location | null): { goal: boolean; hyps: { id: number; from: number; to: number }[]; wildcard: boolean } {
  if (!loc) return { goal: true, hyps: [], wildcard: false };
  if (loc.wildcard) {
    const hyps = c
      .goalLctx(g)
      .decls.filter((d) => !d.hidden && c.m.isProp(d.type))
      .map((d) => ({ id: d.id, from: 0, to: 0 }));
    return { goal: true, hyps, wildcard: true };
  }
  return {
    goal: loc.goal,
    hyps: loc.hyps.map((h) => ({ id: c.findHyp(g, h.name, h).id, from: h.from, to: h.to })),
    wildcard: false,
  };
}

/** Run one rule at the given locations of the main goal. */
function rewriteAt(c: TacCtx, rule: RwRule, loc: Location | null, t: { from: number; to: number }, occs?: number[]): void {
  let g = c.mainGoal(t);
  const locs = locations(c, g, loc);
  const side: number[] = [];
  if (locs.wildcard) {
    let any = false;
    for (const h of locs.hyps) {
      const name = c.m.fvarDecl(h.id).userName;
      const cur = c.goalLctx(g).decls.find((d) => d.userName === name && !d.hidden);
      if (!cur) continue;
      let res: number[] | null = null;
      if (attemptTactic(c, () => {
        res = rewriteHyp(c, g, cur.id, rule, occs);
      }) && res) {
        g = (res as number[])[0];
        side.push(...(res as number[]).slice(1));
        any = true;
      }
    }
    let res: number[] | null = null;
    if (attemptTactic(c, () => {
      res = rewriteTarget(c, g, rule, occs);
    }) && res) {
      g = (res as number[])[0];
      side.push(...(res as number[]).slice(1));
      any = true;
    }
    if (!any) {
      const eq = elabEquation(c, g, rule);
      c.fail('rewrite-failed', `Tactic \`rewrite\` failed: Did not find an occurrence of the pattern\n  ${c.el.pp(eq.lhs)}\nin any hypothesis or the goal\n\n${c.goalString(g)}`, rule.term, {
        pattern: c.el.pp(eq.lhs),
      });
    }
    c.replaceMainGoal([g, ...side]);
    return;
  }
  for (const h of locs.hyps) {
    const name = c.m.fvarDecl(h.id).userName;
    const cur = c.goalLctx(g).decls.find((d) => d.userName === name && !d.hidden) ?? c.goalLctx(g).get(h.id)!;
    const res = rewriteHyp(c, g, cur.id, rule, occs);
    g = res[0];
    side.push(...res.slice(1));
  }
  if (locs.goal) {
    const res = rewriteTarget(c, g, rule, occs);
    g = res[0];
    side.push(...res.slice(1));
  }
  c.replaceMainGoal([g, ...side]);
}

function rwTactic(t: Tactic, c: TacCtx): void {
  const tac = t as T<'rw'>;
  for (const rule of tac.rules) {
    rewriteAt(c, rule, tac.loc, t);
  }
  if (t.name === 'rewrite') return;
  // `rw` tries `rfl` (with reducible transparency) afterwards
  c.pruneGoals();
  if (c.goals.length > 0) {
    const g = c.goals[0];
    attemptTactic(c, () => {
      if (!tryRflReducible(c, g)) throw new TacticFailure('tactic-failed', 'rfl', t.from, t.to);
    });
    c.pruneGoals();
  }
  if (t.name === 'rwa') {
    const g = c.mainGoal(t);
    const target = c.goalType(g);
    const decls = c.goalLctx(g).decls;
    for (let i = decls.length - 1; i >= 0; i--) {
      const d = decls[i];
      if (d.hidden) continue;
      const mark = c.m.mark();
      if (c.el.isDefEq(c.m.instantiateMVars(d.type), target)) {
        c.assign(g, mkFVar(d.id));
        c.replaceMainGoal([]);
        return;
      }
      c.m.rollback(mark);
    }
    c.failWithGoal('Tactic `assumption` failed', g, { from: t.from, to: t.nameTo }, 'rwa');
  }
}

registerTactic(['rw', 'rewrite', 'rwa'], rwTactic);

registerTactic(['nth_rewrite'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'nthRw'>;
  for (const rule of tac.rules) rewriteAt(c, rule, tac.loc, t, [tac.n]);
  if (t.name === 'nth_rw') {
    c.pruneGoals();
    if (c.goals.length > 0) {
      const g = c.goals[0];
      attemptTactic(c, () => {
        if (!tryRflReducible(c, g)) throw new TacticFailure('tactic-failed', 'rfl', t.from, t.to);
      });
    }
  }
});

/* ---------------- unfold ---------------- */

/** δ-expand every occurrence of constant `name` (β-reducing the result). */
export function unfoldConst(c: TacCtx, e: Expr, name: string): Expr {
  const d = c.m.env.get(name);
  if (!d) return e;
  return replace(c.m.instantiateMVars(e), (x) => {
    const f = getAppFn(x);
    if (f.k !== 'const' || f.name !== name) return undefined;
    const args = getAppArgs(x).map((a) => unfoldConst(c, a, name));
    if (d.matchDef) {
      const u = c.m.red.withTransparency('all', () => c.m.red.unfoldHead(mkAppN(f, args)));
      return u ? headBeta(u) : mkAppN(f, args);
    }
    if (!d.value) return mkAppN(f, args);
    const v = instantiateExprLevelParams(d.value, d.levelParams, f.levels);
    return headBeta(mkAppN(v, args));
  });
}

registerTactic(['unfold'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'unfold'>;
  let g = c.mainGoal(t);
  for (const n of tac.names) {
    const full0 = c.inGoal(g, () => c.el.resolveGlobal(n.name));
    if (!full0) c.inGoal(g, () => c.el.unknownIdent(n.name, n));
    const full = full0!;
    c.el.useConst(full, n);
    const d = c.m.env.get(full)!;
    if (!d.value && !d.matchDef) c.fail('tactic-failed', `Tactic \`unfold\` failed: \`${full}\` is not a definition that can be unfolded`, n, { tactic: 'unfold' });
    const locs = locations(c, g, tac.loc);
    let changed = false;
    for (const h of locs.hyps) {
      const decl = c.goalLctx(g).get(h.id);
      if (!decl) continue;
      const ty = c.m.instantiateMVars(decl.type);
      const nt = unfoldConst(c, ty, full);
      if (nt !== ty && !KEQ(nt, ty)) {
        g = c.replaceHyp(g, h.id, nt).goal;
        changed = true;
      } else if (!locs.wildcard) {
        c.fail('tactic-failed', `Tactic \`unfold\` failed to unfold \`${full}\` in\n  ${c.el.pp(ty)}`, n, { tactic: 'unfold' });
      }
    }
    if (locs.goal) {
      const ty = c.goalType(g);
      const nt = unfoldConst(c, ty, full);
      if (nt !== ty && !KEQ(nt, ty)) {
        g = c.replaceTarget(g, nt);
        changed = true;
      } else if (!locs.wildcard) {
        c.fail('tactic-failed', `Tactic \`unfold\` failed to unfold \`${full}\` in\n  ${c.el.pp(ty)}`, n, { tactic: 'unfold' });
      }
    }
    if (!changed && locs.wildcard) c.fail('tactic-failed', `Tactic \`unfold\` failed to unfold \`${full}\``, n, { tactic: 'unfold' });
  }
  c.replaceMainGoal([g]);
});

import { exprEq as KEQ } from '../kernel/expr.ts';

/* ---------------- simp only (small) ---------------- */

registerTactic(['simp', 'simp_all', 'dsimp', 'simp?', 'norm_num'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'simp'>;
  if (!tac.only && t.name !== 'simp') {
    c.fail('unknown-tactic', `The tactic \`${t.name}\` is not supported by this game's Lean engine.`, t, { tactic: t.name });
  }
  let g = c.mainGoal(t);
  let progress = false;
  for (let round = 0; round < 50; round++) {
    let changed = false;
    for (const rule of tac.rules) {
      let res = false;
      res = attemptTactic(c, () => rewriteAt(c, rule, tac.loc, t));
      if (res) {
        changed = true;
        progress = true;
        g = c.mainGoal(t);
      }
    }
    if (!changed) break;
  }
  c.pruneGoals();
  if (c.goals.length > 0) {
    g = c.goals[0];
    const w = c.m.whnfR(c.goalType(g));
    if (w.k === 'const' && w.name === 'True') {
      c.assign(g, mkConst('True.intro'));
      c.pruneGoals();
      return;
    }
    if (attemptTactic(c, () => {
      if (!tryRflReducible(c, g)) throw new TacticFailure('tactic-failed', 'rfl', t.from, t.to);
    })) {
      c.pruneGoals();
      return;
    }
  }
  if (!progress) c.failWithGoal('simp made no progress', g, t, 'simp');
});

export { ElabError };
