/** Translate: header parsing, task derivation and answer checking.   npx vitest run src/arena/translate */
import { describe, expect, it } from 'vitest';
import { engine } from '../engine/index.ts';
import { generator } from './gen/index.ts';
import { checkTranslation, equivalentVariants, slipVariants, splitHeader, translateSet, translateTask } from './translate.ts';
import type { ProofFamily, ProofPuzzle } from './types.ts';

const env = engine.baseEnv();
const mk = (header: string) => ({ header }) as ProofPuzzle;

describe('splitHeader / translateTask', () => {
  it('splits binders bracket-aware', () => {
    const h = splitHeader('theorem puzzle (α : Type) (p : α → Prop) (h : ∀ x, ∃ y, r x y) : ∀ (x : α), ∃ y, p y := by')!;
    expect(h.groups.map((g) => g.names.join(' '))).toEqual(['α', 'p', 'h']);
    expect(h.conclusion).toBe('∀ (x : α), ∃ y, p y');
    expect(splitHeader('example : True := by')).toBeNull();
  });
  it('folds hypotheses into implications (hand-checked)', () => {
    const t = translateTask(mk('theorem puzzle (P Q R S : Prop) (h : P → Q → R ∧ S) (hqp : Q ∧ P) : R ∧ S := by'))!;
    expect(t.binders).toBe('(P Q R S : Prop)');
    expect(t.reference).toBe('(P → Q → R ∧ S) → (Q ∧ P) → R ∧ S');
    const u = translateTask(mk('theorem puzzle (α : Type) (p q : α → Prop) (a : α) (h : ∀ x, p x → q x) (h\' : ∀ x, p x) : q a := by'))!;
    expect(u.binders).toBe('(α : Type) (p q : α → Prop) (a : α)');
    expect(u.reference).toBe('(∀ x, p x → q x) → (∀ x, p x) → q a');
    const v = translateTask(mk('theorem puzzle (α : Type) (A B C : Set α) (h₁ : A ⊆ B) (h₂ : B ⊆ C) : A ⊆ C := by'))!;
    expect(v.reference).toBe('(A ⊆ B) → (B ⊆ C) → A ⊆ C');
    const w = translateTask(mk('theorem puzzle (P Q : Prop) : P ∨ Q → Q ∨ P := by'))!;
    expect(w.reference).toBe('P ∨ Q → Q ∨ P');
  });
  it('elaborates to a Prop and is defEq to itself on 600 generated puzzles', () => {
    const fams: ProofFamily[] = ['prop', 'quant', 'set'];
    let n = 0;
    for (let i = 0; i < 600; i++) {
      const fam = fams[i % 3];
      const [lo, hi] = generator.range[fam];
      const p = generator.generate({ seed: 'tr' + i, family: fam, target: lo + ((hi - lo) * (i % 7)) / 6 });
      if (p.kind !== 'proof') continue;
      const t = translateTask(p);
      expect(t, p.header).not.toBeNull();
      const el = engine.elab(env, t!.reference, t!.binders || undefined);
      expect(el.ok, `${p.header} => ${t!.reference}`).toBe(true);
      expect(el.type?.trim()).toBe('Prop');
      expect(engine.defEq(env, t!.reference, t!.reference, t!.binders || undefined)).toBe(true);
      n++;
    }
    expect(n).toBe(600);
  }, 120000);
});

