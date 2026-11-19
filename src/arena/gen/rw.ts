/**
 * `rw` family: equality reasoning over natural numbers. Rewrite chains with hypotheses
 * (`rw [h]`, `rw [← h]`, `rw [h] at h'`, `rwa`, `subst`, `symm`, `calc`), functions and
 * predicates applied to equal arguments, `≠`, an existential in the style of the Equality
 * world's last level, and (once the bank has them) rewriting with Nat lemmas.
 *
 * Every candidate is a template filled with random names and constants; the engine re-checks the
 * reference proof before a puzzle is returned (see arith.ts `pickArith`).
 */
import type { Rng } from '../types.ts';
import { andList, buildArith, enExpr, lemOk, prefers, tacOk, varNames } from './arith.ts';
import type { ArithBuilt, ArithCand, Gate, Hyp } from './arith.ts';

const SUB = ['₁', '₂', '₃', '₄', '₅'];
const hn = (i: number) => 'h' + SUB[i];

/** Pick one style: those using a focus tactic first (most of the time), else any allowed. */
function chooseStyle<S extends string>(rng: Rng, gate: Gate, styles: [S, string[]][]): S | null {
  const ok = styles.filter(([, ts]) => ts.every((t) => tacOk(gate, t)));
  if (!ok.length) return null;
  const focused = ok.filter(([, ts]) => ts.some((t) => t !== 'rw' && t !== 'exact' && prefers(gate, t)));
  if (focused.length && rng.next() < 0.85) return rng.pick(focused)[0];
  return rng.pick(ok)[0];
}

interface Chain {
  vars: string[];
  hyps: Hyp[];
  /** forward[i]: hyp i reads `v_i = v_{i+1}` (else `v_{i+1} = v_i`). */
  forward: boolean[];
}

function chain(rng: Rng, vars: string[], firstHyp = 0, pFwd = 0.6): Chain {
  const hyps: Hyp[] = [];
  const forward: boolean[] = [];
  for (let i = 0; i + 1 < vars.length; i++) {
    const f = rng.next() < pFwd;
    forward.push(f);
    const [l, r] = f ? [vars[i], vars[i + 1]] : [vars[i + 1], vars[i]];
    hyps.push({ name: hn(firstHyp + i), type: `${l} = ${r}`, en: `${l} = ${r}` });
  }
  return { vars, hyps, forward };
}

/** Rules that rewrite v_0 → v_k (forward) or v_k → v_0 (backward), one hypothesis at a time. */
const fwdRules = (c: Chain) => c.hyps.map((h, i) => (c.forward[i] ? h.name : `← ${h.name}`));
const backRules = (c: Chain) => c.hyps.map((h, i) => (c.forward[i] ? `← ${h.name}` : h.name)).reverse();

const natBinder = (vs: string[]) => `(${vs.join(' ')} : Nat)`;

type Ctx = { show: (x: string) => string; fn?: 'f'; pred?: boolean };

function contexts(rng: Rng, allowPred: boolean): Ctx {
  const c = 2 + rng.int(8);
  const opts: Ctx[] = [
    { show: (x) => `${x} + ${c}` },
    { show: (x) => `${c} * ${x}` },
    { show: (x) => `${x} * ${c}` },
    { show: (x) => `f ${x}`, fn: 'f' },
    { show: (x) => `${x} + ${x}` },
    { show: (x) => `f ${x} + ${c}`, fn: 'f' },
  ];
  if (allowPred) opts.push({ show: (x) => `P ${x}`, pred: true }, { show: (x) => `P (${x} + ${c})`, pred: true });
  return rng.pick(opts);
}

const ctxBinders = (ctx: { fn?: string; pred?: boolean }) => [...(ctx.fn ? ['(f : Nat → Nat)'] : []), ...(ctx.pred ? ['(P : Nat → Prop)'] : [])];

/* ---------- S1: transport a fact along a chain of equalities ---------- */

