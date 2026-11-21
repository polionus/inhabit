/**
 * Commands: declarations (`theorem`/`def`/`example`/`axiom`/…), `inductive`/`structure`,
 * `#check`/`#eval`/`#reduce`/`#print`, scoping (`namespace`, `section`, `open`, `variable`,
 * `universe`), and the equation compiler for definitions by pattern matching.
 *
 * Every declaration is elaborated, then re-checked by the kernel before it enters the
 * environment.
 */
import type { Expr } from '../kernel/expr.ts';
import {
  collectFVars,
  exprEq,
  forEachExpr,
  getAppArgs,
  getAppFn,
  instantiate1,
  mkAppN,
  mkConst,
  mkFVar,
  mkSort,
  replace,
} from '../kernel/expr.ts';
import type { Level } from '../kernel/level.ts';
import { collectLevelParams, lsucc, lzero } from '../kernel/level.ts';
import type { ConstDecl, Environment, MatchAlt as KMatchAlt, Pat, Reducibility } from '../kernel/env.ts';
import { addInductive } from '../kernel/inductive.ts';
import { Fuel, TimeoutError } from '../kernel/reduce.ts';
import { KernelError, TypeChecker } from '../kernel/typecheck.ts';
import { MetaError } from '../meta/meta.ts';
import { Printer, goalsToString } from '../pp/print.ts';
import type { BinderGroup, Command, MatchAlt, Term } from '../syntax/ast.ts';
import type { DeclInfo, DeclKind, Diagnostic, TacticStep } from '../types.ts';
import { ElabError } from './errors.ts';
import type { ElabOptions, Scope, TacticBlockInfo } from './term.ts';
import { Elab } from './term.ts';

export interface ProcessResult {
  env: Environment;
  diagnostics: Diagnostic[];
  steps: TacticStep[];
  decls: DeclInfo[];
  tacticBlocks: TacticBlockInfo[];
}

interface ScopeFrame {
  kind: 'root' | 'namespace' | 'section';
  name: string | null;
  scope: Scope;
}

export const DEFAULT_FUEL = 400_000;

export class CommandElab {
  env: Environment;
  readonly src: string;
  readonly opts: ElabOptions;
  readonly fuelPerDecl: number;
  diagnostics: Diagnostic[] = [];
  steps: TacticStep[] = [];
  decls: DeclInfo[] = [];
  tacticBlocks: TacticBlockInfo[] = [];
  private frames: ScopeFrame[];

  constructor(env: Environment, src: string, opts: ElabOptions, fuel = DEFAULT_FUEL) {
    this.env = env;
    this.src = src;
    this.opts = opts;
    this.fuelPerDecl = fuel;
    this.frames = [{ kind: 'root', name: null, scope: { namespace: '', opens: [], universes: [], variables: [] } }];
  }

  get scope(): Scope {
    return this.frames[this.frames.length - 1].scope;
  }

  private pushFrame(kind: 'namespace' | 'section', name: string | null): void {
    const s = this.scope;
    const ns = kind === 'namespace' && name ? (s.namespace ? `${s.namespace}.${name}` : name) : s.namespace;
    const opens = [...s.opens];
    if (kind === 'namespace' && name) {
      // inside `namespace A.B`, names in A and A.B are visible
      const parts = ns.split('.');
      for (let i = 1; i <= parts.length; i++) {
        const p = parts.slice(0, i).join('.');
        if (!opens.includes(p)) opens.push(p);
      }
    }
    this.frames.push({ kind, name, scope: { namespace: ns, opens, universes: [...s.universes], variables: [...s.variables] } });
  }

  private newElab(): Elab {
    const el = new Elab(this.env, { ...this.scope }, this.src, this.opts);
    el.m.fuel.n = this.fuelPerDecl;
    return el;
  }

  private collect(el: Elab): void {
    for (const d of el.diags) this.diagnostics.push(d);
    this.steps.push(...el.steps);
    this.tacticBlocks.push(...el.tacticBlocks);
  }

  private error(code: Diagnostic['code'], message: string, r: { from: number; to: number }, data?: Diagnostic['data']): void {
    const d: Diagnostic = { severity: 'error', code, message, from: r.from, to: r.to };
    if (data) d.data = data;
    this.diagnostics.push(d);
  }

  private info(message: string, r: { from: number; to: number }): void {
    this.diagnostics.push({ severity: 'info', code: 'command-output', message, from: r.from, to: r.to });
  }

  /* ---------------- dispatch ---------------- */

  run(commands: Command[]): void {
    for (const cmd of commands) {
      try {
        this.command(cmd);
      } catch (e) {
        const r = { from: cmd.from, to: cmd.to };
        if (e instanceof ElabError) this.diagnostics.push(e.toDiagnostic());
        else if (e instanceof TimeoutError) this.error('timeout', e.message, r);
        else if (e instanceof KernelError) this.error('other', `(kernel) ${e.message}`, r);
        else if (e instanceof MetaError) this.error('other', e.message, r);
        else this.error('other', `internal error: ${e instanceof Error ? e.message : String(e)}`, r);
      }
    }
  }

  private command(cmd: Command): void {
    switch (cmd.k) {
      case 'decl':
        this.decl(cmd);
        return;
      case 'inductive':
        this.inductive(cmd);
        return;
      case 'structure':
        this.structure(cmd);
        return;
      case 'check':
      case 'checkFailure':
        this.check(cmd as TermCmd);
        return;
      case 'eval':
      case 'reduce':
        this.evalCmd(cmd as TermCmd);
        return;
      case 'print':
        this.print(cmd);
        return;
      case 'open': {
        for (const n of cmd.names) {
          const full = this.resolveNamespace(n.name);
          if (!full) {
            this.error('unknown-identifier', `unknown namespace '${n.name}'`, n, { name: n.name });
            continue;
          }
          if (cmd.inCmd) continue;
          if (!this.scope.opens.includes(full)) this.scope.opens.push(full);
        }
        if (cmd.inCmd) {
          const saved = this.scope.opens;
          this.scope.opens = [...saved, ...cmd.names.map((n) => this.resolveNamespace(n.name) ?? n.name)];
          try {
            this.command(cmd.inCmd);
          } finally {
            this.scope.opens = saved;
          }
        }
        return;
      }
      case 'namespace':
        this.pushFrame('namespace', cmd.name);
        return;
      case 'section':
        this.pushFrame('section', cmd.name);
        return;
      case 'end': {
        const top = this.frames[this.frames.length - 1];
        if (top.kind === 'root') {
          this.error('other', 'invalid `end`, there is no open namespace or section', cmd);
          return;
        }
        const expected = top.kind === 'namespace' ? top.name : top.name;
        if ((cmd.name ?? null) !== (expected ?? null) && !(top.kind === 'namespace' && cmd.name && top.name && top.name.endsWith(cmd.name))) {
          this.error('other', `invalid 'end', name is missing (expected ${expected ?? 'nothing'})`, cmd);
        }
        this.frames.pop();
        return;
      }
      case 'variable': {
        // check that the binders elaborate
        const el = this.newElab();
        try {
          el.elabBinders([...this.scope.variables, ...cmd.binders], () => undefined);
          this.scope.variables.push(...cmd.binders);
        } catch (e) {
          if (e instanceof ElabError) this.diagnostics.push(e.toDiagnostic());
          else throw e;
        }
        return;
      }
      case 'universe':
        for (const n of cmd.names) if (!this.scope.universes.includes(n)) this.scope.universes.push(n);
        return;
      case 'attribute':
      case 'skip':
        return;
    }
  }

