/**
 * Case analysis and induction: `cases`, `induction`, `rcases`/`obtain`/`rintro` patterns,
 * `subst`, `injection`. All are built from the generated `I.casesOn` / `I.rec` eliminators,
 * so the resulting proof terms are checked by the kernel like any other term.
 */
import type { Expr } from '../kernel/expr.ts';
import { getAppArgs, getAppFn, instantiate1, mkApp, mkAppN, mkConst, mkFVar, mkNatLit } from '../kernel/expr.ts';
import type { Level } from '../kernel/level.ts';
import { headBeta, natCtorView } from '../kernel/reduce.ts';
import type { LocalDecl } from '../meta/lctx.ts';
import { LocalContext } from '../meta/lctx.ts';
import type { InductionAlt, RPat, Tactic } from '../syntax/ast.ts';
import type { TacCtx } from './core.ts';
import { TacticFailure, mentionsFVar, registerTactic, runFocused } from './core.ts';
import { appendTag, disproveEq, revertHyps } from './basic.ts';

type T<K extends Tactic['k']> = Extract<Tactic, { k: K }>;

export interface CaseBranch {
  ctor: string;
  goal: number;
  /** field fvars then induction hypotheses */
  fields: number[];
  ihs: number[];
}

function shortName(ctor: string): string {
  return ctor.slice(ctor.lastIndexOf('.') + 1);
}

/** Re-introduce previously reverted hypotheses with their names. */
function reintro(c: TacCtx, g: number, reverted: LocalDecl[]): number {
  for (const d of reverted) {
    const r = c.introOne(g, d.userName, d.inaccessible);
    if (!r) break;
    g = r.goal;
  }
  return g;
}

/**
 * Core `cases`/`induction` on the hypothesis `hId` of goal `g`.
 * `names[i]` (if given) name the fields (and ihs) of constructor i.
 */