function transport(rng: Rng, gate: Gate): ArithCand | null {
  const k = 1 + rng.int(3);
  const names = varNames(rng, k + 2);
  const vars = names.slice(0, k + 1);
  const ch = chain(rng, vars);
  const ctx = contexts(rng, true);
  let K = '';
  const binders = [...ctxBinders(ctx)];
  const useVarK = !ctx.pred && rng.next() < 0.3;
  if (!ctx.pred) K = useVarK ? names[k + 1] : String(3 + rng.int(17));
  binders.push(natBinder(useVarK ? [...vars, K] : vars));
  const v0 = vars[0];
  const vk = vars[k];
  const fact = ctx.pred ? ctx.show(v0) : `${ctx.show(v0)} = ${K}`;
  const goal = ctx.pred ? ctx.show(vk) : `${ctx.show(vk)} = ${K}`;
  const hp = 'h' + v0;
  const hyps = [...ch.hyps, { name: hp, type: fact, en: enExpr(fact) }];
  const style = chooseStyle(rng, gate, [
    ['goal', ['rw', 'exact']],
    ['at', ['rw', 'exact']],
    ['rwa', ['rwa']],
    ['subst', ['subst', 'exact']],
  ]);
  if (!style) return null;
  let lines: string[];
  let idea: string;
  if (style === 'goal') {
    lines = [`rw [${backRules(ch).join(', ')}]`, `exact ${hp}`];
    idea = `Rewrite the goal until it is exactly \`${hp}\`. Which way does each equation need to point?`;
  } else if (style === 'at') {
    lines = [`rw [${fwdRules(ch).join(', ')}] at ${hp}`, `exact ${hp}`];
    idea = `Change \`${hp}\` instead of the goal: \`rw [...] at ${hp}\` rewrites a hypothesis.`;
  } else if (style === 'rwa') {
    lines = [`rwa [${fwdRules(ch).join(', ')}] at ${hp}`];
    idea = `Rewrite \`${hp}\` until it matches the goal; \`rwa\` rewrites and then closes the goal with a hypothesis.`;
  } else {
    lines = [...ch.hyps.map((h) => `subst ${h.name}`), `exact ${hp}`];
    idea = 'Each equation is between two variables, so `subst` can replace one variable by the other everywhere.';
  }
  return { binders, hyps, goal, goalEn: enExpr(goal), lines, idea, themes: ['equality', 'rewriting', ...(k > 1 ? ['chain'] : [])] };
}

/* ---------- S2: equal arguments give equal values ---------- */

function chainEq(rng: Rng, gate: Gate): ArithCand | null {
  const k = 2 + rng.int(3);
  const vars = varNames(rng, k + 1);
  const ch = chain(rng, vars, 0, 0.55);
  const c = 2 + rng.int(8);
  const G = rng.pick<{ show: (x: string) => string; fn?: 'f' }>([
    { show: (x) => x },
    { show: (x) => x },
    { show: (x) => `f ${x}`, fn: 'f' },
    { show: (x) => `${x} + ${c}` },
    { show: (x) => `${c} * ${x}` },
  ]);
  const v0 = vars[0];
  const vk = vars[k];
  const isId = G.show('q') === 'q';
  const lastBack = !ch.forward[k - 1];
  const styles: [string, string[]][] = [['rw', ['rw']], ['calc', ['calc', 'rw']]];
  if (isId && lastBack) styles.push(['symm', ['rw', 'symm', 'exact']]);
  // `symm` fits only some chains; take it whenever it fits and is allowed, half the time
  const style = isId && lastBack && tacOk(gate, 'symm') && rng.next() < 0.5 ? 'symm' : chooseStyle(rng, gate, styles);
  if (!style) return null;
  const goal = `${G.show(v0)} = ${G.show(vk)}`;
  let lines: string[];
  let idea: string;
  if (style === 'rw') {
    lines = [`rw [${fwdRules(ch).join(', ')}]`];
    idea = `Rewrite \`${v0}\` step by step until both sides are the same; \`rw\` closes a goal of the form \`t = t\` by itself.`;
  } else if (style === 'symm') {
    const pre = fwdRules(ch).slice(0, -1);
    lines = [...(pre.length ? [`rw [${pre.join(', ')}]`] : []), 'symm', `exact ${ch.hyps[k - 1].name}`];
    idea = `The last equation points the wrong way. \`symm\` swaps the two sides of the goal.`;
  } else {
    lines = [];
    for (let i = 0; i < k; i++) {
      const step = isId && ch.forward[i] ? ch.hyps[i].name : `by rw [${ch.hyps[i].name}]`;
      lines.push(i === 0 ? `calc ${G.show(vars[0])} = ${G.show(vars[1])} := ${step}` : `  _ = ${G.show(vars[i + 1])} := ${step}`);
    }
    idea = 'Write the chain out with `calc`: one step per equation, each justified by a hypothesis.';
  }
  return {
    binders: [...(G.fn ? ['(f : Nat → Nat)'] : []), natBinder(vars)],
    hyps: ch.hyps,
    goal,
    goalEn: enExpr(goal),
    lines,
    idea,
    themes: ['equality', 'transitivity', ...(G.fn ? ['functions'] : [])],
  };
}

