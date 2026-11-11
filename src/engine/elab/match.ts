/**
 * Pattern matching in terms (`match`, `fun ⟨a, b⟩ => …`, `fun | p => …`, `have ⟨a, b⟩ := …`):
 * compiled to a case tree of `I.casesOn` applications using the `cases` machinery.
 * Recursive definitions by pattern matching are handled by the equation compiler in
 * `command.ts`; here recursion is not allowed.
 */
import type { Expr } from '../kernel/expr.ts';
import { getAppArgs, getAppFn, mkAppN, mkConst, mkFVar, mkNatLit } from '../kernel/expr.ts';
import { LocalContext } from '../meta/lctx.ts';
import type { MatchAlt, Term } from '../syntax/ast.ts';
import { TacCtx } from '../tactic/core.ts';
import { casesCore } from '../tactic/cases.ts';
import { ElabError } from './errors.ts';
import type { Elab } from './term.ts';

export type PNode =
  | { k: 'var'; name: string; from: number; to: number }
  | { k: 'wild' }
  | { k: 'ctor'; name: string | null; args: PNode[]; from: number; to: number }
  | { k: 'lit'; n: bigint; from: number; to: number };

/** Turn pattern syntax into a pattern tree (constructor names resolved). */
export function toPNode(el: Elab, t: Term): PNode {
  switch (t.k) {
    case 'hole':
      return { k: 'wild' };
    case 'paren':
      return toPNode(el, t.term);
    case 'ascription':
      return toPNode(el, t.term);
    case 'num':
      return { k: 'lit', n: t.value, from: t.from, to: t.to };
    case 'ident': {
      const ctor = resolveCtor(el, t.name);
      if (ctor) return { k: 'ctor', name: ctor, args: [], from: t.from, to: t.to };
      if (t.name.includes('.')) throw new ElabError('unknown-identifier', `Unknown constructor \`${t.name}\``, t.from, t.to, { name: t.name });
      return { k: 'var', name: t.name, from: t.from, to: t.to };
    }
    case 'dotIdent':
      return { k: 'ctor', name: '.' + t.name, args: [], from: t.from, to: t.to };
    case 'anon':
      return { k: 'ctor', name: null, args: t.elems.map((e) => toPNode(el, e)), from: t.from, to: t.to };
    case 'tuple': {
      const [a, ...rest] = t.elems;
      const snd: Term = rest.length === 1 ? rest[0] : { k: 'tuple', elems: rest, from: rest[0].from, to: t.to };
      return { k: 'ctor', name: 'Prod.mk', args: [toPNode(el, a), toPNode(el, snd)], from: t.from, to: t.to };
    }
    case 'app': {
      const f = t.fn;
      let name: string | null = null;
      if (f.k === 'ident') name = resolveCtor(el, f.name);
      else if (f.k === 'dotIdent') name = '.' + f.name;
      if (!name) throw new ElabError('other', `Invalid pattern: \`${el.src.slice(t.from, t.to)}\` is not a constructor application`, t.from, t.to);
      return { k: 'ctor', name, args: t.args.map((a) => toPNode(el, a.value)), from: t.from, to: t.to };
    }
    case 'binop': {
      // `n + k` (k a numeral) is `Nat.succ^k n`
      if (t.op === '+' && t.rhs.k === 'num') {
        let p = toPNode(el, t.lhs);
        for (let i = 0n; i < t.rhs.value; i++) p = { k: 'ctor', name: 'Nat.succ', args: [p], from: t.from, to: t.to };
        return p;
      }
      throw new ElabError('other', `Invalid pattern: \`${el.src.slice(t.from, t.to)}\``, t.from, t.to);
    }
    default:
      throw new ElabError('other', `Invalid pattern: \`${el.src.slice(t.from, t.to)}\``, t.from, t.to);
  }
}

function resolveCtor(el: Elab, name: string): string | null {
  const full = el.resolveGlobal(name);
  if (full && el.env.get(full)?.ctor) return full;
  return null;
}

interface Row {
  pats: PNode[];
  rhs: Term;
  binds: { name: string; value: Expr }[];
  alt: MatchAlt;
}

function shortName(n: string): string {
  return n.slice(n.lastIndexOf('.') + 1);
}

