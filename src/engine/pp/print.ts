/**
 * Pretty printer mirroring Lean's delaborator for the game's fragment: notations with Lean's
 * precedences, hidden implicit arguments, numerals, set-builder, `∀ (x : α), …` binders,
 * generalized field notation (`h.left`, `n.succ`), anonymous constructors `⟨a, b⟩`.
 */
import type { Expr } from '../kernel/expr.ts';
import {
  collectFVars,
  getAppArgs,
  getAppFn,
  hasLooseBVar,
  instantiate1,
  mkFVar,
} from '../kernel/expr.ts';
import { showLevel, toNat } from '../kernel/level.ts';
import type { Level } from '../kernel/level.ts';
import type { Meta } from '../meta/meta.ts';
import type { Goal, Hyp } from '../types.ts';
import type { LocalDecl } from '../meta/lctx.ts';

const MAX = 1024;
const ARG = 1023;
const LEAD = 1022;

interface Notation {
  /** number of leading implicit/type args to drop */
  skip: number;
  arity: number;
  kind: 'infix' | 'prefix' | 'postfix';
  sym: string;
  prec: number;
  lhs: number;
  rhs: number;
}

const inf = (sym: string, skip: number, prec: number, assoc: 'l' | 'r' | 'n'): Notation => ({
  skip,
  arity: skip + 2,
  kind: 'infix',
  sym,
  prec,
  lhs: assoc === 'l' ? prec : prec + 1,
  rhs: assoc === 'r' ? prec : prec + 1,
});

const NOTATIONS: Record<string, Notation> = {
  'Nat.add': inf('+', 0, 65, 'l'),
  'Nat.sub': inf('-', 0, 65, 'l'),
  'Nat.mul': inf('*', 0, 70, 'l'),
  'Nat.div': inf('/', 0, 70, 'l'),
  'Nat.mod': inf('%', 0, 70, 'l'),
  'Nat.pow': inf('^', 0, 75, 'r'),
  'Nat.le': inf('≤', 0, 50, 'n'),
  'Nat.lt': inf('<', 0, 50, 'n'),
  'GE.ge': inf('≥', 0, 50, 'n'),
  'GT.gt': inf('>', 0, 50, 'n'),
  Eq: inf('=', 1, 50, 'n'),
  Ne: inf('≠', 1, 50, 'n'),
  And: inf('∧', 0, 35, 'r'),
  Or: inf('∨', 0, 30, 'r'),
  Iff: inf('↔', 0, 20, 'n'),
  Prod: inf('×', 0, 35, 'r'),
  'Dvd.dvd': inf('∣', 0, 50, 'n'),
  'HasSubset.Subset': inf('⊆', 1, 50, 'n'),
  'Union.union': inf('∪', 1, 65, 'l'),
  'Inter.inter': inf('∩', 1, 70, 'l'),
  'SDiff.sdiff': inf('\\', 1, 70, 'n'),
  'Set.image': inf("''", 2, 90, 'l'),
  'Set.preimage': inf("⁻¹'", 2, 80, 'l'),
  'Function.comp': inf('∘', 3, 90, 'r'),
  'String.append': inf('++', 0, 65, 'l'),
};

export interface PPOptions {
  /** print all implicit arguments (`@f`) — used for `#check @c` */
  explicit?: boolean;
}

/** Display names for free variables (shadowed / inaccessible ones get `✝`). */
export type NameOf = (fvarId: number) => string | undefined;

export class Printer {
  private readonly m: Meta;
  private readonly nameOf: NameOf;
  /** display names currently bound by binders in the printer */
  private readonly localNames = new Map<number, string>();

  constructor(m: Meta, nameOf?: NameOf) {
    this.m = m;
    this.nameOf = nameOf ?? ((id) => {
      const d = m.fvars.get(id);
      if (!d) return undefined;
      return d.inaccessible ? `${d.userName}✝` : d.userName;
    });
  }