/* ---------- S3: compute through equations (calc with numbers) ---------- */

function calcArith(rng: Rng, gate: Gate): ArithCand | null {
  const k = 1 + rng.int(2);
  const vars = varNames(rng, k + 1);
  const cs = Array.from({ length: k + 1 }, () => 1 + rng.int(9));
  const mul = rng.next() < 0.35;
  // h_i : v_i = v_{i+1} + c_i  (or c_i * v_{i+1} on the first), last: v_k = c_k
  const hyps: Hyp[] = [];
  const rhs: string[] = [];
  for (let i = 0; i < k; i++) {
    const r = mul && i === 0 ? `${cs[i] + 1} * ${vars[i + 1]}` : `${vars[i + 1]} + ${cs[i]}`;
    rhs.push(r);
    hyps.push({ name: hn(i), type: `${vars[i]} = ${r}`, en: `${vars[i]} = ${r}` });
  }
  hyps.push({ name: hn(k), type: `${vars[k]} = ${cs[k]}`, en: `${vars[k]} = ${cs[k]}` });
  // value
  let val = cs[k];
  for (let i = k - 1; i >= 0; i--) val = mul && i === 0 ? (cs[i] + 1) * val : val + cs[i];
  const goal = `${vars[0]} = ${val}`;
  const styles: [string, string[]][] = [['calc', ['calc', 'rw']]];
  if (!mul) styles.push(['rw', ['rw']]);
  const style = chooseStyle(rng, gate, styles);
  if (!style) return null;
  let lines: string[];
  let idea: string;
  if (style === 'rw') {
    lines = [`rw [${hyps.map((h) => h.name).join(', ')}]`];
    idea = `Replace each variable by what it equals. When only numbers are left, \`rw\` checks the arithmetic itself.`;
  } else {
    const steps: string[] = [];
    let cur = rhs[0];
    steps.push(`calc ${vars[0]} = ${cur} := ${hn(0)}`);
    for (let i = 1; i <= k; i++) {
      const repl = i < k ? `(${rhs[i]})` : String(cs[k]);
      let next = cur.replace(new RegExp(`\\b${vars[i]}\\b`), repl);
      next = next.replace(/^\(([^()]*)\) \+/, '$1 +');
      steps.push(`  _ = ${next} := by rw [${hn(i)}]`);
      cur = next;
    }
    steps.push(`  _ = ${val} := rfl`);
    lines = steps;
    idea = 'A `calc` chain: substitute one equation per step, and let `rfl` do the final arithmetic.';
  }
  return {
    binders: [natBinder(vars)],
    hyps,
    goal,
    goalEn: enExpr(goal),
    lines,
    idea,
    themes: ['equality', 'computation', ...(style === 'calc' ? ['calc'] : [])],
  };
}

/* ---------- S4: functions applied to known values ---------- */