describe('checkTranslation', () => {
  const task = translateTask(mk('theorem puzzle (P Q : Prop) : P ∨ Q → Q := by'))!;
  it('accepts an equivalent writing, names slips, explains errors', () => {
    expect(checkTranslation(env, task, '(P ∨ Q) → Q').kind).toBe('right');
    expect(checkTranslation(env, task, 'Q → (P ∨ Q)')).toEqual({ kind: 'different', slip: 'converse' });
    expect(checkTranslation(env, task, 'Q ∨ P → Q').kind).toBe('equivalent');
    expect(checkTranslation(env, task, 'P ∨ Q → P').kind).toBe('different');
    expect(checkTranslation(env, task, 'P ∨ ').kind).toBe('error');
    expect(checkTranslation(env, task, 'fun (x : Nat) => x').kind).not.toBe('right');
  });
  it('finds ∧ for → under a quantifier', () => {
    const t = translateTask(mk('theorem puzzle (α : Type) (p q : α → Prop) : ∀ x, p x → q x := by'))!;
    expect(slipVariants(t.reference).some((v) => v.slip === 'and-for-implies')).toBe(true);
    expect(checkTranslation(env, t, '∀ x, p x ∧ q x')).toEqual({ kind: 'different', slip: 'and-for-implies' });
    expect(checkTranslation(env, t, '∀ y, p y → q y').kind).toBe('right');
  });
});

describe('translateSet', () => {
  it('is five rising, deterministic, and differs by round', () => {
    const a = translateSet(0);
    expect(a.length).toBe(5);
    expect(translateSet(0).map((x) => x.puzzle.id)).toEqual(a.map((x) => x.puzzle.id));
    expect(translateSet(1).map((x) => x.puzzle.id)).not.toEqual(a.map((x) => x.puzzle.id));
    expect(new Set(a.map((x) => x.puzzle.english)).size).toBe(5);
    expect(a[4].puzzle.rating).toBeGreaterThan(a[0].puzzle.rating);
  });
});

describe('accepted equivalents', () => {
  const t = (h: string) => translateTask(mk(h))!;
  it('accepts uncurried hypotheses with a note, and in any grouping', () => {
    const task = t("theorem puzzle (α : Type) (A B C : Set α) (h₁ : A ⊆ B) (h₂ : B ⊆ C) : A ⊆ C := by");
    expect(checkTranslation(env, task, '(A ⊆ B ∧ B ⊆ C) → A ⊆ C').kind).toBe('equivalent');
    expect(checkTranslation(env, task, 'A ⊆ B → B ⊆ C → A ⊆ C').kind).toBe('right');
    expect(checkTranslation(env, task, '(B ⊆ C) → (A ⊆ B) → A ⊆ C').kind).toBe('equivalent');
    expect(checkTranslation(env, task, 'A ⊆ C → A ⊆ B').kind).toBe('different');
  });
  it('accepts ¬∃ for ∀ ¬¬', () => {
    const task = t("theorem puzzle (α : Type) (p : α → Prop) : ∀ x, ¬¬p x := by");
    const v = checkTranslation(env, task, '¬∃ x, ¬p x');
    expect(v.kind).toBe('equivalent');
    expect(checkTranslation(env, task, '∀ x, ¬¬p x').kind).toBe('right');
  });
  it('accepts flipped ↔ and commuted ∧ / ∨ in the conclusion; slips stay slips', () => {
    expect(checkTranslation(env, t('theorem puzzle (P Q : Prop) : P ∨ Q → Q ∨ P := by'), 'P ∨ Q → P ∨ Q').kind).toBe('equivalent');
    expect(checkTranslation(env, t('theorem puzzle (P Q : Prop) : P ∧ Q ↔ Q ∧ P := by'), 'Q ∧ P ↔ P ∧ Q').kind).toBe('equivalent');
    expect(checkTranslation(env, t('theorem puzzle (P Q : Prop) : P → Q := by'), 'Q → P').kind).toBe('different');
  });
  it('never classifies an equivalent as a slip, on generated puzzles', () => {
    for (let i = 0; i < 60; i++) {
      const p = generator.generate({ seed: 'eq' + i, family: 'prop', target: 700 });
      if (p.kind !== 'proof') continue;
      const task = translateTask(p);
      if (!task) continue;
      for (const q of equivalentVariants(task, 8)) expect(checkTranslation(env, task, q.text).kind, q.text).toBe('equivalent');
    }
  });
});
