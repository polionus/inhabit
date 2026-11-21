import { describe, expect, it } from 'vitest';
import { matchBind, parse, stripParens, telescope } from './parse.ts';
import type { Kind } from './parse.ts';

const cases: [string, Kind][] = [
  ['P → Q', 'imp'],
  ['(P → Q → R) → Q → P → R', 'imp'],
  ['P ∧ Q → (P → R) → Q ∧ R', 'imp'],
  ['P ∨ Q → R ↔ (P → R) ∧ (Q → R)', 'iff'],
  ['(P ∨ Q → R) → (P → R) ∧ (Q → R)', 'imp'],
  ['(P → R) ∧ (Q → R)', 'and'],
  ['P ∨ Q ∨ R', 'or'],
  ['(P ∧ Q) ∧ R', 'and'],
  ['¬(P ∨ Q)', 'not'],
  ['¬P ∧ ¬Q', 'and'],
  ['¬¬P → P', 'imp'],
  ['¬¬P', 'not'],
  ['¬∃ x, P x', 'not'],
  ['¬Function.Surjective f', 'not'],
  ['¬(P ↔ ¬P)', 'not'],
  ['∀ (x : α), ¬P x', 'forall'],
  ['∀ (x : Nat), f (f (f x)) = f x', 'forall'],
  ['∃ x, P x ∨ Q x', 'exists'],
  ['(∃ x, P x ∨ Q x) ↔ (∃ x, P x) ∨ ∃ x, Q x', 'iff'],
  ['(∃ x, P x) ∨ ∃ x, Q x', 'or'],
  ['(∃ x, P x) ∨ ∃ x, Q x → ∃ x, P x ∨ Q x', 'imp'],
  ['(∃ a, f a = 5) → ∃ b, P (b + 1)', 'imp'],
  ['∃ a, (g ∘ f) a = c', 'exists'],
  ['a + b = 5', 'eq'],
  ['(fun x => x + 1) 2 * 2 = 6', 'eq'],
  ['f x = id x', 'eq'],
  ['f a = {x | x ∉ f x}', 'eq'],
  ['a ≠ c', 'ne'],
  ['b ≠ c', 'ne'],
  ['x ∈ A ∩ B', 'mem'],
  ['x ∈ (A ∪ B)ᶜ → x ∈ Aᶜ ∩ Bᶜ', 'imp'],
  ['x ∈ A ∩ B ∪ A ∩ C', 'mem'],
  ['x ∈ f ⁻¹' + "' (A ∩ B)".slice(1), 'mem'],
  ['y ∈ f \'\' (A ∪ B) ↔ y ∈ f \'\' A ∪ f \'\' B', 'iff'],
  ['a ∈ f a ↔ a ∈ {x | x ∉ f x}', 'iff'],
  ['x ∉ A', 'nmem'],
  ['A ⊆ B', 'subset'],
  ['A ∩ B ⊆ A ∪ B', 'subset'],
  ['Bᶜ ⊆ Aᶜ', 'subset'],
  ['A ∪ B = B ∪ A', 'eq'],
  ['A ∩ (B ∪ C) = A ∩ B ∪ A ∩ C', 'eq'],
  ['a ∣ b * a', 'dvd'],
  ['False', 'false'],
  ['True', 'true'],
  ['Even (m + n)', 'pred'],
  ['Odd (k + 1)', 'pred'],
  ['Function.Injective f', 'pred'],
  ['Function.Surjective (g ∘ f)', 'pred'],
  ['Function.LeftInverse g f', 'pred'],
  ['P x', 'atom'],
  ['P (b + 1)', 'atom'],
  ['Q', 'atom'],
  ['(a + b).succ = 6', 'eq'],
  ['n.succ * m = n * m + m', 'eq'],
  ['0 + n = n', 'eq'],
  ['Even n ∨ Odd n', 'or'],
  ['k + 1 = 2 * r + 1', 'eq'],
  ['∀ x ∈ A, P x', 'forall'],
];

describe('parse: head connective', () => {
  for (const [text, kind] of cases) {
    it(`${text}  ->  ${kind}`, () => {
      expect(parse(text).kind).toBe(kind);
    });
  }

  it('implication is right associative and splits at the first arrow', () => {
    const p = parse('P → Q → R');
    expect(p.a).toBe('P');
    expect(p.b).toBe('Q → R');
  });

  it('a binder swallows everything to its right', () => {
    const p = parse('∀ x, P x → Q x');
    expect(p.kind).toBe('forall');
    expect(p.vars).toEqual(['x']);
    expect(p.b).toBe('P x → Q x');
  });

  it('a binder after an operator belongs to the right operand', () => {
    const p = parse('P ∧ ∃ x, Q x ∨ R');
    expect(p.kind).toBe('and');
    expect(p.b).toBe('∃ x, Q x ∨ R');
  });

  it('reads typed binders', () => {
    expect(parse('∀ (x y : Nat), x = y').vars).toEqual(['x', 'y']);
    expect(parse('∃ (a : α), P a').vars).toEqual(['a']);
  });

  it('union is looser than intersection', () => {
    const p = parse('A ∩ B ∪ A ∩ C');
    expect(p.kind).toBe('union');
    expect(p.a).toBe('A ∩ B');
  });

  it('a local variable applied to arguments is an atom, not a definition', () => {
    expect(parse('Even n', new Set(['Even'])).kind).toBe('atom');
  });

  it('strips matching outer parentheses only', () => {
    expect(stripParens('((P ∧ Q))')).toBe('P ∧ Q');
    expect(stripParens('(P) ∧ (Q)')).toBe('(P) ∧ (Q)');
  });

  it('never throws on odd input', () => {
    for (const s of ['', '(', ')))', '∀', '∃ x', '¬', 'fun', '{x |', "''", '→ →', 'P ∧', '⟨a, b⟩', '"str"']) {
      expect(() => parse(s)).not.toThrow();
    }
  });

  it('telescope descends through arrows, binders and negations', () => {
    const t = telescope('∀ (n : Nat), P n → ¬Q n');
    expect(t.binders.map((b) => b.name)).toEqual(['n']);
    expect(t.premises).toEqual(['P n', 'Q n']);
    expect(t.conclusion).toBe('False');
  });

  it('matchBind binds wildcards', () => {
    expect(matchBind('Q n', ['n'], 'Q 3')).toEqual({ n: '3' });
    expect(matchBind('Q n', ['n'], 'R 3')).toBeNull();
  });
});
