/**
 * Term elaboration: surface syntax → core terms, with implicit-argument insertion,
 * expected-type propagation, postponement of arguments that need their expected type,
 * generalized field notation, and the hard-wired notations of the game's library.
 */
import type { BinderInfo, Expr } from '../kernel/expr.ts';
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
  mkNatLit,
  mkPi,
  mkSort,
  mkStrLit,
  abstractFVars,
  lowerLooseBVars,
  collectMVars as collectMVarsInto,
} from '../kernel/expr.ts';
import type { Level } from '../kernel/level.ts';
import { lparam, lsucc, lzero, lmax, limax } from '../kernel/level.ts';
import type { Environment } from '../kernel/env.ts';
import { Fuel, TimeoutError } from '../kernel/reduce.ts';
import { Meta, MetaError } from '../meta/meta.ts';
import type { LocalDecl } from '../meta/lctx.ts';
import { LocalContext } from '../meta/lctx.ts';
import { Printer, goalsToString, ppGoal } from '../pp/print.ts';
import type { Arg, BinderGroup, LevelSyntax, MatchAlt, Tactic, TacticSeq, Term } from '../syntax/ast.ts';
import type { Diagnostic, Goal, TacticStep } from '../types.ts';
import { ElabError, suggest } from './errors.ts';

export interface Scope {
  namespace: string;
  opens: string[];
  universes: string[];
  variables: BinderGroup[];
}

export interface ElabOptions {
  allowedTactics?: Set<string>;
  forbidden?: Set<string>;
  /** library mode (`extend`): no tactic lock, no forbidden names */
  trusted?: boolean;
}

interface Postponed {
  mvar: Expr;
  stx: Term;
  type: Expr;
  lctx: LocalContext;
}

export interface PendingTactic {
  mvarId: number;
  seq: TacticSeq;
  lctx: LocalContext;
  byFrom: number;
  byTo: number;
}

export interface TacticBlockInfo {
  from: number;
  to: number;
  initial: Goal[];
  /** the steps recorded for this block (indices into steps) */
}

/** Structure for `x.f` resolution. */
interface SelfArg {
  e: Expr;
  head: string;
}

export type TacticRunner = (el: Elab, mvarId: number, seq: TacticSeq, byFrom: number, byTo: number) => void;
export type MatchElaborator = (el: Elab, discrs: Expr[], alts: MatchAlt[], expected: Expr, range: { from: number; to: number }) => Expr;

let tacticRunner: TacticRunner | null = null;
let matchElab: MatchElaborator | null = null;
export function setTacticRunner(r: TacticRunner): void {
  tacticRunner = r;
}
export function setMatchElaborator(r: MatchElaborator): void {
  matchElab = r;
}

const BINOP_CONST: Record<string, string> = {
  '=': 'Eq',
  '≠': 'Ne',
  '∧': 'And',
  '∨': 'Or',
  '↔': 'Iff',
  '+': 'Nat.add',
  '-': 'Nat.sub',
  '*': 'Nat.mul',
  '/': 'Nat.div',
  '%': 'Nat.mod',
  '^': 'Nat.pow',
  '≤': 'Nat.le',
  '<': 'Nat.lt',
  '≥': 'GE.ge',
  '>': 'GT.gt',
  '∣': 'Dvd.dvd',
  '⊆': 'HasSubset.Subset',
  '∪': 'Union.union',
  '∩': 'Inter.inter',
  '\\': 'SDiff.sdiff',
  "''": 'Set.image',
  "⁻¹'": 'Set.preimage',
  '∘': 'Function.comp',
  '×': 'Prod',
  '++': 'String.append',
};

export class Elab {
  readonly m: Meta;
  scope: Scope;
  lctx: LocalContext = LocalContext.empty;
  readonly src: string;
  readonly opts: ElabOptions;
  diags: Diagnostic[] = [];
  steps: TacticStep[] = [];
  tacticBlocks: TacticBlockInfo[] = [];
  usedConstants = new Set<string>();
  usedTactics = new Set<string>();
  usesSorry = false;
  /** errors were reported for this declaration */
  hadError = false;
  pending: PendingTactic[] = [];
  private postponed: Postponed[] = [];
  /** universe names bound in the current declaration (declared + auto-bound) */
  levelNames: string[] = [];
  /** `?_` holes created (for `refine`) */
  syntheticHoles: number[] = [];
  /** natural holes `_` created by the user */
  naturalHoles: { id: number; from: number; to: number }[] = [];
  /** the declaration being defined (for recursive references) */
  selfRef: { name: string; fvar: Expr } | null = null;
  /** user-name of constants we are allowed to unfold for display */
  recover = true;

  constructor(env: Environment, scope: Scope, src: string, opts: ElabOptions, m?: Meta) {
    this.m = m ?? new Meta(env, new Fuel(400_000));
    this.scope = scope;
    this.src = src;
    this.opts = opts;
  }

  get env(): Environment {
    return this.m.env;
  }

  /* ---------------- printing ---------------- */

  pp(e: Expr): string {
    return new Printer(this.m, (id) => {
      const d = this.lctx.get(id) ?? this.m.fvars.get(id);
      if (!d) return undefined;
      const later = this.lctx.findByName(d.userName);
      if (d.inaccessible || (later && later.id !== d.id)) return `${d.userName}✝`;
      return d.userName;
    }).pp(e);
  }

  ppGoals(ids: number[]): Goal[] {
    return ids.map((id) => ppGoal(this.m, id));
  }

  goalContext(): string {
    // the current local context rendered as a goal-less context
    const tmp = this.m.mkFreshMVar(mkSort(lzero), this.lctx, 'natural');
    const g = ppGoal(this.m, (tmp as { id: number }).id);
    return g.hyps.map((h) => `${h.names.join(' ')} : ${h.type}`).join('\n');
  }

  error(code: Diagnostic['code'], message: string, r: { from: number; to: number }, data?: Diagnostic['data']): never {
    throw new ElabError(code, message, r.from, r.to, data);
  }

  report(err: ElabError): void {
    this.hadError = true;
    const d = err.toDiagnostic();
    if (!this.diags.some((x) => x.from === d.from && x.message === d.message)) this.diags.push(d);
  }

  warn(code: Diagnostic['code'], message: string, r: { from: number; to: number }): void {
    if (!this.diags.some((x) => x.from === r.from && x.message === message)) {
      this.diags.push({ severity: 'warning', code, message, from: r.from, to: r.to });
    }
  }

  /* ---------------- local context ---------------- */

  withLocal<T>(d: LocalDecl, f: (x: Expr) => T): T {
    const old = this.lctx;
    this.m.registerLocal(d);
    this.lctx = this.lctx.push(d);
    try {
      return f(mkFVar(d.id));
    } finally {
      this.lctx = old;
    }
  }

  mkLocalDecl(name: string, type: Expr, bi: BinderInfo = 'default', value?: Expr): LocalDecl {
    const inacc = name === '_' || name.includes('✝');
    return this.m.mkLocal(name === '_' ? 'x' : name, type, bi, value, inacc && name === '_');
  }

  newMVar(type: Expr, kind: 'natural' | 'synthetic' | 'opaque' = 'natural', userName?: string): Expr {
    return this.m.mkFreshMVar(type, this.lctx, kind, userName);
  }

  newTypeMVar(): Expr {
    return this.newMVar(mkSort(this.m.mkFreshLevelMVar()));
  }

  instantiate(e: Expr): Expr {
    return this.m.instantiateMVars(e);
  }

  isDefEq(a: Expr, b: Expr): boolean {
    try {
      return this.m.isDefEq(a, b);
    } catch (e) {
      if (e instanceof MetaError) return false;
      throw e;
    }
  }

  inferType(e: Expr): Expr {
    try {
      return this.m.inferType(e);
    } catch (err) {
      if (err instanceof MetaError) throw new ElabError('other', err.message, 0, 0);
      throw err;
    }
  }

  whnf(e: Expr): Expr {
    return this.m.whnf(this.instantiate(e));
  }

  /* ---------------- names ---------------- */

  /** Candidate full names for a (possibly relative) global name, in priority order. */
  globalCandidates(name: string): string[] {
    if (name.startsWith('_root_.')) return [name.slice(7)];
    const out: string[] = [];
    const ns = this.scope.namespace;
    if (ns) {
      const parts = ns.split('.');
      for (let i = parts.length; i > 0; i--) out.push(parts.slice(0, i).join('.') + '.' + name);
    }
    out.push(name);
    for (const o of this.scope.opens) out.push(o + '.' + name);
    return out;
  }