  private resolveNamespace(name: string): string | null {
    const s = this.scope;
    const cands = [];
    if (s.namespace) {
      const parts = s.namespace.split('.');
      for (let i = parts.length; i > 0; i--) cands.push(parts.slice(0, i).join('.') + '.' + name);
    }
    cands.push(name);
    for (const c of cands) if (this.env.isNamespace(c) || this.env.has(c)) return c;
    return null;
  }

  /* ---------------- declarations ---------------- */

  private fullName(name: string): string {
    if (name.startsWith('_root_.')) return name.slice(7);
    return this.scope.namespace ? `${this.scope.namespace}.${name}` : name;
  }

  private universeOrder(el: Elab, exprs: Expr[]): string[] {
    const used = new Set<string>();
    for (const e of exprs) {
      forEachExpr(e, (x) => {
        if (!x.lp) return false;
        if (x.k === 'sort') collectLevelParams(x.level, used);
        if (x.k === 'const') for (const l of x.levels) collectLevelParams(l, used);
        return undefined;
      });
    }
    const order: string[] = [];
    for (const u of this.scope.universes) if (used.has(u)) order.push(u);
    for (const u of el.levelNames) if (used.has(u) && !order.includes(u)) order.push(u);
    for (const u of used) if (!order.includes(u)) order.push(u);
    return order;
  }

  /** Report remaining metavariables; returns true when everything is assigned. */
  private checkNoMVars(el: Elab, e: Expr, r: { from: number; to: number }): boolean {
    const ids = el.m.unassignedMVars(e);
    if (ids.length === 0) return true;
    if (el.hadError) return false; // a consequence of an error already reported
    for (const id of ids) {
      const d = el.m.decl(id);
      const hole = el.naturalHoles.find((h) => h.id === id);
      const ctx = goalsToString([
        {
          hyps: el.m.decl(id).lctx.decls.filter((x) => !x.hidden).map((x) => ({ names: [x.userName], type: el.pp(x.type), isProof: false })),
          target: el.pp(d.type),
        },
      ]);
      if (hole) el.report(new ElabError('unification', `don't know how to synthesize placeholder\ncontext:\n${ctx}`, hole.from, hole.to));
      else el.report(new ElabError('unification', `don't know how to synthesize implicit argument\ncontext:\n${ctx}`, r.from, r.to));
      break;
    }
    return false;
  }

