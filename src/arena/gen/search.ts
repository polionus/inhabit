/**
 * Readable proof search. Finds a *shortest* (by an estimate of tactic lines) normal natural-deduction
 * proof built from the moves a person makes in Lean: `intro`, `constructor`, `left`/`right`,
 * `obtain`, `cases`, `apply`/`exact` (backward chaining through implications, negations and ∀),
 * `use`, `have` (forward use of a hypothesis whose conclusion must be taken apart), `exfalso`, and —
 * in classical mode — `by_cases` / `by_contra`.
 *
 * Termination: iterative deepening on cost (every move costs ≥ 1) plus a node limit. G4ip
 * (`logic.ts`) decides provability; this search only has to produce a nice proof.
 */
import { bot, imp, key, not, subst } from './logic.ts';
import type { F } from './logic.ts';

export interface Hyp {
  name: string;
  f: F;
}

/** An argument of an application: an element of α or a proof. */
export type Item = { term: string } | { pf: Pf };

export type Pf =
  | { k: 'hyp'; goal: F; name: string }
  | { k: 'intro'; goal: F; name: string; f: F | null; body: Pf }
  | { k: 'and' | 'iff'; goal: F; l: Pf; r: Pf }
  | { k: 'inl' | 'inr'; goal: F; p: Pf }
  | { k: 'andE'; goal: F; h: string; hf: F; a: string; b: string; fa: F; fb: F; iff: boolean; body: Pf }
  | { k: 'exE'; goal: F; h: string; hf: F; x: string; a: string; fa: F; body: Pf }
  | { k: 'exI'; goal: F; w: string; p: Pf }
  | { k: 'orE'; goal: F; h: string; hf: F; a: string; b: string; fa: F; fb: F; l: Pf; r: Pf }
  | { k: 'app'; goal: F; h: string; hf: F; items: Item[] }
  | { k: 'exfalso'; goal: F; p: Pf }
  | { k: 'falseE'; goal: F; h: string }
  | { k: 'trivial'; goal: F }
  | { k: 'have'; goal: F; name: string; f: F; h: string; hf: F; items: Item[]; body: Pf }
  | { k: 'byCases'; goal: F; v: F; a: string; b: string; l: Pf; r: Pf }
  | { k: 'byContra'; goal: F; name: string; f: F; body: Pf };

export interface Naming {
  /** Base name for a hypothesis of type `f` (uniquified by the prover). */
  hyp(f: F): string;
  /** Base name for an element variable bound as `x`. */
  elem?(x: string): string;
  /** Full control over fresh hypothesis names (overrides `hyp` + priming). */
  fresh?(f: F, taken: Set<string>): string;
}

export interface ProverOpts {
  classical?: boolean;
  /** Propositions `by_cases` may split on (classical mode). */
  caseAtoms?: F[];
  maxCost?: number;
  nodeLimit?: number;
  naming: Naming;
}

interface Ctx {
  hyps: Hyp[];
  vars: string[];
  taken: Set<string>;
}

interface Res {
  pf: Pf;
  cost: number;
}

/** One way to use a hypothesis as a function: arguments, then the conclusion. */
interface Use {
  items: ({ term: string } | { f: F })[];
  cod: F;
}

class Abort extends Error {}

export function uniq(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  if (!taken.has(base + "'")) return base + "'";
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  for (let i = 2; ; i++) {
    const n = base + String(i).split('').map((d) => sub[Number(d)]).join('');
    if (!taken.has(n)) return n;
  }
}

/** All ways to apply a hypothesis (at least one argument), up to `maxItems` arguments. */
function uses(f: F, vars: string[], maxItems = 5): Use[] {
  const out: Use[] = [];
  const go = (g: F, items: Use['items']) => {
    if (items.length >= maxItems) return;
    if (g.t === 'imp') {
      const it = [...items, { f: g.a }];
      out.push({ items: it, cod: g.b });
      go(g.b, it);
    } else if (g.t === 'not') {
      out.push({ items: [...items, { f: g.a }], cod: bot });
    } else if (g.t === 'all') {
      for (const v of vars) {
        const it = [...items, { term: v }];
        const body = subst(g.a, g.x, v);
        out.push({ items: it, cod: body });
        go(body, it);
      }
    }
  };
  go(f, []);
  return out;
}