  resolveGlobal(name: string): string | null {
    const cands = this.globalCandidates(name);
    for (const c of cands) {
      const d = this.env.get(c);
      if (!d) continue;
      if (d.isProtected && c !== name && this.scope.opens.some((o) => c === o + '.' + name) && !name.includes('.')) continue;
      return c;
    }
    return null;
  }

  checkForbidden(name: string, r: { from: number; to: number }): void {
    if (this.opts.trusted) return;
    if (this.opts.forbidden?.has(name)) {
      this.error('name-locked', `'${name}' is not available in this level: proving it is the point of the exercise`, r, { name });
    }
  }

  useConst(name: string, r: { from: number; to: number }): void {
    this.checkForbidden(name, r);
    this.usedConstants.add(name);
  }

  mkConstInst(name: string): { e: Expr; type: Expr } {
    const d = this.env.get(name)!;
    const levels = d.levelParams.map(() => this.m.mkFreshLevelMVar());
    const e = mkConst(name, levels);
    return { e, type: this.m.inferType(e) };
  }

  unknownIdent(name: string, r: { from: number; to: number }): never {
    const cands = new Set<string>();
    for (const d of this.lctx.decls) if (!d.inaccessible) cands.add(d.userName);
    this.env.forEach((d) => {
      if (d.name.includes('.rec') || d.name.includes('casesOn') || d.name.includes('._')) return;
      cands.add(d.name);
      for (const o of this.scope.opens) if (d.name.startsWith(o + '.')) cands.add(d.name.slice(o.length + 1));
    });
    const suggestions = suggest(name, cands);
    this.error('unknown-identifier', `Unknown identifier \`${name}\``, r, { name, suggestions });
  }

  /* ---------------- universe levels ---------------- */

  elabLevel(l: LevelSyntax, r: { from: number; to: number }): Level {
    switch (l.k) {
      case 'num': {
        let x: Level = lzero;
        for (let i = 0; i < l.n; i++) x = lsucc(x);
        return x;
      }
      case 'param': {
        if (!this.levelNames.includes(l.name)) {
          if (this.scope.universes.includes(l.name)) this.levelNames.push(l.name);
          else this.levelNames.push(l.name); // auto-bound universe
        }
        return lparam(l.name);
      }
      case 'succ': {
        let x = this.elabLevel(l.l, r);
        for (let i = 0; i < l.n; i++) x = lsucc(x);
        return x;
      }
      case 'max':
      case 'imax': {
        const xs = l.args.map((a) => this.elabLevel(a, r));
        let acc = xs[0] ?? lzero;
        for (const x of xs.slice(1)) acc = l.k === 'max' ? lmax(acc, x) : limax(acc, x);
        return acc;
      }
      case 'hole':
        return this.m.mkFreshLevelMVar();
    }
  }

  /* ---------------- entry points ---------------- */

  /** Elaborate a type (a term whose type is a sort). */
  elabType(stx: Term): Expr {
    const u = this.m.mkFreshLevelMVar();
    const e = this.elabTerm(stx, mkSort(u));
    const t = this.whnf(this.inferType(e));
    if (t.k !== 'sort') {
      this.error('type-mismatch', `type expected, got\n  (${this.pp(e)} : ${this.pp(this.inferType(e))})`, stx);
    }
    return e;
  }

  /** Elaborate and make sure the result has the expected type. */
  elabTermEnsuring(stx: Term, expected: Expr | null): Expr {
    const e = this.elabTerm(stx, expected);
    if (expected) this.ensureHasType(expected, e, stx);
    return e;
  }

  ensureHasType(expected: Expr, e: Expr, stx: { from: number; to: number }, appCtx?: { fn: Expr; arg: Expr }): void {
    const t = this.inferType(e);
    if (this.isDefEq(t, expected)) return;
    const exp = this.pp(expected);
    const act = this.pp(t);
    if (appCtx) {
      this.error(
        'type-mismatch',
        `Application type mismatch: The argument\n  ${this.pp(e)}\nhas type\n  ${act}\nbut is expected to have type\n  ${exp}\nin the application\n  ${this.pp(mkApp(appCtx.fn, appCtx.arg))}`,
        stx,
        { expected: exp, actual: act },
      );
    }
    this.error('type-mismatch', `Type mismatch\n  ${this.pp(e)}\nhas type\n  ${act}\nbut is expected to have type\n  ${exp}`, stx, {
      expected: exp,
      actual: act,
    });
  }

  /** Elaborate, then run postponed elaboration problems and pending tactic blocks. */
  elabTermAndSynthesize(stx: Term, expected: Expr | null): Expr {
    const e = this.elabTermEnsuring(stx, expected);
    this.synthesize();
    return e;
  }

  /** Run postponed arguments and tactic blocks (Lean's `synthesizeSyntheticMVars`). */
  synthesize(): void {
    this.synthesizePostponed();
    while (this.pending.length > 0) {
      const p = this.pending.shift()!;
      if (this.m.isAssigned(p.mvarId)) continue;
      this.runPendingTactic(p);
    }
  }

  private synthesizePostponed(): void {
    while (this.postponed.length > 0) {
      const p = this.postponed.shift()!;
      const old = this.lctx;
      this.lctx = p.lctx;
      try {
        const v = this.elabTermEnsuring(p.stx, this.instantiate(p.type));
        if (!this.isDefEq(p.mvar, v)) this.ensureHasType(this.instantiate(p.type), v, p.stx);
      } finally {
        this.lctx = old;
      }
    }
  }

  runPendingTactic(p: PendingTactic): void {
    if (!tacticRunner) throw new Error('tactic framework not loaded');
    const old = this.lctx;
    this.lctx = p.lctx;
    try {
      tacticRunner(this, p.mvarId, p.seq, p.byFrom, p.byTo);
    } finally {
      this.lctx = old;
    }
  }

  /* ---------------- the elaborator ---------------- */