export function casesCore(
  c: TacCtx,
  g: number,
  hId: number,
  kind: 'cases' | 'induction',
  r: { from: number; to: number },
  opts: { generalizing?: number[]; keepTag?: boolean; names?: Map<string, (string | null)[]> } = {},
): CaseBranch[] {
  const m = c.m;
  const lctx0 = c.goalLctx(g);
  const hDecl = lctx0.get(hId);
  if (!hDecl) c.fail('tactic-failed', 'unknown hypothesis', r);
  const hType = m.whnf(m.instantiateMVars(hDecl.type));
  const head = getAppFn(hType);
  const ind = head.k === 'const' ? m.env.get(head.name)?.ind : undefined;
  if (!ind || head.k !== 'const') {
    c.fail(
      'not-inductive',
      `Tactic \`${kind}\` failed: major premise type is not an inductive type\n  ${c.el.pp(hDecl.type)}\n\n${c.goalString(g)}`,
      r,
      { tactic: kind },
    );
  }
  const indName = head.name;
  const indLevels = head.levels;
  const args = getAppArgs(hType);
  const params = args.slice(0, ind.numParams);
  const indices = args.slice(ind.numParams);
  if (indices.some((ix) => ix.k !== 'fvar') || new Set(indices.map((ix) => (ix as { id: number }).id)).size !== indices.length) {
    c.fail('tactic-failed', `Tactic \`${kind}\` failed: the indices of\n  ${c.el.pp(hDecl.type)}\nmust be distinct variables`, r, { tactic: kind });
  }
  const idxIds = indices.map((ix) => (ix as { id: number }).id);
  // revert everything that depends on h / the indices (and `generalizing` variables)
  const keyIds = new Set([hId, ...idxIds]);
  const deps: number[] = [];
  for (const d of lctx0.decls) {
    if (keyIds.has(d.id)) continue;
    const ty = m.instantiateMVars(d.type);
    if ([...keyIds, ...deps].some((k) => mentionsFVar(ty, k)) && lctx0.indexOf(d.id) > Math.min(...[...keyIds].map((k) => lctx0.indexOf(k)))) {
      deps.push(d.id);
    }
  }
  for (const gid of opts.generalizing ?? []) if (!deps.includes(gid)) deps.push(gid);
  deps.sort((a, b) => lctx0.indexOf(a) - lctx0.indexOf(b));
  let g1 = g;
  let reverted: LocalDecl[] = [];
  if (deps.length > 0) {
    const rv = revertHyps(c, g, deps);
    g1 = rv.goal;
    reverted = rv.reverted;
  }
  const target = c.goalType(g1);
  const lctx1 = c.goalLctx(g1);
  const u = m.inferSortLevel(target);
  const uInst = m.instantiateLevel(u);
  if (ind.isProp && !ind.largeElim && uInst.k !== 'zero') {
    c.fail(
      'tactic-failed',
      `Tactic \`${kind}\` failed: \`${indName}\` is a proposition and can only be eliminated into propositions, but the goal\n  ${c.el.pp(target)}\nis not a proposition`,
      r,
      { tactic: kind },
    );
  }
  const motive = m.mkLambdaFVars([...idxIds, hId], target);
  const elimLevels: Level[] = ind.largeElim ? [uInst, ...indLevels] : [...indLevels];
  const parentTag = c.tag(g);
  // base context for branches: without h and indices
  const baseLctx = lctx1.remove(new Set([hId, ...idxIds]));
  const branches: CaseBranch[] = [];
  const minors: Expr[] = [];
  const isNat = indName === 'Nat';
  for (const ctor of ind.ctors) {
    const cdecl = m.env.get(ctor)!;
    let ct = cdecl.type;
    // instantiate universe params and params
    const { instantiateExprLevelParams } = KERNEL;
    ct = instantiateExprLevelParams(ct, cdecl.levelParams, indLevels);
    for (const p of params) {
      if (ct.k !== 'pi') break;
      ct = instantiate1(ct.body, p);
    }
    const fields: LocalDecl[] = [];
    let lctx = baseLctx;
    const given = opts.names?.get(ctor) ?? [];
    while (ct.k === 'pi') {
      const nm = given[fields.length];
      const d = nm ? m.mkLocal(nm, ct.type, 'default', undefined, false) : m.mkLocal(ct.name, ct.type, 'default', undefined, true);
      fields.push(d);
      lctx = lctx.push(d);
      ct = instantiate1(ct.body, mkFVar(d.id));
    }
    const ctorApp = mkAppN(mkAppN(mkConst(ctor, indLevels), params), fields.map((f) => mkFVar(f.id)));
    const resIdx = getAppArgs(ct).slice(ind.numParams);
    const ihs: LocalDecl[] = [];
    if (kind === 'induction') {
      for (const f of fields) {
        let ft = m.whnf(m.instantiateMVars(f.type));
        const ys: LocalDecl[] = [];
        while (ft.k === 'pi') {
          const y = m.mkLocal(ft.name, ft.type);
          ys.push(y);
          ft = m.whnf(instantiate1(ft.body, mkFVar(y.id)));
        }
        const fh = getAppFn(ft);
        if (fh.k !== 'const' || fh.name !== indName) continue;
        const idx = getAppArgs(ft).slice(ind.numParams);
        const fApp = mkAppN(mkFVar(f.id), ys.map((y) => mkFVar(y.id)));
        const ihBody = headBeta(mkApp(mkAppN(motive, idx), fApp));
        const ihType = m.mkForallFVars(ys.map((y) => y.id), ihBody);
        const ihGiven = given[fields.length + ihs.length];
        const ihName = ihGiven ?? (isNat ? 'a' : `${f.userName}_ih`);
        const ih = m.mkLocal(ihName, ihType, 'default', undefined, !ihGiven);
        ihs.push(ih);
        lctx = lctx.push(ih);
      }
    }
    // branch target: motive idx (ctor fields), shown with `n + 1` / `0` for Nat
    let branchTarget = headBeta(mkApp(mkAppN(motive, resIdx), ctorApp));
    if (isNat) {
      const pretty = ctor === 'Nat.zero' ? mkNatLit(0) : mkAppN(mkConst('Nat.add'), [mkFVar(fields[0].id), mkNatLit(1)]);
      branchTarget = headBeta(mkApp(mkAppN(motive, resIdx), pretty));
    }
    const tag = appendTag(parentTag, shortName(ctor));
    const bg = c.newGoal(lctx, branchTarget, opts.keepTag ? parentTag : tag);
    minors.push(m.mkLambdaFVars([...fields.map((f) => f.id), ...ihs.map((i) => i.id)], c.mvarExpr(bg)));
    branches.push({ ctor, goal: bg, fields: fields.map((f) => f.id), ihs: ihs.map((i) => i.id) });
  }
  const hExpr = mkFVar(hId);
  let proof: Expr;
  if (kind === 'induction') {
    proof = mkAppN(mkConst(`${indName}.rec`, elimLevels), [...params, motive, ...minors, ...indices, hExpr]);
  } else {
    proof = mkAppN(mkConst(`${indName}.casesOn`, elimLevels), [...params, motive, ...indices, hExpr, ...minors]);
  }
  c.assign(g1, proof);
  // re-introduce reverted hypotheses in each branch
  for (const b of branches) b.goal = reintro(c, b.goal, reverted);
  return branches;
}