/** Does pattern `p` (at the head) match constructor `ctor`? Returns sub-patterns or null. */
function specialize(p: PNode, ctor: string, numFields: number, explicitMask: boolean[]): PNode[] | null {
  const wilds = (): PNode[] => Array.from({ length: numFields }, () => ({ k: 'wild' }) as PNode);
  switch (p.k) {
    case 'wild':
    case 'var':
      return wilds();
    case 'lit':
      if (ctor === 'Nat.zero') return p.n === 0n ? [] : null;
      if (ctor === 'Nat.succ') return p.n > 0n ? [{ k: 'lit', n: p.n - 1n, from: p.from, to: p.to }] : null;
      return null;
    case 'ctor': {
      if (p.name !== null && p.name !== ctor && !(p.name.startsWith('.') && shortName(ctor) === p.name.slice(1))) return null;
      // patterns name explicit fields only; implicit fields become wildcards
      const out: PNode[] = [];
      let j = 0;
      for (let i = 0; i < numFields; i++) {
        if (explicitMask[i]) out.push(p.args[j++] ?? { k: 'wild' });
        else out.push({ k: 'wild' });
      }
      if (j < p.args.length && p.name === null && numFields > 0) {
        // anonymous constructor flattening ⟨a, b, c⟩ = ⟨a, ⟨b, c⟩⟩
        const lastIdx = explicitMask.lastIndexOf(true);
        const rest = p.args.slice(j - 1);
        out[lastIdx] = { k: 'ctor', name: null, args: rest, from: p.from, to: p.to };
      }
      return out;
    }
  }
}

export function elabMatch(el: Elab, discrs: Expr[], alts: MatchAlt[], expected: Expr, range: { from: number; to: number }): Expr {
  const m = el.m;
  const goalMVar = el.newMVar(el.instantiate(expected), 'opaque');
  const g0 = (goalMVar as { id: number }).id;
  const c = new TacCtx(el, [g0]);
  // discriminants must be local variables: generalize the others
  let g = g0;
  const vars: number[] = [];
  for (const d of discrs) {
    const di = m.instantiateMVars(d);
    if (di.k === 'fvar' && c.goalLctx(g).has(di.id)) {
      vars.push(di.id);
      continue;
    }
    const ty = m.instantiateMVars(m.inferType(di));
    const abs = c.inGoal(g, () => el.abstractExpr(c.goalType(g), di));
    const dl = m.mkLocal('x', ty, 'default', undefined, true);
    const lctx = c.goalLctx(g).push(dl);
    const target = abs ? { ...abs } : c.goalType(g);
    const body = abs ? instantiateWith(abs, dl.id) : target;
    const ng = c.newGoal(lctx, body, c.tag(g));
    c.assign(g, mkAppN(m.mkLambdaFVars([dl.id], c.mvarExpr(ng)), [di]));
    g = ng;
    vars.push(dl.id);
  }
  const rows: Row[] = alts.map((a) => {
    if (a.pats.length !== discrs.length) {
      throw new ElabError('other', `Incorrect number of patterns: expected ${discrs.length}, found ${a.pats.length}`, a.from, a.to);
    }
    return { pats: a.pats.map((p) => toPNode(el, p)), rhs: a.rhs, binds: [], alt: a };
  });
  compile(c, g, vars, rows, range);
  return m.instantiateMVars(goalMVar);
}

import { instantiate1 } from '../kernel/expr.ts';
function instantiateWith(abs: Expr, id: number): Expr {
  return instantiate1(abs, mkFVar(id));
}