  elabTerm(stx: Term, expected: Expr | null, noPostpone = false): Expr {
    this.m.fuel.tick();
    void noPostpone;
    // implicit lambda: `∀ {x}, T` expected and the term is not a matching `fun {x}` / `@` / `by`
    if (expected && this.wantsImplicitLambda(stx)) {
      const exp = this.m.whnfR(this.instantiate(expected));
      if (exp.k === 'pi' && (exp.bi === 'implicit' || exp.bi === 'inst')) {
        const d = this.m.mkLocal(exp.name, exp.type, exp.bi, undefined, true);
        return this.withLocal(d, (x) => {
          const body = this.elabTermEnsuring(stx, instantiate1(exp.body, x));
          return this.m.mkLambdaFVars([d.id], body);
        });
      }
    }
    switch (stx.k) {
      case 'ident':
        return this.elabApp(stx, [], expected, false, stx);
      case 'app':
        return this.elabAppSyntax(stx, expected);
      case 'explicit':
        return this.elabApp(stx.term, [], expected, true, stx);
      case 'proj':
        return this.elabApp(stx, [], expected, false, stx);
      case 'dotIdent':
        return this.elabApp(stx, [], expected, false, stx);
      case 'num':
        return this.elabNum(stx.value, expected, stx);
      case 'str':
        return mkStrLit(stx.value);
      case 'sort': {
        if (stx.sort === 'Prop') return mkSort(lzero);
        const l = stx.level ? this.elabLevel(stx.level, stx) : lzero;
        return mkSort(stx.sort === 'Type' ? lsucc(l) : l);
      }
      case 'hole': {
        const t = expected ?? this.newTypeMVar();
        const mv = this.newMVar(t, 'natural');
        this.naturalHoles.push({ id: (mv as { id: number }).id, from: stx.from, to: stx.to });
        return mv;
      }
      case 'synthHole': {
        const t = expected ?? this.newTypeMVar();
        const mv = this.newMVar(t, 'opaque', stx.name ?? undefined);
        this.syntheticHoles.push((mv as { id: number }).id);
        return mv;
      }
      case 'sorry': {
        const t = expected ?? this.newTypeMVar();
        this.usesSorry = true;
        return this.mkSorry(t);
      }
      case 'paren':
        return this.elabTerm(stx.term, expected);
      case 'ascription': {
        const t = this.elabType(stx.type);
        const e = this.elabTermEnsuring(stx.term, t);
        this.synthesizePostponed();
        return e;
      }
      case 'tuple':
        return this.elabTuple(stx.elems, expected, stx);
      case 'anon':
        return this.elabAnon(stx.elems, expected, stx);
      case 'fun':
        return this.elabFun(stx, expected);
      case 'funMatch': {
        if (!expected) this.error('other', 'invalid pattern-matching `fun`: expected type must be known', stx);
        return this.elabFunMatch(stx.alts, expected, stx);
      }
      case 'forall':
        return this.elabForall(stx.binders, stx.body, stx);
      case 'exists':
        return this.elabExists(stx.binders, stx.body, stx);
      case 'arrow': {
        const a = this.elabType(stx.dom);
        const d = this.m.mkLocal('a✝', a, 'default', undefined, true);
        return this.withLocal(d, () => {
          const b = this.elabType(stx.cod);
          return mkPi('a✝', a, abstractFVars(this.instantiate(b), [d.id]));
        });
      }
      case 'binop':
        return this.elabBinop(stx, expected);
      case 'unop':
        return this.elabUnop(stx, expected);
      case 'by':
        return this.elabBy(stx, expected);
      case 'have':
        return this.elabHave(stx, expected);
      case 'suffices': {
        // suffices h : T from e; body  ≡  (fun h : T => e) body
        const t = this.elabType(stx.type);
        const name = stx.name ?? 'this';
        const d = this.m.mkLocal(name, t);
        const fn = this.withLocal(d, () => {
          const v = this.elabTermEnsuring(stx.value, expected);
          return this.m.mkLambdaFVars([d.id], v);
        });
        const arg = this.elabTermEnsuring(stx.body, t);
        return mkApp(fn, arg);
      }
      case 'show': {
        const t = this.elabType(stx.type);
        if (expected && !this.isDefEq(t, expected)) {
          const exp = this.pp(expected);
          const act = this.pp(t);
          this.error('type-mismatch', `Type mismatch\n  ${act}\nis not definitionally equal to the expected type\n  ${exp}`, stx.type, { expected: exp, actual: act });
        }
        if (!stx.value) this.error('parse', "expected 'from' or 'by' after 'show'", stx);
        const v = this.elabTermEnsuring(stx.value, t);
        const u = this.m.inferSortLevel(t);
        return mkAppN(mkConst('id', [u]), [t, v]);
      }
      case 'let': {
        let t: Expr | null = null;
        let valStx = stx.value;
        if (stx.binders.length > 0) {
          valStx = { k: 'fun', binders: stx.binders.map((g) => ({ k: 'group' as const, group: g })), body: stx.type ? { k: 'ascription', term: stx.value, type: stx.type, from: stx.value.from, to: stx.value.to } : stx.value, from: stx.value.from, to: stx.value.to };
        } else if (stx.type) t = this.elabType(stx.type);
        const v = this.elabTermEnsuring(valStx, t);
        this.synthesizePostponed();
        const ty = t ?? this.instantiate(this.inferType(v));
        const d = this.m.mkLocal(stx.name, ty, 'default', v);
        return this.withLocal(d, () => {
          const b = this.elabTermEnsuring(stx.body, expected);
          return this.m.mkLambdaFVars([d.id], b);
        });
      }
      case 'calc':
        return this.elabCalc(stx.steps, expected, stx);
      case 'setBuilder': {
        let elemType: Expr | null = null;
        if (stx.type) elemType = this.elabType(stx.type);
        else if (expected) {
          const w = this.instantiate(expected);
          if (w.k === 'app' && getAppFn(w).k === 'const' && (getAppFn(w) as { name: string }).name === 'Set') elemType = w.arg;
        }
        const ty = elemType ?? this.newTypeMVar();
        const d = this.m.mkLocal(stx.name, ty);
        const lam = this.withLocal(d, () => {
          const b = this.elabTermEnsuring(stx.body, mkSort(lzero));
          return this.m.mkLambdaFVars([d.id], b);
        });
        const u = this.m.inferSortLevel(ty);
        const lvl = this.levelOfType(u, stx);
        return mkAppN(mkConst('setOf', [lvl]), [ty, lam]);
      }
      case 'setLit':
        return this.elabSetLit(stx.elems, expected, stx);
      case 'match': {
        if (!matchElab) throw new Error('match elaborator not loaded');
        const discrs = stx.discrs.map((d) => {
          const e = this.elabTerm(d, null);
          this.synthesizePostponed();
          return e;
        });
        const exp = expected ?? this.error('other', 'invalid `match` expression: expected type must be known', stx);
        return matchElab(this, discrs, stx.alts, exp, stx);
      }
      case 'ite':
        return this.error('other', '`if … then … else` is not supported in this game; use `by_cases` or `match`', stx);
      case 'cdot':
        return this.error('parse', 'invalid occurrence of `·` notation', stx);
      case 'error':
        return this.mkSorry(expected ?? this.newTypeMVar());
    }
  }

  private wantsImplicitLambda(stx: Term): boolean {
    switch (stx.k) {
      case 'explicit':
      case 'by':
      case 'hole':
      case 'synthHole':
      case 'sorry':
        return false;
      case 'fun': {
        const b = stx.binders[0];
        return !(b && b.k === 'group' && (b.group.bi === 'implicit' || b.group.bi === 'inst'));
      }
      default:
        return true;
    }
  }

  /** Universe `u` of `α : Sort u` as a `Type v` level (`v` with `u = v+1`). */
  levelOfType(u: Level, r: { from: number; to: number }): Level {
    const inst = this.m.instantiateLevel(u);
    if (inst.k === 'succ') return inst.l;
    const v = this.m.mkFreshLevelMVar();
    if (this.m.isLevelDefEq(inst, lsucc(v))) return this.m.instantiateLevel(v);
    this.error('type-mismatch', 'type expected (not a proposition)', r);
  }

  mkSorry(t: Expr): Expr {
    const u = this.m.inferSortLevel(t);
    return mkAppN(mkConst('sorryAx', [u]), [t]);
  }

  /* ---------------- numerals ---------------- */

  private elabNum(v: bigint, expected: Expr | null, r: { from: number; to: number }): Expr {
    if (expected) {
      const t = this.m.whnfR(this.instantiate(expected));
      if (t.k === 'mvar') {
        this.isDefEq(t, mkConst('Nat'));
        return mkNatLit(v);
      }
      if (t.k === 'const' && t.name === 'Nat') return mkNatLit(v);
      const tt = this.whnf(t);
      if (tt.k === 'const' && tt.name === 'Nat') return mkNatLit(v);
      this.error(
        'type-mismatch',
        `failed to synthesize\n  OfNat (${this.pp(expected)}) ${v}\nnumerals are polymorphic in Lean, but the numeral \`${v}\` cannot be used in a context where the expected type is\n  ${this.pp(expected)}\ndue to the absence of the instance above`,
        r,
      );
    }
    return mkNatLit(v);
  }

  /* ---------------- applications ---------------- */

  private elabAppSyntax(stx: Term & { k: 'app' }, expected: Expr | null): Expr {
    const fn = stx.fn;
    if (fn.k === 'ident' || fn.k === 'proj' || fn.k === 'dotIdent') return this.elabApp(fn, stx.args, expected, false, stx);
    if (fn.k === 'explicit') return this.elabApp(fn.term, stx.args, expected, true, stx);
    if (fn.k === 'paren' && (fn.term.k === 'ident' || fn.term.k === 'proj')) return this.elabApp(fn.term, stx.args, expected, false, stx);
    const f = this.elabTerm(fn, null);
    this.synthesizePostponed();
    return this.elabAppArgs({ e: f, type: this.instantiate(this.inferType(f)), self: null }, null, stx.args, expected, false, stx, fn);
  }

  /** Resolve the head of an application (identifier, field access, `.ctor`). */
  private elabHead(stx: Term, expected: Expr | null, explicit: boolean): { e: Expr; type: Expr; self: SelfArg | null } {
    if (stx.k === 'ident') return this.elabIdentHead(stx.name, stx, explicit);
    if (stx.k === 'dotIdent') {
      if (!expected) this.error('other', `invalid dotted identifier notation, expected type must be known`, stx);
      const t = this.whnf(expected);
      const h = getAppFn(t);
      if (h.k !== 'const') this.error('other', `invalid dotted identifier notation, expected type is not of the form (C ...)`, stx);
      let name = `${h.name}.${stx.name}`;
      if (!this.env.has(name)) {
        const t2 = this.instantiate(expected);
        const h2 = getAppFn(t2);
        if (h2.k === 'const' && this.env.has(`${h2.name}.${stx.name}`)) name = `${h2.name}.${stx.name}`;
        else this.unknownIdent(name, stx);
      }
      this.useConst(name, stx);
      const c = this.mkConstInst(name);
      return { ...c, self: null };
    }
    if (stx.k === 'proj') {
      const base = this.elabTerm(stx.term, null);
      this.synthesizePostponed();
      return this.resolveField(base, stx.field, { from: stx.from, to: stx.to }, stx.term);
    }
    const e = this.elabTerm(stx, null);
    return { e, type: this.instantiate(this.inferType(e)), self: null };
  }