function funChain(rng: Rng, gate: Gate): ArithCand | null {
  if (rng.next() < 0.3) {
    // ∀-hypothesis: f x = x + c for every x
    const [a] = varNames(rng, 1);
    const c = 1 + rng.int(9);
    const depth = 2 + rng.int(2);
    let lhs = a;
    for (let i = 0; i < depth; i++) lhs = i === 0 ? `f ${lhs}` : `f (${lhs})`;
    const rhs = a + ` + ${c}`.repeat(depth);
    const style = chooseStyle(rng, gate, [['rw', ['rw']]]);
    if (!style) return null;
    return {
      binders: ['(f : Nat → Nat)', natBinder([a])],
      hyps: [{ name: 'hf', type: `∀ x, f x = x + ${c}`, en: `f(x) = x + ${c} for every x` }],
      goal: `${lhs} = ${rhs}`,
      goalEn: enExpr(`${lhs} = ${rhs}`),
      lines: [`rw [${Array(depth).fill('hf').join(', ')}]`],
      idea: '`hf` holds for every `x`, so `rw [hf]` can rewrite any `f _`. Each use removes one `f`.',
      themes: ['equality', 'functions', 'rewriting'],
    };
  }
  const depth = 2 + rng.int(2);
  const vars = varNames(rng, depth + 1);
  const two = rng.next() < 0.35;
  const fnAt = (i: number) => (two && i === depth - 1 ? 'g' : 'f');
  const hyps: Hyp[] = [];
  const rules: string[] = [];
  for (let i = 0; i < depth; i++) {
    const app = `${fnAt(i)} ${vars[i]}`;
    const fwd = rng.next() < 0.7;
    hyps.push({ name: hn(i), type: fwd ? `${app} = ${vars[i + 1]}` : `${vars[i + 1]} = ${app}`, en: enExpr(fwd ? `${app} = ${vars[i + 1]}` : `${vars[i + 1]} = ${app}`) });
    rules.push(fwd ? hn(i) : `← ${hn(i)}`);
  }
  let lhs = vars[0];
  for (let i = 0; i < depth; i++) lhs = i === 0 ? `${fnAt(i)} ${lhs}` : `${fnAt(i)} (${lhs})`;
  const goal = `${lhs} = ${vars[depth]}`;
  const order = rng.shuffle(hyps.map((_, i) => i));
  const style = chooseStyle(rng, gate, [['rw', ['rw']], ['calc', ['calc', 'rw']]]);
  if (!style) return null;
  let lines: string[];
  if (style === 'rw') lines = [`rw [${rules.join(', ')}]`];
  else {
    const wrap = (i: number) => {
      let t = vars[i];
      for (let j = i; j < depth; j++) t = j === i ? `${fnAt(j)} ${t}` : `${fnAt(j)} (${t})`;
      return t;
    };
    lines = [];
    for (let i = 0; i < depth; i++) {
      const step = i === depth - 1 && rules[i] === hn(i) ? hn(i) : `by rw [${rules[i]}]`;
      lines.push(i === 0 ? `calc ${wrap(0)} = ${wrap(1)} := ${step}` : `  _ = ${wrap(i + 1)} := ${step}`);
    }
  }
  return {
    binders: [two ? '(f g : Nat → Nat)' : '(f : Nat → Nat)', natBinder(vars)],
    hyps: order.map((i) => hyps[i]),
    goal,
    goalEn: enExpr(goal),
    lines,
    idea: 'Work from the inside out: the innermost application is the one a hypothesis knows.',
    themes: ['equality', 'functions', 'rewriting'],
  };
}

/* ---------- S5: inequality ---------- */

function neq(rng: Rng, gate: Gate): ArithCand | null {
  const k = 1 + rng.int(2);
  const names = varNames(rng, k + 2);
  const vars = names.slice(0, k + 1);
  const w = names[k + 1];
  const ch = chain(rng, vars);
  const v0 = vars[0];
  const vk = vars[k];
  const hne = 'hne';
  const style = chooseStyle(rng, gate, [
    ['rw', ['rw', 'exact']],
    ['apply', ['intro', 'apply', 'rw', 'exact']],
  ]);
  if (!style) return null;
  const lines =
    style === 'rw'
      ? [`rw [${backRules(ch).join(', ')}]`, `exact ${hne}`]
      : ['intro heq', `apply ${hne}`, `rw [${fwdRules(ch).join(', ')}]`, 'exact heq'];
  return {
    binders: [natBinder([...vars, w])],
    hyps: [...ch.hyps, { name: hne, type: `${v0} ≠ ${w}`, en: `${v0} ≠ ${w}` }],
    goal: `${vk} ≠ ${w}`,
    goalEn: `${vk} ≠ ${w}`,
    lines,
    idea:
      style === 'rw'
        ? '`≠` is a statement like any other: `rw` can rewrite inside it.'
        : '`x ≠ y` means `x = y → False`. Introduce the equation, then use `hne` to reach `False`.',
    themes: ['equality', 'inequality'],
  };
}

/* ---------- S6: rewrite under a ∀-hypothesis, existentials ---------- */