  /** Variables from `variable` that are used by the declaration (plus their dependencies). */
  private usedVariableIds(el: Elab, varIds: number[], exprs: Expr[]): number[] {
    const used = new Set<number>();
    for (const e of exprs) collectFVars(el.instantiate(e), used);
    // dependencies: types of used variables
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of varIds) {
        if (!used.has(id)) continue;
        const s = new Set<number>();
        collectFVars(el.instantiate(el.m.fvarDecl(id).type), s);
        for (const x of s) if (!used.has(x)) {
          used.add(x);
          changed = true;
        }
      }
    }
    return varIds.filter((id) => used.has(id));
  }

  private decl(cmd: Extract<Command, { k: 'decl' }>): void {
    if (cmd.kind === 'instance') {
      this.error('other', '`instance` declarations are not supported in this game', { from: cmd.from, to: cmd.nameTo });
      return;
    }
    const isExample = cmd.kind === 'example';
    const name = isExample ? '' : this.fullName(cmd.name!);
    const nameRange = { from: cmd.nameFrom, to: cmd.nameTo };
    if (!isExample && this.env.has(name)) {
      this.error('other', `'${name}' has already been declared`, nameRange);
      return;
    }
    const kind: DeclKind = cmd.kind === 'theorem' ? 'theorem' : cmd.kind === 'axiom' ? 'axiom' : isExample ? 'example' : 'def';
    const el = this.newElab();
    el.levelNames = [];
    const info: DeclInfo = {
      name,
      kind,
      type: '',
      from: cmd.from,
      to: cmd.to,
      ok: false,
      usesSorry: false,
      usedTactics: [],
      usedConstants: [],
      isTacticProof: cmd.body.k === 'term' && cmd.body.term.k === 'by',
    };
    const vars = this.scope.variables;
    let typeC: Expr | null = null;
    let valueC: Expr | undefined;
    let levelParams: string[] = [];
    let matchDef: ConstDecl['matchDef'];
    let bodyTermForInfo: string | undefined;
    let typeOk = false;
    try {
      el.elabBinders([...vars, ...cmd.binders], (allIds) => {
        const nVarIds = countBinderNames(vars);
        const varIds = allIds.slice(0, nVarIds);
        const ownIds = allIds.slice(nVarIds);
        let type: Expr | null = null;
        if (cmd.type) {
          type = el.guard(cmd.type, () => el.elabType(cmd.type!));
          el.synthesize();
        } else if (kind === 'theorem' || kind === 'axiom') {
          throw new ElabError('parse', `expected ':' and a type`, nameRange.from, nameRange.to);
        }
        const finishType = (t: Expr, v: Expr | undefined) => {
          const used = this.usedVariableIds(el, varIds, v ? [t, v] : [t]);
          const ids = [...used, ...ownIds];
          return { ids, t: el.m.mkForallFVars(ids, t), v: v !== undefined ? el.m.mkLambdaFVars(ids, v) : undefined };
        };
        if (type && cmd.body.k === 'none') {
          if (!this.checkNoMVars(el, type, cmd.type ?? nameRange)) throw new SilentFail();
          const f = finishType(type, undefined);
          typeC = f.t;
          typeOk = true;
          return;
        }
        // definitions by pattern matching
        const eqns = this.eqnsOf(cmd, ownIds, el);
        if (eqns) {
          if (!type) throw new ElabError('other', 'definitions by pattern matching need a type', nameRange.from, nameRange.to);
          if (!this.checkNoMVars(el, type, cmd.type!)) throw new SilentFail();
          const ids = [...this.usedVariableIds(el, varIds, [type]), ...ownIds];
          const res = this.compileEqns(el, name || '_example', ids, eqns.fixedCount, type, eqns.alts, cmd, eqns.discrIdx);
          typeC = res.type;
          matchDef = res.matchDef;
          levelParams = res.levelParams;
          typeOk = true;
          bodyTermForInfo = res.display;
          return;
        }
        if (type) {
          if (!this.checkNoMVars(el, type, cmd.type!)) throw new SilentFail();
          typeOk = true;
          const tf = finishType(type, undefined);
          typeC = tf.t;
        }
        const bodyStx = (cmd.body as { term: Term }).term;
        let value: Expr;
        try {
          value = el.guard(bodyStx, () => el.elabTermEnsuring(bodyStx, type));
          el.synthesize();
        } catch (e) {
          if (e instanceof ElabError) {
            el.report(e);
            throw new SilentFail();
          }
          throw e;
        }
        value = el.instantiate(value);
        if (!type) {
          type = el.instantiate(el.inferType(value));
          if (!this.checkNoMVars(el, type, nameRange)) throw new SilentFail();
        }
        if (!this.checkNoMVars(el, value, bodyStx)) throw new SilentFail();
        bodyTermForInfo = el.pp(value);
        const f = finishType(el.instantiate(type), value);
        typeC = f.t;
        valueC = f.v;
        typeOk = true;
      });
    } catch (e) {
      if (e instanceof ElabError) el.report(e);
      else if (e instanceof TimeoutError) el.report(new ElabError('timeout', e.message, cmd.from, cmd.to));
      else if (!(e instanceof SilentFail)) throw e;
    }
    // finalize
    const m = el.m;
    let ok = !el.hadError && typeC !== null;
    if (typeC) {
      typeC = m.instantiateMVars(typeC);
      if (valueC) valueC = m.instantiateMVars(valueC);
      if (!matchDef) {
        const all = valueC ? mkPairForLevels(typeC, valueC) : typeC;
        const { e, params } = m.levelMVarsToParams(all, [...this.scope.universes, ...el.levelNames]);
        if (valueC) {
          [typeC, valueC] = unpairForLevels(e);
        } else typeC = e;
        levelParams = this.universeOrder(el, valueC ? [typeC, valueC] : [typeC]);
        for (const p of params) if (!levelParams.includes(p)) levelParams.push(p);
      }
      if (typeC.mv || (valueC && valueC.mv)) ok = false;
    }
    // kernel check
    if (ok && typeC && !matchDef) {
      try {
        const tc = new TypeChecker(this.env, new Fuel(this.fuelPerDecl * 4), levelParams);
        tc.checkDecl(typeC, valueC);
      } catch (e) {
        ok = false;
        if (e instanceof KernelError) el.report(new ElabError('other', `(kernel) ${e.message}`, cmd.from, cmd.to));
        else if (e instanceof TimeoutError) el.report(new ElabError('timeout', `(kernel) ${e.message}`, cmd.from, cmd.to));
        else throw e;
      }
    }
    const usesSorry = el.usesSorry || (valueC ? mentionsConst(valueC, 'sorryAx') && el.usesSorry : false);
    if (el.usesSorry && !el.hadError) {
      el.warn('sorry', "declaration uses 'sorry'", isExample ? { from: cmd.from, to: cmd.from + 7 } : nameRange);
    }
    info.ok = ok && !el.hadError;
    info.usesSorry = el.usesSorry;
    info.usedTactics = [...el.usedTactics];
    info.usedConstants = [...el.usedConstants].filter((n) => n !== name);
    if (typeC) {
      try {
        info.type = new Printer(m).pp(typeC);
      } catch {
        info.type = '';
      }
    }
    if (bodyTermForInfo !== undefined) info.term = bodyTermForInfo;
    this.collect(el);
    this.decls.push(info);
    // add to the environment (even with errors, like Lean: as an axiom-like sorry'd constant)
    if (!isExample && typeC && typeOk && !typeC.mv) {
      const declKind = kind === 'theorem' ? 'theorem' : kind === 'axiom' ? 'axiom' : 'def';
      const red: Reducibility | undefined =
        cmd.kind === 'abbrev' || cmd.mods.attrs.includes('reducible') ? 'reducible' : cmd.mods.attrs.includes('irreducible') ? 'irreducible' : cmd.mods.attrs.includes('instance') ? 'instance' : undefined;
      const d: ConstDecl = {
        name,
        kind: info.ok || declKind === 'axiom' ? declKind : declKind === 'def' && valueC === undefined && !matchDef ? 'axiom' : declKind,
        levelParams,
        type: typeC,
        value: info.ok ? valueC : declKind === 'def' ? undefined : valueC,
        matchDef: info.ok ? matchDef : undefined,
        reducibility: red,
        height: valueC ? heightOf(this.env, valueC) + 1 : 1,
        doc: cmd.mods.doc,
        userKind: kind === 'theorem' ? 'theorem' : kind === 'axiom' ? 'axiom' : 'def',
        isProtected: cmd.mods.isProtected,
        usesSorry: el.usesSorry || !info.ok,
      };
      if (!info.ok && d.kind === 'def' && !d.value && !d.matchDef) d.kind = 'axiom';
      this.env = this.env.add(d);
    }
  }

  /* ---------------- equation compiler ---------------- */

  /** Recognize `| pats => rhs` bodies and `:= match x, y with …` on parameters. */
  private eqnsOf(cmd: Extract<Command, { k: 'decl' }>, ownIds: number[], el: Elab): { fixedCount: number; alts: MatchAlt[]; discrIdx: number[] | null } | null {
    if (cmd.body.k === 'eqns') return { fixedCount: ownIds.length, alts: cmd.body.alts, discrIdx: null };
    if (cmd.body.k !== 'term') return null;
    const t = cmd.body.term;
    if (t.k !== 'match') return null;
    const names = ownIds.map((id) => el.m.fvarDecl(id).userName);
    const idx: number[] = [];
    for (const d of t.discrs) {
      if (d.k !== 'ident') return null;
      const i = names.lastIndexOf(d.name);
      if (i < 0) return null;
      idx.push(i);
    }
    if (new Set(idx).size !== idx.length) return null;
    // only worth it (and needed) for recursive definitions; otherwise keep the case tree
    const selfName = cmd.name ?? '';
    if (!mentionsIdent(t, selfName)) return null;
    return { fixedCount: Math.min(...idx), alts: t.alts, discrIdx: idx };
  }

  private compileEqns(
    el: Elab,
    name: string,
    ids: number[],
    fixedCount: number,
    type: Expr,
    alts: MatchAlt[],
    cmd: Extract<Command, { k: 'decl' }>,
    discrIdx: number[] | null,
  ): { type: Expr; matchDef: NonNullable<ConstDecl['matchDef']>; levelParams: string[]; display: string } {
    const m = el.m;
    // the parameters after the fixed prefix become pattern positions
    const nOwnStart = ids.length - (ids.length - 0);
    void nOwnStart;
    const fixedIds = ids.slice(0, ids.length - (ids.length - fixedCount) - 0).slice(0, fixedCount + (ids.length - ids.length));
    const varPrefix = ids.length - (cmd.binders.reduce((n, g) => n + g.names.length, 0));
    const fixed = ids.slice(0, varPrefix + fixedCount);
    const patternParams = ids.slice(varPrefix + fixedCount);
    void fixedIds;
    // full type of the constant
    const fullType = m.mkForallFVars(ids, type);
    const { e: fullTypeL, params } = m.levelMVarsToParams(m.instantiateMVars(fullType), [...this.scope.universes, ...el.levelNames]);
    const levelParams = this.universeOrder(el, [fullTypeL]);
    for (const p of params) if (!levelParams.includes(p)) levelParams.push(p);
    // remaining type after the pattern params: telescope `type` for eqns without match
    let resType = type;
    const discrTypes: Expr[] = patternParams.map((id) => m.fvarDecl(id).type);
    const numPats = alts[0]?.pats.length ?? 0;
    const extra: Expr[] = [];
    if (!discrIdx) {
      // `def f : A → B → C | p, q => …`: patterns for the arrows of `type`
      let t = type;
      for (let i = 0; i < numPats; i++) {
        const w = t.k === 'pi' ? t : m.whnf(t);
        if (w.k !== 'pi') throw new ElabError('other', 'too many patterns', alts[0].from, alts[0].to);
        const d = m.mkLocal(w.name.includes('✝') ? 'x' : w.name, w.type, 'default', undefined, true);
        extra.push(mkFVar(d.id));
        discrTypes.push(w.type);
        t = instantiate1(w.body, mkFVar(d.id));
      }
      resType = t;
    }
    // temporary constant for recursive calls
    const tmpDecl: ConstDecl = { name, kind: 'axiom', levelParams, type: fullTypeL, userKind: 'def' };
    const savedEnv = el.m.env;
    const envWithSelf = savedEnv.add(tmpDecl);
    const el2 = new Elab(envWithSelf, el.scope, el.src, el.opts);
    el2.m.fuel.n = el.m.fuel.n;
    el2.levelNames = el.levelNames;
    // share the local declarations of the binders
    for (const [id, d] of el.m.fvars) el2.m.registerLocal(d);
    el2.lctx = el.lctx;
    // pattern positions: params positions (discrIdx order) or extra arrows
    const positions = discrIdx ? discrIdx.map((i) => patternParams[i - fixedCount + 0] ?? patternParams[i]) : [];
    void positions;
    const kalts: KMatchAlt[] = [];
    const rowsForCoverage: Pat[][] = [];
    const recCalls: { altIdx: number; args: Expr[]; subKeys: Set<string>[]; from: number; to: number }[] = [];
    const nPos = discrIdx ? patternParams.length : extra.length;
    alts.forEach((alt, altIdx) => {
      if (alt.pats.length !== (discrIdx ? discrIdx.length : numPats)) {
        throw new ElabError('other', `Incorrect number of patterns: expected ${discrIdx ? discrIdx.length : numPats}`, alt.from, alt.to);
      }
      // patterns per position (non-matched params are variables)
      const patTerms: (Term | null)[] = [];
      for (let i = 0; i < nPos; i++) {
        if (discrIdx) {
          const k = discrIdx.indexOf(i + fixedCount);
          patTerms.push(k >= 0 ? alt.pats[k] : null);
        } else patTerms.push(alt.pats[i]);
      }
      const old = el2.lctx;
      try {
        const patVars: number[] = [];
        const pats: Pat[] = [];
        const patExprs: Expr[] = [];
        const inCtor: Set<number>[] = [];
        for (let i = 0; i < nPos; i++) {
          // type of this position, instantiated with earlier pattern expressions
          let ty = discrIdx ? m.fvarDecl(patternParams[i]).type : discrTypes[i];
          const prevIds = discrIdx ? patternParams.slice(0, i) : (extra.slice(0, i) as Expr[]).map((x) => (x as { id: number }).id);
          ty = replaceFVarsMap(ty, prevIds, patExprs);
          const pt = patTerms[i];
          const ctorVars = new Set<number>();
          let res: { pat: Pat; expr: Expr };
          if (pt === null) {
            const pname = m.fvarDecl(patternParams[i]).userName;
            const d = m.mkLocal(pname, ty);
            el2.m.registerLocal(d);
            el2.lctx = el2.lctx.push(d);
            patVars.push(d.id);
            res = { pat: { k: 'var' }, expr: mkFVar(d.id) };
          } else {
            res = this.elabPattern(el2, pt, ty, patVars, ctorVars, false);
          }
          pats.push(res.pat);
          patExprs.push(res.expr);
          inCtor.push(ctorVars);
        }
        rowsForCoverage.push(pats);
        // expected type of the right-hand side
        let rt = resType;
        if (discrIdx) rt = replaceFVarsMap(rt, patternParams, patExprs);
        else rt = replaceFVarsMap(rt, extra.map((x) => (x as { id: number }).id), patExprs);
        const rhs = el2.elabTermEnsuring(alt.rhs, el2.instantiate(rt));
        el2.synthesize();
        const rhsI = el2.instantiate(rhs);
        if (el2.hadError) throw new SilentFail();
        if (!this.checkNoMVars(el2, rhsI, alt.rhs)) throw new SilentFail();
        // collect recursive calls
        const visit = (x: Expr): void => {
          if (!mentionsConst(x, name)) return;
          if (x.k === 'app' || x.k === 'const') {
            const f = getAppFn(x);
            const args = getAppArgs(x);
            if (f.k === 'const' && f.name === name) {
              recCalls.push({ altIdx, args, subKeys: patExprs.map((pe) => properSubtermKeys(this.env, pe)), from: alt.rhs.from, to: alt.rhs.to });
            } else visit(f);
            for (const a of args) visit(a);
            return;
          }
          if (x.k === 'lam' || x.k === 'pi') {
            visit(x.type);
            visit(x.body);
          } else if (x.k === 'let') {
            visit(x.type);
            visit(x.value);
            visit(x.body);
          }
        };
        visit(rhsI);
        // closed alternative: λ fixed patVars, rhs ; its type for the kernel
        const lam = el2.m.mkLambdaFVars([...fixed, ...patVars], rhsI);
        const altType = el2.m.mkForallFVars([...fixed, ...patVars], el2.instantiate(rt));
        kalts.push({ pats, rhs: lam, numVars: patVars.length, ...{ type: altType } } as KMatchAlt & { type: Expr });
      } finally {
        el2.lctx = old;
      }
    });
    // coverage
    const missing = findMissing(this.env, rowsForCoverage, nPos);
    if (missing) {
      throw new ElabError('other', `Missing cases:\n${missing}`, cmd.nameFrom, cmd.nameTo);
    }
    // structural recursion: find a decreasing position
    if (recCalls.length > 0) {
      let found = -1;
      for (let i = 0; i < nPos && found < 0; i++) {
        const pos = fixed.length + i;
        const ok = recCalls.every((rc) => {
          const a = rc.args[pos];
          if (a === undefined) return false;
          const k = termKey(this.env, el2.instantiate(a));
          return k !== null && rc.subKeys[i].has(k);
        });
        if (ok) found = i;
      }
      if (found < 0) {
        const rc = recCalls[0];
        throw new ElabError(
          'other',
          `fail to show termination for\n  ${name}\nstructural recursion cannot be used: every recursive call must be on a variable that is a strict sub-pattern of the same argument (e.g. \`${name} n\` in the case \`n + 1\`)`,
          rc.from,
          rc.to,
        );
      }
    }
    // level mvars → params inside alternatives; kernel-check each alternative
    const finalAlts: KMatchAlt[] = [];
    const tc = new TypeChecker(envWithSelf, new Fuel(this.fuelPerDecl * 4), levelParams);
    for (const a of kalts as (KMatchAlt & { type: Expr })[]) {
      const pair = el2.m.levelMVarsToParams(mkPairForLevels(el2.m.instantiateMVars(a.type), el2.m.instantiateMVars(a.rhs)), [...levelParams]);
      const [ty, rhs] = unpairForLevels(pair.e);
      if (ty.mv || rhs.mv) throw new ElabError('unification', 'could not infer all implicit arguments of the definition', cmd.from, cmd.to);
      try {
        tc.checkDecl(ty, rhs);
      } catch (e) {
        if (e instanceof KernelError) throw new ElabError('other', `(kernel) ${e.message}`, cmd.from, cmd.to);
        throw e;
      }
      finalAlts.push({ pats: a.pats, rhs, numVars: a.numVars });
    }
    for (const d of el2.diags) el.diags.push(d);
    el.steps.push(...el2.steps);
    el.tacticBlocks.push(...el2.tacticBlocks);
    for (const c of el2.usedConstants) el.usedConstants.add(c);
    for (const t of el2.usedTactics) el.usedTactics.add(t);
    if (el2.usesSorry) el.usesSorry = true;
    const display = alts.map((a) => `| ${a.pats.map((p) => this.src.slice(p.from, p.to)).join(', ')} => ${this.src.slice(a.rhs.from, a.rhs.to)}`).join('\n');
    return {
      type: fullTypeL,
      matchDef: { numFixed: fixed.length, arity: fixed.length + nPos, alts: finalAlts },
      levelParams,
      display,
    };
  }

  /** Elaborate a pattern against type `ty`, introducing pattern variables (in order). */
  private elabPattern(el: Elab, t: Term, ty: Expr, vars: number[], ctorVars: Set<number>, insideCtor: boolean): { pat: Pat; expr: Expr } {
    const m = el.m;
    const addVar = (name: string, inaccessible: boolean): Expr => {
      const d = m.mkLocal(name, ty, 'default', undefined, inaccessible);
      el.m.registerLocal(d);
      el.lctx = el.lctx.push(d);
      vars.push(d.id);
      if (insideCtor) ctorVars.add(d.id);
      return mkFVar(d.id);
    };
    switch (t.k) {
      case 'paren':
        return this.elabPattern(el, t.term, ty, vars, ctorVars, insideCtor);
      case 'hole':
        return { pat: { k: 'var' }, expr: addVar('x', true) };
      case 'num': {
        const w = m.whnf(ty);
        if (!(w.k === 'const' && w.name === 'Nat')) throw new ElabError('type-mismatch', `numeral pattern for a non-Nat type`, t.from, t.to);
        return { pat: { k: 'lit', value: t.value }, expr: { k: 'lit', value: t.value, lb: 0, fv: false, mv: false, lmv: false, lp: false } as Expr };
      }
      case 'ident': {
        const full = el.resolveGlobal(t.name);
        if (full && this.env.get(full)?.ctor) return this.elabCtorPattern(el, full, [], ty, vars, ctorVars, insideCtor, t);
        return { pat: { k: 'var' }, expr: addVar(t.name, false) };
      }
      case 'dotIdent': {
        const w = m.whnf(ty);
        const h = getAppFn(w);
        if (h.k !== 'const') throw new ElabError('other', 'invalid dotted pattern', t.from, t.to);
        return this.elabCtorPattern(el, `${h.name}.${t.name}`, [], ty, vars, ctorVars, insideCtor, t);
      }
      case 'app': {
        let cname: string | null = null;
        if (t.fn.k === 'ident') cname = el.resolveGlobal(t.fn.name);
        else if (t.fn.k === 'dotIdent') {
          const h = getAppFn(m.whnf(ty));
          if (h.k === 'const') cname = `${h.name}.${t.fn.name}`;
        }
        if (!cname || !this.env.get(cname)?.ctor) throw new ElabError('other', `Invalid pattern: constructor expected`, t.fn.from, t.fn.to);
        return this.elabCtorPattern(el, cname, t.args.map((a) => a.value), ty, vars, ctorVars, insideCtor, t);
      }
      case 'anon': {
        const h = getAppFn(m.whnf(ty));
        const ind = h.k === 'const' ? this.env.get(h.name)?.ind : undefined;
        if (!ind || ind.ctors.length !== 1) throw new ElabError('other', 'Invalid `⟨...⟩` pattern', t.from, t.to);
        return this.elabCtorPattern(el, ind.ctors[0], t.elems, ty, vars, ctorVars, insideCtor, t);
      }
      case 'binop': {
        if (t.op === '+' && t.rhs.k === 'num') {
          let k = t.rhs.value;
          if (k === 0n) return this.elabPattern(el, t.lhs, ty, vars, ctorVars, insideCtor);
          const inner = this.elabPattern(el, t.lhs, ty, vars, ctorVars, true);
          let pat = inner.pat;
          let expr = inner.expr;
          while (k > 0n) {
            pat = { k: 'ctor', name: 'Nat.succ', numParams: 0, args: [pat] };
            k--;
          }
          expr = mkAppN(mkConst('Nat.add'), [expr, { k: 'lit', value: t.rhs.value, lb: 0, fv: false, mv: false, lmv: false, lp: false } as Expr]);
          return { pat, expr };
        }
        throw new ElabError('other', 'Invalid pattern', t.from, t.to);
      }
      default:
        throw new ElabError('other', `Invalid pattern: \`${this.src.slice(t.from, t.to)}\``, t.from, t.to);
    }
  }

  private elabCtorPattern(el: Elab, ctor: string, args: Term[], ty: Expr, vars: number[], ctorVars: Set<number>, insideCtor: boolean, r: { from: number; to: number }): { pat: Pat; expr: Expr } {
    const m = el.m;
    const cd = this.env.get(ctor)!;
    const w = m.whnf(ty);
    const params = getAppArgs(w).slice(0, cd.ctor!.numParams);
    const levels = (getAppFn(w) as { levels?: readonly Level[] }).levels ?? [];
    let ct = cd.type;
    const { instantiateExprLevelParams } = KERNEL_EXPR;
    ct = instantiateExprLevelParams(ct, cd.levelParams, levels);
    for (const p of params) {
      if (ct.k !== 'pi') break;
      ct = instantiate1(ct.body, p);
    }
    const subPats: Pat[] = [];
    const fieldExprs: Expr[] = [];
    let ai = 0;
    while (ct.k === 'pi') {
      let sub: { pat: Pat; expr: Expr };
      if (ct.bi === 'default' && ai < args.length) {
        const fieldTy = ct.type;
        // anonymous constructor flattening for the last field
        if (ai === countExplicit(ct) - 1 + ai && false) void 0;
        sub = this.elabPatternAt(el, args[ai++], fieldTy, vars, ctorVars);
      } else {
        const d = m.mkLocal(ct.name, ct.type, 'default', undefined, true);
        el.m.registerLocal(d);
        el.lctx = el.lctx.push(d);
        vars.push(d.id);
        ctorVars.add(d.id);
        sub = { pat: { k: 'var' }, expr: mkFVar(d.id) };
      }
      subPats.push(sub.pat);
      fieldExprs.push(sub.expr);
      ct = instantiate1(ct.body, sub.expr);
    }
    if (ai < args.length) throw new ElabError('other', `too many arguments in pattern for \`${ctor}\``, r.from, r.to);
    void insideCtor;
    const expr = mkAppN(mkAppN(mkConst(ctor, levels), params), fieldExprs);
    return { pat: { k: 'ctor', name: ctor, numParams: cd.ctor!.numParams, args: subPats }, expr };
  }

  private elabPatternAt(el: Elab, t: Term, ty: Expr, vars: number[], ctorVars: Set<number>): { pat: Pat; expr: Expr } {
    return this.elabPattern(el, t, ty, vars, ctorVars, true);
  }

  /* ---------------- inductive / structure ---------------- */

  private inductive(cmd: Extract<Command, { k: 'inductive' }>): void {
    const name = this.fullName(cmd.name);
    if (this.env.has(name)) {
      this.error('other', `'${name}' has already been declared`, { from: cmd.nameFrom, to: cmd.nameTo });
      return;
    }
    const el = this.newElab();
    try {
      el.elabBinders(cmd.binders, (paramIds) => {
        const sortT = cmd.type ? el.elabType(cmd.type) : mkSort(lsucc(lzero));
        const indType = el.m.mkForallFVars(paramIds, el.instantiate(sortT));
        const lp = this.universeOrder(el, [indType]);
        const tmp: ConstDecl = { name, kind: 'axiom', levelParams: lp, type: indType };
        const el2 = new Elab(this.env.add(tmp), el.scope, this.src, this.opts);
        for (const [, d] of el.m.fvars) el2.m.registerLocal(d);
        el2.lctx = el.lctx;
        el2.levelNames = el.levelNames;
        const selfApp = mkAppN(mkConst(name, lp.map((p) => ({ k: 'param', name: p }) as Level)), paramIds.map(mkFVar));
        const ctors = cmd.ctors.map((c) => {
          const ct = el2.elabBinders(c.binders, (fieldIds) => {
            const res = c.type ? el2.elabType(c.type) : selfApp;
            return el2.m.mkForallFVars(fieldIds, el2.instantiate(res));
          });
          // parameters become implicit in constructor types
          const full = el2.m.mkForallFVars(paramIds, ct);
          return { name: `${name}.${c.name}`, type: makeImplicit(full, paramIds.length), doc: c.doc };
        });
        this.env = addInductive(this.env, {
          name,
          levelParams: lp,
          type: indType,
          numParams: paramIds.length,
          ctors,
          doc: cmd.mods.doc,
        });
      });
      this.decls.push({ name, kind: 'inductive', type: '', from: cmd.from, to: cmd.to, ok: true, usesSorry: false, usedTactics: [], usedConstants: [], isTacticProof: false });
    } catch (e) {
      if (e instanceof ElabError) el.report(e);
      else if (e instanceof KernelError) el.report(new ElabError('other', `(kernel) ${e.message}`, cmd.from, cmd.to));
      else throw e;
      this.decls.push({ name, kind: 'inductive', type: '', from: cmd.from, to: cmd.to, ok: false, usesSorry: false, usedTactics: [], usedConstants: [], isTacticProof: false });
    }
    this.collect(el);
  }

  private structure(cmd: Extract<Command, { k: 'structure' }>): void {
    const name = this.fullName(cmd.name);
    if (this.env.has(name)) {
      this.error('other', `'${name}' has already been declared`, { from: cmd.nameFrom, to: cmd.nameTo });
      return;
    }
    const el = this.newElab();
    try {
      el.elabBinders(cmd.binders, (paramIds) => {
        const sortT = cmd.type ? el.elabType(cmd.type) : mkSort(lsucc(lzero));
        const indType = el.m.mkForallFVars(paramIds, el.instantiate(sortT));
        const lp = this.universeOrder(el, [indType]);
        const selfApp = mkAppN(mkConst(name, lp.map((p) => ({ k: 'param', name: p }) as Level)), paramIds.map(mkFVar));
        const fieldGroups: BinderGroup[] = cmd.fields.map((f) => ({
          names: f.names.map((n) => ({ name: n, from: f.from, to: f.to })),
          type: f.binders.length ? { k: 'forall', binders: f.binders, body: f.type, from: f.type.from, to: f.type.to } : f.type,
          bi: 'default',
          from: f.from,
          to: f.to,
        }));
        const ctorType = el.elabBinders(fieldGroups, (fieldIds) => el.m.mkForallFVars(fieldIds, selfApp));
        const full = makeImplicit(el.m.mkForallFVars(paramIds, ctorType), paramIds.length);
        const fields = cmd.fields.flatMap((f) => f.names);
        this.env = addInductive(this.env, {
          name,
          levelParams: lp,
          type: indType,
          numParams: paramIds.length,
          ctors: [{ name: `${name}.${cmd.ctorName ?? 'mk'}`, type: full }],
          structureFields: fields,
          doc: cmd.mods.doc,
        });
      });
      this.decls.push({ name, kind: 'structure', type: '', from: cmd.from, to: cmd.to, ok: true, usesSorry: false, usedTactics: [], usedConstants: [], isTacticProof: false });
    } catch (e) {
      if (e instanceof ElabError) el.report(e);
      else if (e instanceof KernelError) el.report(new ElabError('other', `(kernel) ${e.message}`, cmd.from, cmd.to));
      else throw e;
      this.decls.push({ name, kind: 'structure', type: '', from: cmd.from, to: cmd.to, ok: false, usesSorry: false, usedTactics: [], usedConstants: [], isTacticProof: false });
    }
    this.collect(el);
  }

  /* ---------------- #check / #eval / #reduce / #print ---------------- */

  private check(cmd: TermCmd): void {
    const el = this.newElab();
    const t = cmd.term;
    const r = { from: cmd.from, to: cmd.to };
    try {
      // `#check c` for a constant: signature form
      if (t.k === 'ident') {
        const full = el.lctx.findByName(t.name) ? null : el.resolveGlobal(t.name);
        if (full) {
          el.useConst(full, t);
          this.info(this.signature(el, full), r);
          this.collect(el);
          return;
        }
      }
      if (t.k === 'explicit' && t.term.k === 'ident') {
        const full = el.resolveGlobal(t.term.name);
        if (full) {
          el.useConst(full, t);
          const d = this.env.get(full)!;
          const ty = new Printer(el.m).pp(d.type);
          const hasImplicit = hasImplicitBinder(d.type);
          this.info(`${hasImplicit ? '@' : ''}${full} : ${ty}`, r);
          this.collect(el);
          return;
        }
      }
      const e = el.guard(t, () => el.elabTerm(t, null));
      el.synthesize();
      const ei = el.instantiate(e);
      const ty = el.instantiate(el.inferType(ei));
      this.info(`${el.pp(ei)} : ${el.pp(ty)}`, r);
    } catch (err) {
      if (err instanceof ElabError) el.report(err);
      else throw err;
    }
    this.collect(el);
  }

  /** `name.{u} (x : A) {y : B} : T` like Lean's `#check name`. */
  signature(el: Elab, full: string): string {
    const d = this.env.get(full)!;
    const m = el.m;
    let t = d.type;
    const groups: string[] = [];
    const pr = new Printer(m);
    let pending: { names: string[]; type: string; bi: string } | null = null;
    const flush = () => {
      if (!pending) return;
      const inner = `${pending.names.join(' ')} : ${pending.type}`;
      groups.push(pending.bi === 'implicit' ? `{${inner}}` : pending.bi === 'strict' ? `⦃${inner}⦄` : pending.bi === 'inst' ? `[${pending.type}]` : `(${inner})`);
      pending = null;
    };
    while (t.k === 'pi' && !t.name.includes('✝') && t.name !== 'a') {
      const tyStr = pr.pp(t.type);
      const loc = m.mkLocal(t.name, t.type, t.bi);
      const p = pending as { names: string[]; type: string; bi: string } | null;
      if (p && p.type === tyStr && p.bi === t.bi) p.names.push(t.name);
      else {
        flush();
        pending = { names: [t.name], type: tyStr, bi: t.bi };
      }
      t = instantiate1(t.body, mkFVar(loc.id));
    }
    flush();
    const lv = d.levelParams.length ? `.{${d.levelParams.join(', ')}}` : '';
    return `${full}${lv}${groups.length ? ' ' + groups.join(' ') : ''} : ${pr.pp(t)}`;
  }

  private evalCmd(cmd: TermCmd): void {
    const el = this.newElab();
    const r = { from: cmd.from, to: cmd.to };
    try {
      const e = el.guard(cmd.term, () => el.elabTerm(cmd.term, null));
      el.synthesize();
      if (el.hadError) {
        this.collect(el);
        return;
      }
      const ei = el.instantiate(e);
      if (ei.mv) throw new ElabError('unification', "don't know how to synthesize placeholder", cmd.term.from, cmd.term.to);
      const ty = el.instantiate(el.inferType(ei));
      if (cmd.k === 'eval') {
        if (el.m.isProp(ty) || (ty.k === 'sort')) {
          throw new ElabError('other', `could not synthesize a 'ToExpr', 'Repr', or 'ToString' instance for type\n  ${el.pp(ty)}`, cmd.term.from, cmd.term.to);
        }
        const v = el.guard(cmd.term, () => evalValue(el, ei, ty));
        if (v === null) {
          throw new ElabError('other', `could not synthesize a 'ToExpr', 'Repr', or 'ToString' instance for type\n  ${el.pp(ty)}`, cmd.term.from, cmd.term.to);
        }
        this.info(v, r);
      } else {
        const nf = el.guard(cmd.term, () => normalize(el, ei, 0));
        this.info(el.pp(nf), r);
      }
    } catch (err) {
      if (err instanceof ElabError) el.report(err);
      else throw err;
    }
    this.collect(el);
  }

  private print(cmd: Extract<Command, { k: 'print' }>): void {
    const el = this.newElab();
    const full = el.resolveGlobal(cmd.name);
    const r = { from: cmd.from, to: cmd.to };
    if (!full) {
      this.error('unknown-identifier', `Unknown constant \`${cmd.name}\``, { from: cmd.nameFrom, to: cmd.nameTo }, { name: cmd.name });
      return;
    }
    this.info(printConstant(el, this.env, full), r);
    this.collect(el);
  }
}