  private elabIdentHead(name: string, r: { from: number; to: number }, explicit: boolean): { e: Expr; type: Expr; self: SelfArg | null } {
    void explicit;
    if (name === '∅') {
      const c = this.mkConstInst('EmptyCollection.emptyCollection');
      return { ...c, self: null };
    }
    const parts = name.split('.');
    // local variable prefix
    for (let i = parts.length; i >= 1; i--) {
      const prefix = parts.slice(0, i).join('.');
      const d = this.lctx.findByName(prefix);
      if (d) {
        let head: { e: Expr; type: Expr; self: SelfArg | null } = { e: mkFVar(d.id), type: this.instantiate(d.type), self: null };
        if (this.selfRef && d.id === (this.selfRef.fvar as { id: number }).id) this.usedConstants.add(this.selfRef.name);
        for (let j = i; j < parts.length; j++) {
          const fieldFrom = r.from + parts.slice(0, j).join('.').length + 1;
          if (head.self) {
            const full = this.applySelfOnly(head);
            head = { e: full, type: this.instantiate(this.inferType(full)), self: null };
          }
          head = this.resolveField(head.e, parts[j], { from: fieldFrom, to: r.to }, r);
        }
        return head;
      }
    }
    // global constant prefix
    for (let i = parts.length; i >= 1; i--) {
      const prefix = parts.slice(0, i).join('.');
      const full = this.resolveGlobal(prefix);
      if (!full) continue;
      if (i < parts.length) {
        // `Nat.foo` where `Nat` is a type: an unknown name, not field notation
        const pd = this.env.get(full)!;
        let t = pd.type;
        while (t.k === 'pi') t = t.body;
        if (t.k === 'sort') return this.unknownIdent(name, r);
      }
      this.useConst(full, { from: r.from, to: r.from + prefix.length });
      let head: { e: Expr; type: Expr; self: SelfArg | null } = { ...this.mkConstInst(full), self: null };
      for (let j = i; j < parts.length; j++) {
        if (head.self) {
          const e = this.applySelfOnly(head);
          head = { e, type: this.instantiate(this.inferType(e)), self: null };
        } else if (j > i - 0 && j > i) {
          // nothing
        }
        if (j === i) {
          // `Nat.add_comm.symm`: apply implicit args first
          const e = this.insertImplicits(head.e, head.type);
          head = { e, type: this.instantiate(this.inferType(e)), self: null };
        }
        const fieldFrom = r.from + parts.slice(0, j).join('.').length + 1;
        head = this.resolveField(head.e, parts[j], { from: fieldFrom, to: r.to }, r);
      }
      return head;
    }
    return this.unknownIdent(name, r);
  }

  private insertImplicits(e: Expr, type: Expr): Expr {
    let t = type;
    for (;;) {
      if (t.k !== 'pi') t = this.m.whnfCore(t);
      if (t.k !== 'pi' || (t.bi !== 'implicit' && t.bi !== 'inst')) return e;
      const mv = this.newMVar(t.type);
      e = mkApp(e, mv);
      t = instantiate1(t.body, mv);
    }
  }

  /** Apply a field-notation function to its receiver only (`h.symm` as a value). */
  private applySelfOnly(head: { e: Expr; type: Expr; self: SelfArg | null }): Expr {
    return this.elabAppArgs(head, null, [], null, false, { from: 0, to: 0 }, null);
  }

  /**
   * `e.f`: numeric fields are structure projections; named fields resolve `C.f` where `C` is the
   * head of `e`'s type, unfolding the type until such a constant exists.
   */
  resolveField(base: Expr, field: string, r: { from: number; to: number }, baseStx: { from: number; to: number }): { e: Expr; type: Expr; self: SelfArg | null } {
    let t = this.instantiate(this.inferType(base));
    const tried: string[] = [];
    for (let iter = 0; iter < 32; iter++) {
      const h = getAppFn(t);
      if (h.k === 'const') {
        const ind = this.env.get(h.name)?.ind;
        if (/^\d+$/.test(field)) {
          if (ind?.fields) {
            const idx = Number(field) - 1;
            if (idx < 0 || idx >= ind.fields.length) {
              const n = ind.fields.length;
              this.error(
                'other',
                `Invalid projection: Index \`${field}\` is invalid for this structure; it must be between 1 and ${n}\n\nNote: The expression \`${this.pp(base)}\` has type \`${this.pp(this.instantiate(this.inferType(base)))}\` which has only ${n} field${n === 1 ? '' : 's'}`,
                r,
              );
            }
            const pname = `${h.name}.${ind.fields[idx]}`;
            const c = this.mkConstInst(pname);
            return { e: c.e, type: c.type, self: { e: base, head: h.name } };
          }
        } else {
          const full = `${h.name}.${field}`;
          tried.push(full);
          if (this.env.has(full)) {
            this.useConst(full, r);
            const c = this.mkConstInst(full);
            return { e: c.e, type: c.type, self: { e: base, head: h.name } };
          }
        }
      } else if (h.k === 'pi' || t.k === 'pi') {
        const full = `Function.${field}`;
        if (!/^\d+$/.test(field) && this.env.has(full)) {
          this.useConst(full, r);
          const c = this.mkConstInst(full);
          return { e: c.e, type: c.type, self: { e: base, head: '→' } };
        }
        break;
      }
      // unfold one step
      const t1 = this.m.whnfCore(t);
      if (t1 !== t && getAppFn(t1) !== getAppFn(t)) {
        t = t1;
        continue;
      }
      const u = this.m.red.unfoldHead(t);
      if (!u) break;
      t = this.instantiate(u);
    }
    const ty = this.instantiate(this.inferType(base));
    const h0 = getAppFn(this.m.whnf(ty));
    if (h0.k !== 'const' && getAppFn(ty).k !== 'const') {
      this.error(
        'other',
        `Invalid field notation: Type is not of the form \`C ...\` where C is a constant\n  ${this.pp(base)}\nhas type\n  ${this.pp(ty)}`,
        r,
      );
    }
    void baseStx;
    const hname = getAppFn(ty).k === 'const' ? (getAppFn(ty) as { name: string }).name : (h0 as { name: string }).name;
    if (/^\d+$/.test(field)) {
      this.error('other', `Invalid projection: Expected a value whose type is a structure\n  ${this.pp(base)}\nhas type\n  ${this.pp(ty)}`, r);
    }
    this.error('unknown-identifier', `Invalid field \`${field}\`: The environment does not contain \`${hname}.${field}\`\n  ${this.pp(base)}\nhas type\n  ${this.pp(ty)}`, r, {
      name: `${hname}.${field}`,
      suggestions: [],
    });
  }

  elabApp(fnStx: Term, args: Arg[], expected: Expr | null, explicit: boolean, stx: { from: number; to: number }): Expr {
    const head = this.elabHead(fnStx, expected, explicit);
    return this.elabAppArgs(head, null, args, expected, explicit, stx, fnStx);
  }

