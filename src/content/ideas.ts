import type { TheoremIdea } from './types.ts';

/**
 * Theorem ideas for the Workshop. Every proof uses only the engine subset and the lemma bank
 * (no simp/omega/decide), and none duplicates a theorem proved in a level.
 */
export const ideas: TheoremIdea[] = [
  // ───────────── easy ─────────────
  {
    id: 'dvd-zero-one',
    area: 'numbers',
    difficulty: 1,
    title: 'Everything divides zero; one divides everything',
    english: 'For every natural number n: n divides 0, and 1 divides n.',
    statement: 'theorem dvd_zero_one_dvd (n : Nat) : n ∣ 0 ∧ 1 ∣ n := by',
    strategy:
      'Split the conjunction. `n ∣ 0` unfolds to `∃ c, 0 = n * c`: which c works, and does `rfl` see it? For `1 ∣ n` you need `n = 1 * n`; a lemma about `1 * n` is in your inventory.',
    proof: `  constructor
  · exact ⟨0, rfl⟩
  · exact ⟨n, (Nat.one_mul n).symm⟩`,
  },
  {
    id: 'zero-dvd',
    area: 'numbers',
    difficulty: 1,
    title: 'Only zero is divisible by zero',
    english: 'If 0 divides n, then n = 0.',
    statement: 'theorem zero_dvd_eq_zero (n : Nat) (h : 0 ∣ n) : n = 0 := by',
    strategy:
      'Take the hypothesis apart: it hands you a number `c` and an equation for `n`. Then rewrite with it and use a fact about `0 * c`.',
    proof: `  obtain ⟨c, hc⟩ := h
  rw [hc, Nat.zero_mul]`,
  },
  {
    id: 'diff-subset',
    area: 'sets',
    difficulty: 1,
    title: 'A set difference is a subset',
    english: 'For all sets A and B, the difference A \\ B is contained in A.',
    statement: 'theorem diff_subset (α : Type) (A B : Set α) : A \\ B ⊆ A := by',
    strategy:
      'Introduce an element and its membership proof. Membership in `A \\ B` is a pair: "in A, and not in B". Which half do you need?',
    proof: `  intro x hx
  exact hx.1`,
  },
  {
    id: 'preimage-union',
    area: 'functions',
    difficulty: 1,
    title: 'Preimage of a union',
    english: 'For any function f, the preimage of A ∪ B is the union of the preimages of A and of B.',
    statement:
      "theorem preimage_union (α β : Type) (f : α → β) (A B : Set β) : f ⁻¹' (A ∪ B) = f ⁻¹' A ∪ f ⁻¹' B := by",
    strategy:
      'Same pattern as the preimage of an intersection: use `ext`, then notice that both sides of the `↔` say the same thing after unfolding membership.',
    proof: `  ext x
  constructor
  · intro h
    exact h
  · intro h
    exact h`,
  },
  {
    id: 'comp-bijective',
    area: 'functions',
    difficulty: 1,
    title: 'Composites of bijections are bijections',
    english: 'If f and g are bijective, so is g ∘ f.',
    statement:
      'theorem comp_bijective (α β γ : Type) (f : α → β) (g : β → γ) (hf : Function.Bijective f) (hg : Function.Bijective g) : Function.Bijective (g ∘ f) := by',
    strategy:
      'A bijection is an injection that is also a surjection: split the goal into those two parts and take each hypothesis apart the same way. You have already proved the two composition lemmas.',
    proof: `  constructor
  · exact Function.Injective.comp hg.1 hf.1
  · exact Function.Surjective.comp hg.2 hf.2`,
  },
  {
    id: 'curry-iff',
    area: 'logic',
    difficulty: 1,
    title: 'Currying',
    english: 'The statement "if P and Q then R" is equivalent to "if P then (if Q then R)".',
    statement: 'theorem curry_iff (P Q R : Prop) : (P ∧ Q → R) ↔ (P → Q → R) := by',
    strategy:
      'Split the `↔`. Each direction is a function: one takes a pair, the other takes two arguments one at a time. Convert between them.',
    proof: `  constructor
  · intro h hp hq
    exact h ⟨hp, hq⟩
  · intro h hpq
    exact h hpq.1 hpq.2`,
  },
  // ───────────── medium ─────────────
  {
    id: 'odd-add-odd',
    area: 'numbers',
    difficulty: 2,
    title: 'Odd plus odd is even',
    english: 'The sum of two odd numbers is even.',
    statement: 'theorem odd_add_odd (m n : Nat) (hm : Odd m) (hn : Odd n) : Even (m + n) := by',
    strategy:
      'Unpack both hypotheses: `m = 2 * a + 1` and `n = 2 * b + 1`. A witness for evenness is `a + b + 1`. The final equation needs `Nat.two_mul` and then a handful of explicit `Nat.add_assoc` / `Nat.add_right_comm` rewrites; plan them on paper with both sides written out.',
    proof: `  obtain ⟨a, ha⟩ := hm
  obtain ⟨b, hb⟩ := hn
  use a + b + 1
  rw [ha, hb, Nat.two_mul, Nat.two_mul]
  rw [Nat.add_right_comm (a+a) 1 (b+b+1), ← Nat.add_assoc (a+a) (b+b) 1,
      Nat.add_right_comm (a+b) 1 (a+b+1), ← Nat.add_assoc (a+b) (a+b) 1,
      Nat.add_assoc a a (b+b), Nat.add_assoc a b (a+b), Nat.add_left_comm a b b]`,
  },
  {
    id: 'subset-iff-union',
    area: 'sets',
    difficulty: 2,
    title: 'Subset and union',
    english: 'A is a subset of B if and only if A ∪ B = B.',
    statement: 'theorem subset_iff_union_eq (α : Type) (A B : Set α) : A ⊆ B ↔ A ∪ B = B := by',
    strategy:
      'Split the `↔`. Forward: prove the set equality with `ext`; one direction case-splits on the union, the other uses `right`. Backward: given `x ∈ A`, rewrite the goal `x ∈ B` using the equation (backwards!) so it becomes `x ∈ A ∪ B`.',
    proof: `  constructor
  · intro h
    ext x
    constructor
    · intro hx
      cases hx with
      | inl ha => exact h ha
      | inr hb => exact hb
    · intro hx
      right
      exact hx
  · intro h x hx
    rw [← h]
    left
    exact hx`,
  },
  {
    id: 'surjective-right-cancel',
    area: 'functions',
    difficulty: 2,
    title: 'Surjective maps can be cancelled',
    english: 'If f is surjective and g ∘ f = h ∘ f, then g = h.',
    statement:
      'theorem surjective_right_cancel (α β γ : Type) (f : α → β) (g h : β → γ) (hf : Function.Surjective f) (e : g ∘ f = h ∘ f) : g = h := by',
    strategy:
      'Two functions are equal when they agree at every point: start with `funext y`. Surjectivity gives you an `x` with `f x = y`; rewrite `y` away, then use the equation `e` at `x` (`congrFun`).',
    proof: `  funext y
  obtain ⟨x, hx⟩ := hf y
  rw [← hx]
  exact congrFun e x`,
  },
  {
    id: 'inverses-bijective',
    area: 'functions',
    difficulty: 2,
    title: 'Two-sided inverse implies bijective',
    english: 'If g is a left inverse and also a right inverse of f, then f is bijective.',
    statement:
      'theorem bijective_of_inverses (α β : Type) (f : α → β) (g : β → α) (h1 : Function.LeftInverse g f) (h2 : Function.RightInverse g f) : Function.Bijective f := by',
    strategy:
      'Injective: you have a lemma for functions with a left inverse. Surjective: given `y`, which element is a good candidate for the preimage, and which hypothesis shows that it works?',
    proof: `  constructor
  · exact Function.LeftInverse.injective h1
  · intro y
    exact ⟨g y, h2 y⟩`,
  },
  {
    id: 'idem-fixes-image',
    area: 'mixed',
    difficulty: 2,
    title: 'An idempotent function fixes its image',
    english: 'If f (f x) = f x for every x, then f y = y for every y in the image of a set A.',
    statement:
      'theorem idem_fixes_image (α : Type) (f : α → α) (A : Set α) (h : ∀ x, f (f x) = f x) : ∀ y ∈ f \'\' A, f y = y := by',
    strategy:
      'Introduce `y` and its membership proof, then take the membership apart: it is an `∃` that gives you an `x` with `f x = y`. Replace `y` by `f x` and use `h`.',
    proof: `  intro y hy
  obtain ⟨x, hx, hxy⟩ := hy
  rw [← hxy]
  exact h x`,
  },
  {
    id: 'barber',
    area: 'logic',
    difficulty: 2,
    title: 'The barber cannot exist',
    english:
      'For any relation R, there is no x such that for every y, R x y holds if and only if R y y fails. (If the barber shaves exactly those who do not shave themselves, who shaves the barber?)',
    statement: 'theorem barber (α : Type) (R : α → α → Prop) : ¬∃ x, ∀ y, R x y ↔ ¬R y y := by',
    strategy:
      'Assume such an `x` exists and apply its property to `y := x`. You get `R x x ↔ ¬R x x`; derive a contradiction from that. (You proved a lemma about exactly this shape, or do it by hand.)',
    proof: `  intro h
  obtain ⟨x, hx⟩ := h
  have h1 : R x x ↔ ¬R x x := hx x
  have h2 : ¬R x x := fun hr => h1.mp hr hr
  exact h2 (h1.mpr h2)`,
  },
  {
    id: 'not-not-em',
    area: 'logic',
    difficulty: 2,
    title: 'Excluded middle can never be refuted',
    english: 'For any statement P, it is not the case that both P and not-P fail: ¬¬(P ∨ ¬P). This holds without any classical axiom.',
    statement: 'theorem nn_excluded_middle (P : Prop) : ¬¬(P ∨ ¬P) := by',
    strategy:
      'Assume `h : ¬(P ∨ ¬P)` and aim for `False`. Apply `h` twice: first to prove `¬P` (via the right disjunct), and in doing so you get a `P` that lets you apply `h` to the left disjunct.',
    proof: `  intro h
  apply h
  right
  intro hp
  apply h
  left
  exact hp`,
  },
  // ───────────── hard ─────────────
  {
    id: 'compl-inter',
    area: 'sets',
    difficulty: 3,
    title: 'De Morgan, the other law',
    english: 'The complement of an intersection is the union of the complements.',
    statement: 'theorem compl_inter (α : Type) (A B : Set α) : (A ∩ B)ᶜ = Aᶜ ∪ Bᶜ := by',
    strategy:
      'Use `ext x` and split. The direction from the union is easy. For the other, you must decide where the missing membership is: `by_cases` on `x ∈ A` is the classical step that makes the union possible.',
    proof: `  ext x
  constructor
  · intro h
    by_cases ha : x ∈ A
    · right
      intro hb
      exact h ⟨ha, hb⟩
    · left
      exact ha
  · intro h hab
    cases h with
    | inl hna => exact hna hab.1
    | inr hnb => exact hnb hab.2`,
  },
  {
    id: 'not-forall-iff',
    area: 'logic',
    difficulty: 3,
    title: 'Not-for-all means some-fails',
    english: 'For any predicate P, "not every x satisfies P" is equivalent to "some x fails P".',
    statement:
      'theorem not_forall_iff_exists (α : Type) (P : α → Prop) : (¬∀ x, P x) ↔ ∃ x, ¬P x := by',
    strategy:
      'The backward direction is easy and constructive. The forward direction needs classical logic: assume no counterexample exists (`by_contra`), then show `∀ x, P x` by contradiction at each `x`.',
    proof: `  constructor
  · intro h
    by_contra hne
    apply h
    intro x
    by_contra hx
    exact hne ⟨x, hx⟩
  · intro h hall
    obtain ⟨x, hx⟩ := h
    exact hx (hall x)`,
  },
  {
    id: 'injective-iff-cancel',
    area: 'functions',
    difficulty: 3,
    title: 'Injective means left-cancellable',
    english:
      'A function f is injective if and only if, for all functions g and h from the natural numbers into its domain, f ∘ g = f ∘ h implies g = h.',
    statement:
      'theorem injective_iff_cancel (α β : Type) (f : α → β) : Function.Injective f ↔ ∀ g h : Nat → α, f ∘ g = f ∘ h → g = h := by',
    strategy:
      'Forward: prove `g = h` pointwise with `funext`. Backward is the clever part: given `f a = f b`, choose `g` and `h` to be the *constant* functions with values `a` and `b`, show their composites with `f` agree, then evaluate the resulting equation at `0`.',
    proof: `  constructor
  · intro hf g h e
    funext n
    exact hf (congrFun e n)
  · intro H a b hab
    have e : f ∘ (fun _ : Nat => a) = f ∘ (fun _ : Nat => b) := funext fun _ => hab
    exact congrFun (H _ _ e) 0`,
  },
  {
    id: 'even-mul-succ',
    area: 'numbers',
    difficulty: 3,
    title: 'A product of consecutive numbers is even',
    english: 'For every natural number n, the number n * (n + 1) is even.',
    statement: 'theorem even_mul_succ (n : Nat) : Even (n * (n + 1)) := by',
    strategy:
      'Every number is even or odd: split on that. If `n` is even you already have a lemma about an even factor. If `n` is odd, show `n + 1` is even (find the witness, then rearrange with explicit `Nat.add_assoc` rewrites), swap the factors with `Nat.mul_comm`, and use the same lemma.',
    proof: `  rcases Nat.even_or_odd n with hn | hn
  · exact Even.mul_right hn (n + 1)
  · obtain ⟨k, hk⟩ := hn
    have h1 : Even (n + 1) := by
      use k + 1
      rw [hk, Nat.two_mul, Nat.add_assoc k k 1, Nat.add_assoc k (k+1) 1,
          Nat.add_assoc k 1 (k+1), Nat.add_comm (k+1) 1]
    rw [Nat.mul_comm]
    exact Even.mul_right h1 n`,
  },
];