export class Prover {
  nodes = 0;
  private memo = new Map<string, number>();
  private opts: ProverOpts;
  private maxCost: number;
  private nodeLimit: number;

  constructor(opts: ProverOpts) {
    this.opts = opts;
    this.maxCost = opts.maxCost ?? 22;
    this.nodeLimit = opts.nodeLimit ?? 40000;
  }

  /** Shortest proof of `goal` from `hyps`, or null (unprovable within limits). */
  prove(hyps: Hyp[], vars: string[], goal: F, reserved: string[] = []): Res | null {
    const taken = new Set<string>([...reserved, ...vars, ...hyps.map((h) => h.name)]);
    try {
      return this.min({ hyps, vars, taken }, goal, this.maxCost);
    } catch (e) {
      if (e instanceof Abort) return null;
      throw e;
    }
  }

  private key(c: Ctx, goal: F): string {
    const ks = [...new Set(c.hyps.map((h) => key(h.f)))].sort();
    return ks.join(';') + '#' + [...c.vars].sort().join(',') + '⊢' + key(goal);
  }

  private min(c: Ctx, goal: F, B: number): Res | null {
    if (B <= 0) return null;
    const k = this.key(c, goal);
    const failed = this.memo.get(k) ?? 0;
    for (let b = failed + 1; b <= B; b++) {
      const r = this.at(c, goal, b);
      if (r) return r;
      this.memo.set(k, b);
    }
    return null;
  }

  private addHyp(c: Ctx, f: F, base?: string): { c: Ctx; name: string } {
    const nm = this.opts.naming;
    const name = base !== undefined || !nm.fresh ? uniq(base ?? nm.hyp(f), c.taken) : nm.fresh(f, c.taken);
    const taken = new Set(c.taken);
    taken.add(name);
    return { c: { hyps: [...c.hyps, { name, f }], vars: c.vars, taken }, name };
  }
  private addVar(c: Ctx, x: string): { c: Ctx; name: string } {
    const name = uniq(this.opts.naming.elem ? this.opts.naming.elem(x) : x, c.taken);
    const taken = new Set(c.taken);
    taken.add(name);
    return { c: { hyps: c.hyps, vars: [...c.vars, name], taken }, name };
  }
  private drop(c: Ctx, name: string): Ctx {
    return { hyps: c.hyps.filter((h) => h.name !== name), vars: c.vars, taken: c.taken };
  }
  private find(c: Ctx, f: F): Hyp | undefined {
    const k = key(f);
    return c.hyps.find((h) => key(h.f) === k);
  }

  /** Close the goal in one line (`exact h`, `exact h a b`, `exact absurd ha hn`, …). */
  private quick(c: Ctx, goal: F): Pf | null {
    const h = this.find(c, goal);
    if (h) return { k: 'hyp', goal, name: h.name };
    if (goal.t === 'top') return { k: 'trivial', goal };
    const f = c.hyps.find((x) => x.f.t === 'bot');
    if (f) return { k: 'falseE', goal, h: f.name };
    const gk = key(goal);
    for (const want of goal.t === 'bot' ? [gk] : [gk, key(bot)]) {
      for (const hy of c.hyps) {
        for (const u of uses(hy.f, c.vars, 3)) {
          if (key(u.cod) !== want) continue;
          const items: Item[] = [];
          let ok = true;
          for (const it of u.items) {
            if ('term' in it) items.push(it);
            else {
              const a = this.find(c, it.f);
              if (!a) {
                ok = false;
                break;
              }
              items.push({ pf: { k: 'hyp', goal: it.f, name: a.name } });
            }
          }
          if (!ok) continue;
          const app: Pf = { k: 'app', goal: want === gk ? goal : bot, h: hy.name, hf: hy.f, items };
          return want === gk ? app : { k: 'exfalso', goal, p: app };
        }
      }
    }
    return null;
  }

  private items(c: Ctx, its: Use['items'], b: number): { items: Item[]; cost: number } | null {
    const items: Item[] = [];
    let cost = 0;
    for (const it of its) {
      if ('term' in it) {
        items.push(it);
        continue;
      }
      const a = this.find(c, it.f);
      if (a) {
        items.push({ pf: { k: 'hyp', goal: it.f, name: a.name } });
        continue;
      }
      const r = this.min(c, it.f, b - cost);
      if (!r) return null;
      cost += r.cost;
      items.push({ pf: r.pf });
    }
    return { items, cost };
  }