  /**
   * Core application elaborator. Mirrors Lean's `elabAppArgs`: implicit arguments become
   * metavariables, the expected type is propagated to the result type first (when the
   * result does not depend on explicit arguments), then explicit arguments are elaborated
   * left to right; arguments that need their expected type are postponed.
   */
  elabAppArgs(
    head: { e: Expr; type: Expr; self: SelfArg | null },
    _unused: null,
    args: Arg[],
    expected: Expr | null,
    explicit: boolean,
    stx: { from: number; to: number },
    fnStx: Term | null,
  ): Expr {
    let e = head.e;
    let fType = head.type;
    let self = head.self;
    const positional = args.filter((a) => !a.named).map((a) => a.value);
    const named = new Map<string, Term>();
    for (const a of args) if (a.named) named.set(a.named, a.value);
    const postponedHere: Postponed[] = [];

    // --- expected type propagation (first-order) ---
    const preMVars: Expr[] = [];
    if (expected && !explicit && named.size === 0) {
      const sim = this.simulateResultType(fType, positional.length + (self ? 1 : 0), self !== null);
      if (sim) {
        preMVars.push(...sim.mvars);
        const exp = this.instantiate(expected);
        const resT = sim.result;
        const m = this.m.mark();
        if (!this.isDefEq(resT, exp)) this.m.rollback(m);
      }
    }

    const elabArgAgainst = (argStx: Term, bt: Expr): Expr => {
      const bti = this.instantiate(bt);
      if (this.shouldPostpone(argStx, bti)) {
        const mv = this.newMVar(bti, 'natural');
        const p = { mvar: mv, stx: argStx, type: bti, lctx: this.lctx };
        postponedHere.push(p);
        return mv;
      }
      const v = this.elabTerm(argStx, bti);
      this.ensureHasType(bti, v, argStx, { fn: e, arg: v });
      return v;
    };

    for (;;) {
      this.m.fuel.tick();
      const haveMore = positional.length > 0 || named.size > 0 || self !== null;
      let t = fType;
      if (t.k !== 'pi') {
        t = this.m.whnfCore(this.instantiate(t));
        if (t.k !== 'pi' && haveMore) t = this.whnf(t);
      }
      if (t.k !== 'pi') {
        if (haveMore && (positional.length > 0 || self)) {
          const argStx = positional[0];
          const shown = fnStx ? this.pp(e) : this.pp(e);
          const argStr = argStx ? this.src.slice(argStx.from, argStx.to) : '';
          this.error(
            'function-expected',
            `Function expected at\n  ${shown}\nbut this term has type\n  ${this.pp(fType)}\n\nNote: Expected a function because this term is being applied to the argument\n  ${argStr}`,
            stx,
          );
        }
        if (named.size > 0) {
          const [n] = named.keys();
          this.error('other', `Invalid argument name \`${n}\` for function \`${this.pp(head.e)}\``, stx);
        }
        break;
      }
      const bi = explicit ? 'default' : t.bi;
      let arg: Expr | null = null;
      const namedStx = named.get(t.name);
      if (namedStx) {
        named.delete(t.name);
        arg = elabArgAgainst(namedStx, t.type);
      } else if (bi === 'default') {
        if (self && this.selfMatches(t.type, self.head)) {
          arg = self.e;
          const bti = this.instantiate(t.type);
          this.ensureHasType(bti, arg, stx, { fn: e, arg });
          self = null;
        } else if (positional.length > 0) {
          arg = elabArgAgainst(positional.shift()!, t.type);
        } else if (self) {
          // receiver must go to the first explicit argument of matching type; keep looking
          const mv = this.newMVar(this.instantiate(t.type), 'natural');
          arg = mv;
        } else break;
      } else if (bi === 'implicit' || bi === 'inst') {
        if (!haveMore && explicit) break;
        arg = preMVars.shift() ?? this.newMVar(this.instantiate(t.type), 'natural');
      } else {
        // strict implicit: only when an explicit argument follows
        if (!haveMore) break;
        arg = preMVars.shift() ?? this.newMVar(this.instantiate(t.type), 'natural');
      }
      e = mkApp(e, arg);
      fType = instantiate1(t.body, arg);
    }
    if (positional.length > 0) {
      this.error('function-expected', `Function expected at\n  ${this.pp(e)}\nbut this term has type\n  ${this.pp(fType)}`, stx);
    }
    if (self) {
      this.error('other', `Invalid field notation: Function \`${this.pp(head.e)}\` does not have an explicit argument with type \`${self.head} ...\``, stx);
    }
    // unify result type with expected before elaborating postponed arguments
    if (expected && postponedHere.length > 0) {
      const m = this.m.mark();
      if (!this.isDefEq(this.instantiate(fType), this.instantiate(expected))) this.m.rollback(m);
    }
    for (const p of postponedHere) {
      const old = this.lctx;
      this.lctx = p.lctx;
      try {
        const ty = this.instantiate(p.type);
        if (this.shouldPostpone(p.stx, ty) && this.isDelayable(p.stx)) {
          // still unknown: hand over to the global postponement queue
          this.postponed.push({ ...p, type: ty });
          continue;
        }
        const v = this.elabTerm(p.stx, ty);
        this.ensureHasType(ty, v, p.stx, { fn: head.e, arg: v });
        if (!this.isDefEq(p.mvar, v)) this.ensureHasType(ty, v, p.stx);
      } finally {
        this.lctx = old;
      }
    }
    return e;
  }

  private isDelayable(stx: Term): boolean {
    return stx.k === 'anon' || stx.k === 'fun' || stx.k === 'dotIdent' || stx.k === 'setBuilder' || stx.k === 'funMatch';
  }

  private selfMatches(type: Expr, head: string): boolean {
    if (head === '→') {
      const w = this.m.whnf(this.instantiate(type));
      return w.k === 'pi';
    }
    let t = this.instantiate(type);
    for (let i = 0; i < 8; i++) {
      const h = getAppFn(t);
      if (h.k === 'const' && h.name === head) return true;
      const u = this.m.whnfCore(t);
      if (u !== t) {
        t = u;
        continue;
      }
      const v = this.m.red.unfoldHead(t);
      if (!v) return false;
      t = v;
    }
    return false;
  }

  /** Should this argument wait until its expected type is better known? */
  private shouldPostpone(stx: Term, type: Expr): boolean {
    const needsType = stx.k === 'anon' || stx.k === 'dotIdent' || stx.k === 'funMatch' || (stx.k === 'fun' && stx.binders.some((b) => b.k === 'pattern' || (b.k === 'group' && !b.group.type)));
    if (!needsType && stx.k !== 'setBuilder') return false;
    const t = this.m.whnfR(type);
    return getAppFn(t).k === 'mvar';
  }

  /** Walk the function type for `n` explicit arguments; result type if it does not depend on them. */
  private simulateResultType(fType: Expr, n: number, hasSelf: boolean): { result: Expr; mvars: Expr[] } | null {
    void hasSelf;
    const m = this.m.mark();
    const mvars: Expr[] = [];
    const placeholders: number[] = [];
    let t = fType;
    let k = n;
    let ok = true;
    for (let guard = 0; guard < 256; guard++) {
      if (t.k !== 'pi') {
        const w = k > 0 ? this.whnf(t) : this.m.whnfCore(this.instantiate(t));
        if (w.k !== 'pi') break;
        t = w;
      }
      if (t.bi === 'default') {
        if (k === 0) break;
        k--;
        if (hasLooseBVar(t.body, 0)) {
          // placeholder: the result type must not mention it
          const ph = this.newMVar(this.instantiate(t.type), 'natural');
          placeholders.push((ph as { id: number }).id);
          t = instantiate1(t.body, ph);
        } else t = lowerLooseBVars(t.body, 1, 1);
      } else if (t.bi === 'strict' && k === 0) {
        break;
      } else {
        const mv = this.newMVar(this.instantiate(t.type), 'natural');
        mvars.push(mv);
        t = instantiate1(t.body, mv);
      }
    }
    if (ok && placeholders.length > 0) {
      const ti = this.instantiate(t);
      const used = new Set<number>();
      collectMVarsInto(ti, used);
      if (placeholders.some((id) => used.has(id))) ok = false;
    }
    if (!ok || k > 0) {
      this.m.rollback(m);
      return null;
    }
    return { result: t, mvars };
  }

  /* ---------------- anonymous constructors, tuples ---------------- */

  private elabAnon(elems: Term[], expected: Expr | null, stx: { from: number; to: number }): Expr {
    if (!expected) this.error('other', 'Invalid `⟨...⟩` notation: The expected type must be known', stx);
    const t = this.whnf(expected);
    const h = getAppFn(t);
    if (h.k === 'mvar') this.error('other', 'Invalid `⟨...⟩` notation: The expected type must be known', stx);
    const ind = h.k === 'const' ? this.env.get(h.name)?.ind : undefined;
    if (!ind || h.k !== 'const') {
      this.error(
        'other',
        `Invalid \`⟨...⟩\` notation: The expected type \`${this.pp(expected)}\` is not an inductive type\n\nNote: This notation can only be used when the expected type is an inductive type with a single constructor`,
        stx,
      );
    }
    if (ind.ctors.length !== 1) {
      this.error(
        'other',
        `Invalid \`⟨...⟩\` notation: The expected type \`${this.pp(expected)}\` has more than one constructor\n\nNote: This notation can only be used when the expected type is an inductive type with a single constructor`,
        stx,
      );
    }
    const ctor = ind.ctors[0];
    const cdecl = this.env.get(ctor)!;
    // count explicit fields
    let ct = cdecl.type;
    let nexpl = 0;
    let idx = 0;
    while (ct.k === 'pi') {
      if (idx >= ind.numParams && ct.bi === 'default') nexpl++;
      ct = ct.body;
      idx++;
    }
    let args = elems;
    if (elems.length > nexpl && nexpl > 0) {
      const rest = elems.slice(nexpl - 1);
      const nested: Term = { k: 'anon', elems: rest, from: stx.from, to: stx.to };
      args = [...elems.slice(0, nexpl - 1), nested];
    } else if (elems.length < nexpl) {
      this.error(
        'other',
        `Insufficient number of fields for \`⟨...⟩\` constructor: Constructor \`${ctor}\` has ${nexpl} explicit field${nexpl === 1 ? '' : 's'}, but only ${elems.length} ${elems.length === 1 ? 'was' : 'were'} provided`,
        stx,
      );
    }
    const c = this.mkConstInst(ctor);
    const e = this.elabAppArgs({ ...c, self: null }, null, args.map((value) => ({ value })), t, false, stx, null);
    return e;
  }