import * as KERNEL from '../kernel/expr.ts';

/** Show `Nat.succ k` as `k + 1` and `Nat.zero` as `0` (Lean's custom Nat eliminators). */
function natPretty(c: TacCtx, e: Expr, isNat: boolean): Expr {
  if (!isNat) return e;
  void c;
  return KERNEL.replace(e, (x) => {
    if (x.k === 'const' && x.name === 'Nat.zero') return mkNatLit(0);
    if (x.k === 'app' && x.fn.k === 'const' && x.fn.name === 'Nat.succ') {
      return mkAppN(mkConst('Nat.add'), [natPretty(c, x.arg, true), mkNatLit(1)]);
    }
    return undefined;
  });
}

/** Rename the fields of a branch (in order: fields then ihs). */
function nameBranch(c: TacCtx, b: CaseBranch, names: { name: string }[]): number {
  const ids = [...b.fields, ...b.ihs];
  const lctx = c.goalLctx(b.goal);
  const map = new Map<number, string>();
  names.forEach((n, i) => {
    if (i < ids.length && n.name !== '_') map.set(ids[i], n.name);
  });
  if (map.size === 0) return b.goal;
  const decls = lctx.decls.map((d) => {
    const nn = map.get(d.id);
    if (!nn) return d;
    const nd = { ...d, userName: nn, inaccessible: false };
    c.m.registerLocal(nd);
    return nd;
  });
  const ng = c.newGoal(new LocalContext(decls), c.goalType(b.goal), c.tag(b.goal));
  c.assign(b.goal, c.mvarExpr(ng));
  return ng;
}

/** Make `e` a hypothesis (if it is not already a local) and return its fvar id. */
function targetFVar(c: TacCtx, g: number, e: Expr, name: string | null): { goal: number; fvar: number } {
  if (e.k === 'fvar' && c.goalLctx(g).has(e.id) && name === null) return { goal: g, fvar: e.id };
  const ty = c.m.instantiateMVars(c.m.inferType(e));
  // generalize occurrences of e in the goal (like Lean's `cases e`)
  const target = c.goalType(g);
  const abs = c.inGoal(g, () => c.el.abstractExpr(target, e));
  if (abs && e.k !== 'fvar') {
    const d = c.m.mkLocal(name ?? 'x', ty, 'default', undefined, name === null);
    const lctx = c.goalLctx(g).push(d);
    const ng = c.newGoal(lctx, instantiate1(abs, mkFVar(d.id)), c.tag(g));
    c.assign(g, mkApp(c.m.mkLambdaFVars([d.id], c.mvarExpr(ng)), e));
    return { goal: ng, fvar: d.id };
  }
  return c.assertHyp(g, name ?? 'h', ty, e, name === null);
}