  private at(c: Ctx, goal: F, b: number): Res | null {
    if (++this.nodes > this.nodeLimit) throw new Abort();
    const q = this.quick(c, goal);
    if (q) return { pf: q, cost: 1 };
    if (b <= 1) return null;

    // intro (invertible)
    if (goal.t === 'imp' || goal.t === 'not') {
      const [a, body] = goal.t === 'imp' ? [goal.a, goal.b] : [goal.a, bot];
      const { c: c2, name } = this.addHyp(c, a);
      const r = this.min(c2, body, b - 1);
      return r && { pf: { k: 'intro', goal, name, f: a, body: r.pf }, cost: r.cost + 1 };
    }
    if (goal.t === 'all') {
      const { c: c2, name } = this.addVar(c, goal.x);
      const r = this.min(c2, subst(goal.a, goal.x, name), b - 1);
      return r && { pf: { k: 'intro', goal, name, f: null, body: r.pf }, cost: r.cost + 1 };
    }

    // take apart ∧ / ↔ / ∃ hypotheses (invertible)
    for (const h of c.hyps) {
      if (h.f.t === 'and' || h.f.t === 'iff') {
        const isIff = h.f.t === 'iff';
        const fa = isIff ? imp(h.f.a, h.f.b) : h.f.a;
        const fb = isIff ? imp(h.f.b, h.f.a) : h.f.b;
        const c0 = this.drop(c, h.name);
        const { c: c1, name: na } = this.addHyp(c0, fa);
        const { c: c2, name: nb } = this.addHyp(c1, fb);
        const r = this.min(c2, goal, b - 1);
        return (
          r && {
            pf: { k: 'andE', goal, h: h.name, hf: h.f, a: na, b: nb, fa, fb, iff: isIff, body: r.pf },
            cost: r.cost + 1,
          }
        );
      }
      if (h.f.t === 'ex') {
        const c0 = this.drop(c, h.name);
        const { c: c1, name: x } = this.addVar(c0, h.f.x);
        const fa = subst(h.f.a, h.f.x, x);
        const { c: c2, name: na } = this.addHyp(c1, fa);
        const r = this.min(c2, goal, b - 1);
        return r && { pf: { k: 'exE', goal, h: h.name, hf: h.f, x, a: na, fa, body: r.pf }, cost: r.cost + 1 };
      }
    }

    // constructor (invertible, but splitting a hypothesis first can be shorter)
    if (goal.t === 'and' || goal.t === 'iff') {
      const [ga, gb] = goal.t === 'and' ? [goal.a, goal.b] : [imp(goal.a, goal.b), imp(goal.b, goal.a)];
      const l = this.min(c, ga, b - 2);
      const r = l && this.min(c, gb, b - 1 - l.cost);
      if (l && r) return { pf: { k: goal.t, goal, l: l.pf, r: r.pf }, cost: 1 + l.cost + r.cost };
    }

    const gk = key(goal);
    // apply a hypothesis whose conclusion is the goal
    for (const h of c.hyps) {
      for (const u of uses(h.f, c.vars)) {
        if (key(u.cod) !== gk) continue;
        const its = this.items(c, u.items, b - 1);
        if (its) return { pf: { k: 'app', goal, h: h.name, hf: h.f, items: its.items }, cost: 1 + its.cost };
      }
    }
    // left / right
    if (goal.t === 'or') {
      const l = this.min(c, goal.a, b - 1);
      if (l) return { pf: { k: 'inl', goal, p: l.pf }, cost: 1 + l.cost };
      const r = this.min(c, goal.b, b - 1);
      if (r) return { pf: { k: 'inr', goal, p: r.pf }, cost: 1 + r.cost };
    }
    // use a witness
    if (goal.t === 'ex') {
      for (const v of c.vars) {
        const r = this.min(c, subst(goal.a, goal.x, v), b - 1);
        if (r) return { pf: { k: 'exI', goal, w: v, p: r.pf }, cost: 1 + r.cost };
      }
    }
    // case split on a disjunction
    for (const h of c.hyps) {
      if (h.f.t !== 'or') continue;
      const c0 = this.drop(c, h.name);
      const { c: cl, name: na } = this.addHyp(c0, h.f.a);
      const l = this.min(cl, goal, b - 2);
      if (!l) continue;
      const { c: cr, name: nb } = this.addHyp(c0, h.f.b);
      const r = this.min(cr, goal, b - 1 - l.cost);
      if (!r) continue;
      return {
        pf: { k: 'orE', goal, h: h.name, hf: h.f, a: na, b: nb, fa: h.f.a, fb: h.f.b, l: l.pf, r: r.pf },
        cost: 1 + l.cost + r.cost,
      };
    }
    // forward: `have` a conclusion that must be taken apart
    for (const h of c.hyps) {
      for (const u of uses(h.f, c.vars)) {
        const t = u.cod.t;
        if (t !== 'and' && t !== 'or' && t !== 'iff' && t !== 'ex') continue;
        if (this.find(c, u.cod)) continue;
        const its = this.items(c, u.items, b - 2);
        if (!its) continue;
        const { c: c2, name } = this.addHyp(c, u.cod);
        const r = this.min(c2, goal, b - 1 - its.cost);
        if (!r) continue;
        return {
          pf: { k: 'have', goal, name, f: u.cod, h: h.name, hf: h.f, items: its.items, body: r.pf },
          cost: 1 + its.cost + r.cost,
        };
      }
    }
    // exfalso: aim for a contradiction
    if (goal.t !== 'bot' && c.hyps.some((h) => uses(h.f, c.vars).some((u) => u.cod.t === 'bot'))) {
      const r = this.min(c, bot, b - 1);
      if (r) return { pf: { k: 'exfalso', goal, p: r.pf }, cost: 1 + r.cost };
    }
    if (this.opts.classical) {
      if (goal.t !== 'bot' && !this.find(c, not(goal))) {
        const { c: c2, name } = this.addHyp(c, not(goal));
        const r = this.min(c2, bot, b - 2);
        if (r) return { pf: { k: 'byContra', goal, name, f: not(goal), body: r.pf }, cost: 2 + r.cost };
      }
      for (const v of this.opts.caseAtoms ?? []) {
        if (this.find(c, v) || this.find(c, not(v))) continue;
        const { c: cl, name: na } = this.addHyp(c, v);
        const l = this.min(cl, goal, b - 3);
        if (!l) continue;
        // Lean's `by_cases h : p` names the hypothesis `h` in both branches.
        const { c: cr, name: nb } = this.addHyp(c, not(v), na);
        const r = this.min(cr, goal, b - 2 - l.cost);
        if (!r) continue;
        return { pf: { k: 'byCases', goal, v, a: na, b: nb, l: l.pf, r: r.pf }, cost: 2 + l.cost + r.cost };
      }
    }
    return null;
  }
}

