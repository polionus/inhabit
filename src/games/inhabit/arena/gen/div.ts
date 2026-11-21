/**
 * `div` family: divisibility and parity, with the game's definitions
 *
 *   a ∣ b   :=  ∃ c, b = a * c
 *   Even n  :=  ∃ r, n = r + r
 *   Odd n   :=  ∃ k, n = 2 * k + 1
 *
 * Goals are proved by giving a witness (`use`, `refine ⟨w, ?_⟩`, `exact ⟨w, rfl⟩`), unpacking
 * hypotheses with `obtain ⟨k, hk⟩ := h`, rewriting with Nat lemmas, or (once unlocked) citing
 * the bank's `Nat.dvd_*` and `Even.*` lemmas.
 */
import type { Rng } from '../types.ts';
import { andList, buildArith, enExpr, prefers, tacOk, varNames } from './arith.ts';
import type { ArithBuilt, ArithCand, Gate, Hyp } from './arith.ts';

/** How to give a witness, then the rewrites that finish (empty: the goal closes by `rfl`). */
function witness(rng: Rng, gate: Gate, w: string, rules: string[]): string[] | null {
  const opts: [string, string[]][] = [];
  if (tacOk(gate, 'use')) opts.push(['use', rules.length ? [`use ${w}`, `rw [${rules.join(', ')}]`] : [`use ${w}`]]);
  if (tacOk(gate, 'refine')) opts.push(['refine', [`refine ⟨${w}, ?_⟩`, rules.length ? `rw [${rules.join(', ')}]` : 'rfl']]);
  if (!rules.length && tacOk(gate, 'exact')) opts.push(['exact', [`exact ⟨${w}, rfl⟩`]]);
  const ok = opts.filter(([, ls]) => ls.every((l) => tacOk(gate, l.split(' ')[0])));
  if (!ok.length) return null;
  const focused = ok.filter(([t]) => prefers(gate, t));
  return (focused.length && rng.next() < 0.85 ? rng.pick(focused) : rng.pick(ok))[1];
}

const hyp = (name: string, type: string): Hyp => ({ name, type, en: enExpr(type) });
const nat = (vs: string[]) => `(${vs.join(' ')} : Nat)`;
const W = ['k', 'j'];

type Make = (rng: Rng, gate: Gate) => ArithCand | null;

const dvdMulRight: Make = (rng, gate) => {
  const [a, b] = varNames(rng, 2);
  const lit = rng.next() < 0.4;
  const w = lit ? String(2 + rng.int(8)) : b;
  const lines = witness(rng, gate, w, []);
  if (!lines) return null;
  const goal = `${a} ∣ ${a} * ${w}`;
  return { binders: [nat(lit ? [a] : [a, b])], hyps: [], forAll: lit ? [a] : [a, b], goal, goalEn: enExpr(goal), lines, idea: `\`${a} ∣ …\` means \`… = ${a} * c\` for some \`c\`. Which \`c\` works here?`, themes: ['divisibility', 'witness'] };
};

const dvdMulLeft: Make = (rng, gate) => {
  const [a, v] = varNames(rng, 2);
  const lit = rng.next() < 0.4;
  const b = lit ? String(2 + rng.int(8)) : v;
  const lines = witness(rng, gate, b, [`Nat.mul_comm ${b} ${a}`]);
  if (!lines) return null;
  const goal = `${a} ∣ ${b} * ${a}`;
  return { binders: [nat(lit ? [a] : [a, b])], hyps: [], forAll: lit ? [a] : [a, b], goal, goalEn: enExpr(goal), lines, idea: `Give the witness \`${b}\`; what remains is \`${b} * ${a} = ${a} * ${b}\`, a job for \`Nat.mul_comm\`.`, themes: ['divisibility', 'witness', 'commutativity'] };
};

const dvdRefl: Make = (rng, gate) => {
  const [a] = varNames(rng, 1);
  const lines = witness(rng, gate, '1', ['Nat.mul_one']);
  if (!lines) return null;
  const goal = `${a} ∣ ${a}`;
  return { binders: [nat([a])], hyps: [], forAll: [a], goal, goalEn: enExpr(goal), lines, idea: `You need \`${a} = ${a} * c\`. The witness is \`1\`; \`Nat.mul_one\` does the rest.`, themes: ['divisibility', 'witness'] };
};

