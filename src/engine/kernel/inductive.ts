/**
 * Inductive types: checks a declaration (strict positivity, constructor shapes) and generates
 * constructors, the recursor `I.rec` with its ι-rules, `I.casesOn`, and structure projections.
 */
import type { Expr } from './expr.ts';
import {
  abstractFVars,
  getAppArgs,
  getAppFn,
  replaceFVars,
  instantiate1,
  mkApp,
  mkAppN,
  mkConst,
  mkFVar,
  mkLam,
  mkPi,
  mkSort,
  forEachExpr,
} from './expr.ts';
import type { BinderInfo } from './expr.ts';
import type { Level } from './level.ts';
import { lparam, lzero } from './level.ts';
import type { ConstDecl, Environment, RecRule } from './env.ts';
import { Fuel } from './reduce.ts';
import { KernelError, TypeChecker, freshFVarId } from './typecheck.ts';

export interface InductiveSpec {
  name: string;
  levelParams: string[];
  /** Π params indices, Sort l */
  type: Expr;
  numParams: number;
  ctors: { name: string; type: Expr; doc?: string }[];
  /** field names when declared with `structure` */
  structureFields?: string[];
  doc?: string;
}

/** Helper to build binders over kernel fvars. */
class Builder {
  readonly tc: TypeChecker;
  readonly bis = new Map<number, BinderInfo>();
  constructor(tc: TypeChecker) {
    this.tc = tc;
  }
  local(name: string, type: Expr, bi: BinderInfo = 'default'): Expr {
    const id = freshFVarId();
    this.tc.lctx.set(id, { name, type });
    this.bis.set(id, bi);
    return mkFVar(id);
  }
  close(k: 'lam' | 'pi', xs: Expr[], body: Expr, biOverride?: BinderInfo): Expr {
    const ids = xs.map((x) => (x as { id: number }).id);
    let r = abstractFVars(body, ids);
    for (let i = xs.length - 1; i >= 0; i--) {
      const d = this.tc.lctx.get(ids[i])!;
      const ty = abstractFVars(d.type, ids.slice(0, i));
      const bi = biOverride ?? this.bis.get(ids[i]) ?? 'default';
      r = k === 'lam' ? mkLam(d.name, ty, r, bi) : mkPi(d.name, ty, r, bi);
    }
    return r;
  }
  /** Instantiate the leading Π-binders of `t` with fresh locals (up to `n`, or all if n < 0). */
  telescope(t: Expr, n: number, whnf = false): { xs: Expr[]; body: Expr } {
    const xs: Expr[] = [];
    for (;;) {
      if (n >= 0 && xs.length >= n) break;
      if (t.k !== 'pi' && whnf) t = this.tc.whnf(t);
      if (t.k !== 'pi') break;
      const x = this.local(t.name, t.type, t.bi);
      xs.push(x);
      t = instantiate1(t.body, x);
    }
    return { xs, body: t };
  }
  typeOf(x: Expr): Expr {
    return this.tc.lctx.get((x as { id: number }).id)!.type;
  }
}

function freshUnivName(used: string[]): string {
  if (!used.includes('u')) return 'u';
  for (let i = 1; ; i++) if (!used.includes(`u_${i}`)) return `u_${i}`;
}