/** Names of hypotheses / variables a proof actually uses. */
export function usedNames(pf: Pf, out: Set<string> = new Set()): Set<string> {
  const items = (its: Item[]) => {
    for (const it of its) {
      if ('term' in it) out.add(it.term);
      else usedNames(it.pf, out);
    }
  };
  switch (pf.k) {
    case 'hyp':
      out.add(pf.name);
      break;
    case 'intro':
      usedNames(pf.body, out);
      break;
    case 'and':
    case 'iff':
      usedNames(pf.l, out);
      usedNames(pf.r, out);
      break;
    case 'inl':
    case 'inr':
      usedNames(pf.p, out);
      break;
    case 'andE':
      usedNames(pf.body, out);
      if (out.has(pf.a) || out.has(pf.b)) out.add(pf.h);
      break;
    case 'exE':
      usedNames(pf.body, out);
      out.add(pf.h);
      break;
    case 'exI':
      out.add(pf.w);
      usedNames(pf.p, out);
      break;
    case 'orE':
      out.add(pf.h);
      usedNames(pf.l, out);
      usedNames(pf.r, out);
      break;
    case 'app':
      out.add(pf.h);
      items(pf.items);
      break;
    case 'exfalso':
      usedNames(pf.p, out);
      break;
    case 'falseE':
      out.add(pf.h);
      break;
    case 'trivial':
      break;
    case 'have':
      usedNames(pf.body, out);
      if (out.has(pf.name)) {
        out.add(pf.h);
        items(pf.items);
      }
      break;
    case 'byCases':
      usedNames(pf.l, out);
      usedNames(pf.r, out);
      break;
    case 'byContra':
      usedNames(pf.body, out);
      break;
  }
  return out;
}