function runAlts(c: TacCtx, t: Tactic, branches: CaseBranch[], alts: InductionAlt[], kind: string): number[] {
  const out: number[] = [];
  const used = new Set<InductionAlt>();
  for (const b of branches) {
    const sn = shortName(b.ctor);
    const alt = alts.find((a) => a.name === sn) ?? alts.find((a) => a.name === '_');
    if (!alt) {
      c.fail('tactic-failed', `Alternative \`${sn}\` has not been provided`, t, { tactic: kind });
    }
    used.add(alt);
  }
  for (const a of alts) {
    if (!used.has(a) && a.name !== '_') {
      c.fail('tactic-failed', `Invalid alternative name \`${a.name}\`: Expected ${branches.map((b) => `\`${shortName(b.ctor)}\``).join(' or ')}`, { from: a.nameFrom, to: a.nameTo }, { tactic: kind });
    }
  }
  // rename all first so that the infoview shows names inside each alternative
  const named = branches.map((b) => {
    const alt = alts.find((a) => a.name === shortName(b.ctor)) ?? alts.find((a) => a.name === '_')!;
    return { goal: nameBranch(c, b, alt.vars), alt };
  });
  const remaining = new Set(named.map((n) => n.goal));
  for (const { goal, alt } of named) {
    remaining.delete(goal);
    const saved = c.goals;
    c.goals = [goal, ...remaining];
    try {
      const arrow = c.el.src.indexOf('=>', alt.nameTo);
      const from = arrow >= 0 && arrow < alt.to ? arrow : alt.from;
      runFocused(c, [goal], alt.tactics, { from, to: alt.to }, true);
    } finally {
      c.goals = saved;
    }
  }
  return out;
}

registerTactic(['cases', 'induction'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'cases'>;
  const kind = t.name as 'cases' | 'induction';
  let g = c.mainGoal(t);
  const e = c.elabTerm(g, tac.target, null);
  const tgt = targetFVar(c, g, e, tac.targetName);
  g = tgt.goal;
  // cases on an equation: substitution / constructor clash
  const hty = c.m.whnf(c.m.instantiateMVars(c.m.inferType(mkFVar(tgt.fvar))));
  const hh = getAppFn(hty);
  if (kind === 'cases' && hh.k === 'const' && hh.name === 'Eq') {
    const goals = casesEq(c, g, tgt.fvar, t);
    if (tac.alts) {
      const alt = tac.alts[0];
      if (alt && goals.length === 1) {
        runFocused(c, goals, alt.tactics, alt, true);
        c.replaceMainGoal([]);
        return;
      }
    }
    c.replaceMainGoal(goals);
    return;
  }
  const generalizing = tac.generalizing.map((n) => c.findHyp(g, n, t).id);
  const names = new Map<string, (string | null)[]>();
  if (tac.alts) {
    const hty0 = c.m.whnf(c.m.instantiateMVars(c.m.inferType(mkFVar(tgt.fvar))));
    const h0 = getAppFn(hty0);
    const ind0 = h0.k === 'const' ? c.m.env.get(h0.name)?.ind : undefined;
    for (const ctor of ind0?.ctors ?? []) {
      const alt = tac.alts.find((a) => a.name === shortName(ctor));
      if (alt) names.set(ctor, alt.vars.map((v) => (v.name === '_' ? null : v.name)));
    }
  }
  const branches = casesCore(c, g, tgt.fvar, kind, t, { generalizing, names });
  if (!tac.alts) {
    c.replaceMainGoal(branches.map((b) => b.goal));
    return;
  }
  // structured: remove the main goal, then run each alternative
  c.goals = c.goals.slice(1);
  const rest = c.goals;
  c.goals = [];
  runAlts(c, t, branches, tac.alts, kind);
  c.goals = rest;
});

/* ---------------- equations: subst / cases on Eq / injection ---------------- */

function eqParts(c: TacCtx, ty: Expr): { alpha: Expr; lhs: Expr; rhs: Expr; level: Level } | null {
  const w = c.m.whnf(c.m.instantiateMVars(ty));
  const h = getAppFn(w);
  if (h.k !== 'const' || h.name !== 'Eq' || getAppArgs(w).length !== 3) return null;
  const [alpha, lhs, rhs] = getAppArgs(w);
  return { alpha, lhs, rhs, level: h.levels[0] };
}

/**
 * Substitute variable `x` using `h : a = x` (dir 'rhs') or `h : x = b` (dir 'lhs').
 * Returns the new goal (x and h eliminated).
 */
export function substVar(c: TacCtx, g: number, hId: number, r: { from: number; to: number }): number {
  const m = c.m;
  const lctx = c.goalLctx(g);
  const h = lctx.get(hId)!;
  const eq = eqParts(c, h.type);
  if (!eq) c.failWithGoal(`Tactic \`subst\` failed: \`${h.userName}\` is not an equation`, g, r, 'subst');
  const lhs = m.instantiateMVars(eq.lhs);
  const rhs = m.instantiateMVars(eq.rhs);
  let x: number;
  let other: Expr;
  let symm: boolean;
  if (rhs.k === 'fvar' && lctx.has(rhs.id) && !mentionsFVar(lhs, rhs.id) && lctx.get(rhs.id)!.value === undefined) {
    x = rhs.id;
    other = lhs;
    symm = false;
  } else if (lhs.k === 'fvar' && lctx.has(lhs.id) && !mentionsFVar(rhs, lhs.id) && lctx.get(lhs.id)!.value === undefined) {
    x = lhs.id;
    other = rhs;
    symm = true;
  } else {
    c.failWithGoal(
      `Tactic \`subst\` failed: invalid equality proof, it is not of the form (x = t) or (t = x)\n  ${c.el.pp(h.type)}`,
      g,
      r,
      'subst',
    );
  }
  const xIdx = lctx.indexOf(x);
  const otherFVs = new Set<number>();
  KERNEL.collectFVars(other, otherFVs);
  // revert everything (except h) that depends on x or h
  const deps: number[] = [];
  for (const d of lctx.decls) {
    if (d.id === x || d.id === hId) continue;
    const ty = m.instantiateMVars(d.type);
    if ((mentionsFVar(ty, x) || mentionsFVar(ty, hId) || deps.some((k) => mentionsFVar(ty, k))) && lctx.indexOf(d.id) > xIdx) deps.push(d.id);
  }
  if (deps.some((d) => otherFVs.has(d))) c.failWithGoal(`Tactic \`subst\` failed: motive is not type correct`, g, r, 'subst');
  let g1 = g;
  let reverted: LocalDecl[] = [];
  if (deps.length > 0) {
    const rv = revertHyps(c, g, deps);
    g1 = rv.goal;
    reverted = rv.reverted;
  }
  const target = c.goalType(g1);
  if (mentionsFVar(target, hId)) c.failWithGoal('Tactic `subst` failed: the goal depends on the equation', g, r, 'subst');
  const alpha = eq.alpha;
  // motive := fun y (_ : other = y) => target[x := y]
  const y = m.mkLocal('y', alpha);
  const hy = m.mkLocal('h', mkAppN(mkConst('Eq', [eq.level]), [alpha, other, mkFVar(y.id)]));
  const motiveBody = KERNEL.replaceFVars(target, new Map([[x, mkFVar(y.id)]]));
  const motive = m.mkLambdaFVars([y.id, hy.id], motiveBody);
  const newTarget = KERNEL.replaceFVars(target, new Map([[x, other]]));
  const newLctx = c.goalLctx(g1).remove(new Set([x, hId]));
  const ng = c.newGoal(newLctx, newTarget, c.tag(g));
  const hProof = symm ? mkAppN(mkConst('Eq.symm', [eq.level]), [alpha, mkFVar(x), other, mkFVar(hId)]) : mkFVar(hId);
  const u = m.inferSortLevel(target);
  c.assign(g1, mkAppN(mkConst('Eq.rec', [m.instantiateLevel(u), eq.level]), [alpha, other, motive, c.mvarExpr(ng), mkFVar(x), hProof]));
  // reverted hyps: their types mention x → substitute when re-introducing (types come from the goal)
  return reintro(c, ng, reverted);
}