type TermCmd = { k: 'check' | 'eval' | 'reduce' | 'checkFailure'; term: Term; from: number; to: number };

class SilentFail extends Error {
  constructor() {
    super('silent');
  }
}

/* ---------------- helpers ---------------- */

import * as KERNEL_EXPR from '../kernel/expr.ts';

/** Canonical key of a term built from variables, literals and constructors (Nat offsets normalized). */
function termKey(env: Environment, e: Expr): string | null {
  const off = natOffsetView(e);
  if (off) {
    if (off.base === null) return `#${off.k}`;
    const b = termKey(env, off.base);
    return b === null ? null : `${b}+${off.k}`;
  }
  if (e.k === 'fvar') return `f${e.id}`;
  if (e.k === 'lit') return `#${String(e.value)}`;
  const f = getAppFn(e);
  if (f.k === 'const' && f.name === 'Nat.zero') return '#0';
  if (f.k === 'const' && env.get(f.name)?.ctor) {
    const keys = getAppArgs(e).map((a) => termKey(env, a));
    if (keys.some((k) => k === null)) return null;
    return `${f.name}(${keys.join(',')})`;
  }
  return null;
}

/** View `e` as `base + k` (k ≥ 1) through `Nat.succ`, `x + lit` and literals. */
function natOffsetView(e: Expr): { base: Expr | null; k: bigint } | null {
  let k = 0n;
  let x = e;
  for (;;) {
    const f = getAppFn(x);
    if (x.k === 'app' && f.k === 'const' && f.name === 'Nat.succ' && x.fn === f) {
      k += 1n;
      x = x.arg;
      continue;
    }
    if (x.k === 'app' && f.k === 'const' && f.name === 'Nat.add') {
      const args = getAppArgs(x);
      if (args.length === 2 && args[1].k === 'lit' && typeof args[1].value === 'bigint') {
        k += args[1].value;
        x = args[0];
        continue;
      }
    }
    break;
  }
  if (x.k === 'lit' && typeof x.value === 'bigint') return { base: null, k: k + x.value };
  if (k === 0n) return null;
  return { base: x, k };
}

