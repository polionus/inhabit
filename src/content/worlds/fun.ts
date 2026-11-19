import type { World } from '../types.ts';

export const world: World = {
  id: 'fun',
  title: 'Function Fjord',
  tagline: 'Injective, surjective, and Cantor',
  intro:
    "Properties of functions are just quantified statements, and unfolding their definitions lets you read them straight off. You'll compose functions, show that injectivity and surjectivity carry through composition, work with images and preimages, and finish with Cantor's theorem: no function can map a set onto its power set. New tools: `unfold` and `funext`.",
  requires: ['sets'],
  bigIdea:
    'Injective and surjective are just `∀` and `∃` statements about a function, and Cantor\'s theorem comes down to the logic fact `¬(P ↔ ¬P)` applied to a diagonal set.',
  levels: [
    // 01
    {
      id: 'fun-01',
      kind: 'choice',
      title: 'Composition computes',
      intro:
        "`g ∘ f` is the function that runs `f` first, then `g`. It's *defined* as `fun x => g (f x)`, so `(g ∘ f) x` and `g (f x)` reduce to the same term and `rfl` proves they're equal. Look at the example, then answer.",
      code: `example (α β γ : Type) (f : α → β) (g : β → γ) (x : α) : (g ∘ f) x = g (f x) := rfl`,
      question: 'Why can `rfl` prove `(g ∘ f) x = g (f x)`?',
      options: [
        {
          text: '`g ∘ f` unfolds to `fun x => g (f x)`, so both sides reduce to the same term.',
          correct: true,
          feedback: 'Yes—that\'s definitional equality. Unfold `∘`, apply the function to `x` (β-reduction), and both sides are identical.',
        },
        {
          text: '`rfl` can prove any equation that is mathematically true.',
          feedback: '`rfl` only proves equations that hold by computation. `0 + n = n` is true, yet `rfl` rejects it.',
        },
        {
          text: '`Function.comp_apply` is an axiom that Lean assumes.',
          feedback: 'It\'s an ordinary theorem, and its proof is literally `rfl`—no axiom required.',
        },
        {
          text: 'The order matters: `rfl` works for `(g ∘ f) x` only because `f` is applied first.',
          feedback: 'The order is part of the definition, but it\'s not why `rfl` succeeds. Any definitional unfolding that reduces both sides to the same term works.',
        },
      ],
      outro:
        '`Function.comp_apply : (g ∘ f) x = g (f x)` holds by `rfl` because `∘` is just a definition. Definitional equality is computation: the kernel unfolds definitions and reduces until both sides match.',
      unlocks: { codex: ['comp', 'comp_apply'] },
    },
    // 02
    {
      id: 'fun-02',
      kind: 'predict',
      title: 'Injective, unwrapped',
      intro:
        "`Function.Injective f` unfolds to `∀ ⦃a b⦄, f a = f b → a = b`: equal outputs force equal inputs. Just like `⊆`, it uses strict-implicit binders, so `intro a b h` works directly and `hf h` infers `a` and `b`. Read the proof, then predict.",
      code: `theorem id_injective (α : Type) : Function.Injective (id : α → α) := by
  intro a b h
  exact h`,
      line: 2,
      question: 'What will the goal be after `intro a b h`?',
      options: [
        {
          text: '`a b : α`, `h : id a = id b` ⊢ `a = b`',
          correct: true,
          feedback: 'Yes. `h` is the injectivity premise (equal outputs), and the goal is equal inputs. `exact h` succeeds because `id a` unfolds to `a`.',
        },
        {
          text: '`a b : α`, `h : a = b` ⊢ `id a = id b`',
          feedback: 'That\'s the *converse*, which is just congruence and holds for every function. Injectivity goes the other way, from outputs back to inputs.',
        },
        {
          text: '`a b : α` ⊢ `id a = id b → a = b`',
          feedback: 'That\'s what `intro a b` alone would leave. Adding the third name `h` introduces the implication as well.',
        },
        {
          text: '`h : Function.Injective id` ⊢ `a = b`',
          feedback: 'The statement you\'re proving gets broken down by `intro`—it doesn\'t become a hypothesis.',
        },
      ],
      outro:
        'A proof of injectivity is a function: give it two inputs and a proof that their outputs agree, and it returns a proof that the inputs agree. Using one is just application: `hf h` has type `a = b`, with `a` and `b` inferred from `h`.',
      unlocks: { codex: ['injective'] },
    },
    // 03
    {
      id: 'fun-03',
      kind: 'proof',
      title: 'Look inside a definition',
      english: 'The identity function `id : α → α` is surjective.',
      intro:
        "`Function.Surjective f` unfolds to `∀ b, ∃ a, f a = b`: every target gets hit. The tactic `unfold Function.Surjective` replaces the name with its definition in the goal so you can see the `∀` and `∃`. It only changes how the goal looks, not what it means. Finish the proof.",
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
        { text: 'After `unfold`, read the goal as a sentence: for every `b`, there\'s an `a` such that `id a = b`.' },
        { text: 'Introduce `b`, then supply a witness for the `∃`.' },
        { text: 'The witness is `b` itself, and `id b = b` holds by `rfl`.' },
        { text: '`intro b`, then `exact ⟨b, rfl⟩`.' },
      ],
      outro:
        '`unfold` revealed `∀ b, ∃ a, id a = b`: surjectivity is a quantified statement, and proving it means writing a function that returns a dependent pair (a witness plus evidence). Notice the familiar tactics you reused: `intro`, the anonymous constructor, and `rfl`.',
      unlocks: { tactics: ['unfold'], codex: ['unfold', 'surjective'] },
    },
    // 04
    {
      id: 'fun-04',
      kind: 'parsons',
      title: 'Injective composes',
      english: 'If `f` and `g` are injective, so is `g ∘ f`.',
      intro:
        "Start with `a` and `b` satisfying `(g ∘ f) a = (g ∘ f) b`; your goal is `a = b`. Because `hf : Injective f` is an implication, `apply hf` shifts the goal to `f a = f b`, and `apply hg` shifts it one step further. Arrange the lines.",
      header:
        'theorem Injective.comp {α β γ : Type} {g : β → γ} {f : α → β} (hg : Function.Injective g) (hf : Function.Injective f) : Function.Injective (g ∘ f) := by',
      lines: ['  intro a b h', '  apply hf', '  apply hg', '  exact h'],
      distractors: ['  exact hf h', '  intro h'],
      hints: [
        { text: 'Start by introducing everything. Then work backward from `a = b`: which hypothesis concludes an equality of inputs?' },
        { text: 'You need two `apply` steps, one for each injectivity hypothesis. `g` is on the outside of the composition, while the *goal* starts at the inputs of `f`.' },
        { text: 'Apply `hf` first (giving `f a = f b`), then `hg` (giving `g (f a) = g (f b)`), which matches `h` once `∘` unfolds.' },
      ],
      outro:
        'Working backward, each `apply` peels off one function. The proof composes the two injectivity arguments, and in Lean\'s library it\'s `Function.Injective.comp` (often written `hg.comp hf`).',
      unlocks: { lemmas: ['Function.Injective.comp'] },
    },
    // 05
    {
      id: 'fun-05',
      kind: 'proof',
      title: 'Surjective composes',
      english: 'If `f` and `g` are surjective, so is `g ∘ f`.',
      intro:
        "Now for the existential version. Given `c`, `hg c` hands you a `b` with `g b = c`; then `hf b` hands you an `a` with `f a = b`. That `a` is your witness for `g ∘ f`. Use `obtain ⟨b, hb⟩ := hg c` to unpack an existential, `use` to give a witness, and `Function.comp_apply` so `rw` can see `g (f a)`.",
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
        { text: 'Introduce the target `c`. Which hypothesis tells you how to hit `c`?' },
        { text: '`hg c` is an existential—unpack it with `obtain`, then do the same with `hf`.' },
        { text: 'Pick `a` as your witness. The goal becomes `(g ∘ f) a = c`; rewrite with `Function.comp_apply`, then with both equations.' },
        { text: '`rw [Function.comp_apply, ha, hb]` after `use a`.' },
      ],
      outro:
        'You chained the two witnesses in order to build the witness for the composite. A surjectivity proof is a function returning a dependent pair, and composition chains those functions together. This is `Function.Surjective.comp`.',
      unlocks: { lemmas: ['Function.Surjective.comp'] },
    },
    // 06
    {
      id: 'fun-06',
      kind: 'proof',
      title: 'Equal at every point',
      english: 'If `f x = x` for every `x`, then `f = id`.',
      intro:
        "Two functions are equal if they agree on every input. The tactic `funext x` turns a goal `f = g` into `f x = g x` for an arbitrary `x`. That's function extensionality—the basic rules of λ-calculus don't give it to you, so Lean proves it from its quotient axiom. The first line is already there.",
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
        { text: 'Your hypothesis `h` tells you about `f x`. Which instance do you need?' },
        { text: '`exact h x` (Lean matches `f x = id x` with `f x = x` by unfolding `id`).' },
      ],
      outro:
        '`funext` turns pointwise equality into equality of functions. It doesn\'t follow from the core rules alone—Lean derives it from its quotient axiom `Quot.sound`, and it\'s one half of what `Set.ext` relies on. In term mode, it\'s just `funext h`.',
      unlocks: { tactics: ['funext'], codex: ['funext'] },
    },
    // 07
    {
      id: 'fun-07',
      kind: 'proof',
      title: 'Undo implies injective',
      english: 'If `g` undoes `f` (`g (f x) = x` for all `x`), then `f` is injective.',
      intro:
        "`Function.LeftInverse g f` unfolds to `∀ x, g (f x) = x`, meaning `g` undoes `f`. If `f a = f b`, apply `g` to both sides and then undo `f` on each side. The `have` line is already written (using `congrArg` from Equality Estuary); finish with `rw`.",
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
        { text: 'Look at `h2`. What does `h` tell you about `g (f a)`?' },
        { text: '`h a : g (f a) = a`. You can rewrite with it directly even though `h` is written using `LeftInverse`.' },
        { text: '`rw [h a, h b] at h2`, and then `h2` matches the goal.' },
      ],
      outro:
        'Because a left inverse recovers the input, two different inputs can\'t collide—the proof is just a short chain of rewrites. This is `Function.LeftInverse.injective`. Notice that `h a` worked directly because `LeftInverse` unfolds to a `∀`, so it applies like a function.',
      unlocks: { codex: ['left-inverse'], lemmas: ['Function.LeftInverse.injective'] },
    },
    // 08
    {
      id: 'fun-08',
      kind: 'formalize',
      title: 'A fixed point',
      english: 'The function `f : α → α` has a fixed point (a point that `f` leaves where it is).',
      intro:
        "Formalize in Lean: \"f has a fixed point\". Say it in plain English first: *there is* an `x` that `f` sends to itself. Pick the right quantifier, then write the statement.",
      binders: '(α : Type) (f : α → α)',
      accept: ['∃ x, f x = x', '∃ x, x = f x'],
      mistakes: [
        {
          statement: '∀ x, f x = x',
          feedback: 'That says *every* point is fixed, which makes `f` the identity. Having a fixed point only requires one.',
        },
        {
          statement: 'f = id',
          feedback: 'Again, this says every point is fixed. "Has a fixed point" is an existential claim.',
        },
        {
          statement: '∃ x y, f x = y',
          feedback: 'Every function satisfies this—just pick any `x` and let `y := f x`. It doesn\'t say `f x` equals `x`.',
        },
        {
          statement: 'Function.Injective f',
          feedback: 'Injectivity is a different property altogether; it doesn\'t say any point stays fixed.',
        },
      ],
      hints: [
        { text: 'Which quantifier fits: for all, or there exists? Ask whether every point has to be fixed.' },
        { text: '`∃ x, …`, where the body says `f` sends `x` to `x`.' },
      ],
      outro:
        '"For all" versus "there exists" is the entire difference between the identity function and a function with a fixed point. In type theory, that\'s a Π-type versus a Σ-type (a dependent function versus a dependent pair).',
    },
    // 09
    {
      id: 'fun-08b',
      kind: 'choice',
      title: 'Which set is which?',
      intro:
        "Two symbols take a function and a set: `f '' A` (image) and `f ⁻¹' B` (preimage). The two examples below are proved for you. Read them, hover over the pieces, and decide what each symbol collects.",
      question: 'Which description is right?',
      code: `example (f : Nat → Nat) (A : Set Nat) (a : Nat) (ha : a ∈ A) : f a ∈ f '' A :=
  ⟨a, ha, rfl⟩

example (f : Nat → Nat) (B : Set Nat) (x : Nat) (h : f x ∈ B) : x ∈ f ⁻¹' B :=
  h`,
      options: [
        {
          text: "`f '' A` holds outputs `f a` for `a ∈ A`. `f ⁻¹' B` holds the inputs `x` whose output `f x` lies in `B`.",
          correct: true,
          feedback: 'Yes. The image lives on the output side, the preimage on the input side. Membership in a preimage is just `f x ∈ B`.',
        },
        {
          text: "Both collect outputs; the preimage just starts from `B`.",
          feedback: 'A preimage collects *inputs*: its elements `x` are tested by asking whether `f x` is in `B`. That\'s why the second proof is just `h : f x ∈ B`.',
        },
        {
          text: "`f ⁻¹' B` is the image of `B` under an inverse function.",
          feedback: 'No inverse is involved, and `f` need not have one. `⁻¹` is part of the notation. The preimage only asks whether `f x ∈ B`.',
        },
        {
          text: "`y ∈ f '' A` means `f y ∈ A`.",
          feedback: 'That mixes up the two. `y ∈ f \'\' A` means some `x ∈ A` has `f x = y`. The condition `f y ∈ A` is closer to a preimage.',
        },
      ],
      outro:
        'Image: start from inputs in `A`, collect their outputs. Preimage: start from outputs in `B`, collect the inputs that land there. Next you\'ll prove that every `x ∈ A` lands in the preimage of its own image.',
    },
    {
      id: 'fun-09',
      kind: 'proof',
      mode: 'term',
      showTerm: true,
      title: 'Image and preimage',
      english: 'Every `x` in `A` lies in the preimage of the image of `A`: `A ⊆ f ⁻¹\' (f \'\' A)`.',
      intro:
        "The image `f '' A` is `{y | ∃ x, x ∈ A ∧ f x = y}`, and the preimage `f ⁻¹' B` is `{x | f x ∈ B}`. So `x ∈ f ⁻¹' (f '' A)` unfolds to `∃ a, a ∈ A ∧ f a = f x`, where `x` itself is a witness. Write the proof as a term: `fun x hx => ⟨_, _, _⟩`.",
      header:
        "theorem subset_preimage_image {α β : Type} (f : α → β) (A : Set α) : A ⊆ f ⁻¹' (f '' A) :=",
      starter: '  fun x hx => ⟨sorry, sorry, sorry⟩',
      solutions: ['  fun x hx => ⟨x, hx, rfl⟩'],
      hints: [
        { text: 'Start with the function for `⊆`. Then unfold the membership in the goal—preimage first, then image—until you see an `∃`.' },
        { text: 'The existential takes three pieces: a witness, a proof that it\'s in `A`, and an equation. Anonymous constructors nest to the right.' },
        { text: '`fun x hx => ⟨x, hx, rfl⟩`' },
      ],
      outro:
        'Both definitions are just predicates: preimage composes with `f`, and image adds an existential. The proof term is a function returning nested pairs. Image and preimage form a Galois connection between sets, and this lemma is `Set.subset_preimage_image`.',
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
        "Side quest. After `ext x`, both sides unfold to `f x ∈ A ∧ f x ∈ B`, so each direction is just the identity on that proposition. You can close both with `exact`.",
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
        { text: 'Start with the tactic for set equality, then compare both sides of the `↔` once they unfold.' },
        { text: 'Both sides unfold to the exact same statement, so `exact` with the hypothesis closes each branch.' },
      ],
      outro:
        'Both sides unfold to the exact same proposition, so each direction is just the identity. Preimages respect every set operation because they only precompose with `f`. This is `Set.preimage_inter`.',
      unlocks: { lemmas: ['Set.preimage_inter'] },
    },
    // 11
    {
      id: 'fun-11',
      kind: 'proof',
      title: 'Cancelling on the left',
      english: 'If `g ∘ f` is surjective, then `g` is surjective.',
      intro:
        "Here's a cancellation theorem: deduce a property of one function from a property of the composite. If `g ∘ f` hits every `c`, then `g` hits every `c` too—using `f a` as the witness. Unpack `h c`, then supply that witness.",
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
        { text: 'The goal is `∀ c, ∃ b, g b = c`. Introduce `c` and check what `h` gives you at `c`.' },
        { text: '`h c` gives an `a` with `(g ∘ f) a = c`. Which element of `β` does `g` take to `c` in that equation?' },
        { text: 'Use `f a` as the witness; `ha` proves the equation once `∘` unfolds.' },
      ],
      outro:
        'The witness `f a` is the point where `g` actually acts. Cancellation works on the *outer* function for surjectivity and on the *inner* function for injectivity, since anything the composite hits must be hit by `g`. This is `Function.Surjective.of_comp`.',
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
        "Now for the dual cancellation. If `g a = g b`, then `f (g a) = f (g b)`, and injectivity of the composite finishes the proof. Use `apply` on the hypothesis to turn the goal into an equation about `f ∘ g`.",
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
        { text: '`apply h` turns the goal into `(f ∘ g) a = (f ∘ g) b`. Which equation do you already have to start from?' },
        { text: '`exact congrArg f hab`' },
      ],
      outro:
        'If the composite never maps two distinct inputs to the same output, its first stage can\'t either. This is `Function.Injective.of_comp`.',
      unlocks: { lemmas: ['Function.Injective.of_comp'] },
    },
    // 13
    {
      id: 'fun-14b',
      kind: 'proof',
      title: 'Compose, then compare',
      english: 'If `f` and `g` agree at every point, then `k ∘ f = k ∘ g`.',
      intro:
        `Equal functions agree at every input, and \`funext\` from earlier in this world is how you prove that. Next, use \`change\` from Set Savanna to expose the composition applied to \`x\`, then rewrite with the hypothesis.`,
      header:
        'theorem comp_congr {α β γ : Type} (f g : α → β) (k : β → γ) (h : ∀ x, f x = g x) : k ∘ f = k ∘ g := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  funext x
  change k (f x) = k (g x)
  rw [h x]`,
        `  funext x
  show k (f x) = k (g x)
  rw [h x]`,
      ],
      hints: [
        { text: 'The goal is an equation between functions. Which tactic reduces it to an equation at a single input?' },
        { text: 'After `funext x`, the goal is `(k ∘ f) x = (k ∘ g) x`. Restate it with `change` so you can see `f x` directly.' },
        { text: 'The hypothesis `h x` rewrites `f x`. Once both sides match, `rw` closes the goal automatically.' },
      ],
      outro:
        `Pointwise equality gave you equality of functions, and the composition unfolded because \`(k ∘ f) x\` is \`k (f x)\` by definition. Notice that \`rw\` finished the goal on its own once both sides matched.`,
    },
    {
      id: 'fun-14c',
      kind: 'proof',
      title: 'Nothing comes from nothing',
      english: 'If `y` is in the image of the empty set, then `y` is in any set `S`.',
      intro:
        `Any element of \`f '' ∅\` would have to come from an element of \`∅\`, and there aren't any. Unpack the image with \`obtain\`, then use \`exfalso\` from Connective Canyon: once you hold a contradiction, the goal doesn't matter.`,
      header:
        'theorem mem_of_mem_image_empty {α β : Type} (f : α → β) (S : Set β) (y : β) (h : y ∈ f \'\' (∅ : Set α)) : y ∈ S := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  obtain ⟨x, hx, _⟩ := h
  exfalso
  exact hx`,
        `  obtain ⟨x, hx, _⟩ := h
  contradiction`,
      ],
      hints: [
        { text: 'The goal `y ∈ S` has nothing to do with your hypotheses yet. Unpack `h` first and see what comes out.' },
        { text: 'Membership in an image gives an `x`, a proof `hx : x ∈ ∅`, and an equation—and `x ∈ ∅` unfolds to `False`.' },
        { text: 'Once you have a proof of `False`, you can throw away the current goal. Which tactic does that?' },
      ],
      outro:
        `Claims about the empty set are often vacuously true because there's nothing to check. The moment \`hx : x ∈ ∅\` appeared, you held a proof of \`False\`, and anything follows from \`False\`.`,
    },
    {
      id: 'fun-14d',
      kind: 'proof',
      title: 'Surjective means the image covers',
      english: 'If `f` is surjective, then every `S ⊆ β` satisfies `S ⊆ f \'\' (f ⁻¹\' S)`.',
      intro:
        `Take \`y\` in \`S\`. Surjectivity gives an \`x\` with \`f x = y\`. Pass that witness to \`use\`, split the remaining pair, and use \`change\` to expose what the first half means. \`rwa\` rewrites and then closes the goal from your context.`,
      header:
        'theorem subset_image_preimage {α β : Type} (f : α → β) (hf : Function.Surjective f) (S : Set β) : S ⊆ f \'\' (f ⁻¹\' S) := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  intro y hy
  obtain ⟨x, hx⟩ := hf y
  use x
  constructor
  · change f x ∈ S
    rwa [hx]
  · exact hx`,
        `  intro y hy
  obtain ⟨x, hx⟩ := hf y
  exact ⟨x, by rw [Set.mem_preimage, hx]; exact hy, hx⟩`,
      ],
      hints: [
        { text: 'Start with `intro y hy`, then apply surjectivity at `y` to get a preimage point `x`.' },
        { text: 'The goal is `∃ x, x ∈ f ⁻¹\' S ∧ f x = y`. `use x` supplies the witness and leaves a conjunction, which `constructor` splits.' },
        { text: 'The first part is `x ∈ f ⁻¹\' S`, meaning `f x ∈ S`. With `hx : f x = y` in hand, rewrite and match it with `hy`.' },
      ],
      outro:
        `The image of a preimage is the slice of \`S\` that \`f\` actually reaches. Surjectivity guarantees nothing gets missed, and \`rwa\` saved you from writing a separate \`exact\` at the end.`,
    },
    // 15 boss
    {
      id: 'fun-13',
      kind: 'proof',
      title: 'Nothing is its own opposite',
      english: 'No proposition is equivalent to its own negation: `¬(P ↔ ¬P)`.',
      intro:
        "The engine behind Cantor's argument is pure logic: `P ↔ ¬P` is impossible. Assume `h : P ↔ ¬P`. First show `¬P`: if `P` held, `h` would give `¬P`, which applied to `P` gives a contradiction. Then `h` turns `¬P` right back into `P`. This is `iff_not_self` in Lean's library.",
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
        { text: '`h.mp hp : ¬P` is a function from `P` to `False`. Apply it to `hp`.' },
        { text: 'Once you have `hn : ¬P`, `h.mpr hn` gives you a proof of `P`. Put them together.' },
        { text: '`exact (h.mp hp) hp` inside `hn`, then `exact hn (h.mpr hn)`.' },
      ],
      outro:
        'To draw a contradiction from `P ↔ ¬P`, you turned `P` and `¬P` against each other. That Russell-style self-reference is the entire engine of Cantor\'s proof. It\'s `iff_not_self` in core Lean, and it\'s now in your inventory.',
      unlocks: { lemmas: ['iff_not_self'] },
    },
    // 14
    {
      id: 'fun-14',
      kind: 'proof',
      title: 'The diagonal set',
      english: 'If `f a` equals the diagonal set `{x | x ∉ f x}`, we have a contradiction.',
      intro:
        "Given `f : α → Set α`, build the *diagonal set* `D = {x | x ∉ f x}`—the elements that don't belong to their own image. Suppose some `a` satisfies `f a = D`. Is `a ∈ f a`? Rewriting with `ha` gives `a ∈ f a ↔ a ∈ D`, and `a ∈ D` unfolds to `a ∉ f a`. Finish the proof.",
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
        { text: 'Look at `key`: the two sides differ only in `f a` versus the diagonal set. Which hypothesis links them?' },
        { text: '`rw [ha]` replaces `f a` with the diagonal set so both sides match. Then apply the lemma from the previous level.' },
        { text: '`exact iff_not_self key`: Lean unfolds `a ∈ {x | x ∉ f x}` to `¬ (a ∈ f a)` automatically.' },
      ],
      outro:
        'The diagonal set is constructed to disagree with every `f a` on the element `a` itself, so it can\'t equal any `f a`. Letting `a ∈ {x | x ∉ f x}` count as `a ∉ f a` is definitional unfolding doing the heavy lifting.',
      unlocks: { codex: ['diagonal'] },
    },
    {
      id: 'fun-15',
      kind: 'proof',
      boss: true,
      showTerm: true,
      title: "Cantor's theorem",
      english: 'No function `f : α → Set α` is surjective: there are more sets of elements than elements.',
      intro:
        "Boss level. A surjection onto `Set α` would have to hit the diagonal set `{x | x ∉ f x}`. Put the pieces together: assume `f` is surjective, apply it to the diagonal set to get an `a`, and finish using what you proved in the last two levels. No scaffolding this time.",
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
        { text: 'The goal is a negation—what do you assume? And what does surjectivity let you do with a chosen set?' },
        { text: 'Apply `hf` to the diagonal set, unpack the result, and notice you\'re right back in the previous level.' },
        { text: 'Build an equivalence between `a ∈ f a` and `a ∈ {x | x ∉ f x}` using the equation `ha`.' },
        { text: '`intro hf`, `obtain ⟨a, ha⟩ := hf {x | x ∉ f x}`, then `have key … := by rw [ha]` and `exact iff_not_self key`.' },
      ],
      outro:
        "Cantor's theorem: a diagonal set built from `f` disagrees with every `f a`, so `f` has to miss it. Logic gave you `¬(P ↔ ¬P)`, and sets gave you the diagonal. In Lean this is `Function.cantor_surjective`—you've walked all the way from basic type theory to a classic theorem.",
      unlocks: { codex: ['cantor'], lemmas: ['Function.cantor_surjective'] },
    },
  ],

  codex: [
    {
      id: 'comp',
      kind: 'symbol',
      name: '∘',
      summary: '`g ∘ f` is the function `fun x => g (f x)`.',
      body: 'Composition: apply `f` first, then `g`. Because it\'s a definition, `(g ∘ f) x = g (f x)` holds by `rfl`.',
      input: '\\comp',
    },
    {
      id: 'comp_apply',
      kind: 'definition',
      name: 'Function.comp_apply',
      summary: '`(g ∘ f) x = g (f x)`, by `rfl`.',
      body: 'The unfolding lemma for composition. Pass it to `rw` whenever `(g ∘ f) x` sits in a goal and you want to expose `g (f x)`.',
      example: `example (α β γ : Type) (f : α → β) (g : β → γ) (x : α) : (g ∘ f) x = g (f x) := Function.comp_apply`,
      mathlib: '`Function.comp_apply`',
    },
    {
      id: 'injective',
      kind: 'definition',
      name: 'Function.Injective',
      summary: '`Injective f` is `∀ ⦃a b⦄, f a = f b → a = b`.',
      body:
        'Equal outputs force equal inputs. To prove it, use `intro a b h`; to use `hf : Injective f` on `h : f a = f b`, write `hf h : a = b`. The binders are strict-implicit.',
      example: `example (α β : Type) (f : α → β) (hf : Function.Injective f) (a b : α) (h : f a = f b) : a = b := hf h`,
      mathlib: '`Function.Injective`',
    },
    {
      id: 'surjective',
      kind: 'definition',
      name: 'Function.Surjective',
      summary: '`Surjective f` is `∀ b, ∃ a, f a = b`.',
      body: 'Every target has a preimage. To prove it, run `intro b` and supply a witness; to use it, unpack with `obtain ⟨a, ha⟩ := hf b`.',
      example: `example (α β : Type) (f : α → β) (hf : Function.Surjective f) (b : β) : ∃ a, f a = b := hf b`,
      mathlib: '`Function.Surjective`',
    },
    {
      id: 'unfold',
      kind: 'tactic',
      name: 'unfold',
      summary: 'Replace a defined name with its definition.',
      body:
        '`unfold Function.Surjective` rewrites the goal so the body of the definition is visible, and `unfold f at h` does the same inside a hypothesis. It only changes appearance—the new statement is definitionally equal.',
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
        '`funext x` applies function extensionality. In Lean, it\'s a theorem proved from the quotient axiom `Quot.sound` (the other half of what `Set.ext` relies on). `ext x` does the same thing for functions.',
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
      body: 'True by definition. To use `hy : y ∈ f \'\' A`, unpack it with `obtain ⟨x, hx, hxy⟩ := hy`.',
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
        'Given `f : α → Set α`, the diagonal set `{x | x ∉ f x}` disagrees with `f a` on whether `a` belongs to it, so it can\'t equal any `f a`. The same diagonal trick proves Cantor\'s theorem, the uncountability of the reals, and the undecidability of the halting problem.',
    },
    {
      id: 'cantor',
      kind: 'concept',
      name: "Cantor's theorem",
      summary: 'No function `α → Set α` is surjective.',
      body: 'Every set has strictly more subsets than elements, proved by combining the diagonal set with `¬(P ↔ ¬P)`. In Mathlib: `Function.cantor_surjective`.',
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