function casesEq(c: TacCtx, g: number, hId: number, r: { from: number; to: number }): number[] {
  const m = c.m;
  const h = c.goalLctx(g).get(hId)!;
  const eq = eqParts(c, h.type)!;
  const lhs = m.instantiateMVars(eq.lhs);
  const rhs = m.instantiateMVars(eq.rhs);
  const lctx = c.goalLctx(g);
  if ((rhs.k === 'fvar' && lctx.has(rhs.id) && !mentionsFVar(lhs, rhs.id)) || (lhs.k === 'fvar' && lctx.has(lhs.id) && !mentionsFVar(rhs, lhs.id))) {
    return [substVar(c, g, hId, r)];
  }
  const p = disproveEq(c, mkFVar(hId), h.type);
  if (p) {
    const target = c.goalType(g);
    c.assign(g, mkAppN(mkConst('False.elim', [m.inferSortLevel(target)]), [target, p]));
    return [];
  }
  // same constructor on both sides: injection
  const inj = injectionCore(c, g, hId, [], r);
  if (inj) return [inj];
  if (c.el.isDefEq(lhs, rhs)) {
    return [c.clearHyps(g, [hId], r)];
  }
  c.failWithGoal(`Tactic \`cases\` failed: could not unify the sides of\n  ${c.el.pp(h.type)}`, g, r, 'cases');
}