/** Keys of the proper subterms of a pattern term (for the structural recursion check). */
function properSubtermKeys(env: Environment, e: Expr): Set<string> {
  const out = new Set<string>();
  const go = (x: Expr): void => {
    const off = natOffsetView(x);
    if (off) {
      for (let j = 0n; j < off.k; j++) {
        if (off.base === null) out.add(`#${j}`);
        else {
          const b = termKey(env, off.base);
          if (b !== null) out.add(j === 0n ? b : `${b}+${j}`);
        }
      }
      if (off.base) go(off.base);
      return;
    }
    const f = getAppFn(x);
    if (f.k === 'const' && env.get(f.name)?.ctor) {
      const np = env.get(f.name)!.ctor!.numParams;
      for (const a of getAppArgs(x).slice(np)) {
        const k = termKey(env, a);
        if (k !== null) out.add(k);
        go(a);
      }
    }
  };
  go(e);
  return out;
}

function countBinderNames(groups: BinderGroup[]): number {
  return groups.reduce((n, g) => n + g.names.length, 0);
}

function countExplicit(t: Expr): number {
  let n = 0;
  while (t.k === 'pi') {
    if (t.bi === 'default') n++;
    t = t.body;
  }
  return n;
}

function makeImplicit(t: Expr, n: number): Expr {
  if (n === 0 || t.k !== 'pi') return t;
  return { ...t, bi: 'implicit', body: makeImplicit(t.body, n - 1) } as Expr;
}

