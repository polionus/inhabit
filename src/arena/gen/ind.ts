/**
 * `ind` family: small identities about natural numbers proved by induction,
 *
 *   induction n with
 *   | zero => …
 *   | succ k ih => rw [...]
 *
 * A handful of shapes (the Nat world's own lemmas and close relatives), each with its variable,
 * case and hypothesis names and its constants varied. Every shape lists the lemmas its proof
 * cites, so a gate can keep it to what a level has unlocked.
 */
import type { Rng } from '../types.ts';
import { buildArith, lemOk, tacOk } from './arith.ts';
import type { ArithBuilt, ArithCand, Gate } from './arith.ts';

interface Names {
  n: string;
  k: string;
  ih: string;
  a: string;
  b: string;
}

interface Shape {
  /** Statement over the names (the induction variable is `n`). */
  goal: (x: Names) => string;
  /** Other variables, in binder order (the induction variable is placed by `order`). */
  params: (x: Names) => string[];
  zero: (x: Names) => string;
  succ: (x: Names) => string;
  idea: string;
  /** Bank lemmas that restate the goal: a solver may not cite them. */
  forbid: string[];
  bonus?: number;
}

const rwl = (rules: string[]) => `rw [${rules.join(', ')}]`;

function shapes(c: number): Shape[] {
  return [
    {
      goal: (x) => `0 + ${x.n} = ${x.n}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.add_succ', x.ih]),
      idea: 'Addition recurses on its second argument, so induct on it. In the step, `Nat.add_succ` pulls the `+ 1` outside; then `ih` applies.',
      forbid: ['Nat.zero_add'],
    },
    {
      goal: (x) => `${x.n} = 0 + ${x.n}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl([`Nat.add_succ 0 ${x.k}`, `← ${x.ih}`]),
      idea: 'Same idea as `0 + n = n`, with the sides swapped: in the step, rewrite with `ih` from right to left.',
      forbid: ['Nat.zero_add'],
    },
    {
      goal: (x) => `0 * ${x.n} = 0`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.mul_succ', x.ih]),
      idea: 'Multiplication recurses on its second argument. In the step, `Nat.mul_succ` unfolds `0 * (k + 1)` to `0 * k + 0`.',
      forbid: ['Nat.zero_mul'],
    },
    {
      goal: (x) => `1 * ${x.n} = ${x.n}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.mul_succ', x.ih]),
      idea: 'In the step, `Nat.mul_succ` turns `1 * (k + 1)` into `1 * k + 1`, and `ih` knows `1 * k`.',
      forbid: ['Nat.one_mul'],
    },
    {
      goal: (x) => `${x.a} + ${x.b} + ${x.n} = ${x.a} + (${x.b} + ${x.n})`,
      params: (x) => [x.a, x.b],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.add_succ', 'Nat.add_succ', 'Nat.add_succ', x.ih]),
      idea: 'Induct on the last variable: every sum ends in it. In the step, unfold each `+ (k + 1)` with `Nat.add_succ`.',
      forbid: ['Nat.add_assoc'],
      bonus: 40,
    },
    {
      goal: (x) => `Nat.succ ${x.a} + ${x.n} = Nat.succ (${x.a} + ${x.n})`,
      params: (x) => [x.a],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.add_succ', 'Nat.add_succ', x.ih]),
      idea: 'Induct on the right-hand argument, where addition does its recursion. Both sides contain a `+ (k + 1)`.',
      forbid: ['Nat.succ_add'],
    },
    {
      goal: (x) => `${x.a} + ${x.n} = ${x.n} + ${x.a}`,
      params: (x) => [x.a],
      zero: () => rwl(['Nat.add_zero', 'Nat.zero_add']),
      succ: (x) => rwl(['Nat.add_succ', x.ih, 'Nat.succ_add']),
      idea: 'Base case: one side computes, the other needs `Nat.zero_add`. Step: unfold, use `ih`, and move the `succ` with `Nat.succ_add`.',
      forbid: ['Nat.add_comm'],
      bonus: 40,
    },
    {
      goal: (x) => `${c} + ${x.n} = ${x.n} + ${c}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.add_succ', x.ih, 'Nat.succ_add']),
      idea: 'With only numbers left, the base case is a computation. In the step, unfold, use `ih`, then `Nat.succ_add`.',
      forbid: ['Nat.add_comm'],
    },
    {
      goal: (x) => `${x.a} * ${x.n} = ${x.n} * ${x.a}`,
      params: (x) => [x.a],
      zero: () => rwl(['Nat.mul_zero', 'Nat.zero_mul']),
      succ: (x) => rwl(['Nat.mul_succ', x.ih, 'Nat.succ_mul']),
      idea: 'Base case: `Nat.mul_zero` and `Nat.zero_mul`. Step: unfold with `Nat.mul_succ`, use `ih`, finish with `Nat.succ_mul`.',
      forbid: ['Nat.mul_comm'],
      bonus: 60,
    },
    {
      goal: (x) => `${x.n} + ${c} = ${c} + ${x.n}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl([`Nat.succ_add ${x.k} ${c}`, `Nat.add_succ ${c} ${x.k}`, x.ih]),
      idea: 'The base case is a computation. In the step, `Nat.succ_add` and `Nat.add_succ` each pull a `+ 1` out; then `ih` finishes.',
      forbid: ['Nat.add_comm'],
    },
    {
      goal: (x) => `${x.a} + (${x.b} + ${x.n}) = ${x.a} + ${x.b} + ${x.n}`,
      params: (x) => [x.a, x.b],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.add_succ', 'Nat.add_succ', 'Nat.add_succ', x.ih]),
      idea: 'Induct on the last variable. In the step, unfold each `+ (k + 1)` with `Nat.add_succ`, then use `ih`.',
      forbid: ['Nat.add_assoc'],
      bonus: 40,
    },
    {
      goal: (x) => `${x.n} * 1 = ${x.n}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.succ_mul', x.ih]),
      idea: 'Induct on the left factor. In the step, `Nat.succ_mul` turns `(k + 1) * 1` into `k * 1 + 1`, and `ih` knows `k * 1`.',
      forbid: ['Nat.mul_one'],
    },
    {
      goal: (x) => `${x.n} * ${c} = ${c} * ${x.n}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl([`Nat.succ_mul ${x.k} ${c}`, `Nat.mul_succ ${c} ${x.k}`, x.ih]),
      idea: 'The base case is a computation. In the step, `Nat.succ_mul` and `Nat.mul_succ` unfold each side, and `ih` makes them match.',
      forbid: ['Nat.mul_comm'],
      bonus: 40,
    },
    {
      goal: (x) => `2 * ${x.n} = ${x.n} + ${x.n}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.mul_succ', x.ih, `Nat.add_succ (${x.k} + 1) ${x.k}`, `Nat.succ_add ${x.k} ${x.k}`]),
      idea: 'In the step, `Nat.mul_succ` and `ih` rewrite the left side; on the right, move each `+ 1` outside with `Nat.add_succ` and `Nat.succ_add`.',
      forbid: ['Nat.two_mul'],
      bonus: 60,
    },
  ];
}

