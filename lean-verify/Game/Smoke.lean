import Game.Core
-- Smoke tests: the idioms the game teaches must work in real Lean.
open Function

example (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by
  obtain ⟨hp, hq⟩ := h
  constructor
  · exact hq
  · exact hp

example (P Q : Prop) (h : P ∨ Q) : Q ∨ P := by
  cases h with
  | inl hp => right; exact hp
  | inr hq => left; exact hq

example (P : Prop) : ¬¬P → P := by
  intro h
  by_contra hn
  exact h hn

theorem zero_add' (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, ih]

example (α : Type) (A B : Set α) : A ∩ B ⊆ A := by
  intro x hx
  exact hx.1

example (α : Type) (A B C : Set α) (h1 : A ⊆ B) (h2 : B ⊆ C) : A ⊆ C := by
  intro x hx
  exact h2 (h1 hx)

example (α : Type) (A B : Set α) : A ∩ B = B ∩ A := by
  ext x
  constructor
  · intro h
    exact ⟨h.2, h.1⟩
  · rintro ⟨h1, h2⟩
    constructor
    · exact h2
    · exact h1

example (α : Type) (A B : Set α) : (A ∪ B)ᶜ = Aᶜ ∩ Bᶜ := by
  ext x
  constructor
  · intro h
    constructor
    · intro ha
      apply h
      left
      exact ha
    · intro hb
      exact h (Or.inr hb)
  · intro h hab
    rcases hab with ha | hb
    · exact h.1 ha
    · exact h.2 hb

example (α : Type) (A : Set α) : A ⊆ {x | x ∈ A ∨ False} := by
  intro x hx
  left
  exact hx

example (α β γ : Type) (f : α → β) (g : β → γ) (hf : Injective f) (hg : Injective g) :
    Injective (g ∘ f) := by
  intro a b h
  apply hf
  apply hg
  exact h

example (α β γ : Type) (f : α → β) (g : β → γ) (hf : Surjective f) (hg : Surjective g) :
    Surjective (g ∘ f) := by
  intro c
  obtain ⟨b, hb⟩ := hg c
  obtain ⟨a, ha⟩ := hf b
  use a
  rw [Function.comp_apply, ha, hb]

example (α β : Type) (f : α → β) (A B : Set β) : f ⁻¹' (A ∩ B) = f ⁻¹' A ∩ f ⁻¹' B := by
  ext x
  constructor
  · intro h
    exact h
  · intro h
    exact h

example (α β : Type) (f : α → β) (A : Set α) : A ⊆ f ⁻¹' (f '' A) := by
  intro x hx
  exact ⟨x, hx, rfl⟩

theorem cantor (α : Type) (f : α → Set α) : ¬ Surjective f := by
  intro hf
  obtain ⟨a, ha⟩ := hf {x | x ∉ f x}
  have hn : a ∉ f a := by
    intro h
    have h' : a ∈ {x | x ∉ f x} := by
      rw [← ha]
      exact h
    exact h' h
  apply hn
  rw [ha]
  exact hn

example (a b c : Nat) (h1 : a ∣ b) (h2 : b ∣ c) : a ∣ c := by
  obtain ⟨m, hm⟩ := h1
  obtain ⟨n, hn⟩ := h2
  use m * n
  rw [hn, hm, Nat.mul_assoc]

example (m n : Nat) (hm : Even m) (hn : Even n) : Even (m + n) := by
  obtain ⟨a, ha⟩ := hm
  obtain ⟨b, hb⟩ := hn
  use a + b
  rw [ha, hb, Nat.add_assoc, Nat.add_assoc, Nat.add_left_comm b a b]

example : Even 4 := by
  use 2

example : (2 : Nat) + 2 = 4 := rfl
example (n : Nat) : n + 0 = n := rfl

def double : Nat → Nat
  | 0 => 0
  | n + 1 => double n + 2

example : double 3 = 6 := rfl
example (n : Nat) : double (n + 1) = double n + 2 := rfl

example (f : Nat → Nat) (a b : Nat) (h : a = b) : f a = f b := by
  rw [h]

example (a b c : Nat) (h1 : a = b) (h2 : b = c) : a = c :=
  calc a = b := h1
    _ = c := h2

example (p : Nat → Prop) (h : ∀ n, p n) : p 5 := h 5
example : ∃ n : Nat, n + 2 = 5 := ⟨3, rfl⟩
example (α : Type) (p q : α → Prop) (h : ∃ x, p x ∧ q x) : ∃ x, q x := by
  obtain ⟨x, _, hq⟩ := h
  exact ⟨x, hq⟩
#check ({n | Even n} : Set Nat)
#check @Set.ext
#print Function.Injective
#print Function.Surjective
#print Function.LeftInverse
#check @Function.comp_apply
#check @Nat.add_succ
#check @Nat.succ_ne_zero
#check @Nat.succ.inj
#check @Nat.mul_succ
#check @Nat.add_left_comm
example (α : Type) (A B : Set α) (x : α) (h : x ∈ A ∩ B) : x ∈ B ∩ A := by
  rw [Set.mem_inter_iff] at *
  exact ⟨h.2, h.1⟩
example (n : Nat) : n + 1 ≠ 0 := Nat.succ_ne_zero n
example (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := by
  constructor <;> assumption
example (P : Prop) (h : P) : P ∨ False := by
  exact Or.inl h
example (P Q : Prop) (h : P → Q) (hnq : ¬Q) : ¬P := by
  intro hp
  apply hnq
  apply h
  exact hp
example (p : Nat → Prop) (h : ∃ n, p n) : ¬ ∀ n, ¬ p n := by
  intro hall
  obtain ⟨n, hn⟩ := h
  exact hall n hn
example (P : Prop) (h : P) : P := by
  show P
  exact h
example (n : Nat) : Even n ∨ Odd n := by
  induction n with
  | zero => left; use 0
  | succ k ih =>
    rcases ih with ⟨r, hr⟩ | ⟨r, hr⟩
    · right
      use r
      rw [hr, Nat.two_mul]
    · left
      use r + 1
      rw [hr, Nat.two_mul, Nat.add_assoc, Nat.add_assoc, Nat.add_left_comm r 1 1, Nat.add_assoc]