function hasImplicitBinder(t: Expr): boolean {
  while (t.k === 'pi') {
    if (t.bi !== 'default') return true;
    t = t.body;
  }
  return false;
}

function mentionsConst(e: Expr, name: string): boolean {
  let found = false;
  forEachExpr(e, (x) => {
    if (found) return false;
    if (x.k === 'const' && x.name === name) found = true;
    return undefined;
  });
  return found;
}

function mentionsIdent(t: unknown, name: string): boolean {
  if (!name) return false;
  const short = name.slice(name.lastIndexOf('.') + 1);
  let found = false;
  const go = (x: unknown): void => {
    if (found || x === null || typeof x !== 'object') return;
    if (Array.isArray(x)) {
      for (const y of x) go(y);
      return;
    }
    const o = x as Record<string, unknown>;
    if (o.k === 'ident' && (o.name === name || o.name === short)) {
      found = true;
      return;
    }
    for (const v of Object.values(o)) if (typeof v === 'object') go(v);
  };
  go(t);
  return found;
}

function heightOf(env: Environment, e: Expr): number {
  let h = 0;
  forEachExpr(e, (x) => {
    if (x.k === 'const') {
      const d = env.get(x.name);
      if (d?.height !== undefined && d.height > h) h = d.height;
    }
    return undefined;
  });
  return h;
}

