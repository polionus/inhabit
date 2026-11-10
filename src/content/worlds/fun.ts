import type { World } from '../types.ts';

export const world: World = {
  id: 'fun',
  title: 'Function Fjord',
  tagline: 'Injective, surjective, and Cantor',
  intro:
    "Properties of functions are quantified statements, and definitions can be unfolded to read them. You will compose functions, prove that injectivity and surjectivity survive composition, meet images and preimages, and finish with Cantor's theorem: no function from a set onto its power set exists. New tools: `unfold` and `funext`.",
  requires: ['sets'],
  bigIdea:
    'Injective and surjective are just `∀` and `∃` statements about a function, and Cantor\'s theorem is the logic fact `¬(P ↔ ¬P)` applied to a diagonal set.',
  levels: [
    // 01
    {
      id: 'fun-01',
      kind: 'choice',
      title: 'Composition computes',
      intro:
        "`g ∘ f` is the function that applies `f` first, then `g`. It is *defined* as `fun x => g (f x)`. So `(g ∘ f) x` and `g (f x)` are the same term after unfolding, and `rfl` proves their equality. Look at the example, then answer.",
      code: `example (α β γ : Type) (f : α → β) (g : β → γ) (x : α) : (g ∘ f) x = g (f x) := rfl`,
      question: 'Why can `rfl` prove `(g ∘ f) x = g (f x)`?',
      options: [
        {
          text: '`g ∘ f` unfolds to `fun x => g (f x)`, so both sides reduce to the same term.',
          correct: true,
          feedback: 'Yes: definitional equality. Unfold `∘`, apply the function to `x` (β-reduction), and the sides coincide.',
        },
        {
          text: '`rfl` can prove any equation that is mathematically true.',
          feedback: '`rfl` only proves equations that hold by computation. `0 + n = n` is true, but `rfl` fails on it.',
        },
        {
          text: '`Function.comp_apply` is an axiom that Lean assumes.',
          feedback: 'It is an ordinary theorem, and its proof is exactly `rfl`. No axiom is needed.',
        },
        {
          text: 'The order matters: `rfl` works for `(g ∘ f) x` only because `f` is applied first.',
          feedback: 'The order is part of the definition, but it is not what makes `rfl` work. Any definitional unfolding that makes both sides identical would do.',
        },
      ],
      outro:
        '`Function.comp_apply : (g ∘ f) x = g (f x)` is true by `rfl`, since `∘` is a definition. Definitional equality is computation: the kernel unfolds and reduces until the terms match.',
      unlocks: { codex: ['comp', 'comp_apply'] },
    },
    // 02
    {
      id: 'fun-02',
      kind: 'predict',
      title: 'Injective, unwrapped',
      intro:
        "`Function.Injective f` unfolds to `∀ ⦃a b⦄, f a = f b → a = b`: equal outputs force equal inputs. Like `⊆`, it has strict-implicit binders, so `intro a b h` works and `hf h` infers `a` and `b`. Read the proof, then predict.",
      code: `theorem id_injective (α : Type) : Function.Injective (id : α → α) := by
  intro a b h
  exact h`,
      line: 2,
      question: 'What will the goal be after `intro a b h`?',
      options: [
        {
          text: '`a b : α`, `h : id a = id b` ⊢ `a = b`',
          correct: true,
          feedback: 'Yes. `h` is the hypothesis of injectivity (equal outputs), the goal is equal inputs. `exact h` works because `id a` unfolds to `a`.',
        },
        {
          text: '`a b : α`, `h : a = b` ⊢ `id a = id b`',
          feedback: 'That is the *converse*, which is just congruence and holds for every function. Injectivity goes from outputs back to inputs.',
        },
        {
          text: '`a b : α` ⊢ `id a = id b → a = b`',
          feedback: 'That is what `intro a b` alone gives. The third name `h` introduces the implication as well.',
        },
        {
          text: '`h : Function.Injective id` ⊢ `a = b`',
          feedback: 'The statement being proved is consumed by `intro`; it does not become a hypothesis.',
        },
      ],
      outro:
        'An injectivity proof is a function: given two inputs and a proof that their outputs agree, produce a proof that the inputs agree. Using one is application: `hf h` has type `a = b`, with `a` and `b` inferred from `h`.',
      unlocks: { codex: ['injective'] },
    },
    // 03
    {
      id: 'fun-03',
      kind: 'proof',
      title: 'Look inside a definition',
      english: 'The identity function `id : α → α` is surjective.',
      intro:
        "`Function.Surjective f` unfolds to `∀ b, ∃ a, f a = b`: every target is hit. The tactic `unfold Function.Surjective` replaces the name by its definition in the goal, so you can see the `∀` and `∃`. It changes how the goal looks, not what it means. Finish the proof.",
      header: 'theorem id_surjective (α : Type) : Function.Surjective (id : α → α) := by',
      starter: `  unfold Function.Surjective
  sorry`,
      mode: 'tactic',
      solutions: [
        `  unfold Function.Surjective
  intro b
  exact ⟨b, rfl⟩`,
        `  intro b
  exact ⟨b, rfl⟩`,
      ],
      hints: [
        { text: 'After `unfold`, read the goal as a sentence: for every `b`, there exists an `a` with `id a = b`.' },
        { text: 'Introduce `b`, then provide a witness for the `∃`.' },
        { text: 'The witness is `b` itself, and `id b = b` holds by `rfl`.' },
        { text: '`intro b`, then `exact ⟨b, rfl⟩`.' },
      ],
      outro:
        '`unfold` exposed `∀ b, ∃ a, id a = b`: surjectivity is a quantifier statement, and a proof is a function returning a dependent pair (a witness with evidence). Note the tactics you reused: `intro`, anonymous constructor, `rfl`.',
      unlocks: { tactics: ['unfold'], codex: ['unfold', 'surjective'] },
    },
    // 04
    {
      id: 'fun-04',
      kind: 'parsons',
      title: 'Injective composes',
      english: 'If `f` and `g` are injective, so is `g ∘ f`.',
      intro:
        "Take `a b` with `(g ∘ f) a = (g ∘ f) b`. The goal is `a = b`. Using `hf : Injective f` as a tactic, `apply hf` changes the goal to `f a = f b`, because `hf` is an implication. Then `apply hg` changes it again. Arrange the lines.",
      header:
        'theorem Injective.comp {α β γ : Type} {g : β → γ} {f : α → β} (hg : Function.Injective g) (hf : Function.Injective f) : Function.Injective (g ∘ f) := by',
      lines: ['  intro a b h', '  apply hf', '  apply hg', '  exact h'],
      distractors: ['  exact hf h', '  intro h'],
      hints: [
        { text: 'Begin by introducing everything. Then think backwards from `a = b`: which hypothesis concludes an equality of inputs?' },
        { text: 'Two `apply` steps, one per injectivity hypothesis. The outermost function applied is `g`, but the *goal* is about inputs of `f`.' },
        { text: '`hf` first (goal `f a = f b`), then `hg` (goal `g (f a) = g (f b)`), which is `h` up to unfolding `∘`.' },
      ],
      outro:
        'Working backwards, each `apply` peels one function off. The result is a composite of the two proofs, which is `Function.Injective.comp` in Lean\'s library (as `hg.comp hf`).',
      unlocks: { lemmas: ['Function.Injective.comp'] },
    },
    // 05
    {
      id: 'fun-05',
      kind: 'proof',
      title: 'Surjective composes',
      english: 'If `f` and `g` are surjective, so is `g ∘ f`.',
      intro:
        "Now the existential version. Given `c`, `hg c` produces a `b` with `g b = c`; then `hf b` produces `a` with `f a = b`. The witness for `g ∘ f` is that `a`. `obtain ⟨b, hb⟩ := hg c` takes an existential apart, and `use` supplies a witness. `Function.comp_apply` lets `rw` see `g (f a)`.",
      header:
        'theorem Surjective.comp {α β γ : Type} {g : β → γ} {f : α → β} (hg : Function.Surjective g) (hf : Function.Surjective f) : Function.Surjective (g ∘ f) := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  intro c
  obtain ⟨b, hb⟩ := hg c
  obtain ⟨a, ha⟩ := hf b
  use a
  rw [Function.comp_apply, ha, hb]`,
        `  intro c
  obtain ⟨b, hb⟩ := hg c
  obtain ⟨a, ha⟩ := hf b
  exact ⟨a, (congrArg g ha).trans hb⟩`,
      ],
      hints: [
        { text: 'Introduce the target `c`. What do you know about hitting `c`? Which hypothesis is about hitting things?' },
        { text: '`hg c` is an existential: take it apart with `obtain`. Then do the same with `hf`.' },
        { text: 'Choose `a` as the witness. The goal is `(g ∘ f) a = c`; rewrite with `Function.comp_apply`, then with your two equations.' },
        { text: '`rw [Function.comp_apply, ha, hb]` after `use a`.' },
      ],
      outro:
        'Chaining witnesses: the witness for the composite is built from the two witnesses, in order. A proof of surjectivity is a function returning a dependent pair, and composition composes those functions. This is `Function.Surjective.comp`.',
      unlocks: { lemmas: ['Function.Surjective.comp'] },
    },
    // 06
    {
      id: 'fun-06',
      kind: 'proof',
      title: 'Equal at every point',
      english: 'If `f x = x` for every `x`, then `f = id`.',
      intro:
        "Two functions are equal when they agree on every input. The tactic `funext x` turns a goal `f = g` into `f x = g x` for an arbitrary `x`. This is function extensionality, an axiom of Lean's logic: the rules of λ-calculus alone do not give it. The first line is written.",
      header: 'theorem eq_id_of_fixed {α : Type} (f : α → α) (h : ∀ x, f x = x) : f = id := by',
      starter: `  funext x
  sorry`,
      mode: 'tactic',
      solutions: [
        `  funext x
  exact h x`,
        `  exact funext h`,
      ],
      hints: [
        { text: 'After `funext x`, read the goal. What does `id x` unfold to?' },
        { text: 'Your hypothesis `h` talks about `f x`. Which instance of it do you need?' },
        { text: '`exact h x` (the goal `f x = id x` matches `f x = x` by unfolding `id`).' },
      ],
      outro:
        '`funext` says pointwise equality implies equality of functions. It cannot be derived from the basic rules, so Lean takes it as an axiom (it is one half of what `Set.ext` rests on). As a term: `funext h`.',
      unlocks: { tactics: ['funext'], codex: ['funext'] },
    },
    // 07
    {
      id: 'fun-07',
      kind: 'proof',
      title: 'Undo implies injective',
      english: 'If `g` undoes `f` (`g (f x) = x` for all `x`), then `f` is injective.',
      intro:
        "`Function.LeftInverse g f` unfolds to `∀ x, g (f x) = x`: `g` undoes `f`. If `f a = f b`, apply `g` to both sides, then undo `f` on each side. The `have` line is written (it uses `congrArg` from Equality Estuary). Finish with `rw`.",
      header:
        'theorem LeftInverse.injective {α β : Type} {g : β → α} {f : α → β} (h : Function.LeftInverse g f) : Function.Injective f := by',
      starter: `  intro a b hab
  have h2 : g (f a) = g (f b) := congrArg g hab
  sorry`,
      mode: 'tactic',
      solutions: [
        `  intro a b hab
  have h2 : g (f a) = g (f b) := congrArg g hab
  rw [h a, h b] at h2
  exact h2`,
        `  intro a b hab
  calc a = g (f a) := (h a).symm
    _ = g (f b) := congrArg g hab
    _ = b := h b`,
      ],
      hints: [
        { text: 'Look at `h2`. What does `h` say about `g (f a)`?' },
        { text: '`h a : g (f a) = a`. You can rewrite with it even though `h` is stated with `LeftInverse`.' },
        { text: '`rw [h a, h b] at h2`, then `h2` is the goal.' },
      ],
      outro:
        'A left inverse recovers the input, so the input cannot be confused with another: the proof is a short chain of rewrites. This is `Function.LeftInverse.injective`. Notice `h a` worked: `LeftInverse` unfolds to a `∀`, so it applies like a function.',
      unlocks: { codex: ['left-inverse'], lemmas: ['Function.LeftInverse.injective'] },
    },
    // 08
    {
      id: 'fun-08',
      kind: 'formalize',
      title: 'A fixed point',
      english: 'The function `f : α → α` has a fixed point (a point that `f` leaves where it is).',
      intro:
        "Formalize in Lean: \"f has a fixed point\". Say it in words first: *there is* an `x` such that `f` sends `x` to itself. Mark the quantifier, then write it.",
      binders: '(α : Type) (f : α → α)',
      accept: ['∃ x, f x = x', '∃ x, x = f x'],
      mistakes: [
        {
          statement: '∀ x, f x = x',
          feedback: 'That says *every* point is fixed, which means `f` is the identity. A fixed point needs only one.',
        },
        {
          statement: 'f = id',
          feedback: 'Again this says every point is fixed. "Has a fixed point" is existential.',
        },
        {
          statement: '∃ x y, f x = y',
          feedback: 'Every function satisfies this: take any `x` and `y := f x`. It does not say `f x` equals `x`.',
        },
        {
          statement: 'Function.Injective f',
          feedback: 'Injectivity is a different property of `f`; it says nothing about points being fixed.',
        },
      ],
      hints: [
        { text: 'Which quantifier: for all, or there exists? Ask whether you need all points to be fixed.' },
        { text: '`∃ x, …` where the body says `f` maps `x` to `x`.' },
      ],
      outro:
        '"For all" versus "there exists" is the whole difference between the identity function and a function with a fixed point. In type theory it is a Π-type versus a Σ-type (a dependent function versus a dependent pair).',
    },
    // 09
    {
      id: 'fun-09',
      kind: 'proof',
      mode: 'term',
      showTerm: true,
      title: 'Image and preimage',
      english: 'Every `x` in `A` lies in the preimage of the image of `A`: `A ⊆ f ⁻¹\' (f \'\' A)`.',
      intro:
        "The image `f '' A` is `{y | ∃ x, x ∈ A ∧ f x = y}`. The preimage `f ⁻¹' B` is `{x | f x ∈ B}`. So `x ∈ f ⁻¹' (f '' A)` unfolds to `∃ a, a ∈ A ∧ f a = f x`. A witness is `x` itself. Write it as a term: `fun x hx => ⟨_, _, _⟩`.",
      header:
        "theorem subset_preimage_image {α β : Type} (f : α → β) (A : Set α) : A ⊆ f ⁻¹' (f '' A) :=",
      starter: '  sorry',
      solutions: ['  fun x hx => ⟨x, hx, rfl⟩'],
      hints: [
        { text: 'Begin with the function for `⊆`. Then unfold the goal membership: preimage, then image, until you see an `∃`.' },
        { text: 'The existential has three pieces: a witness, a proof it lies in `A`, and an equation. Anonymous constructors nest to the right.' },
        { text: '`fun x hx => ⟨x, hx, rfl⟩`' },
      ],
      outro:
        'Both definitions are just predicates: preimage is composition with `f`, image is an existential. The proof term is a function returning nested pairs. Image and preimage are the Galois connection of set maps; this is `Set.subset_preimage_image`.',
      unlocks: {
        codex: ['image', 'preimage', 'mem_image', 'mem_preimage'],
        lemmas: ['Set.subset_preimage_image'],
      },
    },
    // 10 optional
    {
      id: 'fun-10',
      kind: 'proof',
      optional: true,
      title: 'Preimage respects intersection',
      english: '`f ⁻¹\' (A ∩ B) = f ⁻¹\' A ∩ f ⁻¹\' B`.',
      intro:
        "Side quest. After `ext x`, both sides unfold to `f x ∈ A ∧ f x ∈ B`. The two directions are then the identity function on that proposition. You can finish each with `exact`.",
      header:
        "theorem preimage_inter {α β : Type} (f : α → β) (A B : Set β) : f ⁻¹' (A ∩ B) = f ⁻¹' A ∩ f ⁻¹' B := by",
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  ext x
  constructor
  · intro h
    exact h
  · intro h
    exact h`,
      ],
      hints: [
        { text: 'Begin with the tactic for set equality. Then compare both sides of the `↔` after unfolding.' },
        { text: 'They unfold to the same statement, so `exact` with the hypothesis works.' },
      ],
      outro:
        'Both sides are the same proposition after unfolding, so each direction is the identity. Preimages commute with every set operation because they only precompose with `f`. This is `Set.preimage_inter`.',
      unlocks: { lemmas: ['Set.preimage_inter'] },
    },
    // 11
    {
      id: 'fun-11',
      kind: 'proof',
      title: 'Cancelling on the left',
      english: 'If `g ∘ f` is surjective, then `g` is surjective.',
      intro:
        "A cancellation theorem: from a property of a composite, deduce a property of one factor. If every `c` is hit by `g ∘ f`, then every `c` is hit by `g`, using the point `f a`. Take apart the hypothesis `h c`, then supply the witness.",
      header:
        'theorem Surjective.of_comp {α β γ : Type} {g : β → γ} {f : α → β} (h : Function.Surjective (g ∘ f)) : Function.Surjective g := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  intro c
  obtain ⟨a, ha⟩ := h c
  exact ⟨f a, ha⟩`,
      ],
      hints: [
        { text: 'The goal is `∀ c, ∃ b, g b = c`. Introduce `c` and see what `h` offers at `c`.' },
        { text: '`h c` gives some `a` with `(g ∘ f) a = c`. Which element of `β` does `g` hit in that equation?' },
        { text: 'Use `f a` as the witness; `ha` proves the equation after unfolding `∘`.' },
      ],
      outro:
        'The witness `f a` is the point where `g` actually lands. Cancellation works on the *outer* function for surjectivity and on the *inner* one for injectivity, since the composite hits whatever `g` hits. This is `Function.Surjective.of_comp`.',
      unlocks: { lemmas: ['Function.Surjective.of_comp'] },
    },
    // 12 optional
    {
      id: 'fun-12',
      kind: 'proof',
      optional: true,
      title: 'Cancelling on the right',
      english: 'If `f ∘ g` is injective, then `g` is injective.',
      intro:
        "The dual cancellation. If `g a = g b`, then `f (g a) = f (g b)`, and injectivity of the composite finishes. Use `apply` on the hypothesis to turn the goal into an equation about `f ∘ g`.",
      header:
        'theorem Injective.of_comp {α β γ : Type} {f : β → γ} {g : α → β} (h : Function.Injective (f ∘ g)) : Function.Injective g := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  intro a b hab
  apply h
  exact congrArg f hab`,
      ],
      hints: [
        { text: 'After `intro a b hab`, which hypothesis concludes `a = b`?' },
        { text: '`apply h` leaves a goal `(f ∘ g) a = (f ∘ g) b`. Which equation do you have to start from?' },
        { text: '`exact congrArg f hab`' },
      ],
      outro:
        'If the composite never confuses two inputs, neither can its first stage. This is `Function.Injective.of_comp`.',
      unlocks: { lemmas: ['Function.Injective.of_comp'] },
    },
    // 13
    {
      id: 'fun-13',
      kind: 'proof',
      title: 'Nothing is its own opposite',
      english: 'No proposition is equivalent to its own negation: `¬(P ↔ ¬P)`.',
      intro:
        "The engine of Cantor's argument is pure logic: `P ↔ ¬P` is contradictory. Assume `h : P ↔ ¬P`. First show `¬P`: if `P` held, `h` would give `¬P`, applied to `P`, contradiction. Then `h` turns `¬P` back into `P`. This is `iff_not_self` in Lean's library.",
      header: 'theorem iff_not_self {P : Prop} : ¬(P ↔ ¬P) := by',
      starter: `  intro h
  have hn : ¬P := by
    sorry
  sorry`,
      mode: 'tactic',
      solutions: [
        `  intro h
  have hn : ¬P := by
    intro hp
    exact (h.mp hp) hp
  exact hn (h.mpr hn)`,
      ],
      hints: [
        { text: 'For `hn`, assume `P` and aim for `False`. What does `h.mp` do to a proof of `P`?' },
        { text: '`h.mp hp : ¬P`, a function from `P` to `False`. Apply it to `hp`.' },
        { text: 'Once you have `hn : ¬P`, `h.mpr hn` is a proof of `P`. Combine them.' },
        { text: '`exact (h.mp hp) hp` inside `hn`, then `exact hn (h.mpr hn)`.' },
      ],
      outro:
        'To get a contradiction from `P ↔ ¬P` you used `P` and `¬P` against each other. This is Russell-style self-reference, and it is all of Cantor\'s proof. It is `iff_not_self` in core Lean, now in your inventory.',
      unlocks: { lemmas: ['iff_not_self'] },
    },
    // 14
    {
      id: 'fun-14',
      kind: 'proof',
      title: 'The diagonal set',
      english: 'If `f a` equals the diagonal set `{x | x ∉ f x}`, we have a contradiction.',
      intro:
        "Given `f : α → Set α`, define the *diagonal set* `D = {x | x ∉ f x}`: the elements that do not belong to their own image. Suppose some `a` has `f a = D`. Is `a ∈ f a`? Rewriting with `ha` shows `a ∈ f a ↔ a ∈ D`, and `a ∈ D` unfolds to `a ∉ f a`. Complete the proof.",
      header:
        'theorem diagonal_clash {α : Type} (f : α → Set α) (a : α) (ha : f a = {x | x ∉ f x}) : False := by',
      starter: `  have key : a ∈ f a ↔ a ∈ {x | x ∉ f x} := by
    sorry
  sorry`,
      mode: 'tactic',
      solutions: [
        `  have key : a ∈ f a ↔ a ∈ {x | x ∉ f x} := by
    rw [ha]
  exact iff_not_self key`,
      ],
      hints: [
        { text: 'Look at `key`: the two sides differ only in `f a` versus the diagonal set. Which hypothesis connects them?' },
        { text: '`rw [ha]` replaces `f a` by the diagonal set and the sides become identical. Then use the lemma from the previous level.' },
        { text: '`exact iff_not_self key`: Lean accepts `a ∈ {x | x ∉ f x}` as `¬ (a ∈ f a)` by unfolding.' },
      ],
      outro:
        'The diagonal set is built to disagree with every `f a` about the element `a` itself, so it cannot equal any `f a`. That `a ∈ {x | x ∉ f x}` is accepted as `a ∉ f a` is definitional unfolding at work.',
      unlocks: { codex: ['diagonal'] },
    },
    // 15 boss
    {
      id: 'fun-15',
      kind: 'proof',
      boss: true,
      showTerm: true,
      title: "Cantor's theorem",
      english: 'No function `f : α → Set α` is surjective: there are more sets of elements than elements.',
      intro:
        "Boss. A surjection onto `Set α` would hit the diagonal set `{x | x ∉ f x}`. Assemble: assume surjectivity, apply it to the diagonal set to get an `a`, and use what you built in the last two levels. There is no scaffolding.",
      header: 'theorem cantor (α : Type) (f : α → Set α) : ¬ Function.Surjective f := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  intro hf
  obtain ⟨a, ha⟩ := hf {x | x ∉ f x}
  have key : a ∈ f a ↔ a ∈ {x | x ∉ f x} := by
    rw [ha]
  exact iff_not_self key`,
      ],
      hints: [
        { text: 'The goal is a negation: what do you assume? Then what does surjectivity let you do with a particular set?' },
        { text: 'Apply `hf` to the diagonal set. Take apart the result and recognise the situation from the previous level.' },
        { text: 'You need an equivalence between `a ∈ f a` and `a ∈ {x | x ∉ f x}`, from the equation `ha`.' },
        { text: '`intro hf`, `obtain ⟨a, ha⟩ := hf {x | x ∉ f x}`, then `have key … := by rw [ha]` and `exact iff_not_self key`.' },
      ],
      outro:
        "Cantor's theorem: a diagonal set built from `f` disagrees with every `f a`, so `f` misses it. Logic supplied `¬(P ↔ ¬P)`, sets supplied the diagonal. In Lean it is `Function.cantor_surjective`, and with it you have walked from basic type theory to a classical theorem.",
      unlocks: { codex: ['cantor'], lemmas: ['Function.cantor_surjective'] },
    },
  ],

  codex: [
    {
      id: 'comp',
      kind: 'symbol',
      name: '∘',
      summary: '`g ∘ f` is the function `fun x => g (f x)`.',
      body: 'Composition: apply `f` first, then `g`. It is a definition, so `(g ∘ f) x = g (f x)` holds by `rfl`.',
      input: '\\comp',
    },
    {
      id: 'comp_apply',
      kind: 'definition',
      name: 'Function.comp_apply',
      summary: '`(g ∘ f) x = g (f x)`, by `rfl`.',
      body: 'The unfolding lemma for composition. Use it with `rw` when `(g ∘ f) x` appears in a goal and you want to see `g (f x)`.',
      example: `example (α β γ : Type) (f : α → β) (g : β → γ) (x : α) : (g ∘ f) x = g (f x) := Function.comp_apply`,
      mathlib: '`Function.comp_apply`',
    },
    {
      id: 'injective',
      kind: 'definition',
      name: 'Function.Injective',
      summary: '`Injective f` is `∀ ⦃a b⦄, f a = f b → a = b`.',
      body:
        'Equal outputs force equal inputs. To prove it, `intro a b h`; to use `hf : Injective f` on `h : f a = f b`, write `hf h : a = b`. The binders are strict-implicit.',
      example: `example (α β : Type) (f : α → β) (hf : Function.Injective f) (a b : α) (h : f a = f b) : a = b := hf h`,
      mathlib: '`Function.Injective`',
    },
    {
      id: 'surjective',
      kind: 'definition',
      name: 'Function.Surjective',
      summary: '`Surjective f` is `∀ b, ∃ a, f a = b`.',
      body: 'Every target has a preimage. To prove it, `intro b` then give a witness; to use it, `obtain ⟨a, ha⟩ := hf b`.',
      example: `example (α β : Type) (f : α → β) (hf : Function.Surjective f) (b : β) : ∃ a, f a = b := hf b`,
      mathlib: '`Function.Surjective`',
    },
    {
      id: 'unfold',
      kind: 'tactic',
      name: 'unfold',
      summary: 'Replace a defined name by its definition.',
      body:
        '`unfold Function.Surjective` rewrites the goal so the body of the definition is visible. `unfold f at h` does it in a hypothesis. It changes appearance only: the new statement is definitionally equal.',
      example: `example (α : Type) : Function.Surjective (id : α → α) := by
  unfold Function.Surjective
  intro b
  exact ⟨b, rfl⟩`,
      term: '(no term form: the kernel unfolds automatically)',
      mathlib: '`unfold`',
    },
    {
      id: 'funext',
      kind: 'tactic',
      name: 'funext',
      summary: 'Prove `f = g` by proving `f x = g x` for arbitrary `x`.',
      body:
        '`funext x` applies function extensionality. It is an axiom of Lean (the other half of what `Set.ext` is built from). `ext x` does the same for functions.',
      example: `example (α : Type) (f : α → α) (h : ∀ x, f x = x) : f = id := by
  funext x
  exact h x`,
      term: 'funext (fun x => _)',
      mathlib: '`funext`',
    },
    {
      id: 'left-inverse',
      kind: 'definition',
      name: 'Function.LeftInverse',
      summary: '`LeftInverse g f` is `∀ x, g (f x) = x`.',
      body: '`g` undoes `f`. A proof applies like a function: `h a : g (f a) = a`.',
      example: `example (α β : Type) (f : α → β) (g : β → α) (h : Function.LeftInverse g f) (a : α) : g (f a) = a := h a`,
      mathlib: '`Function.LeftInverse`',
    },
    {
      id: 'image',
      kind: 'symbol',
      name: "f '' A",
      summary: '`f \'\' A` is the image: `{y | ∃ x, x ∈ A ∧ f x = y}`.',
      body: "The image of `A` under `f`. Membership is an existential: `y ∈ f '' A` means some `x ∈ A` maps to `y`. Typed as two apostrophes.",
      input: "'' (two apostrophes)",
    },
    {
      id: 'preimage',
      kind: 'symbol',
      name: "f ⁻¹' B",
      summary: "`f ⁻¹' B` is the preimage: `{x | f x ∈ B}`.",
      body: "The preimage of `B` under `f`. Membership unfolds to `f x ∈ B`.",
      input: "\\preim (or \\inv then ')",
    },
    {
      id: 'mem_image',
      kind: 'definition',
      name: 'Set.mem_image',
      summary: '`y ∈ f \'\' A ↔ ∃ x, x ∈ A ∧ f x = y`.',
      body: 'True by definition. To use `hy : y ∈ f \'\' A`, `obtain ⟨x, hx, hxy⟩ := hy`.',
      example: `example (α β : Type) (f : α → β) (A : Set α) (y : β) : y ∈ f '' A ↔ ∃ x, x ∈ A ∧ f x = y := Set.mem_image f A y`,
      mathlib: '`Set.mem_image`',
    },
    {
      id: 'mem_preimage',
      kind: 'definition',
      name: 'Set.mem_preimage',
      summary: "`a ∈ f ⁻¹' B ↔ f a ∈ B`.",
      body: 'True by definition.',
      example: `example (α β : Type) (f : α → β) (B : Set β) (a : α) : a ∈ f ⁻¹' B ↔ f a ∈ B := Set.mem_preimage`,
      mathlib: '`Set.mem_preimage`',
    },
    {
      id: 'diagonal',
      kind: 'concept',
      name: 'The diagonal construction',
      summary: 'Build an object that differs from the i-th object at position i.',
      body:
        'Given `f : α → Set α`, the diagonal set `{x | x ∉ f x}` disagrees with `f a` about whether `a` is a member. So it equals no `f a`. This idea proves Cantor\'s theorem, and also the uncountability of the reals and the undecidability of the halting problem.',
    },
    {
      id: 'cantor',
      kind: 'concept',
      name: "Cantor's theorem",
      summary: 'No function `α → Set α` is surjective.',
      body: 'Every set has strictly more subsets than elements. Proof: diagonal set plus `¬(P ↔ ¬P)`. In Mathlib: `Function.cantor_surjective`.',
      mathlib: '`Function.cantor_surjective`',
    },
  ],

  lemmas: [
    {
      name: 'Function.Injective.comp',
      origin: 'core',
      source: `theorem Function.Injective.comp {α β γ : Type} {g : β → γ} {f : α → β} (hg : Function.Injective g) (hf : Function.Injective f) : Function.Injective (g ∘ f) := by
  intro a b h
  apply hf
  apply hg
  exact h`,
      doc: 'A composite of injective functions is injective.',
    },
    {
      name: 'Function.Surjective.comp',
      origin: 'core',
      source: `theorem Function.Surjective.comp {α β γ : Type} {g : β → γ} {f : α → β} (hg : Function.Surjective g) (hf : Function.Surjective f) : Function.Surjective (g ∘ f) := by
  intro c
  obtain ⟨b, hb⟩ := hg c
  obtain ⟨a, ha⟩ := hf b
  use a
  rw [Function.comp_apply, ha, hb]`,
      doc: 'A composite of surjective functions is surjective.',
    },
    {
      name: 'Function.LeftInverse.injective',
      origin: 'core',
      source: `theorem Function.LeftInverse.injective {α β : Type} {g : β → α} {f : α → β} (h : Function.LeftInverse g f) : Function.Injective f := by
  intro a b hab
  have h2 : g (f a) = g (f b) := congrArg g hab
  rw [h a, h b] at h2
  exact h2`,
      doc: 'A function with a left inverse is injective.',
    },
    {
      name: 'Set.subset_preimage_image',
      origin: 'game',
      source: `theorem Set.subset_preimage_image {α β : Type} (f : α → β) (A : Set α) : A ⊆ f ⁻¹' (f '' A) :=
  fun x hx => ⟨x, hx, rfl⟩`,
      doc: 'A set is contained in the preimage of its image.',
    },
    {
      name: 'Set.preimage_inter',
      origin: 'game',
      source: `theorem Set.preimage_inter {α β : Type} (f : α → β) (A B : Set β) : f ⁻¹' (A ∩ B) = f ⁻¹' A ∩ f ⁻¹' B := by
  ext x
  constructor
  · intro h
    exact h
  · intro h
    exact h`,
      doc: 'Preimage commutes with intersection.',
    },
    {
      name: 'Function.Surjective.of_comp',
      origin: 'game',
      source: `theorem Function.Surjective.of_comp {α β γ : Type} {g : β → γ} {f : α → β} (h : Function.Surjective (g ∘ f)) : Function.Surjective g := by
  intro c
  obtain ⟨a, ha⟩ := h c
  exact ⟨f a, ha⟩`,
      doc: 'If `g ∘ f` is surjective, so is `g`.',
    },
    {
      name: 'Function.Injective.of_comp',
      origin: 'game',
      source: `theorem Function.Injective.of_comp {α β γ : Type} {f : β → γ} {g : α → β} (h : Function.Injective (f ∘ g)) : Function.Injective g := by
  intro a b hab
  apply h
  exact congrArg f hab`,
      doc: 'If `f ∘ g` is injective, so is `g`.',
    },
    {
      name: 'iff_not_self',
      origin: 'core',
      source: `theorem iff_not_self {P : Prop} : ¬(P ↔ ¬P) := by
  intro h
  have hn : ¬P := by
    intro hp
    exact (h.mp hp) hp
  exact hn (h.mpr hn)`,
      doc: 'A proposition is never equivalent to its own negation.',
    },
    {
      name: 'Function.cantor_surjective',
      origin: 'game',
      source: `theorem Function.cantor_surjective {α : Type} (f : α → Set α) : ¬ Function.Surjective f := by
  intro hf
  obtain ⟨a, ha⟩ := hf {x | x ∉ f x}
  have key : a ∈ f a ↔ a ∈ {x | x ∉ f x} := by
    rw [ha]
  exact iff_not_self key`,
      doc: "Cantor's theorem: no function from `α` to its power set is surjective.",
    },
  ],
};