registerTactic(['subst'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'names'>;
  let g = c.mainGoal(t);
  for (const n of tac.names) {
    const d = c.findHyp(g, n.name, n);
    if (eqParts(c, d.type)) {
      g = substVar(c, g, d.id, n);
    } else {
      // `subst x`: find an equation mentioning variable x
      const h = c.goalLctx(g).decls.find((e) => {
        const p = eqParts(c, e.type);
        if (!p) return false;
        const l = c.m.instantiateMVars(p.lhs);
        const r = c.m.instantiateMVars(p.rhs);
        return (l.k === 'fvar' && l.id === d.id) || (r.k === 'fvar' && r.id === d.id);
      });
      if (!h) c.failWithGoal(`Tactic \`subst\` failed: did not find equation for eliminating \`${n.name}\``, g, n, 'subst');
      g = substVar(c, g, h.id, n);
    }
  }
  c.replaceMainGoal([g]);
});

/** From `h : C a₁ … = C b₁ …` derive `aᵢ = bᵢ` hypotheses. */
function injectionCore(c: TacCtx, g: number, hId: number, names: { name: string }[], r: { from: number; to: number }): number | null {
  const m = c.m;
  const h = c.goalLctx(g).get(hId)!;
  const eq = eqParts(c, h.type);
  if (!eq) return null;
  const lw = m.instantiateMVars(eq.lhs);
  const rw = m.instantiateMVars(eq.rhs);
  const view = (e0: Expr): { ctor: string; args: Expr[] } | null => {
    const nv = natCtorView(e0);
    if (nv) return nv.k === 'zero' ? { ctor: 'Nat.zero', args: [] } : { ctor: 'Nat.succ', args: [nv.pred] };
    const e = m.whnf(e0);
    if (e.k === 'lit' && typeof e.value === 'bigint') {
      return e.value === 0n ? { ctor: 'Nat.zero', args: [] } : { ctor: 'Nat.succ', args: [mkNatLit(e.value - 1n)] };
    }
    const f = getAppFn(e);
    if (f.k === 'const' && m.env.get(f.name)?.ctor) return { ctor: f.name, args: getAppArgs(e) };
    return null;
  };
  const a = view(lw);
  const b = view(rw);
  if (!a || !b || a.ctor !== b.ctor) return null;
  if (a.ctor === 'Nat.succ') {
    const p = mkAppN(mkConst('Nat.succ.inj'), [a.args[0], b.args[0], mkFVar(hId)]);
    const ty = mkAppN(mkConst('Eq', [{ k: 'succ', l: { k: 'zero' } }]), [mkConst('Nat'), a.args[0], b.args[0]]);
    const res = c.assertHyp(g, names[0]?.name ?? 'h', ty, p, names.length === 0);
    return res.goal;
  }
  // structures: congrArg with projections
  const cd = m.env.get(a.ctor)!.ctor!;
  const ind = m.env.get(cd.induct)!.ind!;
  if (!ind.fields) return null;
  let goal = g;
  const np = cd.numParams;
  for (let i = 0; i < cd.numFields; i++) {
    const proj = `${cd.induct}.${ind.fields[i]}`;
    const ci = c.el.mkConstInst(proj);
    const ai = a.args[np + i];
    const bi = b.args[np + i];
    const ty = c.m.instantiateMVars(c.m.inferType(ai));
    const eqTy = mkAppN(mkConst('Eq', [m.inferSortLevel(ty)]), [ty, ai, bi]);
    const x = m.mkLocal('x', eq.alpha);
    const f = m.mkLambdaFVars([x.id], c.inGoal(goal, () => c.el.elabAppArgsExprs(ci.e, ci.type, [mkFVar(x.id)])));
    const p = mkAppN(mkConst('congrArg', [eq.level, m.inferSortLevel(ty)]), [eq.alpha, ty, eq.lhs, eq.rhs, f, mkFVar(hId)]);
    goal = c.assertHyp(goal, names[i]?.name ?? 'h', eqTy, p, names[i] === undefined).goal;
  }
  void r;
  return goal;
}