  pp(e: Expr): string {
    try {
      return this.go(this.m.instantiateMVars(e), 0);
    } catch {
      return '<expr>';
    }
  }

  private fvName(id: number): string {
    return this.localNames.get(id) ?? this.nameOf(id) ?? `x✝`;
  }

  private paren(s: string, prec: number, need: number): string {
    return prec < need ? `(${s})` : s;
  }

  private go(e: Expr, need: number): string {
    switch (e.k) {
      case 'bvar':
        return `#${e.idx}`;
      case 'fvar':
        return this.fvName(e.id);
      case 'mvar': {
        const d = this.m.mvars.get(e.id);
        const v = this.m.instantiateMVars(e);
        if (v !== e) return this.go(v, need);
        if (d?.userName) return `?${d.userName}`;
        return `?m.${e.id}`;
      }
      case 'sort':
        return this.paren(ppSort(e.level), toNat(e.level) !== null && toNat(e.level)! <= 1 ? MAX : LEAD, need);
      case 'const':
        return this.app(e, [], need);
      case 'lit':
        return typeof e.value === 'bigint' ? e.value.toString() : JSON.stringify(e.value);
      case 'app':
        return this.app(getAppFn(e), getAppArgs(e), need);
      case 'lam':
        return this.paren(this.lam(e), LEAD, need);
      case 'pi':
        return this.pi(e, need);
      case 'let': {
        const name = this.fresh(e.name, e.body);
        const d = this.m.mkLocal(name, e.type, 'default', e.value);
        this.localNames.set(d.id, name);
        const v = this.go(e.value, 0);
        const b = this.go(instantiate1(e.body, mkFVar(d.id)), 0);
        return this.paren(`let ${name} := ${v};\n${b}`, LEAD, need);
      }
    }
  }

  /** Choose a display name for a binder that does not clash with names used in `body`. */
  private fresh(name: string, body: Expr): string {
    let base = name.replace(/✝\d*$/, '');
    if (base === '' || base === '_') base = 'x';
    const used = new Set<string>();
    if (body.fv) {
      const fvs = new Set<number>();
      collectFVars(body, fvs);
      for (const id of fvs) used.add(this.fvName(id));
    }
    if (!used.has(base)) return base;
    for (let i = 1; ; i++) if (!used.has(`${base}_${i}`)) return `${base}_${i}`;
  }

  private enter(name: string, type: Expr, body: Expr, bi: Expr['k'] extends never ? never : 'default' | 'implicit' | 'strict' | 'inst' = 'default'): { name: string; body: Expr; id: number } {
    const n = this.fresh(name, body);
    const d = this.m.mkLocal(n, type, bi);
    this.localNames.set(d.id, n);
    return { name: n, body: instantiate1(body, mkFVar(d.id)), id: d.id };
  }

  private lam(e: Expr & { k: 'lam' }): string {
    const names: string[] = [];
    let cur: Expr = e;
    while (cur.k === 'lam') {
      const r = this.enter(cur.name, cur.type, cur.body, cur.bi);
      names.push(cur.bi === 'implicit' ? `{${r.name}}` : cur.bi === 'strict' ? `⦃${r.name}⦄` : cur.bi === 'inst' ? `[${this.go(cur.type, 0)}]` : r.name);
      cur = r.body;
    }
    return `fun ${names.join(' ')} => ${this.go(cur, 0)}`;
  }

  private isPropType(t: Expr): boolean {
    try {
      return this.m.isProp(t);
    } catch {
      return false;
    }
  }

