/**
 * The base library, written in the engine's own Lean subset and elaborated at start-up
 * (trusted mode, re-checked by the kernel). Names and statements mirror Lean core and
 * `lean-verify/Game/Core.lean`; notations are hard-wired (no type classes): e.g. `x ∈ s` is
 * `Membership.mem s x`, which unfolds (at `instances` transparency, like Lean's instances) to
 * `Set.Mem s x`.
 */

export const PRELUDE = String.raw`
universe u v w

/-- The empty proposition: it has no proofs. -/
inductive False : Prop

/-- The trivially true proposition. -/
inductive True : Prop
  | intro : True

/-- \`a ∧ b\`: a proof of \`a\` and a proof of \`b\`. -/
structure And (a b : Prop) : Prop where
  intro ::
  left : a
  right : b

/-- \`a ∨ b\`: a proof of \`a\` or a proof of \`b\`. -/
inductive Or (a b : Prop) : Prop
  | inl (h : a) : Or a b
  | inr (h : b) : Or a b

/-- \`a ↔ b\`: implications in both directions. -/
structure Iff (a b : Prop) : Prop where
  intro ::
  mp : a → b
  mpr : b → a

/-- \`∃ x, p x\`: a witness together with a proof. -/
inductive Exists {α : Sort u} (p : α → Prop) : Prop
  | intro (w : α) (h : p w) : Exists p

/-- \`a = b\`: the only constructor is \`rfl\`. -/
inductive Eq {α : Sort u} (a : α) : α → Prop
  | refl : Eq a a

/-- Natural numbers: \`0\` and \`n + 1\`. -/
inductive Nat : Type
  | zero : Nat
  | succ (n : Nat) : Nat

inductive Bool : Type
  | false : Bool
  | true : Bool

inductive Unit : Type
  | unit : Unit

structure Prod (α : Type u) (β : Type v) : Type (max u v) where
  mk ::
  fst : α
  snd : β

axiom String : Type
axiom String.append : String → String → String

/-- Placeholder for missing proofs (\`sorry\`). -/
axiom sorryAx (α : Sort u) : α

/-! ## Logic -/

/-- \`¬a\` is \`a → False\`. -/
def Not (a : Prop) : Prop := a → False

def id {α : Sort u} (a : α) : α := a

theorem rfl {α : Sort u} {a : α} : a = a := Eq.refl a

theorem trivial : True := True.intro

def False.elim {C : Sort u} (h : False) : C := False.rec (motive := fun _ => C) h

def absurd {a : Prop} {b : Sort v} (h₁ : a) (h₂ : Not a) : b := False.elim (h₂ h₁)

def Not.elim {a : Prop} {α : Sort u} (H1 : Not a) (H2 : a) : α := absurd H2 H1

/-- \`a ≠ b\` is \`¬(a = b)\`. -/
@[reducible] def Ne {α : Sort u} (a b : α) : Prop := Not (a = b)

def Eq.ndrec {α : Sort v} {a : α} {motive : α → Sort u} (m : motive a) {b : α} (h : Eq a b) : motive b :=
  Eq.rec (motive := fun x _ => motive x) m h

theorem Eq.symm {α : Sort u} {a b : α} (h : Eq a b) : Eq b a :=
  Eq.rec (motive := fun x _ => Eq x a) (Eq.refl a) h

theorem Eq.trans {α : Sort u} {a b c : α} (h₁ : Eq a b) (h₂ : Eq b c) : Eq a c :=
  Eq.rec (motive := fun x _ => Eq a x) h₁ h₂

theorem Eq.subst {α : Sort u} {motive : α → Prop} {a b : α} (h₁ : Eq a b) (h₂ : motive a) : motive b :=
  Eq.ndrec (motive := motive) h₂ h₁

def Eq.mp {α β : Sort u} (h : Eq α β) (a : α) : β := Eq.rec (motive := fun x _ => x) a h

def Eq.mpr {α β : Sort u} (h : Eq α β) (b : β) : α := Eq.rec (motive := fun x _ => x) b (Eq.symm h)

def cast {α β : Sort u} (h : Eq α β) (a : α) : β := Eq.mp h a

theorem congrArg {α : Sort u} {β : Sort v} {a₁ a₂ : α} (f : α → β) (h : Eq a₁ a₂) : Eq (f a₁) (f a₂) :=
  Eq.rec (motive := fun x _ => Eq (f a₁) (f x)) (Eq.refl (f a₁)) h

theorem congrFun {α : Sort u} {β : α → Sort v} {f g : (x : α) → β x} (h : Eq f g) (a : α) : Eq (f a) (g a) :=
  @Eq.rec ((x : α) → β x) f (fun x _ => Eq (f a) (x a)) (Eq.refl (f a)) g h

theorem Ne.symm {α : Sort u} {a b : α} (h : a ≠ b) : b ≠ a := fun h' => h (Eq.symm h')

theorem Or.elim {a b c : Prop} (h : a ∨ b) (left : a → c) (right : b → c) : c :=
  Or.rec (motive := fun _ => c) left right h

theorem Or.symm {a b : Prop} (h : a ∨ b) : b ∨ a := Or.elim h (fun ha => Or.inr ha) (fun hb => Or.inl hb)

theorem And.symm {a b : Prop} (h : a ∧ b) : b ∧ a := And.intro h.right h.left

theorem Iff.refl (a : Prop) : a ↔ a := Iff.intro (fun h => h) (fun h => h)

theorem Iff.rfl {a : Prop} : a ↔ a := Iff.refl a

theorem Iff.symm {a b : Prop} (h : a ↔ b) : b ↔ a := Iff.intro h.mpr h.mp

theorem Iff.trans {a b c : Prop} (h₁ : a ↔ b) (h₂ : b ↔ c) : a ↔ c :=
  Iff.intro (fun x => h₂.mp (h₁.mp x)) (fun x => h₁.mpr (h₂.mpr x))

theorem Exists.elim {α : Sort u} {p : α → Prop} {b : Prop} (h₁ : Exists (fun x => p x)) (h₂ : ∀ (a : α), p a → b) : b :=
  Exists.rec (motive := fun _ => b) h₂ h₁

/-! ## Axioms -/

/-- Propositional extensionality: equivalent propositions are equal. -/
axiom propext {a b : Prop} : (a ↔ b) → a = b

/-- Function extensionality: functions that agree everywhere are equal. -/
axiom funext {α : Sort u} {β : α → Sort v} {f g : (x : α) → β x} (h : ∀ (x : α), f x = g x) : f = g

/-- The law of the excluded middle (classical logic). -/
axiom Classical.em (p : Prop) : p ∨ ¬p

theorem Classical.byContradiction {p : Prop} (h : ¬p → False) : p :=
  Or.elim (Classical.em p) (fun hp => hp) (fun hn => False.elim (h hn))

theorem Classical.not_not {a : Prop} : ¬¬a ↔ a :=
  Iff.intro (fun h => Classical.byContradiction h) (fun ha hn => hn ha)

theorem eq_true {p : Prop} (h : p) : p = True := propext (Iff.intro (fun _ => trivial) (fun _ => h))

/-! ## Functions -/

namespace Function

/-- Function composition, written \`f ∘ g\`. -/
def comp {α : Sort u} {β : Sort v} {δ : Sort w} (f : β → δ) (g : α → β) : α → δ := fun x => f (g x)

theorem comp_apply {β : Sort u} {δ : Sort v} {α : Sort w} {f : β → δ} {g : α → β} {x : α} : (f ∘ g) x = f (g x) := rfl

/-- \`f\` is injective: equal outputs come from equal inputs. -/
def Injective {α : Sort u} {β : Sort v} (f : α → β) : Prop := ∀ ⦃a₁ a₂ : α⦄, f a₁ = f a₂ → a₁ = a₂

/-- \`f\` is surjective: every output is hit. -/
def Surjective {α : Sort u} {β : Sort v} (f : α → β) : Prop := ∀ b, ∃ a, f a = b

/-- \`g\` is a left inverse of \`f\`: \`g (f x) = x\`. -/
def LeftInverse {α : Sort u} {β : Sort v} (g : β → α) (f : α → β) : Prop := ∀ x, g (f x) = x

/-- \`g\` is a right inverse of \`f\`: \`f (g x) = x\`. -/
def RightInverse {α : Sort u} {β : Sort v} (g : β → α) (f : α → β) : Prop := LeftInverse f g

/-- \`f\` is bijective: injective and surjective. -/
def Bijective {α : Sort u} {β : Sort v} (f : α → β) : Prop := Injective f ∧ Surjective f

end Function

/-! ## Natural numbers -/

/-- Addition, by recursion on the second argument. -/
protected def Nat.add : Nat → Nat → Nat
  | n, .zero => n
  | n, .succ m => Nat.succ (Nat.add n m)

/-- Multiplication, by recursion on the second argument. -/
protected def Nat.mul : Nat → Nat → Nat
  | _, .zero => 0
  | n, .succ m => Nat.add (Nat.mul n m) n

def Nat.pred : Nat → Nat
  | .zero => 0
  | .succ n => n

protected def Nat.sub : Nat → Nat → Nat
  | n, .zero => n
  | n, .succ m => Nat.pred (Nat.sub n m)

protected def Nat.pow : Nat → Nat → Nat
  | _, .zero => 1
  | n, .succ m => Nat.mul (Nat.pow n m) n

axiom Nat.div : Nat → Nat → Nat
axiom Nat.mod : Nat → Nat → Nat

def Nat.beq : Nat → Nat → Bool
  | .zero, .zero => Bool.true
  | .zero, .succ _ => Bool.false
  | .succ _, .zero => Bool.false
  | .succ n, .succ m => Nat.beq n m

def Nat.ble : Nat → Nat → Bool
  | .zero, _ => Bool.true
  | .succ _, .zero => Bool.false
  | .succ n, .succ m => Nat.ble n m

theorem Nat.add_zero (n : Nat) : n + 0 = n := rfl
theorem Nat.add_succ (n m : Nat) : n + Nat.succ m = Nat.succ (n + m) := rfl
theorem Nat.mul_zero (n : Nat) : n * 0 = 0 := rfl
theorem Nat.mul_succ (n m : Nat) : n * Nat.succ m = n * m + n := rfl
theorem Nat.succ_eq_add_one (n : Nat) : Nat.succ n = n + 1 := rfl
theorem Nat.pow_zero (n : Nat) : n ^ 0 = 1 := rfl
theorem Nat.pow_succ (n m : Nat) : n ^ Nat.succ m = n ^ m * n := rfl

theorem Nat.succ.inj {m n : Nat} (h : Nat.succ m = Nat.succ n) : m = n := congrArg Nat.pred h

theorem Nat.succ_ne_zero (n : Nat) : Nat.succ n ≠ 0 := by
  intro h
  contradiction

/-- \`n ≤ m\`. -/
inductive Nat.le (n : Nat) : Nat → Prop
  | refl : Nat.le n n
  | step {m : Nat} (h : Nat.le n m) : Nat.le n (Nat.succ m)

/-- \`n < m\` is \`n + 1 ≤ m\`. -/
def Nat.lt (n m : Nat) : Prop := Nat.le (n + 1) m

@[reducible] def GE.ge (a b : Nat) : Prop := Nat.le b a
@[reducible] def GT.gt (a b : Nat) : Prop := Nat.lt b a

theorem Nat.le_refl (n : Nat) : n ≤ n := Nat.le.refl

theorem Nat.le_succ (n : Nat) : n ≤ Nat.succ n := Nat.le.step Nat.le.refl

/-- The natural numbers below \`n\`. -/
structure Fin (n : Nat) where
  mk ::
  val : Nat
  isLt : Nat.lt val n

/-- \`a ∣ b\`: \`b\` is a multiple of \`a\`. -/
@[instance] def Dvd.dvd (a b : Nat) : Prop := ∃ c, b = a * c

/-- \`n\` is even: it is \`r + r\` for some \`r\`. -/
def Even (n : Nat) : Prop := ∃ r, n = r + r

/-- \`n\` is odd: it is \`2 * k + 1\` for some \`k\`. -/
def Odd (n : Nat) : Prop := ∃ k, n = 2 * k + 1

/-! ## Sets — a set is a predicate -/

/-- A set of elements of type \`α\` is a predicate \`α → Prop\`. -/
def Set (α : Type u) : Type u := α → Prop

/-- Turn a predicate into a set: \`setOf p = {x | p x}\`. -/
def setOf {α : Type u} (p : α → Prop) : Set α := p

protected def Set.Mem {α : Type u} (s : Set α) (a : α) : Prop := s a

/-- \`a ∈ s\` -/
@[instance] def Membership.mem {α : Type u} (s : Set α) (a : α) : Prop := Set.Mem s a

protected def Set.Subset {α : Type u} (s t : Set α) : Prop := ∀ ⦃a⦄, a ∈ s → a ∈ t

/-- \`s ⊆ t\` -/
@[instance] def HasSubset.Subset {α : Type u} (s t : Set α) : Prop := Set.Subset s t

/-- \`∅\` -/
@[instance] def EmptyCollection.emptyCollection {α : Type u} : Set α := setOf fun _ => False

/-- The set of all elements of \`α\`. -/
def Set.univ {α : Type u} : Set α := setOf fun _ => True

protected def Set.union {α : Type u} (s t : Set α) : Set α := setOf fun a => a ∈ s ∨ a ∈ t
protected def Set.inter {α : Type u} (s t : Set α) : Set α := setOf fun a => a ∈ s ∧ a ∈ t
protected def Set.diff {α : Type u} (s t : Set α) : Set α := setOf fun a => a ∈ s ∧ a ∉ t

/-- \`s ∪ t\` -/
@[instance] def Union.union {α : Type u} (s t : Set α) : Set α := Set.union s t
/-- \`s ∩ t\` -/
@[instance] def Inter.inter {α : Type u} (s t : Set α) : Set α := Set.inter s t
/-- \`s \ t\` -/
@[instance] def SDiff.sdiff {α : Type u} (s t : Set α) : Set α := Set.diff s t

/-- The complement of a set, written \`sᶜ\`. -/
def Set.compl {α : Type u} (s : Set α) : Set α := setOf fun a => a ∉ s

/-- The image of \`s\` under \`f\`, written \`f '' s\`. -/
def Set.image {α : Type u} {β : Type v} (f : α → β) (s : Set α) : Set β := setOf fun b => ∃ a, a ∈ s ∧ f a = b

/-- The preimage of \`t\` under \`f\`, written \`f ⁻¹' t\`. -/
def Set.preimage {α : Type u} {β : Type v} (f : α → β) (t : Set β) : Set α := setOf fun a => f a ∈ t

namespace Set

/-- Extensionality: two sets are equal when they have the same elements. -/
theorem ext {α : Type u} {a b : Set α} (h : ∀ x, x ∈ a ↔ x ∈ b) : a = b :=
  funext fun x => propext (h x)

theorem mem_def {α : Type u} {a : α} {s : Set α} : a ∈ s ↔ s a := Iff.rfl
theorem mem_setOf_eq {α : Type u} {a : α} {p : α → Prop} : (a ∈ {x | p x}) = p a := rfl
theorem subset_def {α : Type u} {s t : Set α} : (s ⊆ t) = ∀ x, x ∈ s → x ∈ t := rfl
theorem mem_union {α : Type u} (x : α) (a b : Set α) : x ∈ a ∪ b ↔ x ∈ a ∨ x ∈ b := Iff.rfl
theorem mem_inter_iff {α : Type u} (x : α) (a b : Set α) : x ∈ a ∩ b ↔ x ∈ a ∧ x ∈ b := Iff.rfl
theorem mem_diff {α : Type u} {s t : Set α} (x : α) : x ∈ s \ t ↔ x ∈ s ∧ x ∉ t := Iff.rfl
theorem mem_compl_iff {α : Type u} (s : Set α) (x : α) : x ∈ sᶜ ↔ x ∉ s := Iff.rfl
theorem mem_empty_iff_false {α : Type u} (x : α) : x ∈ (∅ : Set α) ↔ False := Iff.rfl
theorem mem_univ {α : Type u} (x : α) : x ∈ (univ : Set α) := True.intro
theorem mem_image {α : Type u} {β : Type v} (f : α → β) (s : Set α) (y : β) : y ∈ f '' s ↔ ∃ x, x ∈ s ∧ f x = y := Iff.rfl
theorem mem_preimage {α : Type u} {β : Type v} {f : α → β} {s : Set β} {a : α} : a ∈ f ⁻¹' s ↔ f a ∈ s := Iff.rfl

end Set
`;