const dvdMulHyp: Make = (rng, gate) => {
  if (!tacOk(gate, 'obtain')) return null;
  const [a, b, v] = varNames(rng, 3);
  const lit = rng.next() < 0.4;
  const c = lit ? String(2 + rng.int(8)) : v;
  const left = rng.next() < 0.4;
  const [k] = W;
  const tail = left ? [`hk`, `Nat.mul_comm ${c} (${a} * ${k})`, 'Nat.mul_assoc'] : ['hk', 'Nat.mul_assoc'];
  const lines = witness(rng, gate, `${k} * ${c}`, tail);
  if (!lines) return null;
  const goal = left ? `${a} ∣ ${c} * ${b}` : `${a} ∣ ${b} * ${c}`;
  return {
    binders: [nat(lit ? [a, b] : [a, b, c])],
    hyps: [hyp('h', `${a} ∣ ${b}`)],
    goal,
    goalEn: enExpr(goal),
    lines: [`obtain ⟨${k}, hk⟩ := h`, ...lines],
    idea: `Unpack \`h\` to get \`${b} = ${a} * ${k}\`. Then find the witness for the goal.`,
    themes: ['divisibility', 'witness', 'destructuring'],
  };
};

const dvdTrans: Make = (rng, gate) => {
  if (!tacOk(gate, 'obtain')) return null;
  const [a, b, c] = varNames(rng, 3);
  const [k, j] = W;
  const lines = witness(rng, gate, `${k} * ${j}`, ['hj', 'hk', 'Nat.mul_assoc']);
  if (!lines) return null;
  const goal = `${a} ∣ ${c}`;
  return {
    binders: [nat([a, b, c])],
    hyps: [hyp('h₁', `${a} ∣ ${b}`), hyp('h₂', `${b} ∣ ${c}`)],
    goal,
    goalEn: enExpr(goal),
    lines: [`obtain ⟨${k}, hk⟩ := h₁`, `obtain ⟨${j}, hj⟩ := h₂`, ...lines],
    idea: 'Unpack both hypotheses. The witness for the goal is the product of the two witnesses.',
    themes: ['divisibility', 'transitivity', 'destructuring'],
  };
};

const dvdAdd: Make = (rng, gate) => {
  if (!tacOk(gate, 'obtain')) return null;
  const [a, b, c] = varNames(rng, 3);
  const [k, j] = W;
  const lines = witness(rng, gate, `${k} + ${j}`, ['hk', 'hj', `Nat.mul_add ${a} ${k} ${j}`]);
  if (!lines) return null;
  const goal = `${a} ∣ ${b} + ${c}`;
  return {
    binders: [nat([a, b, c])],
    hyps: [hyp('h₁', `${a} ∣ ${b}`), hyp('h₂', `${a} ∣ ${c}`)],
    goal,
    goalEn: enExpr(goal),
    lines: [`obtain ⟨${k}, hk⟩ := h₁`, `obtain ⟨${j}, hj⟩ := h₂`, ...lines],
    idea: 'Unpack both hypotheses. Then factor the sum: `Nat.mul_add` turns `a * (k + j)` into `a * k + a * j`.',
    themes: ['divisibility', 'destructuring', 'distributivity'],
  };
};

const evenDouble: Make = (rng, gate) => {
  const [n] = varNames(rng, 1);
  const two = rng.next() < 0.5;
  const lines = witness(rng, gate, n, two ? ['Nat.two_mul'] : []);
  if (!lines) return null;
  const goal = two ? `Even (2 * ${n})` : `Even (${n} + ${n})`;
  return { binders: [nat([n])], hyps: [], forAll: [n], goal, goalEn: enExpr(goal), lines, idea: '`Even m` means `m = r + r` for some `r`. Name the `r`.', themes: ['parity', 'witness'] };
};

const oddDouble: Make = (rng, gate) => {
  const [n] = varNames(rng, 1);
  const lines = witness(rng, gate, n, []);
  if (!lines) return null;
  const goal = `Odd (2 * ${n} + 1)`;
  return { binders: [nat([n])], hyps: [], forAll: [n], goal, goalEn: enExpr(goal), lines, idea: '`Odd m` means `m = 2 * k + 1` for some `k`. Read the `k` off the goal.', themes: ['parity', 'witness'] };
};

