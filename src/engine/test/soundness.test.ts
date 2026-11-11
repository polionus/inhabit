/**
 * Soundness audit. The engine must never report `complete` for a false or unproved statement.
 * These are adversarial inputs: wrong proofs, hidden `sorry`, and classic ways to break a
 * type-theory kernel (large elimination from Prop, non-positive inductives, universe
 * inconsistency, non-terminating definitions, circular theorems).
 */
import { describe, expect, it } from 'vitest';
import { engine } from '../index.ts';
import { fullEnv, levelSession, checkBody } from '../../game/env.ts';

const reject: [string, string][] = [
  ['sorry', 'theorem f : False := by sorry'],
  ['self reference', 'theorem f : False := f'],
  ['self reference via tactic', 'theorem f : False := by exact f'],
  ['wrong hypothesis', 'theorem f (P Q : Prop) (hp : P) : Q := by exact hp'],
  ['rfl 0+n', 'theorem f (n : Nat) : 0 + n = n := rfl'],
  ['rfl comm', 'example (a b : Nat) : a + b = b + a := by rfl'],
  ['2+2=5', 'example : 2 + 2 = 5 := rfl'],
  ['0=1 rfl', 'example : (0 : Nat) = 1 := by rfl'],
  ['n+1=n', 'example (n : Nat) : n + 1 = n := by rfl'],
  ['assumption none', 'theorem f (P : Prop) : P := by assumption'],
  ['constructor on or', 'theorem f (P : Prop) : P ∨ ¬P := by constructor'],
  ['apply leaves goal', 'example (P Q : Prop) (h : P → Q) : Q := by apply h'],
  ['occurs check anon', 'example : ∃ n : Nat, n = n + 1 := ⟨_, rfl⟩'],
  ['occurs check use', 'example : ∃ n : Nat, n = n + 1 := by refine ⟨?_, rfl⟩'],
  ['refine holes left', 'example : ∃ n : Nat, n = n + 1 := by refine ⟨?_, ?_⟩'],
  ['Type : Type', 'def bad : Type := Type'],
  ['Prop := Type', 'example : Prop := Type'],
  ['contradiction none', 'theorem t : 1 = 2 := by contradiction'],
  ['trivial false', 'theorem t : 1 = 2 := by trivial'],
  ['exfalso', 'theorem t : 1 = 2 := by exfalso; assumption'],
  ['bad induction', 'theorem t (n : Nat) : n = 0 := by\n  induction n with\n  | zero => rfl\n  | succ k ih => exact ih'],
  ['dne exact', 'example (P : Prop) (h : ¬¬P) : P := by exact h'],
  ['subset bogus', 'example (A B : Set Nat) : A ⊆ B := by\n  intro x hx\n  exact hx'],
  ['calc short', 'example (a b c : Nat) (h1 : a = b) : a = c :=\n  calc a = b := h1'],
  ['have shadow', 'example (P Q : Prop) (h : P) : Q := by\n  have h : Q := h\n  exact h'],
  ['try sorry', 'example : False := by try sorry'],
  ['first sorry', 'example : False := by first | assumption | sorry'],
  ['repeat nothing', 'example (P : Prop) : P := by repeat constructor'],
  ['all_goals try', 'example (P : Prop) : P := by all_goals try assumption'],
  ['show wrong', 'example (P Q : Prop) (hq : Q) : P := by\n  show Q\n  exact hq'],
  ['change wrong', 'example (P Q : Prop) (hq : Q) : P := by\n  change Q\n  exact hq'],
  ['have no proof', 'example (P : Prop) : P := by\n  have h : P\n  exact h'],
  ['large elim Exists (match)', 'def w (h : ∃ n : Nat, True) : Nat := match h with | ⟨x, _⟩ => x'],
  ['large elim Exists (casesOn)', 'def w (h : ∃ n : Nat, True) : Nat := Exists.casesOn h (fun x _ => x)'],
  ['large elim Exists (tactic)', 'def w (h : ∃ n : Nat, True) : Nat := by\n  obtain ⟨x, _⟩ := h\n  exact x'],
  ['large elim Or (tactic)', 'def f (h : True ∨ True) : Nat := by\n  cases h with\n  | inl _ => exact 0\n  | inr _ => exact 1'],
  ['large elim Or (match)', 'def f (h : True ∨ True) : Nat := match h with | Or.inl _ => 0 | Or.inr _ => 1'],
  ['large elim Or rec', 'def f (h : True ∨ True) : Nat := Or.rec (fun _ => 0) (fun _ => 1) h'],
  ['non-positive inductive', 'inductive Bad where\n  | mk : (Bad → False) → Bad\ntheorem boom : False :=\n  have f : Bad → False := fun b => match b with | Bad.mk g => g b\n  f (Bad.mk f)'],
  ['non-positive inductive (decl only)', 'inductive Bad where\n  | mk : (Bad → False) → Bad'],
  ['loop def', 'def loop (n : Nat) : False := loop n'],
  ['loop succ', 'def loop : Nat → False\n  | n => loop (n + 1)'],
  ['partial match', 'def f : Nat → Nat\n  | 0 => 1\ntheorem t : f 1 = 0 := rfl'],
  ['universe too big field', 'inductive U : Type where\n  | mk : Type → U'],
  ['theorem with data', 'theorem t : Nat := 0\nexample : t = 1 := rfl'],
  ['unknown tactic', 'example : False := by omega'],
  ['exact with wrong implicit', 'example (f : Nat → Nat) (a b : Nat) : f a = f b := congrArg f rfl'],
  ['eta abuse', 'example (f g : Nat → Nat) : f = g := funext fun x => rfl'],
  ['propext abuse', 'example (P Q : Prop) : P = Q := propext ⟨fun h => h, fun h => h⟩'],
  ['iff rfl abuse', 'example (P Q : Prop) : P ↔ Q := Iff.rfl'],
  ['rw closes wrongly', 'example (a b c : Nat) (h : a = b) : a = c := by rw [h]'],
  ['symm wrong', 'example (a b c : Nat) (h : a = b) : c = a := by\n  symm\n  exact h'],
  ['subst wrong', 'example (a b : Nat) (h : a = b) : a = 0 := by\n  subst h\n  rfl'],
  ['dvd bogus', 'example : 2 ∣ 3 := ⟨1, rfl⟩'],
  ['even bogus', 'example : Even 3 := ⟨1, rfl⟩'],
  ['use bogus', 'example : ∃ n : Nat, n + 1 = 0 := by use 0'],
  ['ext then nothing', 'example (A B : Set Nat) : A = B := by ext x'],
  ['by_contra then nothing', 'example (P : Prop) : P := by\n  by_contra h\n  exact h'],
  ['intro too many', 'example (P : Prop) : P → P := by\n  intro h h2\n  exact h'],
  ['cases eq impossible', 'example (h : (1 : Nat) = 1) : False := by cases h'],
  ['exists wrong', 'example : ∃ n : Nat, n = n + 1 := by exists 0'],
  ['injective bogus', 'example (f : Nat → Nat) : Function.Injective f := by\n  intro a b h\n  exact h'],
  ['mutual shadow', 'def Even (n : Nat) : Prop := True\ntheorem t : Even 3 := trivial'],
];
const accept: [string, string][] = [
  ['control id', 'theorem f (P : Prop) (h : P) : P := h'],
  ['control add_zero', 'theorem t : ∀ n : Nat, n = n + 0 := fun n => rfl'],
  ['control cases 1=2', 'example (h : (1 : Nat) = 2) : False := by cases h'],
  ['control exists', 'example : ∃ n : Nat, n + 2 = 5 := ⟨3, rfl⟩'],
  ['control positive inductive', 'inductive T where\n  | leaf : T\n  | node : T → T → T\ndef size : T → Nat\n  | T.leaf => 1\n  | T.node l r => size l + size r\nexample : size (T.node T.leaf T.leaf) = 2 := rfl'],
  ['control Exists elim into Prop', 'example (p : Nat → Prop) (h : ∃ n, p n) : ¬ ∀ n, ¬ p n := by\n  intro hall\n  obtain ⟨n, hn⟩ := h\n  exact hall n hn'],
];