  private pi(e: Expr & { k: 'pi' }, need: number): string {
    // non-dependent arrow
    if (!hasLooseBVar(e.body, 0) && e.bi === 'default') {
      const dom = this.isBinderLike(e.type) ? `(${this.go(e.type, 0)})` : this.go(e.type, 26);
      const d = this.m.mkLocal('_', e.type);
      const cod = this.go(instantiate1(e.body, mkFVar(d.id)), 25);
      return this.paren(`${dom} → ${cod}`, 25, need);
    }
    const isProp = this.isPropType(e);
    if (isProp) {
      // ∀ (x y : α) {z : β}, body
      const groups: string[] = [];
      let cur: Expr = e;
      let pending: { names: string[]; type: string; bi: string } | null = null;
      const flush = () => {
        if (!pending) return;
        const inner = `${pending.names.join(' ')} : ${pending.type}`;
        groups.push(pending.bi === 'implicit' ? `{${inner}}` : pending.bi === 'strict' ? `⦃${inner}⦄` : pending.bi === 'inst' ? `[${pending.type}]` : `(${inner})`);
        pending = null;
      };
      while (cur.k === 'pi' && (hasLooseBVar(cur.body, 0) || cur.bi !== 'default')) {
        const tyStr = this.go(cur.type, 0);
        const r = this.enter(cur.name, cur.type, cur.body, cur.bi);
        const p = pending as { names: string[]; type: string; bi: string } | null;
        if (p && p.type === tyStr && p.bi === cur.bi) p.names.push(r.name);
        else {
          flush();
          pending = { names: [r.name], type: tyStr, bi: cur.bi };
        }
        cur = r.body;
      }
      flush();
      return this.paren(`∀ ${groups.join(' ')}, ${this.go(cur, 0)}`, LEAD, need);
    }
    // dependent arrow (x : α) → β
    const tyStr = this.go(e.type, 0);
    const r = this.enter(e.name, e.type, e.body, e.bi);
    const b = e.bi === 'implicit' ? `{${r.name} : ${tyStr}}` : e.bi === 'strict' ? `⦃${r.name} : ${tyStr}⦄` : e.bi === 'inst' ? `[${tyStr}]` : `(${r.name} : ${tyStr})`;
    return this.paren(`${b} → ${this.go(r.body, 25)}`, 25, need);
  }

  /** Binder infos of a function's type, for hiding implicit arguments. */
  private binderInfos(fn: Expr, nargs: number): string[] {
    let t: Expr;
    try {
      t = this.m.inferType(fn);
    } catch {
      return [];
    }
    const out: string[] = [];
    while (out.length < nargs) {
      if (t.k !== 'pi') {
        try {
          t = this.m.whnf(t);
        } catch {
          break;
        }
        if (t.k !== 'pi') break;
      }
      out.push(t.bi);
      t = t.body.lb > 0 ? instantiate1(t.body, mkFVar(this.m.mkLocal('_', t.type).id)) : t.body;
    }
    return out;
  }

  private app(fn: Expr, args: Expr[], need: number): string {
    if (fn.k === 'const') {
      const special = this.special(fn.name, args, need);
      if (special !== null) return special;
    }
    if (fn.k === 'lam' && args.length > 0) {
      const f = `(${this.lam(fn)})`;
      return this.paren([f, ...args.map((a) => this.go(a, MAX))].join(' '), LEAD, need);
    }
    const bis = this.binderInfos(fn, args.length);
    const shown: Expr[] = [];
    args.forEach((a, i) => {
      if (bis[i] === undefined || bis[i] === 'default') shown.push(a);
    });
    let head: string;
    if (fn.k === 'const') {
      // generalized field notation: `x.f` when x : C … and fn = C.f (not a theorem)
      const fieldStr = this.fieldNotation(fn.name, args, bis);
      if (fieldStr !== null) return this.paren(fieldStr.s, fieldStr.prec, need);
      head = fn.name;
    } else head = this.go(fn, MAX);
    if (shown.length === 0) return head;
    return this.paren([head, ...this.argStrings(shown)].join(' '), LEAD, need);
  }

  /** Arguments at max precedence; a trailing `fun` is printed without parentheses (like Lean). */
  private argStrings(args: Expr[]): string[] {
    return args.map((a, i) => {
      const ai = this.m.instantiateMVars(a);
      if (i === args.length - 1 && ai.k === 'lam') return this.lam(ai);
      return this.go(a, MAX);
    });
  }

