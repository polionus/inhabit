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
    },
    {
      goal: (x) => `${x.n} = 0 + ${x.n}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl([`Nat.add_succ 0 ${x.k}`, `← ${x.ih}`]),
      idea: 'Same idea as `0 + n = n`, with the sides swapped: in the step, rewrite with `ih` from right to left.',
    },
    {
      goal: (x) => `0 * ${x.n} = 0`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.mul_succ', x.ih]),
      idea: 'Multiplication recurses on its second argument. In the step, `Nat.mul_succ` unfolds `0 * (k + 1)` to `0 * k + 0`.',
    },
    {
      goal: (x) => `1 * ${x.n} = ${x.n}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.mul_succ', x.ih]),
      idea: 'In the step, `Nat.mul_succ` turns `1 * (k + 1)` into `1 * k + 1`, and `ih` knows `1 * k`.',
    },
    {
      goal: (x) => `${x.a} + ${x.b} + ${x.n} = ${x.a} + (${x.b} + ${x.n})`,
      params: (x) => [x.a, x.b],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.add_succ', 'Nat.add_succ', 'Nat.add_succ', x.ih]),
      idea: 'Induct on the last variable: every sum ends in it. In the step, unfold each `+ (k + 1)` with `Nat.add_succ`.',
      bonus: 40,
    },
    {
      goal: (x) => `Nat.succ ${x.a} + ${x.n} = Nat.succ (${x.a} + ${x.n})`,
      params: (x) => [x.a],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.add_succ', 'Nat.add_succ', x.ih]),
      idea: 'Induct on the right-hand argument, where addition does its recursion. Both sides contain a `+ (k + 1)`.',
    },
    {
      goal: (x) => `${x.a} + ${x.n} = ${x.n} + ${x.a}`,
      params: (x) => [x.a],
      zero: () => rwl(['Nat.add_zero', 'Nat.zero_add']),
      succ: (x) => rwl(['Nat.add_succ', x.ih, 'Nat.succ_add']),
      idea: 'Base case: one side computes, the other needs `Nat.zero_add`. Step: unfold, use `ih`, and move the `succ` with `Nat.succ_add`.',
      bonus: 40,
    },
    {
      goal: (x) => `${c} + ${x.n} = ${x.n} + ${c}`,
      params: () => [],
      zero: () => 'rfl',
      succ: (x) => rwl(['Nat.add_succ', x.ih, 'Nat.succ_add']),
      idea: 'With only numbers left, the base case is a computation. In the step, unfold, use `ih`, then `Nat.succ_add`.',
    },
    {
      goal: (x) => `${x.a} * ${x.n} = ${x.n} * ${x.a}`,
      params: (x) => [x.a],
      zero: () => rwl(['Nat.mul_zero', 'Nat.zero_mul']),
      succ: (x) => rwl(['Nat.mul_succ', x.ih, 'Nat.succ_mul']),
      idea: 'Base case: `Nat.mul_zero` and `Nat.zero_mul`. Step: unfold with `Nat.mul_succ`, use `ih`, finish with `Nat.succ_mul`.',
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
    idea: s.idea,
    themes: ['induction', 'natural numbers', 'rewriting'],
    bonus: 100 + (s.bonus ?? 0),
  };
  return buildArith('ind', cand);
}
