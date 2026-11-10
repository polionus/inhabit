/-
  Game/Core.lean — the real-Lean mirror of Inhabit's base library.

  The in-browser mini-Lean engine has its own built-in copy of these definitions.
  Names and statements deliberately mirror Mathlib, so that everything a player
  learns transfers to real Lean + Mathlib unchanged.

  This file needs only core Lean 4 (no Mathlib).
-/

universe u v w

/-! ## Tactic shims: Mathlib tactics that core Lean lacks -/

/-- `use w` supplies a witness for an existential goal (Mathlib's `use`). -/
macro "use " es:term,+ : tactic =>
  `(tactic| (refine ⟨$es,*, ?_⟩; try with_reducible rfl))

/-- `by_contra h` assumes the negation of the goal as `h`; the new goal is `False`. -/
macro "by_contra " h:ident : tactic =>
  `(tactic| (apply Classical.byContradiction; intro $h:ident))

/-! ## Sets — a set is a predicate (mirrors Mathlib's `Set`) -/

/-- A set of elements of type `α` is a predicate `α → Prop`. -/
def Set (α : Type u) : Type u := α → Prop

/-- Turn a predicate into a set: `setOf p = {x | p x}`. -/
def setOf {α : Type u} (p : α → Prop) : Set α := p

namespace Set
variable {α : Type u} {β : Type v}

protected def Mem (s : Set α) (a : α) : Prop := s a

instance : Membership α (Set α) := ⟨Set.Mem⟩

protected def Subset (s t : Set α) : Prop := ∀ ⦃a⦄, a ∈ s → a ∈ t

instance : HasSubset (Set α) := ⟨Set.Subset⟩
instance : EmptyCollection (Set α) := ⟨setOf fun _ => False⟩

/-- The set of all elements of `α`. -/
def univ : Set α := setOf fun _ => True

protected def union (s t : Set α) : Set α := setOf fun a => a ∈ s ∨ a ∈ t
protected def inter (s t : Set α) : Set α := setOf fun a => a ∈ s ∧ a ∈ t
protected def diff (s t : Set α) : Set α := setOf fun a => a ∈ s ∧ a ∉ t
/-- The complement of a set. -/
def compl (s : Set α) : Set α := setOf fun a => a ∉ s

instance : Union (Set α) := ⟨Set.union⟩
instance : Inter (Set α) := ⟨Set.inter⟩
instance : SDiff (Set α) := ⟨Set.diff⟩

/-- The image of `s` under `f`, written `f '' s`. -/
def image (f : α → β) (s : Set α) : Set β := setOf fun b => ∃ a, a ∈ s ∧ f a = b
/-- The preimage of `t` under `f`, written `f ⁻¹' t`. -/
def preimage (f : α → β) (t : Set β) : Set α := setOf fun a => f a ∈ t

end Set

postfix:1024 "ᶜ" => Set.compl
infixl:90 " '' " => Set.image
infixl:80 " ⁻¹' " => Set.preimage

/-- Set-builder notation `{x | p x}` and `{x : α | p x}`. -/
syntax (name := setBuilder) "{" ident (" : " term)? " | " term "}" : term
macro_rules (kind := setBuilder)
  | `({ $x:ident | $p }) => `(setOf fun $x:ident => $p)
  | `({ $x:ident : $t | $p }) => `(setOf fun ($x:ident : $t) => $p)

@[app_unexpander setOf] def setOf.unexpander : Lean.PrettyPrinter.Unexpander
  | `($_ fun $x:ident => $p) => `({ $x:ident | $p })
  | `($_ fun ($x:ident : $t) => $p) => `({ $x:ident : $t | $p })
  | _ => throw ()

namespace Set
variable {α : Type u} {β : Type v}

/-- Extensionality: two sets are equal when they have the same elements. -/
@[ext] theorem ext {a b : Set α} (h : ∀ x, x ∈ a ↔ x ∈ b) : a = b :=
  funext fun x => propext (h x)

/-! ### Definitional unfolding lemmas (all true by `Iff.rfl` / `rfl`) -/

theorem mem_def {a : α} {s : Set α} : a ∈ s ↔ s a := Iff.rfl
theorem mem_setOf_eq {a : α} {p : α → Prop} : (a ∈ {x | p x}) = p a := rfl
theorem subset_def {s t : Set α} : (s ⊆ t) = ∀ x, x ∈ s → x ∈ t := rfl
theorem mem_union (x : α) (a b : Set α) : x ∈ a ∪ b ↔ x ∈ a ∨ x ∈ b := Iff.rfl
theorem mem_inter_iff (x : α) (a b : Set α) : x ∈ a ∩ b ↔ x ∈ a ∧ x ∈ b := Iff.rfl
theorem mem_diff {s t : Set α} (x : α) : x ∈ s \ t ↔ x ∈ s ∧ x ∉ t := Iff.rfl
theorem mem_compl_iff (s : Set α) (x : α) : x ∈ sᶜ ↔ x ∉ s := Iff.rfl
theorem mem_empty_iff_false (x : α) : x ∈ (∅ : Set α) ↔ False := Iff.rfl
theorem mem_univ (x : α) : x ∈ (univ : Set α) := True.intro
theorem mem_image (f : α → β) (s : Set α) (y : β) : y ∈ f '' s ↔ ∃ x, x ∈ s ∧ f x = y := Iff.rfl
theorem mem_preimage {f : α → β} {s : Set β} {a : α} : a ∈ f ⁻¹' s ↔ f a ∈ s := Iff.rfl

end Set

/-! ## Functions

Core Lean already provides `Function.Injective`, `Function.Surjective`,
`Function.LeftInverse`, `Function.RightInverse`, `Function.comp` (`∘`) and `id`:

    def Function.Injective (f : α → β) : Prop := ∀ ⦃a₁ a₂⦄, f a₁ = f a₂ → a₁ = a₂
    def Function.Surjective (f : α → β) : Prop := ∀ b, ∃ a, f a = b
    def Function.LeftInverse (g : β → α) (f : α → β) : Prop := ∀ x, g (f x) = x
    def Function.RightInverse (g : β → α) (f : α → β) : Prop := LeftInverse f g

Only `Bijective` is Mathlib's. -/

namespace Function
variable {α : Sort u} {β : Sort v}

/-- `f` is bijective: injective and surjective. -/
def Bijective (f : α → β) : Prop := Injective f ∧ Surjective f

end Function

/-! ## Parity (mirrors Mathlib's `Even` / `Odd`, specialised to `Nat`) -/

/-- `n` is even: it is `r + r` for some `r`. -/
def Even (n : Nat) : Prop := ∃ r, n = r + r
/-- `n` is odd: it is `2 * k + 1` for some `k`. -/
def Odd (n : Nat) : Prop := ∃ k, n = 2 * k + 1