  private elabTuple(elems: Term[], expected: Expr | null, stx: { from: number; to: number }): Expr {
    if (elems.length > 2) {
      const rest = elems.slice(1);
      return this.elabTuple([elems[0], { k: 'tuple', elems: rest, from: rest[0].from, to: rest[rest.length - 1].to }], expected, stx);
    }
    const c = this.mkConstInst('Prod.mk');
    return this.elabAppArgs({ ...c, self: null }, null, elems.map((value) => ({ value })), expected, false, stx, null);
  }

  private elabSetLit(elems: Term[], expected: Expr | null, stx: { from: number; to: number }): Expr {
    // {a, b} = {x | x = a ∨ x = b}
    let elemType: Expr | null = null;
    if (expected) {
      const w = this.instantiate(expected);
      if (w.k === 'app' && getAppFn(w).k === 'const' && (getAppFn(w) as { name: string }).name === 'Set') elemType = w.arg;
    }
    const ty = elemType ?? this.newTypeMVar();
    if (elems.length === 0) {
      const c = this.mkConstInst('EmptyCollection.emptyCollection');
      return this.elabAppArgs({ ...c, self: null }, null, [], expected, false, stx, null);
    }
    const d = this.m.mkLocal('x', ty);
    const lam = this.withLocal(d, (x) => {
      let body: Expr | null = null;
      for (let i = elems.length - 1; i >= 0; i--) {
        const v = this.elabTermEnsuring(elems[i], ty);
        const eq = mkAppN(mkConst('Eq', [this.m.inferSortLevel(ty)]), [ty, x, v]);
        body = body ? mkAppN(mkConst('Or'), [eq, body]) : eq;
      }
      return this.m.mkLambdaFVars([d.id], body!);
    });
    const lvl = this.levelOfType(this.m.inferSortLevel(ty), stx);
    return mkAppN(mkConst('setOf', [lvl]), [ty, lam]);
  }

  /* ---------------- binders ---------------- */

  /** Elaborate binder groups, then `body` in the extended context; returns fvar ids too. */
  elabBinders<T>(groups: BinderGroup[], f: (xs: number[]) => T): T {
    const ids: number[] = [];
    const old = this.lctx;
    try {
      for (const g of groups) {
        const t = g.type ? this.elabType(g.type) : null;
        for (const n of g.names) {
          const ty = t ?? this.newTypeMVar();
          const d = this.m.mkLocal(n.name === '_' ? 'x' : n.name, ty, g.bi, undefined, n.name === '_');
          this.m.registerLocal(d);
          this.lctx = this.lctx.push(d);
          ids.push(d.id);
        }
      }
      return f(ids);
    } finally {
      this.lctx = old;
    }
  }

  private elabForall(groups: BinderGroup[], body: Term, stx: { from: number; to: number }): Expr {
    // ∀ x ∈ s, p  ≡  ∀ x, x ∈ s → p
    const expanded = this.expandBinderPreds(groups, body, 'forall');
    return this.elabBinders(expanded.groups, (xs) => {
      const b = this.elabType(expanded.body);
      this.synthesizePostponed();
      this.checkBinderTypesKnown(xs, stx);
      return this.m.mkForallFVars(xs, b);
    });
  }

  private checkBinderTypesKnown(xs: number[], stx: { from: number; to: number }): void {
    for (const x of xs) {
      const t = this.instantiate(this.m.fvarDecl(x).type);
      if (t.k === 'mvar') {
        // the type may still be determined later by unification; Lean reports at the end
        void stx;
      }
    }
  }

  private expandBinderPreds(groups: BinderGroup[], body: Term, kind: 'forall' | 'exists'): { groups: BinderGroup[]; body: Term } {
    const g = groups[0];
    if (!g || !g.pred) return { groups, body };
    // `∀ x y ∈ s, p` → ∀ x, x ∈ s → ∀ y, y ∈ s → p
    let newBody = body;
    for (let i = g.names.length - 1; i >= 0; i--) {
      const n = g.names[i];
      const predTerm: Term = {
        k: 'binop',
        op: g.pred.op,
        lhs: { k: 'ident', name: n.name, from: n.from, to: n.to },
        rhs: g.pred.rhs,
        opFrom: n.to,
        from: n.from,
        to: g.pred.rhs.to,
      };
      const inner: Term =
        kind === 'forall'
          ? { k: 'arrow', dom: predTerm, cod: newBody, from: g.from, to: body.to }
          : { k: 'binop', op: '∧', lhs: predTerm, rhs: newBody, opFrom: g.to, from: g.from, to: body.to };
      if (i === 0) {
        newBody = inner;
        return { groups: [{ ...g, names: [n], pred: undefined }], body: newBody };
      }
      newBody = {
        k: kind,
        binders: [{ names: [n], type: g.type, bi: 'default', from: n.from, to: n.to }],
        body: inner,
        from: n.from,
        to: body.to,
      } as Term;
    }
    return { groups, body };
  }

  private elabExists(groups: BinderGroup[], body: Term, stx: { from: number; to: number }): Expr {
    const expanded = this.expandBinderPreds(groups, body, 'exists');
    const flat: { name: string; type: Term | null; from: number; to: number }[] = [];
    for (const g of expanded.groups) for (const n of g.names) flat.push({ name: n.name, type: g.type, from: n.from, to: n.to });
    const go = (i: number): Expr => {
      if (i >= flat.length) return this.elabType(expanded.body);
      const b = flat[i];
      const ty = b.type ? this.elabType(b.type) : this.newTypeMVar();
      const d = this.m.mkLocal(b.name === '_' ? 'x' : b.name, ty, 'default', undefined, b.name === '_');
      const lam = this.withLocal(d, () => {
        const inner = go(i + 1);
        return this.m.mkLambdaFVars([d.id], inner);
      });
      const u = this.m.inferSortLevel(this.instantiate(ty));
      return mkAppN(mkConst('Exists', [u]), [ty, lam]);
    };
    void stx;
    return go(0);
  }

  private elabFun(stx: Term & { k: 'fun' }, expected: Expr | null): Expr {
    const ids: number[] = [];
    const old = this.lctx;
    let exp: Expr | null = expected ? this.instantiate(expected) : null;
    const patterns: { id: number; pat: Term }[] = [];
    try {
      for (const b of stx.binders) {
        if (b.k === 'pattern') {
          const pi = exp ? this.m.whnfToPi(this.instantiate(exp)) : null;
          const ty = pi ? pi.type : this.newTypeMVar();
          const d = this.m.mkLocal('x', ty, 'default', undefined, true);
          this.m.registerLocal(d);
          this.lctx = this.lctx.push(d);
          ids.push(d.id);
          patterns.push({ id: d.id, pat: b.pat });
          exp = pi ? instantiate1(pi.body, mkFVar(d.id)) : null;
          continue;
        }
        const g = b.group;
        for (const n of g.names) {
          const pi = exp ? this.m.whnfToPi(this.instantiate(exp)) : null;
          let ty: Expr;
          if (g.type) {
            ty = this.elabType(g.type);
            if (pi && !this.isDefEq(pi.type, ty)) {
              // binder type annotation does not match the expected domain
              const e1 = this.pp(pi.type);
              const a1 = this.pp(ty);
              this.error('type-mismatch', `Type mismatch: binder annotation\n  ${a1}\nis not definitionally equal to the expected type\n  ${e1}`, g, { expected: e1, actual: a1 });
            }
          } else ty = pi ? pi.type : this.newTypeMVar();
          const bi: BinderInfo = g.bi === 'default' && pi && pi.bi === 'strict' ? 'default' : g.bi;
          const d = this.m.mkLocal(n.name === '_' ? 'x' : n.name, ty, bi, undefined, n.name === '_');
          this.m.registerLocal(d);
          this.lctx = this.lctx.push(d);
          ids.push(d.id);
          exp = pi ? instantiate1(pi.body, mkFVar(d.id)) : null;
        }
      }
      let body: Expr;
      if (patterns.length > 0) {
        if (!matchElab) throw new Error('match elaborator not loaded');
        const bodyType = exp ?? this.newTypeMVar();
        const alt: MatchAlt = { pats: patterns.map((p) => p.pat), rhs: stx.body, from: stx.from, to: stx.to };
        body = matchElab(this, patterns.map((p) => mkFVar(p.id)), [alt], bodyType, stx);
      } else {
        body = this.elabTermEnsuring(stx.body, exp);
      }
      return this.m.mkLambdaFVars(ids, body);
    } finally {
      this.lctx = old;
    }
  }