registerTactic(['injection'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'names'>;
  const g = c.mainGoal(t);
  const [hn, ...rest] = tac.names;
  if (!hn) c.fail('parse', 'injection: expected a hypothesis', t);
  const d = c.findHyp(g, hn.name, hn);
  const ng = injectionCore(c, g, d.id, rest, t);
  if (ng === null) c.failWithGoal('Tactic `injection` failed: equality of constructor applications expected', g, t, 'injection');
  // like Lean, try to close the goal with the new hypotheses
  const target = c.goalType(ng);
  const decls = c.goalLctx(ng).decls;
  for (let i = decls.length - 1; i >= 0; i--) {
    const mark = c.m.mark();
    if (!decls[i].hidden && c.el.isDefEq(c.m.instantiateMVars(decls[i].type), target)) {
      c.assign(ng, mkFVar(decls[i].id));
      c.replaceMainGoal([]);
      return;
    }
    c.m.rollback(mark);
  }
  c.replaceMainGoal([ng]);
});

/* ---------------- rcases patterns ---------------- */

function rename(c: TacCtx, g: number, id: number, name: string, inaccessible: boolean): number {
  const lctx = c.goalLctx(g);
  const d = lctx.get(id);
  if (!d) return g;
  const nd = { ...d, userName: name, inaccessible };
  c.m.registerLocal(nd);
  const ng = c.newGoal(lctx.replace(nd), c.goalType(g), c.tag(g));
  c.assign(g, c.mvarExpr(ng));
  return ng;
}

/** Destructure hypothesis `id` of goal `g` with pattern `pat`. Returns the resulting goals. */
export function rcasesFVar(c: TacCtx, g: number, id: number, pat: RPat, r: { from: number; to: number }, fromIntro: boolean): number[] {
  void fromIntro;
  switch (pat.k) {
    case 'paren':
      return rcasesFVar(c, g, id, pat.pat, r, fromIntro);
    case 'one': {
      if (pat.name === 'rfl') return [substVar(c, g, id, pat)];
      if (pat.name === '_') {
        const d = c.goalLctx(g).get(id);
        return [rename(c, g, id, d?.userName ?? 'x', true)];
      }
      return [rename(c, g, id, pat.name, false)];
    }
    case 'clear':
      return [c.clearHyps(g, [id], pat)];
    case 'typed': {
      const ty = c.inGoal(g, () => c.m.instantiateMVars(c.el.elabType(pat.type)));
      const d = c.goalLctx(g).get(id)!;
      if (!c.el.isDefEq(ty, c.m.instantiateMVars(d.type))) {
        c.fail('type-mismatch', `Type mismatch in rcases pattern: the hypothesis has type\n  ${c.el.pp(d.type)}\nbut the pattern expects\n  ${c.el.pp(ty)}`, pat);
      }
      const res = c.replaceHyp(g, id, ty);
      return rcasesFVar(c, res.goal, res.fvar, pat.pat, r, fromIntro);
    }
    case 'tuple':
    case 'alts': {
      const d = c.goalLctx(g).get(id)!;
      const ty = c.m.whnf(c.m.instantiateMVars(d.type));
      const h = getAppFn(ty);
      // `rfl` alternatives / equations with a tuple pattern: treat as subst when possible
      const ind = h.k === 'const' ? c.m.env.get(h.name)?.ind : undefined;
      if (!ind) {
        c.fail('not-inductive', `rcases: the hypothesis\n  ${d.userName} : ${c.el.pp(d.type)}\nis not an inductive datatype, so the pattern cannot destructure it`, pat);
      }
      if (h.k === 'const' && h.name === 'Eq') {
        return rcasesFVar(c, g, id, { k: 'one', name: 'rfl', from: pat.from, to: pat.to }, r, fromIntro);
      }
      const single = ind.ctors.length === 1;
      const pats: RPat[] = pat.k === 'alts' ? pat.alts : [pat];
      const names = new Map<string, (string | null)[]>();
      ind.ctors.forEach((ctor, i) => {
        const p = single ? pat : pats[i];
        if (!p) return;
        const elems = p.k === 'tuple' ? p.elems : [p];
        names.set(
          ctor,
          elems.map((e) => (e.k === 'one' && e.name !== '_' && e.name !== 'rfl' ? e.name : null)),
        );
      });
      const branches = casesCore(c, g, id, 'cases', pat, { keepTag: single, names });
      const out: number[] = [];
      branches.forEach((b, i) => {
        let p: RPat | undefined = single ? pat : pats[i];
        if (!p && pat.k === 'tuple' && !single) p = i === 0 ? pat : undefined;
        if (!p) p = { k: 'one', name: '_', from: pat.from, to: pat.to };
        const elems: RPat[] = p.k === 'tuple' ? p.elems : b.fields.length === 1 ? [p] : p.k === 'alts' ? [p] : [p];
        out.push(...destructFields(c, b.goal, b.fields, elems, r));
      });
      return out;
    }
  }
}