function exists(rng: Rng, gate: Gate): ArithCand | null {
  const c = 1 + rng.int(6);
  const K = c + 2 + rng.int(9);
  const form = rng.pick<[string, (x: string) => string]>([
    ['x + c', (x) => `${x} + ${c}`],
    ['c + x', (x) => `${c} + ${x}`],
    ['c * x', (x) => `${c + 1} * ${x}`],
    ['x * c', (x) => `${x} * ${c + 1}`],
  ]);
  const show = form[1];
  const [a, b] = varNames(rng, 2);
  if (rng.next() < 0.4 || !tacOk(gate, 'obtain') || !tacOk(gate, 'use') || !tacOk(gate, 'intro')) {
    const style = chooseStyle(rng, gate, [['at', ['rw', 'exact']], ['rwa', ['rwa']]]);
    if (!style) return null;
    const lines = style === 'at' ? ['rw [hf] at h', 'exact h'] : ['rwa [hf] at h'];
    return {
      binders: ['(f : Nat → Nat)', natBinder([a])],
      hyps: [
        { name: 'hf', type: `∀ x, f x = ${show('x')}`, en: `f(x) = ${show('x')} for every x` },
        { name: 'h', type: `f ${a} = ${K}`, en: `f(${a}) = ${K}` },
      ],
      goal: `${show(a)} = ${K}`,
      goalEn: `${show(a)} = ${K}`,
      lines,
      idea: '`hf` is an equation for every `x`; `rw [hf] at h` uses it with `x` chosen to match `h`.',
      themes: ['equality', 'functions', 'universal'],
    };
  }
  const lines = ['intro h', `obtain ⟨${a}, h${a}⟩ := h`, `rw [hf] at h${a}`, `use ${a}`, `rw [h${a}]`, 'exact hP'];
  const goal = `(∃ ${a}, f ${a} = ${K}) → ∃ ${b}, P (${show(b)})`;
  return {
    binders: ['(f : Nat → Nat)', '(P : Nat → Prop)'],
    hyps: [
      { name: 'hf', type: `∀ x, f x = ${show('x')}`, en: `f(x) = ${show('x')} for every x` },
      { name: 'hP', type: `P ${K}`, en: `P(${K})` },
    ],
    goal,
    goalEn: `if f(${a}) = ${K} for some ${a}, then P(${show(b)}) for some ${b}`,
    lines,
    idea: 'Unpack the existential hypothesis, rewrite it with `hf`, and reuse its witness.',
    themes: ['equality', 'existential', 'functions'],
    bonus: 40,
  };
}

/* ---------- S7–S9: Nat lemmas from the bank ---------- */

type Ex = { k: 'v'; n: string } | { k: 'n'; v: number } | { k: '+' | '*'; a: Ex; b: Ex };
const V = (n: string): Ex => ({ k: 'v', n });
const N = (v: number): Ex => ({ k: 'n', v });
const add = (a: Ex, b: Ex): Ex => ({ k: '+', a, b });
const mul = (a: Ex, b: Ex): Ex => ({ k: '*', a, b });

function show(e: Ex, ctx = 0, right = false): string {
  if (e.k === 'v') return e.n;
  if (e.k === 'n') return String(e.v);
  const p = e.k === '+' ? 65 : 70;
  const s = `${show(e.a, p, false)} ${e.k} ${show(e.b, p, true)}`;
  return p < ctx || (p === ctx && right) ? `(${s})` : s;
}
const arg = (e: Ex) => (e.k === 'v' || e.k === 'n' ? show(e) : `(${show(e)})`);
const eq = (a: Ex, b: Ex): boolean => show(a) === show(b);

/** Replace every occurrence of `from` by `to` (what `rw` does with an instantiated lemma). */
function replaceAll(e: Ex, from: Ex, to: Ex): { e: Ex; n: number } {
  if (eq(e, from)) return { e: to, n: 1 };
  if (e.k === '+' || e.k === '*') {
    const a = replaceAll(e.a, from, to);
    const b = replaceAll(e.b, from, to);
    return { e: { k: e.k, a: a.e, b: b.e }, n: a.n + b.n };
  }
  return { e, n: 0 };
}

/** Subterm positions as replacer functions. */
function positions(e: Ex): { t: Ex; put: (x: Ex) => Ex }[] {
  const out: { t: Ex; put: (x: Ex) => Ex }[] = [{ t: e, put: (x) => x }];
  if (e.k === '+' || e.k === '*') {
    for (const p of positions(e.a)) out.push({ t: p.t, put: (x) => ({ k: e.k, a: p.put(x), b: e.b }) as Ex });
    for (const p of positions(e.b)) out.push({ t: p.t, put: (x) => ({ k: e.k, a: e.a, b: p.put(x) }) as Ex });
  }
  return out;
}