  private elabFunMatch(alts: MatchAlt[], expected: Expr, stx: { from: number; to: number }): Expr {
    if (!matchElab) throw new Error('match elaborator not loaded');
    const n = alts[0]?.pats.length ?? 1;
    const ids: number[] = [];
    const old = this.lctx;
    let exp = this.instantiate(expected);
    try {
      for (let i = 0; i < n; i++) {
        const pi = this.m.whnfToPi(exp);
        if (!pi) this.error('other', 'too many patterns for the expected type', stx);
        const d = this.m.mkLocal('x', pi.type, 'default', undefined, true);
        this.m.registerLocal(d);
        this.lctx = this.lctx.push(d);
        ids.push(d.id);
        exp = instantiate1(pi.body, mkFVar(d.id));
      }
      const body = matchElab(this, ids.map(mkFVar), alts, exp, stx);
      return this.m.mkLambdaFVars(ids, body);
    } finally {
      this.lctx = old;
    }
  }

  /* ---------------- operators ---------------- */

  private elabBinop(stx: Term & { k: 'binop' }, expected: Expr | null): Expr {
    const op = stx.op;
    const opRange = { from: stx.opFrom, to: stx.opFrom + op.length };
    if (op === '∈' || op === '∉') {
      const c = this.mkConstInst('Membership.mem');
      // Membership.mem s x  for  x ∈ s : elaborate the set first, then the element
      const t = this.inferType(c.e);
      void t;
      const mem = this.elabAppArgs({ ...c, self: null }, null, [{ value: stx.rhs }, { value: stx.lhs }], mkSort(lzero), false, stx, null);
      return op === '∈' ? mem : mkApp(mkConst('Not'), mem);
    }
    if (op === '▸') return this.elabSubst(stx.lhs, stx.rhs, expected, stx);
    if (op === '<|') return this.elabTerm({ k: 'app', fn: stx.lhs, args: [{ value: stx.rhs }], from: stx.from, to: stx.to }, expected);
    if (op === '|>') return this.elabTerm({ k: 'app', fn: stx.rhs, args: [{ value: stx.lhs }], from: stx.from, to: stx.to }, expected);
    const name = BINOP_CONST[op];
    if (!name) this.error('parse', `unsupported operator '${op}'`, opRange);
    if (!this.env.has(name)) this.error('unknown-identifier', `Unknown constant \`${name}\``, opRange, { name });
    const c = this.mkConstInst(name);
    return this.elabAppArgs({ ...c, self: null }, null, [{ value: stx.lhs }, { value: stx.rhs }], expected, false, stx, null);
  }

  private elabUnop(stx: Term & { k: 'unop' }, expected: Expr | null): Expr {
    switch (stx.op) {
      case '¬': {
        const p = this.elabTermEnsuring(stx.arg, mkSort(lzero));
        return mkApp(mkConst('Not'), p);
      }
      case 'ᶜ': {
        const c = this.mkConstInst('Set.compl');
        return this.elabAppArgs({ ...c, self: null }, null, [{ value: stx.arg }], expected, false, stx, null);
      }
      default:
        return this.error('other', `unsupported operator '${stx.op}'`, stx);
    }
  }

  /** `h ▸ e`: rewrite the expected type with `h : a = b` (either direction). */
  private elabSubst(hStx: Term, eStx: Term, expected: Expr | null, stx: { from: number; to: number }): Expr {
    const h = this.elabTerm(hStx, null);
    this.synthesizePostponed();
    const ht = this.whnf(this.inferType(h));
    if (!(ht.k === 'app' && getAppFn(ht).k === 'const' && (getAppFn(ht) as { name: string }).name === 'Eq' && getAppArgs(ht).length === 3)) {
      this.error('other', `invalid \`▸\` notation, argument\n  ${this.pp(h)}\nhas type\n  ${this.pp(ht)}\nequality expected`, hStx);
    }
    const [alpha, a, b] = getAppArgs(ht);
    const u = (getAppFn(ht) as { levels: readonly Level[] }).levels[0];
    const tryDir = (target: Expr, from: Expr, to: Expr, proof: Expr): Expr | null => {
      // target mentions `to`: motive x ↦ target[to := x]; need e : target[to := from]
      const abs = this.abstractExpr(target, to);
      if (!abs) return null;
      const d = this.m.mkLocal('x', alpha);
      const motiveBody = instantiate1(abs, mkFVar(d.id));
      const motive = this.m.mkLambdaFVars([d.id], motiveBody);
      const need = this.instantiate(instantiate1(abs, from));
      const eVal = this.elabTermEnsuring(eStx, need);
      // @Eq.ndrec α from motive e to proof
      const v = this.m.inferSortLevel(target);
      return mkAppN(mkConst('Eq.ndrec', [v, u]), [alpha, from, motive, eVal, to, proof]);
    };
    if (expected) {
      const exp = this.instantiate(expected);
      const r1 = tryDir(exp, a, b, h);
      if (r1) return r1;
      const symm = mkAppN(mkConst('Eq.symm', [u]), [alpha, a, b, h]);
      const r2 = tryDir(exp, b, a, symm);
      if (r2) return r2;
    }
    // no expected type: rewrite the type of e
    const e = this.elabTerm(eStx, null);
    this.synthesizePostponed();
    const et = this.instantiate(this.inferType(e));
    const abs = this.abstractExpr(et, a);
    if (!abs) this.error('other', `invalid \`▸\` notation, failed to rewrite\n  ${this.pp(et)}\nusing\n  ${this.pp(ht)}`, stx);
    const d = this.m.mkLocal('x', alpha);
    const motive = this.m.mkLambdaFVars([d.id], instantiate1(abs, mkFVar(d.id)));
    return mkAppN(mkConst('Eq.ndrec', [this.m.inferSortLevel(et), u]), [alpha, a, motive, e, b, h]);
  }

  /** Abstract occurrences of `p` in `e` (syntactic up to instantiation); null if none. */
  abstractExpr(e: Expr, p: Expr): Expr | null {
    const pi = this.instantiate(p);
    let found = false;
    const go = (x: Expr, off: number): Expr => {
      if (x.lb === 0 && this.syntacticEq(x, pi)) {
        found = true;
        return { k: 'bvar', idx: off, lb: off + 1, fv: false, mv: false, lmv: false, lp: false } as Expr;
      }
      switch (x.k) {
        case 'app':
          return mkApp(go(x.fn, off), go(x.arg, off));
        case 'lam':
          return mkLam(x.name, go(x.type, off), go(x.body, off + 1), x.bi);
        case 'pi':
          return mkPi(x.name, go(x.type, off), go(x.body, off + 1), x.bi);
        default:
          return x;
      }
    };
    const r = go(this.instantiate(e), 0);
    return found ? r : null;
  }

  syntacticEq(a: Expr, b: Expr): boolean {
    if (a === b) return true;
    if (a.k !== b.k) return false;
    const m = this.m.mark();
    const ok = this.m.withTransparency('reducible', () => this.isDefEq(a, b));
    if (!ok) this.m.rollback(m);
    return ok;
  }

  /* ---------------- by / have / calc ---------------- */

  private elabBy(stx: Term & { k: 'by' }, expected: Expr | null): Expr {
    if (!this.opts.trusted && this.opts.allowedTactics && this.opts.allowedTactics.size === 0) {
      this.error('mode', 'This level asks for a term-mode proof: `by` is not available here. Write the proof term directly.', { from: stx.from, to: stx.from + 2 });
    }
    const t = expected ?? this.newTypeMVar();
    const mv = this.newMVar(t, 'opaque');
    this.pending.push({ mvarId: (mv as { id: number }).id, seq: stx.tactics, lctx: this.lctx, byFrom: stx.from, byTo: stx.to });
    return mv;
  }

