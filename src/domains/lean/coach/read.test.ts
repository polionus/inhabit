import { describe, expect, it } from 'vitest';
import type { Goal, Hyp } from '../engine/types.ts';
import { goalFromHeader } from './header.ts';
import { readGoal } from './read.ts';
import type { ReadContext, Reading } from './read.ts';

const hyp = (names: string, type: string, isProof = true): Hyp => ({ names: names.split(' '), type, isProof });
const goal = (target: string, hyps: Hyp[] = [], caseName?: string): Goal => ({ hyps, target, caseName });
const props = hyp('P Q R', 'Prop', false);
const all: ReadContext = { allowedTactics: null, mode: 'tactic' };
const term: ReadContext = { allowedTactics: [], mode: 'term' };
const only = (...t: string[]): ReadContext => ({ allowedTactics: t, mode: 'tactic' });

const read = (g: Goal, ctx: ReadContext = all): Reading => {
  const r = readGoal([g], ctx);
  expect(r).not.toBeNull();
  return r!;
};
const codes = (r: Reading) => (r.tools ?? []).map((t) => t.code);

describe('readGoal: what the goal is, and a question', () => {
  it('implication', () => {
    const r = read(goal('P ∧ Q → Q ∧ P', [props]));
    expect(r.shape).toBe('imp');
    expect(r.say).toBe('The goal is an implication: if `P ∧ Q` then `Q ∧ P`.');
    expect(r.ask).toMatch(/assume its left side/);
    expect(codes(r)).toContain('intro h');
  });

  const shapes: [string, string, RegExp, string][] = [
    ['∀ (x : α), P x', 'forall', /for every/, 'intro x'],
    ['P ↔ Q', 'iff', /if and only if/, 'constructor'],
    ['P ∧ Q', 'and', /conjunction/, 'constructor'],
    ['P ∨ Q', 'or', /disjunction/, 'left'],
    ['¬P', 'not', /cannot be true/, 'intro h'],
    ['P ≠ Q', 'ne', /different/, 'intro h'],
    ['∃ x, P x', 'exists', /there is some/, 'use w'],
    ['a + b = b + a', 'eq', /equation/, 'rfl'],
    ['A ⊆ B', 'subset', /every element/, 'intro x hx'],
    ['A ∪ B = B ∪ A', 'eq', /same elements/, 'ext x'],
    ['x ∈ A ∩ B', 'mem', /both/, 'constructor'],
    ['x ∈ A ∪ B', 'mem', /or in/, 'left'],
    ['x ∈ Aᶜ', 'mem', /not in/, 'intro h'],
    ['a ∣ b', 'dvd', /multiple/, 'use c'],
    ['Function.Injective f', 'pred', /different inputs/, 'intro a b h'],
    ['Function.Surjective f', 'pred', /every output/, 'intro b'],
    ['Even n', 'pred', /definition/, 'use r'],
    ['True', 'true', /True/, 'trivial'],
  ];
  const sets = [hyp('A B', 'Set α', false), hyp('f g', 'α → α', false), hyp('x', 'α', false)];
  for (const [target, shape, say, tool] of shapes) {
    it(`${target} reads as ${shape}`, () => {
      const r = read(goal(target, [props, ...sets]));
      expect(r.shape).toBe(shape);
      expect(r.say).toMatch(say);
      expect(codes(r)).toContain(tool);
    });
  }

  it('False asks for a contradiction and clashing hypotheses are the first thing said', () => {
    const r = read(goal('False', [props, hyp('hp', 'P'), hyp('hnp', '¬P')]));
    expect(r.say).toMatch(/contradiction/);
    expect(r.uses[0].text).toMatch(/cannot both hold|contradict/);
    expect(codes(r)).toContain('exact hnp hp');
  });

  it('an atom with a matching hypothesis points at it', () => {
    const r = read(goal('P', [props, hyp('hp', 'P')]));
    expect(r.shape).toBe('atom');
    expect(r.uses[0].hyp).toBe('hp');
    expect(codes(r)).toContain('exact hp');
  });

  it('the ask names no tactic, and no text has an exclamation mark', () => {
    const tacticWords = /\b(intro|constructor|exact|apply|rw|obtain|cases|rcases|simp)\b|`(use|left|right)/;
    for (const [target] of shapes) {
      const r = read(goal(target, [props, ...sets]));
      expect(r.ask).not.toMatch(tacticWords);
      const everything = [r.say, r.ask, ...r.uses.map((u) => u.text), ...(r.tools ?? []).map((t) => t.says)].join(' ');
      expect(everything).not.toContain('!');
    }
  });
});

describe('readGoal: hypotheses', () => {
  it('takes a conjunction apart and says so without a tactic', () => {
    const r = read(goal('Q ∧ P', [props, hyp('h', 'P ∧ Q')]));
    expect(r.uses[0].text).toMatch(/conjunction/);
    expect(r.uses[0].text).not.toMatch(/obtain|cases/);
    expect(codes(r)).toContain('obtain ⟨h1, h2⟩ := h');
  });

  it('a disjunction is a split', () => {
    const r = read(goal('Q ∨ P', [props, hyp('h', 'P ∨ Q')]));
    expect(r.uses.some((u) => /both cases/.test(u.text))).toBe(true);
    expect(codes(r)).toContain('cases h');
  });

  it('an implication ending in the goal is applied, or fed when its premise is at hand', () => {
    const backward = read(goal('Q', [props, hyp('h', 'P → Q')]));
    expect(codes(backward)).toContain('apply h');
    const forward = read(goal('Q', [props, hyp('h', 'P → Q'), hyp('hp', 'P')]));
    expect(codes(forward)).toContain('exact h hp');
  });

  it('an equation rewrites only when it would change the goal', () => {
    const nat = hyp('a b', 'Nat', false);
    const changes = read(goal('a + 1 = 5', [nat, hyp('h', 'a = b')]));
    expect(codes(changes)).toContain('rw [h]');
    expect(changes.tools!.find((t) => t.code === 'rw [h]')!.says).toMatch(/becomes `b \+ 1 = 5`/);
    const unrelated = read(goal('P', [nat, props, hyp('h', 'a = b')]));
    expect(codes(unrelated)).not.toContain('rw [h]');
    expect(unrelated.uses.some((u) => u.hyp === 'h')).toBe(false);
  });

  it('the most relevant hypothesis comes first', () => {
    const r = read(goal('P', [props, hyp('h', 'P ∧ Q'), hyp('hp', 'P')]));
    expect(r.uses[0].hyp).toBe('hp');
  });
});

describe('readGoal: the inventory filters the tools', () => {
  it('offers constructor but not obtain when only constructor is allowed', () => {
    const g = goal('Q ∧ P', [props, hyp('h', 'P ∧ Q')]);
    const r = read(g, only('constructor', 'intro'));
    expect(codes(r)).toContain('constructor');
    expect(codes(r).some((c) => c.startsWith('obtain'))).toBe(false);
    const tactics = (r.tools ?? []).map((t) => t.tactic);
    expect(tactics.every((t) => t === 'constructor' || t === 'intro')).toBe(true);
  });

  it('falls back to another allowed tactic that does the same job', () => {
    const r = read(goal('Q ∧ P', [props, hyp('h', 'P ∧ Q')]), only('rcases', 'constructor'));
    expect(codes(r)).toContain('rcases h with ⟨h1, h2⟩');
  });

  it('returns null tools when nothing allowed fits', () => {
    const r = read(goal('P ∧ Q', [props]), only('rfl'));
    expect(r.tools).toBeNull();
    expect(r.say).toMatch(/conjunction/);
  });

  it('shows the other allowed way as an alternative', () => {
    const r = read(goal('Q ∧ P', [props, hyp('h', 'P ∧ Q')]), only('obtain', 'rcases'));
    const t = r.tools!.find((x) => x.tactic === 'obtain')!;
    expect(t.also?.map((a) => a.tactic)).toEqual(['rcases']);
  });
});

describe('readGoal: term mode', () => {
  it('offers constructs, not tactics', () => {
    const r = read(goal('P → Q → P', [props]), term);
    expect(codes(r)).toEqual(['fun h => _']);
    expect(r.tools![0].tactic).toBeUndefined();
    expect(r.tools![0].says).toMatch(/stands for a proof of/);
  });
  it('conjunction, disjunction, hypotheses', () => {
    expect(codes(read(goal('P ∧ Q', [props]), term))).toContain('⟨_, _⟩');
    expect(codes(read(goal('P ∨ Q', [props]), term))).toEqual(['Or.inl _', 'Or.inr _']);
    expect(codes(read(goal('P', [props, hyp('h', 'P ∧ Q')]), term))).toContain('h.1');
    expect(codes(read(goal('Q', [props, hyp('h', 'P → Q'), hyp('hp', 'P')]), term))).toContain('h hp');
    expect(codes(read(goal('Q', [props, hyp('h', 'P'), hyp('hn', '¬P')]), term))).toContain('absurd h hn');
    expect(codes(read(goal('a = a', [hyp('a', 'Nat', false)]), term))).toContain('rfl');
  });
});

describe('readGoal: several goals and no goals', () => {
  it('says how many remain and which it reads', () => {
    const r = readGoal([goal('P', [props, hyp('hp', 'P')], 'left'), goal('Q', [props, hyp('hq', 'Q')], 'right')], all)!;
    expect(r.goalCount).toBe(2);
    expect(r.say).toMatch(/^2 goals are open\. You are reading the first \(case `left`\)\./);
  });
  it('null for no goals', () => {
    expect(readGoal([], all)).toBeNull();
  });
  it('an unrecognised shape still gets a reading, with few or no tools', () => {
    const r = read(goal('P x y', [hyp('P', 'α → α → Prop', false), hyp('x y', 'α', false)]));
    expect(r.shape).toBe('atom');
    expect(r.tools === null || r.tools.length <= 2).toBe(true);
  });
  it('never throws on rubbish', () => {
    for (const t of ['', '∀', '(((', '∃ x', 'a ∈', '⟨', "''"]) {
      expect(() => readGoal([goal(t, [hyp('h', t)])], all)).not.toThrow();
    }
  });
  it('never writes a proof: one move per tool', () => {
    const r = read(goal('(P → R) ∧ (Q → R)', [props, hyp('h', 'P ∨ Q → R')]));
    for (const t of r.tools ?? []) expect(t.code).not.toContain('\n');
  });
});

describe('goalFromHeader', () => {
  it('reads binders and target', () => {
    const g = goalFromHeader('theorem and_swap (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by')!;
    expect(g.target).toBe('Q ∧ P');
    expect(g.hyps).toEqual([
      { names: ['P', 'Q'], type: 'Prop', isProof: false },
      { names: ['h'], type: 'P ∧ Q', isProof: true },
    ]);
  });
  it('handles implicit binders and term mode headers', () => {
    const g = goalFromHeader('theorem t {α : Type} (A B : Set α) (h : A ⊆ B) : ∀ x, x ∈ A → x ∈ B :=')!;
    expect(g.target).toBe('∀ x, x ∈ A → x ∈ B');
    expect(g.hyps.map((h) => h.isProof)).toEqual([false, false, true]);
  });
  it('null when there is no colon', () => {
    expect(goalFromHeader('nonsense')).toBeNull();
  });
});