  private fieldNotation(name: string, args: Expr[], bis: string[]): { s: string; prec: number } | null {
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return null;
    const ns = name.slice(0, dot);
    const field = name.slice(dot + 1);
    const d = this.m.env.get(name);
    if (!d || d.kind === 'theorem' || d.kind === 'axiom' || d.kind === 'rec' || field === 'rec' || field === 'casesOn') return null;
    const first = bis.findIndex((b) => b === 'default');
    if (first < 0 || first >= args.length) return null;
    const x = args[first];
    if (x.k === 'lit') return null;
    let xt: Expr;
    try {
      xt = this.m.whnfCore(this.m.instantiateMVars(this.m.inferType(x)));
    } catch {
      return null;
    }
    const h = getAppFn(xt);
    if (h.k !== 'const' || h.name !== ns) return null;
    const rest: Expr[] = [];
    for (let i = first + 1; i < args.length; i++) if (bis[i] === undefined || bis[i] === 'default') rest.push(args[i]);
    const recv = `${this.go(x, MAX)}.${field}`;
    if (rest.length === 0) return { s: recv, prec: MAX };
    return { s: [recv, ...rest.map((a) => this.go(a, MAX))].join(' '), prec: LEAD };
  }

  private special(name: string, args: Expr[], need: number): string | null {
    const n = NOTATIONS[name];
    if (n && args.length >= n.arity) {
      const a = args[n.skip];
      const b = args[n.skip + 1];
      const lhs = this.isBinderLike(a) ? `(${this.go(a, 0)})` : this.go(a, n.lhs);
      const s = `${lhs} ${n.sym} ${this.go(b, n.rhs)}`;
      return this.extra(s, n.prec, args.slice(n.arity), need);
    }
    switch (name) {
      case 'Not':
        if (args.length === 1) {
          const a = args[0];
          // ¬(x ∈ s) is printed `x ∉ s`
          const af = getAppFn(a);
          if (af.k === 'const' && af.name === 'Membership.mem' && getAppArgs(a).length === 3) {
            const [, s, x] = getAppArgs(a);
            return this.paren(`${this.go(x, 51)} ∉ ${this.go(s, 51)}`, 50, need);
          }
          return this.paren(`¬${this.go(a, 40)}`, MAX, need);
        }
        break;
      case 'Membership.mem':
        if (args.length >= 3) {
          const s = `${this.go(args[2], 51)} ∈ ${this.go(args[1], 51)}`;
          return this.extra(s, 50, args.slice(3), need);
        }
        break;
      case 'Set.compl':
        if (args.length >= 2) return this.extra(`${this.go(args[1], MAX)}ᶜ`, MAX, args.slice(2), need);
        break;
      case 'setOf':
        if (args.length === 2 && args[1].k === 'lam') {
          const lam = args[1];
          const r = this.enter(lam.name, lam.type, lam.body);
          return `{${r.name} | ${this.go(r.body, 0)}}`;
        }
        break;
      case 'EmptyCollection.emptyCollection':
        if (args.length === 1) return '∅';
        break;
      case 'Exists':
        if (args.length === 2 && args[1].k === 'lam') {
          const names: string[] = [];
          let body: Expr = args[1];
          while (body.k === 'lam') {
            const r = this.enter(body.name, body.type, body.body);
            names.push(r.name);
            const inner = r.body;
            const f = getAppFn(inner);
            if (f.k === 'const' && f.name === 'Exists' && getAppArgs(inner).length === 2 && getAppArgs(inner)[1].k === 'lam') {
              body = getAppArgs(inner)[1];
            } else {
              body = inner;
              break;
            }
          }
          return this.paren(`∃ ${names.join(' ')}, ${this.go(body, 0)}`, LEAD, need);
        }
        break;
      case 'And.intro':
      case 'Iff.intro':
        if (args.length === 4) return `⟨${this.go(args[2], 0)}, ${this.go(args[3], 0)}⟩`;
        break;
      case 'Prod.mk':
        if (args.length === 4) return `(${this.go(args[2], 0)}, ${this.go(args[3], 0)})`;
        break;
      case 'Nat.zero':
        if (args.length === 0) return 'Nat.zero';
        break;
      case 'OfNat.ofNat':
        break;
    }
    return null;
  }