const evenSucc: Make = (rng, gate) => {
  if (!tacOk(gate, 'obtain')) return null;
  const [n] = varNames(rng, 1);
  const [k] = W;
  const odd = rng.next() < 0.5;
  const lines = odd
    ? witness(rng, gate, `${k} + 1`, ['hk', 'Nat.two_mul', `Nat.add_right_comm ${k} ${k} 1`, `Nat.add_assoc (${k} + 1) ${k} 1`])
    : witness(rng, gate, k, ['hk', 'Nat.two_mul']);
  if (!lines) return null;
  const h = odd ? `Odd ${n}` : `Even ${n}`;
  const goal = odd ? `Even (${n} + 1)` : `Odd (${n} + 1)`;
  return {
    binders: [nat([n])],
    hyps: [hyp('h', h)],
    goal,
    goalEn: enExpr(goal),
    lines: [`obtain ⟨${k}, hk⟩ := h`, ...lines],
    idea: odd
      ? 'Unpack `h`: `n = 2 * k + 1`. The next number is `(k + 1) + (k + 1)`; rearrange with `Nat.two_mul` and the addition lemmas.'
      : 'Unpack `h`: `n = k + k`. Then `n + 1 = 2 * k + 1`, and `Nat.two_mul` says `2 * k = k + k`.',
    themes: ['parity', 'destructuring', 'rewriting'],
    bonus: odd ? 60 : 0,
  };
};

const evenMul: Make = (rng, gate) => {
  const [m, v] = varNames(rng, 2);
  const lit = rng.next() < 0.4;
  const n = lit ? String(2 + rng.int(8)) : v;
  const vs = lit ? [m] : [m, n];
  if (rng.next() < 0.5 && (!gate.lemmas || gate.lemmas.has('Even.mul_right')) && tacOk(gate, 'exact')) {
    return { binders: [nat(vs)], hyps: [hyp('h', `Even ${m}`)], goal: `Even (${m} * ${n})`, goalEn: enExpr(`Even (${m} * ${n})`), lines: [`exact Even.mul_right h ${n}`], idea: 'Your inventory has a lemma for exactly this.', themes: ['parity', 'lemmas'] };
  }
  if (!tacOk(gate, 'obtain')) return null;
  const [k] = W;
  const lines = witness(rng, gate, `${k} * ${n}`, ['hk', 'Nat.add_mul']);
  if (!lines) return null;
  return {
    binders: [nat(vs)],
    hyps: [hyp('h', `Even ${m}`)],
    goal: `Even (${m} * ${n})`,
    goalEn: enExpr(`Even (${m} * ${n})`),
    lines: [`obtain ⟨${k}, hk⟩ := h`, ...lines],
    idea: 'Unpack `h`. Then `(k + k) * n` splits with `Nat.add_mul`.',
    themes: ['parity', 'destructuring', 'distributivity'],
  };
};