function compile(c: TacCtx, g: number, vars: number[], rows: Row[], range: { from: number; to: number }): void {
  const m = c.m;
  if (rows.length === 0) {
    throw new ElabError('other', `Missing cases:\n${c.goalString(g)}`, range.from, range.to);
  }
  if (vars.length === 0) {
    const row = rows[0];
    let goal = g;
    // bind pattern variables: rename locals in place, or add local definitions
    for (const b of row.binds) {
      if (b.value.k === 'fvar' && c.goalLctx(goal).has(b.value.id)) {
        const lctx = c.goalLctx(goal);
        const d = lctx.get(b.value.id)!;
        const nd = { ...d, userName: b.name, inaccessible: false };
        m.registerLocal(nd);
        const ng = c.newGoal(lctx.replace(nd), c.goalType(goal), c.tag(goal));
        c.assign(goal, c.mvarExpr(ng));
        goal = ng;
      } else {
        const ty = m.instantiateMVars(m.inferType(b.value));
        const d = m.mkLocal(b.name, ty, 'default', b.value);
        const ng = c.newGoal(c.goalLctx(goal).push(d), c.goalType(goal), c.tag(goal));
        c.assign(goal, m.mkLambdaFVars([d.id], c.mvarExpr(ng)));
        goal = ng;
      }
    }
    const e = c.elabTerm(goal, row.rhs, c.goalType(goal));
    const old = c.el.lctx;
    c.el.lctx = c.goalLctx(goal);
    try {
      c.el.ensureHasType(c.goalType(goal), e, row.rhs);
    } finally {
      c.el.lctx = old;
    }
    c.assign(goal, e);
    return;
  }
  const v = vars[0];
  if (rows.every((r) => r.pats[0].k === 'var' || r.pats[0].k === 'wild')) {
    const next = rows.map((r) => {
      const p = r.pats[0];
      const binds = p.k === 'var' ? [...r.binds, { name: p.name, value: mkFVar(v) }] : r.binds;
      return { ...r, pats: r.pats.slice(1), binds };
    });
    compile(c, g, vars.slice(1), next, range);
    return;
  }
  // split on v
  const vDecl = c.goalLctx(g).get(v)!;
  const vType = m.whnf(m.instantiateMVars(vDecl.type));
  const head = getAppFn(vType);
  if (head.k !== 'const' || !m.env.get(head.name)?.ind) {
    throw new ElabError('other', `Invalid pattern: the type of the discriminant\n  ${c.el.pp(vDecl.type)}\nis not an inductive type`, range.from, range.to);
  }
  const names = c.goalLctx(g).decls.map((d) => ({ id: d.id, name: d.userName }));
  const branches = casesCore(c, g, v, 'cases', range);
  for (const b of branches) {
    const cdecl = m.env.get(b.ctor)!;
    const explicitMask: boolean[] = [];
    let ct = cdecl.type;
    let idx = 0;
    while (ct.k === 'pi') {
      if (idx >= cdecl.ctor!.numParams) explicitMask.push(ct.bi === 'default');
      ct = ct.body;
      idx++;
    }
    const numFields = cdecl.ctor!.numFields;
    // the value of v in this branch (for variable patterns)
    const params = getAppArgs(vType).slice(0, cdecl.ctor!.numParams);
    let ctorVal: Expr = mkAppN(mkAppN(mkConst(b.ctor, (head as { levels: readonly import('../kernel/level.ts').Level[] }).levels), params), b.fields.map(mkFVar));
    if (b.ctor === 'Nat.zero') ctorVal = mkNatLit(0);
    else if (b.ctor === 'Nat.succ') ctorVal = mkAppN(mkConst('Nat.add'), [mkFVar(b.fields[0]), mkNatLit(1)]);
    const next: Row[] = [];
    for (const r of rows) {
      const sub = specialize(r.pats[0], b.ctor, numFields, explicitMask);
      if (!sub) continue;
      const p = r.pats[0];
      const binds = p.k === 'var' ? [...r.binds, { name: p.name, value: ctorVal }] : r.binds;
      next.push({ ...r, pats: [...sub, ...r.pats.slice(1)], binds });
    }
    // remaining vars may have been re-introduced with new ids: remap by name
    const lctx: LocalContext = c.goalLctx(b.goal);
    const remap = (id: number): number => {
      if (lctx.has(id)) return id;
      const n = names.find((x) => x.id === id)?.name;
      const d = n ? lctx.findByName(n) ?? [...lctx.decls].reverse().find((x) => x.userName === n) : undefined;
      return d ? d.id : id;
    };
    const restVars = vars.slice(1).map(remap);
    const remapBinds = next.map((r) => ({
      ...r,
      binds: r.binds.map((bd) => (bd.value.k === 'fvar' && !lctx.has(bd.value.id) ? { ...bd, value: mkFVar(remap(bd.value.id)) } : bd)),
    }));
    if (remapBinds.length === 0) {
      throw new ElabError('other', `Missing cases:\n  ${shortName(b.ctor)}`, range.from, range.to);
    }
    compile(c, b.goal, [...b.fields, ...restVars], remapBinds, range);
  }
}