/** Bundle two expressions so that level-mvar generalization treats them together. */
function mkPairForLevels(a: Expr, b: Expr): Expr {
  return mkAppN(mkConst('__pair'), [a, b]);
}
function unpairForLevels(e: Expr): [Expr, Expr] {
  const args = getAppArgs(e);
  return [args[0], args[1]];
}

function replaceFVarsMap(e: Expr, ids: number[], vals: Expr[]): Expr {
  const map = new Map<number, Expr>();
  ids.forEach((id, i) => {
    if (vals[i]) map.set(id, vals[i]);
  });
  return KERNEL_EXPR.replaceFVars(e, map);
}

/** First missing pattern row (as text), or null when the patterns are exhaustive. */
function findMissing(env: Environment, rows: Pat[][], n: number): string | null {
  const show = (ps: string[]) => ps.join(', ');
  const go = (rows: Pat[][], n: number, prefix: string[]): string | null => {
    if (n === 0) return rows.length > 0 ? null : show(prefix);
    if (rows.length === 0) return show([...prefix, ...Array.from({ length: n }, () => '_')]);
    const col = rows.map((r) => r[0]);
    const ctorPats = col.filter((p) => p.k === 'ctor' || p.k === 'lit');
    if (ctorPats.length === 0) return go(rows.map((r) => r.slice(1)), n - 1, [...prefix, '_']);
    // inductive of the column
    let ctors: string[] = [];
    const first = ctorPats[0];
    if (first.k === 'lit') ctors = ['Nat.zero', 'Nat.succ'];
    else if (first.k === 'ctor') {
      const cd = env.get(first.name)?.ctor;
      ctors = cd ? env.get(cd.induct)!.ind!.ctors : [first.name];
    }
    for (const c of ctors) {
      const cd = env.get(c)!.ctor!;
      const arity = cd.numFields;
      const spec: Pat[][] = [];
      for (const r of rows) {
        const p = r[0];
        const wild = (): Pat[] => Array.from({ length: arity }, () => ({ k: 'wild' }) as Pat);
        if (p.k === 'var' || p.k === 'wild') spec.push([...wild(), ...r.slice(1)]);
        else if (p.k === 'lit') {
          if (c === 'Nat.zero' && p.value === 0n) spec.push(r.slice(1));
          else if (c === 'Nat.succ' && p.value > 0n) spec.push([{ k: 'lit', value: p.value - 1n }, ...r.slice(1)]);
        } else if (p.k === 'ctor' && p.name === c) spec.push([...p.args, ...r.slice(1)]);
      }
      const short = c === 'Nat.zero' ? '0' : c === 'Nat.succ' ? '_ + 1' : c.slice(c.lastIndexOf('.') + 1);
      const res = go(spec, arity + n - 1, [...prefix, short]);
      if (res !== null) return res;
    }
    return null;
  };
  return go(rows, n, []);
}