  private elabHave(stx: Term & { k: 'have' }, expected: Expr | null): Expr {
    let type: Expr | null = null;
    let valStx = stx.value;
    if (stx.binders.length > 0) {
      const fn: Term = { k: 'fun', binders: stx.binders.map((g) => ({ k: 'group' as const, group: g })), body: stx.value, from: stx.value.from, to: stx.value.to };
      if (stx.type) {
        const pi: Term = { k: 'forall', binders: stx.binders, body: stx.type, from: stx.type.from, to: stx.type.to };
        type = this.elabType(pi);
      }
      valStx = fn;
    } else if (stx.type) type = this.elabType(stx.type);
    const v = this.elabTermEnsuring(valStx, type);
    this.synthesize();
    const ty = type ?? this.instantiate(this.inferType(v));
    if (stx.pat) {
      if (!matchElab) throw new Error('match elaborator not loaded');
      const exp = expected ?? this.newTypeMVar();
      const d = this.m.mkLocal('x', ty, 'default', undefined, true);
      const body = this.withLocal(d, (x) => {
        const alt: MatchAlt = { pats: [stx.pat!], rhs: stx.body, from: stx.from, to: stx.to };
        return this.m.mkLambdaFVars([d.id], matchElab!(this, [x], [alt], exp, stx));
      });
      return mkApp(body, v);
    }
    const d = this.m.mkLocal(stx.name ?? 'this', ty);
    const fn = this.withLocal(d, () => {
      const b = this.elabTermEnsuring(stx.body, expected);
      return this.m.mkLambdaFVars([d.id], b);
    });
    return mkApp(fn, v);
  }

  elabCalc(steps: { rel: Term; proof: Term; from: number; to: number }[], expected: Expr | null, stx: { from: number; to: number }): Expr {
    let acc: { proof: Expr; rel: Expr } | null = null;
    let prevRhs: Expr | null = null;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      let relStx = s.rel;
      let rel: Expr;
      if (prevRhs && relStx.k === 'binop' && relStx.lhs.k === 'hole') {
        // `_ = c`: the hole is the previous right-hand side
        const hole = this.newMVar(this.instantiate(this.inferType(prevRhs)));
        rel = this.elabType(relStx);
        const parts = this.relParts(rel);
        if (parts) this.isDefEq(parts.lhs, prevRhs);
        void hole;
      } else {
        rel = this.elabType(relStx);
      }
      this.synthesizePostponed();
      relStx = s.rel;
      const parts = this.relParts(rel);
      if (!parts) this.error('other', `invalid 'calc' step, relation expected\n  ${this.pp(rel)}`, s.rel);
      if (prevRhs && !this.isDefEq(parts.lhs, prevRhs)) {
        this.error(
          'type-mismatch',
          `invalid 'calc' step, left-hand side is\n  ${this.pp(parts.lhs)}\nbut previous right-hand side is\n  ${this.pp(prevRhs)}`,
          s.rel,
        );
      }
      const p = this.elabTermEnsuring(s.proof, rel);
      this.synthesize();
      if (!acc) acc = { proof: p, rel };
      else acc = this.calcTrans(acc, { proof: p, rel }, s);
      prevRhs = parts.rhs;
    }
    if (!acc) this.error('other', 'empty calc', stx);
    if (expected) this.ensureHasType(expected, acc.proof, stx);
    return acc.proof;
  }

  relParts(rel: Expr): { head: string; lhs: Expr; rhs: Expr; args: Expr[] } | null {
    const r = this.instantiate(rel);
    if (r.k === 'pi' && !hasLooseBVar(r.body, 0)) return { head: '→', lhs: r.type, rhs: r.body, args: [] };
    const f = getAppFn(r);
    const args = getAppArgs(r);
    if (f.k !== 'const' || args.length < 2) return null;
    return { head: f.name, lhs: args[args.length - 2], rhs: args[args.length - 1], args };
  }

  private calcTrans(a: { proof: Expr; rel: Expr }, b: { proof: Expr; rel: Expr }, r: { from: number; to: number }): { proof: Expr; rel: Expr } {
    const pa = this.relParts(a.rel)!;
    const pb = this.relParts(b.rel)!;
    const mk = (name: string, args: Expr[]): Expr => {
      const c = this.mkConstInst(name);
      return this.elabAppArgsExprs(c.e, c.type, args);
    };
    if (pa.head === 'Eq' && pb.head === 'Eq') {
      const proof = mk('Eq.trans', [a.proof, b.proof]);
      return { proof, rel: this.instantiate(this.inferType(proof)) };
    }
    if (pa.head === 'Eq') {
      // a = b, R b c ⊢ R a c  via  ▸
      const abs = this.abstractExpr(b.rel, pa.rhs);
      if (abs) {
        const alpha = this.inferType(pa.lhs);
        const d = this.m.mkLocal('x', alpha);
        const motive = this.m.mkLambdaFVars([d.id], instantiate1(abs, mkFVar(d.id)));
        const symm = mk('Eq.symm', [a.proof]);
        const proof = mkAppN(mkConst('Eq.ndrec', [lzero, this.m.inferSortLevel(alpha)]), [alpha, pa.rhs, motive, b.proof, pa.lhs, symm]);
        return { proof, rel: this.instantiate(instantiate1(abs, pa.lhs)) };
      }
    }
    if (pb.head === 'Eq') {
      const abs = this.abstractExpr(a.rel, pb.lhs);
      if (abs) {
        const alpha = this.inferType(pb.lhs);
        const d = this.m.mkLocal('x', alpha);
        const motive = this.m.mkLambdaFVars([d.id], instantiate1(abs, mkFVar(d.id)));
        const proof = mkAppN(mkConst('Eq.ndrec', [lzero, this.m.inferSortLevel(alpha)]), [alpha, pb.lhs, motive, a.proof, pb.rhs, b.proof]);
        return { proof, rel: this.instantiate(instantiate1(abs, pb.rhs)) };
      }
    }
    const transNames: Record<string, string> = {
      Iff: 'Iff.trans',
      'Nat.le': 'Nat.le_trans',
      'Nat.lt': 'Nat.lt_trans',
      'HasSubset.Subset': 'Set.Subset.trans',
    };
    if (pa.head === pb.head && transNames[pa.head] && this.env.has(transNames[pa.head])) {
      const proof = mk(transNames[pa.head], [a.proof, b.proof]);
      return { proof, rel: this.instantiate(this.inferType(proof)) };
    }
    if (pa.head === '→' && pb.head === '→') {
      const d = this.m.mkLocal('h', pa.lhs);
      const body = mkApp(b.proof, mkApp(a.proof, mkFVar(d.id)));
      const proof = this.m.mkLambdaFVars([d.id], body);
      return { proof, rel: this.instantiate(this.inferType(proof)) };
    }
    this.error('other', `invalid 'calc' step, failed to compose relations\n  ${this.pp(a.rel)}\nand\n  ${this.pp(b.rel)}`, r);
  }

  /** Apply a function to already-elaborated explicit arguments (inserting implicits). */
  elabAppArgsExprs(fn: Expr, fnType: Expr, args: Expr[]): Expr {
    let e = fn;
    let t = fnType;
    const rest = [...args];
    while (rest.length > 0) {
      if (t.k !== 'pi') t = this.whnf(t);
      if (t.k !== 'pi') throw new ElabError('function-expected', 'function expected', 0, 0);
      let arg: Expr;
      if (t.bi === 'default') {
        arg = rest.shift()!;
        if (!this.isDefEq(this.inferType(arg), this.instantiate(t.type))) {
          throw new ElabError('type-mismatch', `Application type mismatch: The argument\n  ${this.pp(arg)}\nhas type\n  ${this.pp(this.inferType(arg))}\nbut is expected to have type\n  ${this.pp(t.type)}`, 0, 0);
        }
      } else arg = this.newMVar(this.instantiate(t.type));
      e = mkApp(e, arg);
      t = instantiate1(t.body, arg);
    }
    return e;
  }

  /* ---------------- misc ---------------- */

  /** Run `f`, converting meta/timeouts into elaboration errors at range `r`. */
  guard<T>(r: { from: number; to: number }, f: () => T): T {
    try {
      return f();
    } catch (e) {
      if (e instanceof TimeoutError) throw new ElabError('timeout', e.message, r.from, r.to);
      if (e instanceof MetaError) throw new ElabError('other', e.message, r.from, r.to);
      throw e;
    }
  }

  ppGoalsString(ids: number[]): string {
    return goalsToString(this.ppGoals(ids));
  }

  tacticAllowed(name: string): boolean {
    if (this.opts.trusted || !this.opts.allowedTactics) return true;
    return this.opts.allowedTactics.has(name);
  }

  /** for Tactic typing convenience */
  static tacticName(t: Tactic): string {
    return t.name;
  }
}