/** A rewrite: `lhs` (what the rule finds) becomes `rhs`. `rule` is the text inside `rw [...]`. */
interface Rule {
  rule: string;
  lemma: string;
  lhs: Ex;
  rhs: Ex;
}

/** Ways to make a term look different; each returns the new term and the rule that undoes it. */
function disguises(t: Ex): { lemma: string; to: Ex; undo: Rule }[] {
  const out: { lemma: string; to: Ex; undo: Rule }[] = [];
  const mk = (lemma: string, to: Ex, rule: string, back = false): { lemma: string; to: Ex; undo: Rule } => ({
    lemma,
    to,
    undo: { rule: (back ? '← ' : '') + rule, lemma, lhs: to, rhs: t },
  });
  if (t.k !== 'n') {
    out.push(mk('Nat.add_zero', add(t, N(0)), `Nat.add_zero ${arg(t)}`));
    out.push(mk('Nat.zero_add', add(N(0), t), `Nat.zero_add ${arg(t)}`));
    out.push(mk('Nat.mul_one', mul(t, N(1)), `Nat.mul_one ${arg(t)}`));
    out.push(mk('Nat.one_mul', mul(N(1), t), `Nat.one_mul ${arg(t)}`));
  }
  if (t.k === '+') {
    out.push(mk('Nat.add_comm', add(t.b, t.a), `Nat.add_comm ${arg(t.b)} ${arg(t.a)}`));
    if (t.b.k === '+') out.push(mk('Nat.add_assoc', add(add(t.a, t.b.a), t.b.b), `Nat.add_assoc ${arg(t.a)} ${arg(t.b.a)} ${arg(t.b.b)}`));
    if (t.a.k === '+') out.push(mk('Nat.add_assoc', add(t.a.a, add(t.a.b, t.b)), `Nat.add_assoc ${arg(t.a.a)} ${arg(t.a.b)} ${arg(t.b)}`, true));
    if (eq(t.a, t.b)) out.push(mk('Nat.two_mul', mul(N(2), t.a), `Nat.two_mul ${arg(t.a)}`));
    if (t.a.k === '*' && t.b.k === '*' && eq(t.a.a, t.b.a))
      out.push(mk('Nat.mul_add', mul(t.a.a, add(t.a.b, t.b.b)), `Nat.mul_add ${arg(t.a.a)} ${arg(t.a.b)} ${arg(t.b.b)}`));
  }
  if (t.k === '*') out.push(mk('Nat.mul_comm', mul(t.b, t.a), `Nat.mul_comm ${arg(t.b)} ${arg(t.a)}`));
  return out;
}

function baseTerm(rng: Rng, vs: string[]): Ex {
  const [a, b, c] = vs.map(V);
  return rng.pick<Ex>([add(a, b), add(a, add(b, c)), add(add(a, b), c), mul(a, b), add(mul(a, b), c), add(a, a), add(mul(a, b), mul(a, c)), add(a, mul(b, c))]);
}

/** Apply 1–3 disguises; returns the disguised term and the proof rules (in order). */
function disguise(rng: Rng, gate: Gate, x: Ex, steps: number): { y: Ex; rules: Rule[] } | null {
  let y = x;
  const undo: Rule[] = [];
  const UNIT = ['Nat.add_zero', 'Nat.zero_add', 'Nat.mul_one', 'Nat.one_mul'];
  let units = 0;
  for (let s = 0; s < steps; s++) {
    const opts = positions(y).flatMap((p) => disguises(p.t).filter((d) => lemOk(gate, d.lemma) && !(units > 0 && UNIT.includes(d.lemma))).map((d) => ({ p, d })));
    if (!opts.length) break;
    // structural lemmas (comm, assoc, distributivity) more often than adding a 0 or a 1
    const weighted = opts.flatMap((o) => (UNIT.includes(o.d.lemma) ? [o] : [o, o, o]));
    const { p, d } = rng.pick(weighted);
    if (UNIT.includes(d.lemma)) units++;
    y = p.put(d.to);
    undo.push(d.undo);
  }
  if (!undo.length) return null;
  return { y, rules: undo.reverse() };
}

/** Simulate `rw [rules]` on a list of sides; null if some rule finds nothing. */
function simulate(sides: Ex[], rules: Rule[]): Ex[] | null {
  let cur = sides;
  for (const r of rules) {
    let n = 0;
    cur = cur.map((s) => {
      const x = replaceAll(s, r.lhs, r.rhs);
      n += x.n;
      return x.e;
    });
    if (n === 0) return null;
  }
  return cur;
}