/* ---------------- evaluation ---------------- */

function evalValue(el: Elab, e: Expr, ty: Expr): string | null {
  const m = el.m;
  const t = m.whnf(ty);
  const tn = getAppFn(t);
  const red = m.red;
  return red.withTransparency('all', () => {
    if (tn.k === 'const' && tn.name === 'Nat') {
      const v = red.natLitOf(e);
      return v === null ? null : v.toString();
    }
    if (tn.k === 'const' && tn.name === 'Bool') {
      const w = red.whnf(e);
      if (w.k === 'const' && w.name === 'Bool.true') return 'true';
      if (w.k === 'const' && w.name === 'Bool.false') return 'false';
      return null;
    }
    if (tn.k === 'const' && tn.name === 'String') {
      const w = red.whnf(e);
      return w.k === 'lit' && typeof w.value === 'string' ? JSON.stringify(w.value) : null;
    }
    if (tn.k === 'const' && tn.name === 'Prod') {
      const w = red.whnf(e);
      const args = getAppArgs(w);
      const [a, b] = getAppArgs(t);
      if (getAppFn(w).k === 'const' && args.length === 4) {
        const x = evalValue(el, args[2], a);
        const y = evalValue(el, args[3], b);
        return x !== null && y !== null ? `(${x}, ${y})` : null;
      }
      return null;
    }
    // user inductives: constructor applications of values
    if (tn.k === 'const' && m.env.get(tn.name)?.ind && !m.env.get(tn.name)!.ind!.isProp) {
      const nf = normalize(el, e, 0);
      return el.pp(nf);
    }
    return null;
  });
}

/** Full normalization (for #reduce / #eval of data). */
function normalize(el: Elab, e: Expr, depth: number): Expr {
  const m = el.m;
  if (depth > 200) return e;
  const w = m.red.withTransparency('all', () => m.whnf(e));
  const nat = w.k === 'app' && w.fn.k === 'const' && w.fn.name === 'Nat.succ' ? m.red.natLitOf(w) : null;
  if (nat !== null) return { k: 'lit', value: nat, lb: 0, fv: false, mv: false, lmv: false, lp: false } as Expr;
  switch (w.k) {
    case 'app': {
      const f = getAppFn(w);
      const args = getAppArgs(w).map((a) => normalize(el, a, depth + 1));
      return mkAppN(f.k === 'lam' ? normalize(el, f, depth + 1) : f, args);
    }
    case 'lam':
    case 'pi': {
      const d = m.mkLocal(w.name, w.type, w.bi);
      const body = normalize(el, instantiate1(w.body, mkFVar(d.id)), depth + 1);
      const ty = normalize(el, w.type, depth + 1);
      const r = w.k === 'lam' ? m.mkLambdaFVars([d.id], body) : m.mkForallFVars([d.id], body);
      return replace(r, (x) => (exprEq(x, w.type) ? ty : undefined));
    }
    default:
      return w;
  }
}

/* ---------------- #print ---------------- */

export function printConstant(el: Elab, env: Environment, full: string): string {
  const d = env.get(full)!;
  const pr = new Printer(el.m);
  const lv = d.levelParams.length ? `.{${d.levelParams.join(', ')}}` : '';
  const prot = d.isProtected ? 'protected ' : '';
  if (d.ind) {
    const ind = d.ind;
    if (ind.fields && ind.ctors.length === 1) {
      const sig = el ? structureHeader(el, d) : full;
      const lines = [`structure ${sig}`, `number of parameters: ${ind.numParams}`, 'fields:'];
      for (const f of ind.fields) {
        const pd = env.get(`${full}.${f}`);
        if (!pd) continue;
        // field type: strip params and self
        let t = pd.type;
        const locals: number[] = [];
        while (t.k === 'pi') {
          const l = el.m.mkLocal(t.name, t.type, t.bi);
          locals.push(l.id);
          t = instantiate1(t.body, mkFVar(l.id));
        }
        lines.push(`  ${full}.${f} : ${pr.pp(t)}`);
      }
      lines.push('constructor:');
      lines.push(`  ${new CommandElabSig(el, env).signature(ind.ctors[0])}`);
      return lines.join('\n');
    }
    const lines = [`inductive ${full}${lv} : ${pr.pp(d.type)}`, `number of parameters: ${ind.numParams}`, 'constructors:'];
    for (const c of ind.ctors) lines.push(`${c} : ${pr.pp(env.get(c)!.type)}`);
    return lines.join('\n');
  }
  if (d.kind === 'axiom' || d.kind === 'opaque') return `axiom ${full}${lv} : ${pr.pp(d.type)}`;
  if (d.kind === 'ctor') return `constructor ${full}${lv} : ${pr.pp(d.type)}`;
  if (d.kind === 'rec') return `recursor ${full}${lv} : ${pr.pp(d.type)}`;
  const kw = d.kind === 'theorem' ? 'theorem' : 'def';
  if (d.matchDef) return `${prot}${kw} ${full}${lv} : ${pr.pp(d.type)} :=\n(defined by pattern matching)`;
  return `${prot}${kw} ${full}${lv} : ${pr.pp(d.type)} :=\n${d.value ? pr.pp(d.value) : 'sorry'}`;
}

function structureHeader(el: Elab, d: ConstDecl): string {
  let t = d.type;
  const pr = new Printer(el.m);
  const parts: string[] = [];
  let pending: { names: string[]; type: string } | null = null;
  for (let i = 0; i < (d.ind?.numParams ?? 0) && t.k === 'pi'; i++) {
    const ts = pr.pp(t.type);
    const p = pending as { names: string[]; type: string } | null;
    if (p && p.type === ts) p.names.push(t.name);
    else {
      if (p) parts.push(`(${p.names.join(' ')} : ${p.type})`);
      pending = { names: [t.name], type: ts };
    }
    const l = el.m.mkLocal(t.name, t.type);
    t = instantiate1(t.body, mkFVar(l.id));
  }
  const p = pending as { names: string[]; type: string } | null;
  if (p) parts.push(`(${p.names.join(' ')} : ${p.type})`);
  return `${d.name}${d.levelParams.length ? `.{${d.levelParams.join(', ')}}` : ''}${parts.length ? ' ' + parts.join(' ') : ''} : ${pr.pp(t)}`;
}

class CommandElabSig {
  private el: Elab;
  private env: Environment;
  constructor(el: Elab, env: Environment) {
    this.el = el;
    this.env = env;
  }
  signature(full: string): string {
    const ce = new CommandElab(this.env, '', {});
    return ce.signature(this.el, full);
  }
}