export function addInductive(env0: Environment, spec: InductiveSpec, fuel = new Fuel(1_000_000)): Environment {
  const { name, levelParams, numParams } = spec;
  const lvls: Level[] = levelParams.map(lparam);
  const tc0 = new TypeChecker(env0, fuel, levelParams);
  const indSort = tc0.ensureSort(tc0.infer(spec.type), spec.type);
  void indSort;

  const indDecl: ConstDecl = {
    name,
    kind: 'inductive',
    levelParams,
    type: spec.type,
    doc: spec.doc,
    userKind: spec.structureFields ? 'structure' : 'inductive',
  };
  let env = env0.add(indDecl);
  const tc = new TypeChecker(env, fuel, levelParams);
  const B = new Builder(tc);

  // telescope of the inductive type
  const { xs: allIdx, body: resSort0 } = B.telescope(spec.type, -1, true);
  const resSort = tc.whnf(resSort0);
  if (resSort.k !== 'sort') throw new KernelError(`invalid inductive type '${name}': resulting type is not a sort`);
  if (allIdx.length < numParams) throw new KernelError(`invalid inductive type '${name}': too many parameters`);
  const ps = allIdx.slice(0, numParams);
  const numIndices = allIdx.length - numParams;
  const isProp = resSort.level.k === 'zero';
  const indConst = mkConst(name, lvls);
  const isIndApp = (e: Expr): boolean => {
    const f = getAppFn(e);
    return f.k === 'const' && f.name === name;
  };
  const mentionsInd = (e: Expr): boolean => {
    let found = false;
    forEachExpr(e, (x) => {
      if (found) return false;
      if (x.k === 'const' && x.name === name) found = true;
      return undefined;
    });
    return found;
  };

  interface CtorShape {
    name: string;
    type: Expr;
    fields: Expr[];
    /** for each field: if recursive, its telescope */
    rec: ({ ys: Expr[]; idx: Expr[] } | null)[];
    resIdx: Expr[];
  }
  const shapes: CtorShape[] = [];
  let isRec = false;
  for (const c of spec.ctors) {
    tc.ensureSort(tc.infer(c.type), c.type);
    let t = c.type;
    // parameters must coincide
    for (let i = 0; i < numParams; i++) {
      if (t.k !== 'pi') throw new KernelError(`invalid constructor '${c.name}': missing parameters`);
      if (!tc.isDefEq(t.type, B.typeOf(ps[i]))) {
        throw new KernelError(`invalid constructor '${c.name}': parameter type mismatch`);
      }
      t = instantiate1(t.body, ps[i]);
    }
    const { xs: fields, body: res } = B.telescope(t, -1);
    if (!isIndApp(res)) throw new KernelError(`invalid constructor '${c.name}': must return '${name}'`);
    const resArgs = getAppArgs(res);
    if (resArgs.length !== allIdx.length) throw new KernelError(`invalid constructor '${c.name}': wrong number of arguments`);
    for (let i = 0; i < numParams; i++) {
      const a = resArgs[i];
      if (a.k !== 'fvar' || a.id !== (ps[i] as { id: number }).id) {
        throw new KernelError(`invalid constructor '${c.name}': parameters must be passed unchanged`);
      }
    }
    const recInfo: CtorShape['rec'] = [];
    for (const f of fields) {
      const ft = B.typeOf(f);
      if (!mentionsInd(ft)) {
        recInfo.push(null);
        continue;
      }
      const { xs: ys, body } = B.telescope(ft, -1, true);
      if (!isIndApp(body) || ys.some((y) => mentionsInd(B.typeOf(y)))) {
        throw new KernelError(`(kernel) arg #${fields.indexOf(f) + 1} of '${c.name}' has a non positive occurrence of the datatypes being declared`);
      }
      const args = getAppArgs(body);
      if (args.slice(numParams).some(mentionsInd)) throw new KernelError(`invalid nested inductive occurrence in '${c.name}'`);
      recInfo.push({ ys, idx: args.slice(numParams) });
      isRec = true;
    }
    shapes.push({ name: c.name, type: c.type, fields, rec: recInfo, resIdx: resArgs.slice(numParams) });
  }

  // large elimination
  let largeElim = true;
  if (isProp) {
    if (shapes.length > 1) largeElim = false;
    else if (shapes.length === 1) {
      const s = shapes[0];
      for (const f of s.fields) {
        if (tc.isProp(B.typeOf(f))) continue;
        const occurs = s.resIdx.some((ix) => ix.k === 'fvar' && ix.id === (f as { id: number }).id);
        if (!occurs) {
          largeElim = false;
          break;
        }
      }
    }
  }
  const fields = spec.structureFields;
  const ctorDecls: ConstDecl[] = spec.ctors.map((c, idx) => ({
    name: c.name,
    kind: 'ctor',
    levelParams,
    type: c.type,
    doc: c.doc,
    userKind: 'constructor',
    ctor: { induct: name, idx, numParams, numFields: shapes[idx].fields.length },
  }));
  env = env.add(
    {
      ...indDecl,
      ind: {
        numParams,
        numIndices,
        ctors: spec.ctors.map((c) => c.name),
        isRec,
        isProp,
        largeElim,
        fields: fields ?? (shapes.length === 1 && numIndices === 0 && !isProp ? undefined : undefined),
      },
    },
    ...ctorDecls,
  );

  // ---- recursor ----
  const univ = largeElim ? freshUnivName(levelParams) : null;
  const elimLevel: Level = univ ? lparam(univ) : lzero;
  const recLevelParams = univ ? [univ, ...levelParams] : [...levelParams];
  const recLvls = recLevelParams.map(lparam);
  const recName = `${name}.rec`;
  const recConst = mkConst(recName, recLvls);

  const tc2 = new TypeChecker(env, fuel, recLevelParams);
  const B2 = new Builder(tc2);
  // re-create params/indices in the new checker
  const { xs: ixs2 } = B2.telescope(spec.type, -1, true);
  const ps2 = ixs2.slice(0, numParams);
  for (const p of ps2) B2.bis.set((p as { id: number }).id, 'implicit');
  // motive
  const { xs: mIdx } = B2.telescope(instantiateParams(spec.type, ps2), numIndices, true);
  const majorT = mkAppN(mkAppN(indConst, ps2), mIdx);
  const mt = B2.local('t', majorT);
  const motiveType = B2.close('pi', [...mIdx, mt], mkSort(elimLevel));
  const motive = B2.local('motive', motiveType, 'implicit');

  const minors: Expr[] = [];
  const minorInfo: { fields: Expr[]; ihs: Expr[]; recFields: { f: Expr; ys: Expr[]; idx: Expr[] }[] }[] = [];
  for (const c of spec.ctors) {
    const ct = instantiateParams(c.type, ps2);
    const { xs: fs, body: res } = B2.telescope(ct, -1);
    const ihs: Expr[] = [];
    const recFields: { f: Expr; ys: Expr[]; idx: Expr[] }[] = [];
    for (const f of fs) {
      const ft = B2.typeOf(f);
      if (!mentionsInd(ft)) continue;
      const { xs: ys, body } = B2.telescope(ft, -1, true);
      const idx = getAppArgs(body).slice(numParams);
      const ihT = B2.close('pi', ys, mkApp(mkAppN(motive, idx), mkAppN(f, ys)));
      const fname = tc2.lctx.get((f as { id: number }).id)!.name;
      ihs.push(B2.local(`${fname}_ih`, ihT));
      recFields.push({ f, ys, idx });
    }
    const resIdx = getAppArgs(res).slice(numParams);
    const minorT = B2.close('pi', [...fs, ...ihs], mkApp(mkAppN(motive, resIdx), mkAppN(mkAppN(mkConst(c.name, lvls), ps2), fs)));
    const short = c.name.slice(name.length + 1);
    minors.push(B2.local(short, minorT));
    minorInfo.push({ fields: fs, ihs, recFields });
  }
  const { xs: rIdx } = B2.telescope(instantiateParams(spec.type, ps2), numIndices, true);
  for (const x of rIdx) B2.bis.set((x as { id: number }).id, 'implicit');
  const rMajor = B2.local('t', mkAppN(mkAppN(indConst, ps2), rIdx));
  const recType = B2.close('pi', [...ps2, motive, ...minors, ...rIdx, rMajor], mkApp(mkAppN(motive, rIdx), rMajor));

  const rules: RecRule[] = spec.ctors.map((c, j) => {
    const info = minorInfo[j];
    const ihVals = info.recFields.map(({ f, ys, idx }) =>
      B2.close('lam', ys, mkApp(mkAppN(mkAppN(mkAppN(recConst, ps2), [motive, ...minors]), idx), mkAppN(f, ys))),
    );
    const body = mkAppN(mkAppN(minors[j], info.fields), ihVals);
    return {
      ctor: c.name,
      numFields: info.fields.length,
      rhs: B2.close('lam', [...ps2, motive, ...minors, ...info.fields], body),
    };
  });

  const recDecl: ConstDecl = {
    name: recName,
    kind: 'rec',
    levelParams: recLevelParams,
    type: recType,
    userKind: 'recursor',
    rec: { induct: name, numParams, numIndices, numMinors: minors.length, rules },
  };
  env = env.add(recDecl);

  // ---- casesOn ----
  {
    const tc3 = new TypeChecker(env, fuel, recLevelParams);
    const B3 = new Builder(tc3);
    const { xs: ixs3 } = B3.telescope(spec.type, -1, true);
    const ps3 = ixs3.slice(0, numParams);
    for (const p of ps3) B3.bis.set((p as { id: number }).id, 'implicit');
    const { xs: mIdx3 } = B3.telescope(instantiateParams(spec.type, ps3), numIndices, true);
    const mt3 = B3.local('t', mkAppN(mkAppN(indConst, ps3), mIdx3));
    const motive3 = B3.local('motive', B3.close('pi', [...mIdx3, mt3], mkSort(elimLevel)), 'implicit');
    const { xs: idx3 } = B3.telescope(instantiateParams(spec.type, ps3), numIndices, true);
    for (const x of idx3) B3.bis.set((x as { id: number }).id, 'implicit');
    const major3 = B3.local('t', mkAppN(mkAppN(indConst, ps3), idx3));
    const minors3: Expr[] = [];
    const recMinorVals: Expr[] = [];
    for (const c of spec.ctors) {
      const { xs: fs, body: res } = B3.telescope(instantiateParams(c.type, ps3), -1);
      const resIdx = getAppArgs(res).slice(numParams);
      const minorT = B3.close('pi', fs, mkApp(mkAppN(motive3, resIdx), mkAppN(mkAppN(mkConst(c.name, lvls), ps3), fs)));
      const m = B3.local(c.name.slice(name.length + 1), minorT);
      minors3.push(m);
      // λ fields ihs, m fields
      const ihs: Expr[] = [];
      for (const f of fs) {
        const ft = B3.typeOf(f);
        if (!mentionsInd(ft)) continue;
        const { xs: ys, body } = B3.telescope(ft, -1, true);
        const idx = getAppArgs(body).slice(numParams);
        ihs.push(B3.local('ih', B3.close('pi', ys, mkApp(mkAppN(motive3, idx), mkAppN(f, ys)))));
      }
      recMinorVals.push(B3.close('lam', [...fs, ...ihs], mkAppN(m, fs)));
    }
    const casesType = B3.close('pi', [...ps3, motive3, ...idx3, major3, ...minors3], mkApp(mkAppN(motive3, idx3), major3));
    const casesVal = B3.close(
      'lam',
      [...ps3, motive3, ...idx3, major3, ...minors3],
      mkApp(mkAppN(mkAppN(mkAppN(recConst, ps3), [motive3, ...recMinorVals]), idx3), major3),
    );
    env = env.add({
      name: `${name}.casesOn`,
      kind: 'def',
      levelParams: recLevelParams,
      type: casesType,
      value: casesVal,
      height: 1,
      reducibility: 'reducible',
      userKind: 'def',
    });
  }

  // ---- structure projections ----
  if (fields && spec.ctors.length === 1 && numIndices === 0) {
    env = addProjections(env, name, levelParams, numParams, spec.ctors[0], fields, largeElim, fuel);
  }
  return env;
}