  /** Terms that extend as far right as possible (`fun`, `∀`, `∃`, `let`) need parentheses on the left. */
  private isBinderLike(e: Expr): boolean {
    const x = this.m.instantiateMVars(e);
    if (x.k === 'lam' || x.k === 'let') return true;
    if (x.k === 'pi') return hasLooseBVar(x.body, 0) || x.bi !== 'default';
    const f = getAppFn(x);
    return f.k === 'const' && f.name === 'Exists' && getAppArgs(x).length === 2;
  }

  private extra(s: string, prec: number, rest: Expr[], need: number): string {
    if (rest.length === 0) return this.paren(s, prec, need);
    return this.paren([`(${s})`, ...rest.map((a) => this.go(a, MAX))].join(' '), LEAD, need);
  }
}

export function ppSort(l: Level): string {
  const n = toNat(l);
  if (n === 0) return 'Prop';
  if (n === 1) return 'Type';
  if (n !== null) return `Type ${n - 1}`;
  if (l.k === 'succ') {
    const inner = showLevel(l.l);
    return /\s/.test(inner) ? `Type (${inner})` : `Type ${inner}`;
  }
  const s = showLevel(l);
  return /\s/.test(s) ? `Sort (${s})` : `Sort ${s}`;
}

/** Display names for the hypotheses of a local context (shadowed names get `✝`). */
export function displayNames(decls: readonly LocalDecl[]): Map<number, string> {
  const out = new Map<number, string>();
  const seen = new Set<string>();
  for (let i = decls.length - 1; i >= 0; i--) {
    const d = decls[i];
    let n = d.userName;
    if (d.inaccessible || seen.has(n)) n = `${n}✝`;
    else seen.add(n);
    out.set(d.id, n);
  }
  return out;
}

/** Infoview rendering of a goal metavariable. */
export function ppGoal(m: Meta, mvarId: number): Goal {
  const decl = m.decl(mvarId);
  const visible = decl.lctx.decls.filter((d) => !d.hidden);
  const names = displayNames(decl.lctx.decls);
  const pr = new Printer(m, (id) => names.get(id) ?? (m.fvars.get(id) ? `${m.fvars.get(id)!.userName}✝` : undefined));
  const hyps: Hyp[] = [];
  for (const d of visible) {
    const type = pr.pp(d.type);
    const name = names.get(d.id)!;
    const value = d.value !== undefined ? pr.pp(d.value) : undefined;
    const last = hyps[hyps.length - 1];
    if (last && value === undefined && last.value === undefined && last.type === type) {
      last.names.push(name);
      continue;
    }
    let isProof = false;
    try {
      isProof = m.isProp(d.type);
    } catch {
      isProof = false;
    }
    hyps.push({ names: [name], type, value, isProof });
  }
  const goal: Goal = { hyps, target: pr.pp(decl.type) };
  if (decl.userName) goal.caseName = decl.userName;
  return goal;
}

export function goalToString(g: Goal): string {
  const lines: string[] = [];
  if (g.caseName) lines.push(`case ${g.caseName}`);
  for (const h of g.hyps) lines.push(`${h.names.join(' ')} : ${h.type}${h.value !== undefined ? ` := ${h.value}` : ''}`);
  lines.push(`⊢ ${g.target}`);
  return lines.join('\n');
}

export function goalsToString(gs: Goal[]): string {
  return gs.map(goalToString).join('\n\n');
}