/** Combine hypotheses with the bank's lemmas: `Nat.dvd_trans`, `Nat.dvd_add`, `Even.add`, … */
const viaLemmas: Make = (rng, gate) => {
  const vs = varNames(rng, 4);
  const [a, b, c, d] = vs;
  const forms: { need: string[]; binders: string[]; hyps: Hyp[]; goal: string; lines: string[] }[] = [
    { need: ['Nat.dvd_trans'], binders: [nat([a, b, c, d])], hyps: [hyp('h₁', `${a} ∣ ${b}`), hyp('h₂', `${b} ∣ ${c}`), hyp('h₃', `${c} ∣ ${d}`)], goal: `${a} ∣ ${d}`, lines: ['exact Nat.dvd_trans h₁ (Nat.dvd_trans h₂ h₃)'] },
    { need: ['Nat.dvd_trans'], binders: [nat([a, b, c, d])], hyps: [hyp('h₁', `${a} ∣ ${b}`), hyp('h₂', `${b} ∣ ${c}`), hyp('h₃', `${c} ∣ ${d}`)], goal: `${a} ∣ ${d}`, lines: ['apply Nat.dvd_trans h₁', 'exact Nat.dvd_trans h₂ h₃'] },
    { need: ['Nat.dvd_add'], binders: [nat([a, b, c, d])], hyps: [hyp('h₁', `${a} ∣ ${b}`), hyp('h₂', `${a} ∣ ${c}`), hyp('h₃', `${a} ∣ ${d}`)], goal: `${a} ∣ ${b} + ${c} + ${d}`, lines: ['exact Nat.dvd_add (Nat.dvd_add h₁ h₂) h₃'] },
    { need: ['Nat.dvd_add'], binders: [nat([a, b, c])], hyps: [hyp('h₁', `${a} ∣ ${b}`), hyp('h₂', `${a} ∣ ${c}`)], goal: `${a} ∣ ${b} + ${c}`, lines: ['apply Nat.dvd_add', 'exact h₁', 'exact h₂'] },
    { need: ['Nat.dvd_trans', 'Nat.dvd_mul_right'], binders: [nat([a, b, c])], hyps: [hyp('h', `${a} ∣ ${b}`)], goal: `${a} ∣ ${b} * ${c}`, lines: [`exact Nat.dvd_trans h (Nat.dvd_mul_right ${b} ${c})`] },
    { need: ['Nat.dvd_add', 'Nat.dvd_mul_right'], binders: [nat([a, b, c])], hyps: [hyp('h', `${a} ∣ ${b}`)], goal: `${a} ∣ ${b} + ${a} * ${c}`, lines: [`exact Nat.dvd_add h (Nat.dvd_mul_right ${a} ${c})`] },
    { need: ['Nat.dvd_add', 'Nat.dvd_mul_left'], binders: [nat([a, b, c])], hyps: [hyp('h', `${a} ∣ ${b}`)], goal: `${a} ∣ ${c} * ${a} + ${b}`, lines: ['apply Nat.dvd_add', `exact Nat.dvd_mul_left ${a} ${c}`, 'exact h'] },
    { need: ['Even.add'], binders: [nat([a, b, c])], hyps: [hyp('h₁', `Even ${a}`), hyp('h₂', `Even ${b}`), hyp('h₃', `Even ${c}`)], goal: `Even (${a} + ${b} + ${c})`, lines: ['exact Even.add (Even.add h₁ h₂) h₃'] },
    { need: ['Even.add', 'Even.mul_right'], binders: [nat([a, b, c])], hyps: [hyp('h₁', `Even ${a}`), hyp('h₂', `Even ${b}`)], goal: `Even (${a} + ${b} * ${c})`, lines: [`exact Even.add h₁ (Even.mul_right h₂ ${c})`] },
  ];
  const ok = forms.filter((f) => f.need.every((l) => !gate.lemmas || gate.lemmas.has(l)) && f.lines.every((l) => tacOk(gate, l.split(' ')[0])));
  if (!ok.length) return null;
  const f = rng.pick(ok);
  return {
    binders: f.binders,
    hyps: f.hyps,
    goal: f.goal,
    goalEn: enExpr(f.goal),
    lines: f.lines,
    idea: `No need to unpack anything: ${andList(f.need.map((l) => '`' + l + '`'))} from your inventory ${f.need.length === 1 ? 'does' : 'do'} the work.`,
    themes: ['divisibility', 'lemmas'],
  };
};

const MAKERS: [number, Make][] = [
  [2, dvdMulRight],
  [2, dvdMulLeft],
  [1, dvdRefl],
  [3, dvdMulHyp],
  [2, dvdTrans],
  [2, dvdAdd],
  [2, evenDouble],
  [1, oddDouble],
  [3, evenSucc],
  [2, evenMul],
  [3, viaLemmas],
];

export function divAttempt(rng: Rng, _target: number, gate: Gate): ArithBuilt | null {
  const total = MAKERS.reduce((n, [w]) => n + w, 0);
  let r = rng.next() * total;
  let make: Make = dvdMulRight;
  for (const [w, m] of MAKERS) {
    r -= w;
    if (r < 0) {
      make = m;
      break;
    }
  }
  const c = make(rng, gate);
  return c ? buildArith('div', c) : null;
}