function destructFields(c: TacCtx, g: number, fields: number[], elems: RPat[], r: { from: number; to: number }): number[] {
  const k = fields.length;
  let pats = elems;
  if (pats.length > k && k > 0) {
    const rest = pats.slice(k - 1);
    pats = [...pats.slice(0, k - 1), { k: 'tuple', elems: rest, from: rest[0].from, to: rest[rest.length - 1].to }];
  }
  let goals = [g];
  for (let i = 0; i < k; i++) {
    const p = pats[i];
    if (!p) continue; // remaining fields keep their inaccessible names
    const next: number[] = [];
    for (const gg of goals) {
      if (!c.goalLctx(gg).has(fields[i])) {
        next.push(gg);
        continue;
      }
      next.push(...rcasesFVar(c, gg, fields[i], p, r, false));
    }
    goals = next;
  }
  return goals;
}

registerTactic(['rcases'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'rcases'>;
  let goals = [c.mainGoal(t)];
  const pats: RPat[] = tac.pat ? (tac.targets.length > 1 && tac.pat.k === 'tuple' ? tac.pat.elems : [tac.pat]) : [];
  tac.targets.forEach((target, i) => {
    const next: number[] = [];
    for (const g of goals) {
      const e = c.elabTerm(g, target, null);
      const tg = targetFVar(c, g, e, null);
      const p = pats[i] ?? { k: 'one', name: '_', from: target.from, to: target.to };
      next.push(...rcasesFVar(c, tg.goal, tg.fvar, p, t, false));
    }
    goals = next;
  });
  c.replaceMainGoal(goals);
});

registerTactic(['obtain'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'obtain'>;
  const g = c.mainGoal(t);
  const pat = tac.pat ?? { k: 'one', name: 'this', from: t.from, to: t.to };
  if (!tac.value) {
    if (!tac.type) c.fail('parse', "obtain: expected ':=' or a type", t);
    const ty = c.inGoal(g, () => c.m.instantiateMVars(c.el.elabType(tac.type!)));
    const g2 = c.newGoal(c.goalLctx(g), ty, c.tag(g));
    const res = c.assertHyp(g, 'h', ty, c.mvarExpr(g2), true);
    const goals = rcasesFVar(c, res.goal, res.fvar, pat, t, false);
    c.replaceMainGoal([g2, ...goals]);
    return;
  }
  const type = tac.type ? c.inGoal(g, () => c.m.instantiateMVars(c.el.elabType(tac.type!))) : null;
  const { e, holes } = c.elabTermWithHoles(g, tac.value, type, true, 'obtain');
  let tg: { goal: number; fvar: number };
  if (e.k === 'fvar' && !type && c.goalLctx(g).has(e.id)) tg = { goal: g, fvar: e.id };
  else tg = c.assertHyp(g, 'h', type ?? c.m.instantiateMVars(c.m.inferType(e)), e, true);
  const goals = rcasesFVar(c, tg.goal, tg.fvar, pat, t, false);
  c.replaceMainGoal([...goals, ...holes]);
});

registerTactic(['rintro'], (t: Tactic, c: TacCtx) => {
  const tac = t as T<'rintro'>;
  let goals = [c.mainGoal(t)];
  for (const p of tac.pats) {
    const next: number[] = [];
    for (const g of goals) {
      if (p.k === 'one') {
        const r = c.introOne(g, p.name === 'rfl' ? 'h' : p.name, p.name === '_');
        if (!r) c.failWithGoal('Tactic `rintro` failed: There are no additional binders to introduce', g, p, 'rintro');
        if (p.name === 'rfl') next.push(substVar(c, r.goal, r.fvar, p));
        else next.push(r.goal);
        continue;
      }
      const r = c.introOne(g, null, true);
      if (!r) c.failWithGoal('Tactic `rintro` failed: There are no additional binders to introduce', g, p, 'rintro');
      next.push(...rcasesFVar(c, r.goal, r.fvar, p, t, true));
    }
    goals = next;
  }
  c.replaceMainGoal(goals);
});

export { TacticFailure };