/** Remove `andE` nodes whose parts are never used (they arise from eager destructuring). */
export function prune(pf: Pf): Pf {
  const rec = (p: Pf): Pf => {
    switch (p.k) {
      case 'intro':
        return { ...p, body: rec(p.body) };
      case 'and':
      case 'iff':
        return { ...p, l: rec(p.l), r: rec(p.r) };
      case 'inl':
      case 'inr':
        return { ...p, p: rec(p.p) };
      case 'andE': {
        const body = rec(p.body);
        const u = usedNames(body);
        if (!u.has(p.a) && !u.has(p.b)) return body;
        return { ...p, body };
      }
      case 'exE':
        return { ...p, body: rec(p.body) };
      case 'exI':
        return { ...p, p: rec(p.p) };
      case 'orE':
        return { ...p, l: rec(p.l), r: rec(p.r) };
      case 'app':
        return { ...p, items: p.items.map((it) => ('term' in it ? it : { pf: rec(it.pf) })) };
      case 'exfalso':
        return { ...p, p: rec(p.p) };
      case 'have': {
        const body = rec(p.body);
        if (!usedNames(body).has(p.name)) return body;
        return { ...p, items: p.items.map((it) => ('term' in it ? it : { pf: rec(it.pf) })), body };
      }
      case 'byCases':
        return { ...p, l: rec(p.l), r: rec(p.r) };
      case 'byContra':
        return { ...p, body: rec(p.body) };
      default:
        return p;
    }
  };
  return rec(pf);
}

/** Proof statistics used for rating, hints and themes. */
export interface Stats {
  nodes: number;
  splits: number;
  applies: number;
  haves: number;
  exfalsos: number;
  classical: number;
  lefts: number;
  constructors: number;
  destructs: number;
  witnesses: number;
  maxDepth: number;
}

export function stats(pf: Pf): Stats {
  const s: Stats = {
    nodes: 0,
    splits: 0,
    applies: 0,
    haves: 0,
    exfalsos: 0,
    classical: 0,
    lefts: 0,
    constructors: 0,
    destructs: 0,
    witnesses: 0,
    maxDepth: 0,
  };
  const go = (p: Pf, d: number) => {
    s.nodes++;
    s.maxDepth = Math.max(s.maxDepth, d);
    switch (p.k) {
      case 'intro':
        return go(p.body, d);
      case 'and':
      case 'iff':
        s.constructors++;
        go(p.l, d + 1);
        return go(p.r, d + 1);
      case 'inl':
      case 'inr':
        s.lefts++;
        return go(p.p, d);
      case 'andE':
      case 'exE':
        s.destructs++;
        return go(p.body, d);
      case 'exI':
        s.witnesses++;
        return go(p.p, d);
      case 'orE':
        s.splits++;
        go(p.l, d + 1);
        return go(p.r, d + 1);
      case 'app': {
        const nontriv = p.items.filter((it) => 'pf' in it && it.pf.k !== 'hyp');
        if (nontriv.length) s.applies++;
        for (const it of p.items) if ('pf' in it) go(it.pf, d + (nontriv.length > 1 ? 1 : 0));
        return;
      }
      case 'exfalso':
        s.exfalsos++;
        return go(p.p, d);
      case 'have':
        s.haves++;
        for (const it of p.items) if ('pf' in it) go(it.pf, d + 1);
        return go(p.body, d);
      case 'byCases':
        s.classical++;
        s.splits++;
        go(p.l, d + 1);
        return go(p.r, d + 1);
      case 'byContra':
        s.classical++;
        return go(p.body, d);
      default:
        return;
    }
  };
  go(pf, 0);
  return s;
}


/**
 * Every assumption the *statement* offers must be used: along the spine of the proof (intros,
 * destructuring, both sides of `constructor`), an introduced hypothesis must be needed.
 */
export function spineUsesAll(pf: Pf): boolean {
  switch (pf.k) {
    case 'intro':
      if (pf.f !== null && !usedNames(pf.body).has(pf.name)) return false;
      return spineUsesAll(pf.body);
    case 'andE':
    case 'exE':
      return spineUsesAll(pf.body);
    case 'and':
    case 'iff':
      return spineUsesAll(pf.l) && spineUsesAll(pf.r);
    default:
      return true;
  }
}