const N_NAMES = ['n', 'm', 'x', 'y'];
const K_NAMES = ['k', 'd', 'j'];
const IH_NAMES = ['ih', 'ih', 'hk', 'IH'];
const PARAM_SETS = [
  ['a', 'b'],
  ['p', 'q'],
  ['u', 'v'],
];

export function indAttempt(rng: Rng, _target: number, gate: Gate): ArithBuilt | null {
  if (!tacOk(gate, 'induction') || !tacOk(gate, 'rw')) return null;
  const c = 2 + rng.int(8);
  const s = rng.pick(shapes(c));
  const [a, b] = rng.pick(PARAM_SETS);
  const x: Names = { n: rng.pick(N_NAMES), k: rng.pick(K_NAMES), ih: rng.pick(IH_NAMES), a, b };
  const zero = s.zero(x);
  const succ = s.succ(x);
  const lines = [`induction ${x.n} with`, `| zero => ${zero}`, `| succ ${x.k} ${x.ih} => ${succ}`];
  const sol = lines.join('\n');
  if (/\brfl\b/.test(zero) && !tacOk(gate, 'rfl')) return null;
  for (const m of sol.matchAll(/\bNat\.[a-z_]+/g)) if (!lemOk(gate, m[0])) return null;
  const params = s.params(x);
  const cand: ArithCand = {
    binders: [`(${[...params, x.n].join(' ')} : Nat)`],
    hyps: [],
    forAll: [...params, x.n],
    goal: s.goal(x),
    goalEn: s.goal(x).replace(/Nat\.succ (\w)/g, '($1 + 1)').replace(/Nat\.succ \(([^()]*)\)/g, '($1) + 1'),
    lines,
    forbidden: s.forbid,
    idea: s.idea,
    themes: ['induction', 'natural numbers', 'rewriting'],
    bonus: 100 + (s.bonus ?? 0),
  };
  return buildArith('ind', cand);
}