function instantiateParams(t: Expr, ps: Expr[]): Expr {
  for (const p of ps) {
    if (t.k !== 'pi') throw new KernelError('instantiateParams: not a pi');
    t = instantiate1(t.body, p);
  }
  return t;
}

/** `S.f {params} (self : S params) : T_f`, defined by `casesOn`. */
function addProjections(
  env: Environment,
  name: string,
  levelParams: string[],
  numParams: number,
  ctor: { name: string; type: Expr },
  fields: string[],
  largeElim: boolean,
  fuel: Fuel,
): Environment {
  const lvls = levelParams.map(lparam);
  const indDecl = env.get(name)!;
  env = env.add({ ...indDecl, ind: { ...indDecl.ind!, fields } });
  const projs: Expr[] = [];
  for (let i = 0; i < fields.length; i++) {
    const tc = new TypeChecker(env, fuel, levelParams);
    const B = new Builder(tc);
    const { xs: ps } = B.telescope(indDecl.type, numParams);
    for (const p of ps) B.bis.set((p as { id: number }).id, 'implicit');
    const self = B.local('self', mkAppN(mkConst(name, lvls), ps));
    let t = instantiateParams(ctor.type, ps);
    for (let j = 0; j < i; j++) {
      if (t.k !== 'pi') throw new KernelError('bad structure');
      t = instantiate1(t.body, mkApp(mkAppN(projs[j], ps), self));
    }
    if (t.k !== 'pi') throw new KernelError('bad structure');
    const fieldType = t.type;
    const isPropField = tc.isProp(fieldType);
    if (!largeElim && !isPropField) break; // Prop structure with data fields: no projection
    const { xs: fs } = B.telescope(instantiateParams(ctor.type, ps), -1);
    const tLocal = B.local('t', mkAppN(mkConst(name, lvls), ps));
    const motive = B.close('lam', [tLocal], replaceFVars(fieldType, new Map([[(self as { id: number }).id, tLocal]])));
    const elimLevel = tc.ensureSort(tc.infer(fieldType), fieldType);
    const casesLvls = largeElim ? [elimLevel, ...lvls] : lvls;
    const minor = B.close('lam', fs, fs[i]);
    const val = mkAppN(mkConst(`${name}.casesOn`, casesLvls), [...ps, motive, self, minor]);
    const fname = `${name}.${fields[i]}`;
    const type = B.close('pi', [...ps, self], fieldType);
    const value = B.close('lam', [...ps, self], val);
    env = env.add({
      name: fname,
      kind: 'def',
      levelParams,
      type,
      value,
      height: 2,
      reducibility: 'reducible',
      userKind: 'def',
      pp: 'proj',
    });
    projs.push(mkConst(fname, lvls));
  }
  return env;
}