function lemmaHyp(rng: Rng, gate: Gate): ArithCand | null {
  const vs = varNames(rng, 4);
  const x = baseTerm(rng, vs.slice(0, 3));
  const used = vs.slice(0, 3).filter((v) => show(x).includes(v));
  const w = vs[3];
  const d = disguise(rng, gate, x, 1 + rng.int(3));
  if (!d || eq(d.y, x)) return null;
  const rules = d.rules.map((r) => r.rule);
  const intoHyp = rng.next() < 0.4;
  // into the hypothesis: `h : y = w`, goal `x = w`; on the goal: `h : x = w`, goal `y = w`.
  const sim = simulate([d.y, V(w)], d.rules);
  if (!sim || !eq(sim[0], x) || !eq(sim[1], V(w))) return null;
  const styles: [string, string[]][] = intoHyp
    ? [['at', ['rw', 'exact']], ['rwa', ['rwa']]]
    : [['exact', ['rw', 'exact']], ['close', ['rw']]];
  const style = chooseStyle(rng, gate, styles);
  if (!style) return null;
  const hType = intoHyp ? `${show(d.y)} = ${w}` : `${show(x)} = ${w}`;
  const goal = intoHyp ? `${show(x)} = ${w}` : `${show(d.y)} = ${w}`;
  const lines =
    style === 'at'
      ? [`rw [${rules.join(', ')}] at h`, 'exact h']
      : style === 'rwa'
        ? [`rwa [${rules.join(', ')}] at h`]
        : style === 'exact'
          ? [`rw [${rules.join(', ')}]`, 'exact h']
          : [`rw [${[...rules, 'h'].join(', ')}]`];
  const names = [...new Set(d.rules.map((r) => '`' + r.lemma + '`'))];
  return {
    binders: [natBinder([...used, w])],
    hyps: [{ name: 'h', type: hType, en: hType }],
    goal,
    goalEn: goal,
    lines,
    idea: `The two sides differ only in how the arithmetic is written. ${names.length === 1 ? 'The lemma' : 'The lemmas'} ${andList(names)} from your inventory bridge${names.length === 1 ? 's' : ''} the gap.`,
    themes: ['rewriting', 'arithmetic', 'lemmas'],
  };
}

function lemmaGoal(rng: Rng, gate: Gate): ArithCand | null {
  const vs = varNames(rng, 3);
  const x = baseTerm(rng, vs);
  const used = vs.filter((v) => show(x).includes(v));
  const d = disguise(rng, gate, x, 1 + rng.int(3));
  if (!d || eq(d.y, x)) return null;
  const sim = simulate([d.y, x], d.rules);
  if (!sim || !eq(sim[0], sim[1])) return null;
  // every rule must still change something (no rule made redundant by an earlier one)
  const style = chooseStyle(rng, gate, [['rw', ['rw']]]);
  if (!style) return null;
  const goal = `${show(d.y)} = ${show(x)}`;
  const names = [...new Set(d.rules.map((r) => '`' + r.lemma + '`'))];
  return {
    binders: [natBinder(used)],
    hyps: [],
    forAll: used,
    goal,
    goalEn: goal,
    lines: [`rw [${d.rules.map((r) => r.rule).join(', ')}]`],
    idea: `Rewrite the left side into the right side with ${andList(names)}. Give the lemma its arguments to say exactly where it applies.`,
    themes: ['rewriting', 'arithmetic', 'lemmas'],
  };
}