describe('soundness: wrong proofs are never complete', () => {
  const env = fullEnv();
  for (const [name, src] of reject) {
    it(`rejects: ${name}`, () => {
      expect(engine.check(env, src).complete).toBe(false);
    });
  }
  for (const [name, src] of accept) {
    it(`accepts: ${name}`, () => {
      expect(engine.check(env, src).complete).toBe(true);
    });
  }
});

describe('soundness: the game layer', () => {
  it('does not let a learner assume the final boss as an axiom', () => {
    const session = levelSession('forge-13');
    const cheat =
      "axiom image_union (α β : Type) (f : α → β) (A B : Set α) : f '' (A ∪ B) = f '' A ∪ f '' B";
    const { result } = checkBody(session, cheat);
    expect(result.complete).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'name-locked')).toBe(true);
  });
  it('locks tactics that are not in the inventory yet', () => {
    const session = levelSession('props-03'); // only `exact` is unlocked here
    const { result } = checkBody(session, '  apply hqr\n  exact hq');
    expect(result.complete).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'tactic-locked')).toBe(true);
  });
  it('locks `by` in term-mode levels', () => {
    const session = levelSession('types-03');
    const level = session.ctx.level;
    if (level.kind !== 'proof') throw new Error('expected a proof level');
    expect(level.mode).toBe('term');
    const { result } = checkBody(session, '  by sorry');
    expect(result.complete).toBe(false);
  });
});