/** Nat-03 style: unfold `+ 1` / `* (_ + 1)` with the defining equations, then use the hypothesis. */
function succStep(rng: Rng, gate: Gate): ArithCand | null {
  const [a, b, w] = varNames(rng, 3);
  const K = 2 + rng.int(15);
  const form = rng.int(3);
  let hType: string;
  let goal: string;
  let lemma: string;
  if (form === 0) {
    hType = `${a} + ${b} = ${K}`;
    goal = `${a} + (${b} + 1) = ${K + 1}`;
    lemma = 'Nat.add_succ';
  } else if (form === 1) {
    hType = `${a} + ${b} = ${w}`;
    goal = `${a} + (${b} + 1) = ${w} + 1`;
    lemma = 'Nat.add_succ';
  } else {
    hType = `${a} * ${b} = ${w}`;
    goal = `${a} * (${b} + 1) = ${w} + ${a}`;
    lemma = 'Nat.mul_succ';
  }
  if (!lemOk(gate, lemma) || !tacOk(gate, 'rw')) return null;
  return {
    binders: [natBinder(form === 0 ? [a, b] : [a, b, w])],
    hyps: [{ name: 'h', type: hType, en: hType }],
    goal,
    goalEn: goal,
    lines: [`rw [${lemma}, h]`],
    idea: `\`${lemma}\` unfolds the \`+ 1\` on the right of the ${lemma === 'Nat.add_succ' ? 'sum' : 'product'}; after that the hypothesis fits.`,
    themes: ['rewriting', 'arithmetic', 'definitions'],
  };
}

/* ---------- S0: computation, true by `rfl` ---------- */

function compute(rng: Rng, gate: Gate): ArithCand | null {
  if (!tacOk(gate, 'rfl')) return null;
  const [p, q, r] = [2 + rng.int(8), 1 + rng.int(9), 2 + rng.int(4)];
  const [a] = varNames(rng, 1);
  const forms: [string, string[], string][] = [
    [`(fun x => x + ${p}) ${q} * ${r} = ${(q + p) * r}`, [], 'Both sides are numbers once the function is applied; Lean can compute them.'],
    [`${p} + ${q} * ${r} = ${p + q * r}`, [], 'Only numbers: evaluate both sides.'],
    [`(fun x => ${r} * x) ${q} + ${p} = ${r * q + p}`, [], 'Apply the function, then compute.'],
    [`(fun x => x + ${p}) ${a} = ${a} + ${p}`, [a], 'Applying a `fun` substitutes the argument: the two sides are the same by definition.'],
    [`${a} + 0 = ${a}`, [a], 'Adding `0` on the right is how addition is defined to stop: the sides are equal by definition.'],
    [`${a} + (${q} + 1) = ${a} + ${q} + 1`, [a], 'Addition unfolds on its right argument, so both sides compute to the same thing.'],
  ];
  const [goal, vs, idea] = rng.pick(forms);
  return { binders: vs.length ? [natBinder(vs)] : [], hyps: [], forAll: vs, goal, goalEn: goal.replace(/\(fun x => ([^)]*)\) (\w+)/, '(x ↦ $1)($2)'), lines: ['rfl'], idea, themes: ['equality', 'definitional equality'] };
}

/* ---------- the family ---------- */

const SHAPES: [number, (rng: Rng, gate: Gate) => ArithCand | null][] = [
  [1, compute],
  [4, transport],
  [3, chainEq],
  [2, calcArith],
  [2, funChain],
  [2, neq],
  [2, exists],
  [3, lemmaHyp],
  [2, lemmaGoal],
  [1, succStep],
];

const FOCUS_SHAPES: Record<string, (rng: Rng, gate: Gate) => ArithCand | null> = {
  calc: calcArith,
  symm: chainEq,
  subst: transport,
  rwa: transport,
  rfl: compute,
  apply: neq,
  obtain: exists,
  use: exists,
};

export function rwAttempt(rng: Rng, _target: number, gate: Gate): ArithBuilt | null {
  let shape: ((rng: Rng, gate: Gate) => ArithCand | null) | undefined;
  const special = (gate.focus ?? []).filter((t) => FOCUS_SHAPES[t] && tacOk(gate, t));
  if (special.length && rng.next() < 0.8) shape = FOCUS_SHAPES[rng.pick(special)];
  if (!shape) {
    // Once the bank holds the algebra lemmas, practice is mostly about using them.
    const algebra = !!gate.lemmas && ['Nat.zero_add', 'Nat.add_comm', 'Nat.add_assoc'].filter((l) => gate.lemmas!.has(l)).length >= 2;
    const shapes: typeof SHAPES = algebra ? SHAPES.map(([w, f]) => [f === lemmaHyp || f === lemmaGoal ? w * 4 : w, f]) : SHAPES;
    const total = shapes.reduce((n, [w]) => n + w, 0);
    let r = rng.next() * total;
    for (const [w, f] of shapes) {
      r -= w;
      if (r < 0) {
        shape = f;
        break;
      }
    }
    shape ??= transport;
  }
  const c = shape(rng, gate);
  return c ? buildArith('rw', c) : null;
}
