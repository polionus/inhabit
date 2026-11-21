import type { World } from '../types.ts';

export const world: World = {
  id: 'sets',
  title: 'Set Savanna',
  tagline: 'Sets are predicates',
  intro:
    "In Lean, a set isn't a bag of elements—it's a question you can ask about any element. Here you'll prove facts about subsets, intersections, unions, and complements, and see that each proof is really a logic proof you already know in disguise. New tools: `ext`, `rintro`, and `change`.",
  requires: ['eq'],
  bigIdea:
    'A set is just a predicate `α → Prop`, so every statement about sets unfolds into a statement using `∀`, `→`, `∧`, `∨`, and `¬`.',
  levels: [
    // ───────────────────────── 01 choice: sets are predicates
    {
      id: 'sets-01',
      kind: 'choice',
      title: 'A set is a question',
      intro:
        "In Lean, `Set α` is *defined* as `α → Prop`. A set is a predicate, and `a ∈ A` simply means `A a`. Set-builder notation `{x | p x}` turns the predicate `p` into a set, so a proof of `p a` already works as a proof of `a ∈ {x | p x}` with no conversion. Look over the two examples, then answer.",
      code: `example (α : Type) (p : α → Prop) (a : α) (h : p a) : a ∈ {x | p x} := h
example (α : Type) (A : Set α) (a : α) (h : A a) : a ∈ A := h`,
      question:
        'The second example accepts `h : A a` as a proof of `a ∈ A` with no conversion. What does that tell you about `Set α`?',
      options: [
        {
          text: '`Set α` is the same type as `α → Prop`, and `a ∈ A` is the predicate `A` applied to `a`.',
          correct: true,
          feedback:
            'Yes. `Set α` is a definition, and Lean unfolds definitions when comparing types. Membership is just function application.',
        },
        {
          text: 'A set stores its elements, and `A a` looks `a` up in that storage.',
          feedback:
            'That\'s the container picture from other languages. In Lean, a set doesn\'t store elements—it\'s a function that returns a proposition (`Prop`) for each element.',
        },
        {
          text: 'Lean silently coerces `A a` into `a ∈ A` as a convenience.',
          feedback:
            'There\'s no coercion happening here. After unfolding the definition of `∈`, the two statements are literally the same term, so the kernel sees no difference.',
        },
        {
          text: '`A a` and `a ∈ A` are different propositions that happen to have the same proofs.',
          feedback:
            'They aren\'t two different propositions at all—they\'re one proposition written two ways. Truly different propositions would need an actual proof to get from one to the other.',
        },
      ],
      outro:
        'A set is a function into `Prop`, and membership is function application. In type theory, `Set α` and `α → Prop` are the exact same type once the definition unfolds, so every statement about sets is really a statement about predicates.',
      unlocks: { codex: ['set-as-predicate', 'mem', 'notin', 'set-builder', 'mem_setOf_eq'] },
    },

    // ───────────────────────── 02 predict: ⊆
    {
      id: 'sets-02',
      kind: 'predict',
      title: 'Subset is a function',
      intro:
        "`A ⊆ B` isn't a new primitive—it unfolds to `∀ ⦃x⦄, x ∈ A → x ∈ B`: for every `x`, a proof that `x ∈ A` yields a proof that `x ∈ B`. Because that's a `∀` and an `→`, `intro` works on it directly. Read the proof, then predict what `intro x hx` does.",
      code: `theorem subset_refl_demo (α : Type) (A : Set α) : A ⊆ A := by
  intro x hx
  exact hx`,
      line: 2,
      question: 'What will the goal look like after `intro x hx`?',
      options: [
        {
          text: '`x : α`, `hx : x ∈ A` ⊢ `x ∈ A`',
          correct: true,
          feedback:
            'Right. `intro x` handles the `∀`, `intro hx` handles the `→`, and the goal becomes the conclusion `x ∈ A`.',
        },
        {
          text: '`x : α` ⊢ `x ∈ A → x ∈ A`',
          feedback:
            'That\'s what `intro x` alone would give. You wrote two names, so the arrow gets introduced too.',
        },
        {
          text: '`intro` fails: `A ⊆ A` is not a function type, so there is nothing to introduce.',
          feedback:
            '`⊆` is a definition, and `intro` unfolds definitions until it finds a `∀` or `→`. That\'s why it works here.',
        },
        {
          text: '`hx : A ⊆ A` ⊢ `x ∈ A`',
          feedback:
            'The hypothesis `hx` is the *premise* `x ∈ A`, not the original statement. The original goal gets broken down rather than saved as a hypothesis.',
        },
      ],
      outro:
        'A proof of `A ⊆ B` is a function from membership proofs to membership proofs. The binder `⦃x⦄` is strict-implicit: given `h : A ⊆ B` and `hx : x ∈ A`, Lean infers `x` from `hx`, so you just write `h hx`. This demo is `Set.Subset.refl`, now in your inventory.',
      unlocks: { codex: ['subset', 'strict-implicit'], lemmas: ['Set.Subset.refl'] },
    },

    // ───────────────────────── 03 completion: transitivity
    {
      id: 'sets-03',
      kind: 'proof',
      title: 'Chaining subsets',
      english: 'If `A ⊆ B` and `B ⊆ C`, then `A ⊆ C`.',
      intro:
        "Given `h1 : A ⊆ B` and `h2 : B ⊆ C`, start with an element of `A`, pass it through `h1`, then pass the result through `h2`. Each `h hx` feeds a membership proof to a function, and Lean infers the element from `hx` automatically. The first line is there; replace the `sorry`.",
      header:
        'theorem Subset.trans {α : Type} {A B C : Set α} (h1 : A ⊆ B) (h2 : B ⊆ C) : A ⊆ C := by',
      starter: `  intro x hx
  sorry`,
      mode: 'tactic',
      solutions: [`  intro x hx
  exact h2 (h1 hx)`],
      hints: [
        { text: 'After `intro x hx`, what do you have, and what do you want? Say both out loud in terms of `A`, `B`, and `C`.' },
        { text: '`h1` and `h2` are functions on membership proofs. Which one can take `hx`?' },
        { text: 'Apply `h1` to `hx` to get a proof of `x ∈ B`, then apply `h2` to that.' },
        { text: '`exact h2 (h1 hx)`' },
      ],
      outro:
        'This is function composition—the same shape as `(A → B) → (B → C) → A → C` from Basecamp, now passing membership proofs along. Transitivity of `⊆` is just composition, and in Lean\'s library it\'s `Set.Subset.trans`.',
      unlocks: { lemmas: ['Set.Subset.trans'] },
    },

    // ───────────────────────── 04 term mode: ∩ is ∧
    {
      id: 'sets-04',
      kind: 'proof',
      mode: 'term',
      showTerm: true,
      title: 'Intersection is "and"',
      english: 'Every element of `A ∩ B` is an element of `A`.',
      intro:
        "No tactics this time: a proof of `A ∩ B ⊆ A` is a function `fun x hx => …`. What's `hx : x ∈ A ∩ B`? By definition `A ∩ B` is `{x | x ∈ A ∧ x ∈ B}`, so membership in `A ∩ B` *is* a conjunction, and `hx.1` gives its first half. `Set.mem_inter_iff` states this equivalence, and it holds by `Iff.rfl`.",
      header: 'theorem inter_subset_left {α : Type} {A B : Set α} : A ∩ B ⊆ A :=',
      starter: '  fun x hx => sorry',
      solutions: ['  fun x hx => hx.1', '  fun _ hx => hx.left'],
      hints: [
        { text: 'The goal is a subset statement. In term mode, what kind of term proves a `∀ … → …`?' },
        { text: '`fun x hx =>` is written for you. Then check what `hx` really is by unfolding `∩` once.' },
        { text: 'A proof of `P ∧ Q` has two halves, accessed with `.1` and `.2`.' },
      ],
      outro:
        'Intersection is conjunction: `x ∈ A ∩ B` unfolds to `x ∈ A ∧ x ∈ B`, so `.1` and `.2` work right out of the box. The proof term is a function projecting from a pair. Its twin, `Set.inter_subset_right`, uses `hx.2` and is now in your inventory too.',
      unlocks: {
        codex: ['inter', 'mem_inter_iff'],
        lemmas: ['Set.inter_subset_left', 'Set.inter_subset_right'],
      },
    },

    // ───────────────────────── 05 parsons: ∪ is ∨
    {
      id: 'sets-05',
      kind: 'parsons',
      title: 'Union is "or"',
      english: 'Every element of `A` is an element of `A ∪ B`.',
      intro:
        "Union is disjunction: `x ∈ A ∪ B` unfolds to `x ∈ A ∨ x ∈ B` (`Set.mem_union`). To prove membership in a union, pick a side with `left` or `right`, just as in Connective Canyon. Arrange the lines into a proof of `A ⊆ A ∪ B`.",
      header: 'theorem subset_union_left {α : Type} {A B : Set α} : A ⊆ A ∪ B := by',
      lines: ['  intro x hx', '  left', '  exact hx'],
      distractors: ['  right', '  exact hx.1', '  constructor'],
      hints: [
        { text: 'Start the way every subset proof starts, then ask what the goal `x ∈ A ∪ B` means.' },
        { text: 'You hold a proof of the left side of the disjunction. Which tactic picks that side?' },
        { text: 'Order: `intro`, pick a side, `exact`. Watch out: `A` has no projections, and `∪` isn\'t a pair to split.' },
      ],
      outro:
        '`left` works on `x ∈ A ∪ B` because `∪` unfolds to `∨`, making `Or.inl hx` a valid proof. Constructors see right through definitions—they don\'t care whether the goal was written with `∨` or `∪`. This is `Set.subset_union_left`.',
      unlocks: { codex: ['union', 'mem_union'], lemmas: ['Set.subset_union_left'] },
    },

    // ───────────────────────── 06 predict: ext
    {
      id: 'sets-06',
      kind: 'predict',
      title: 'Same elements, same set',
      intro:
        "To show two sets are equal, show they have the same elements: `Set.ext : (∀ x, x ∈ A ↔ x ∈ B) → A = B`. The tactic `ext x` applies this rule and introduces `x` for you, turning the goal into an `↔` so you're right back in logic. Predict what the goal looks like after `ext x`.",
      code: `theorem inter_comm_demo (α : Type) (A B : Set α) : A ∩ B = B ∩ A := by
  ext x
  constructor
  · intro h
    exact ⟨h.2, h.1⟩
  · intro h
    exact ⟨h.2, h.1⟩`,
      line: 2,
      question: 'What will the goal look like after `ext x`?',
      options: [
        {
          text: '`x : α` ⊢ `x ∈ A ∩ B ↔ x ∈ B ∩ A`',
          correct: true,
          feedback: 'Yes. `ext x` introduces an arbitrary element and asks you to show membership matches on both sides.',
        },
        {
          text: '`⊢ A ∩ B ⊆ B ∩ A` and `⊢ B ∩ A ⊆ A ∩ B`, as two goals',
          feedback:
            'That\'s true mathematically (equal sets are subsets of each other), but it\'s not what `ext` produces. `ext` gives a single `↔` goal, and `constructor` is what splits it in two.',
        },
        {
          text: '`x : α`, `h : x ∈ A ∩ B` ⊢ `x ∈ B ∩ A`',
          feedback:
            'That\'s the first direction, which only shows up after `constructor` and `intro h`. `ext` on its own doesn\'t split the `↔`.',
        },
        {
          text: '`⊢ ∀ x, x ∈ A ∩ B ↔ x ∈ B ∩ A`',
          feedback: 'Close—that\'s the *hypothesis* of `Set.ext`. Writing `ext x` already introduces `x` for you.',
        },
      ],
      outro:
        '`ext x` turned set equality into `x ∈ A ∩ B ↔ x ∈ B ∩ A`. Under the hood, `Set.ext` relies on two principles that the basic rules don\'t give you: `funext` (functions with equal outputs are equal) and `propext` (equivalent propositions are equal). Because a set is a function into `Prop`, it needs both. The demo is `Set.inter_comm`.',
      unlocks: { tactics: ['ext'], codex: ['ext', 'set-ext'], lemmas: ['Set.inter_comm'] },
    },

    // ───────────────────────── 07 completion: union_comm
    {
      id: 'sets-07',
      kind: 'proof',
      title: 'Union commutes',
      english: '`A ∪ B = B ∪ A`.',
      intro:
        "Same shape, different operator. After `ext x`, the goal `x ∈ A ∪ B ↔ x ∈ B ∪ A` is just `P ∨ Q ↔ Q ∨ P`. The first direction is already done using `rcases` on the `∨`. Now prove the second direction yourself.",
      header: 'theorem union_comm {α : Type} (A B : Set α) : A ∪ B = B ∪ A := by',
      starter: `  ext x
  constructor
  · intro h
    rcases h with ha | hb
    · right
      exact ha
    · left
      exact hb
  · sorry`,
      mode: 'tactic',
      solutions: [`  ext x
  constructor
  · intro h
    rcases h with ha | hb
    · right
      exact ha
    · left
      exact hb
  · intro h
    rcases h with hb | ha
    · right
      exact hb
    · left
      exact ha`],
      hints: [
        { text: 'Compare with the first bullet: the second goal is the same statement with `A` and `B` swapped.' },
        { text: 'Introduce the hypothesis, split it with `rcases`, then choose the right side in each case.' },
        { text: 'Mirror the first bullet, paying attention to which of `ha` and `hb` you bind in each branch.' },
      ],
      outro:
        'This is the same proof as the previous demo, with `∨` instead of `∧`: commutativity of union is just commutativity of "or". Every set-algebra identity is a logic identity with `x ∈` in front. This is `Set.union_comm`.',
      unlocks: { lemmas: ['Set.union_comm'] },
    },

    // ───────────────────────── 08 rintro
    {
      id: 'sets-08',
      kind: 'proof',
      title: 'Introduce and take apart',
      english: 'Every element of `A ∩ B` is an element of `A ∪ B`.',
      intro:
        "`intro x h` followed by `obtain ⟨ha, hb⟩ := h` comes up so often that `rintro x ⟨ha, hb⟩` combines them into one step. In patterns, `⟨a, b⟩` splits an `∧` (or `∩`), and `(a | b)` splits an `∨` (or `∪`). Prove `A ∩ B ⊆ A ∪ B`; the first line is ready for you.",
      header: 'theorem inter_subset_union {α : Type} (A B : Set α) : A ∩ B ⊆ A ∪ B := by',
      starter: `  rintro x ⟨ha, hb⟩
  sorry`,
      mode: 'tactic',
      solutions: [
        `  rintro x ⟨ha, hb⟩
  left
  exact ha`,
        `  intro x h
  right
  exact h.2`,
      ],
      hints: [
        { text: 'After `rintro`, you have `ha : x ∈ A` and `hb : x ∈ B`, and your goal is membership in a union.' },
        { text: 'A union goal asks you to choose a side. Either side works here, since you have both proofs.' },
        { text: '`left`, then `exact ha`.' },
      ],
      outro:
        '`rintro` is simply `intro` followed by `rcases`. The pattern `⟨ha, hb⟩` applies the eliminator for `And` right as you introduce the hypothesis, so the short proof and the long one build the exact same proof term.',
      unlocks: { tactics: ['rintro'], codex: ['rintro'] },
    },

    // ───────────────────────── 09 change / complement
    {
      id: 'sets-09',
      kind: 'proof',
      title: 'Restating a goal',
      english: 'If `A ⊆ B`, then `Bᶜ ⊆ Aᶜ`.',
      intro:
        "`Aᶜ` is the set `{x | x ∉ A}`, so `x ∈ Aᶜ` means `x ∉ A`—that is, `x ∈ A → False`—by definition. The tactic `change` rewrites the goal into a definitionally equal form; it checks that the two match without proving anything new. After `intro x hx`, restate the goal with `change x ∉ A`, then finish.",
      header:
        'theorem compl_subset_compl_of_subset {α : Type} {A B : Set α} (h : A ⊆ B) : Bᶜ ⊆ Aᶜ := by',
      starter: `  intro x hx
  change x ∉ A
  sorry`,
      mode: 'tactic',
      solutions: [`  intro x hx
  change x ∉ A
  intro ha
  exact hx (h ha)`],
      hints: [
        { text: 'After `change`, the goal is a negation. Think back to how you proved `¬P` in Connective Canyon.' },
        { text: 'Assume `x ∈ A`. You need a contradiction from `hx : x ∈ Bᶜ`, which unfolds to `x ∈ B → False`.' },
        { text: '`intro ha`, then apply `hx` to a proof of `x ∈ B`, which `h` gives you.' },
      ],
      outro:
        '`change` is free: the kernel treats `x ∈ Aᶜ` and `x ∉ A` as the same type because definitions unfold (δ-reduction). Tactics like `intro`, `exact`, and `constructor` unfold automatically, whereas `rw` only matches syntax and can\'t see `∉` inside `∈ Aᶜ`. This proof is the contrapositive `(P → Q) → ¬Q → ¬P`.',
      unlocks: {
        tactics: ['change'],
        codex: ['change', 'compl', 'mem_compl_iff', 'definitional-unfolding'],
      },
    },

    // ───────────────────────── 10 De Morgan
    {
      id: 'sets-10',
      kind: 'proof',
      title: 'De Morgan for sets',
      english: 'The complement of a union is the intersection of the complements: `(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ`.',
      intro:
        "Here's a classic identity: `(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ`. After `ext x`, it becomes `¬(P ∨ Q) ↔ ¬P ∧ ¬Q`—De Morgan's law, which you proved in Connective Canyon. Sketch both directions before typing: what do you assume, and what do you need to build?",
      header: 'theorem compl_union {α : Type} (A B : Set α) : (A ∪ B)ᶜ = Aᶜ ∩ Bᶜ := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  ext x
  constructor
  · intro h
    constructor
    · intro ha
      exact h (Or.inl ha)
    · intro hb
      exact h (Or.inr hb)
  · rintro ⟨hna, hnb⟩ (ha | hb)
    · exact hna ha
    · exact hnb hb`,
        `  ext x
  constructor
  · intro h
    exact ⟨fun ha => h (Or.inl ha), fun hb => h (Or.inr hb)⟩
  · intro h hab
    rcases hab with ha | hb
    · exact h.1 ha
    · exact h.2 hb`,
      ],
      hints: [
        { text: 'Start with `ext x` and split the `↔`. Then in each direction, check what hypothesis you have and what the goal unfolds to.' },
        { text: 'Forward: from `x ∉ A ∪ B`, build a pair with one negation in each half. Backward: the goal is a negation, so introduce a proof of `x ∈ A ∪ B` and split it.' },
        { text: 'Forward: use `constructor`, then in each branch `intro` a membership proof and pass `Or.inl` or `Or.inr` of it to `h`.' },
        { text: 'Backward: `rintro ⟨hna, hnb⟩ (ha | hb)`, then each branch contradicts one of the negations.' },
      ],
      outro:
        'A set identity turned into a logic identity and fell in a few lines because `∪` and `∩` unfold to `∨` and `∧`, and `ᶜ` unfolds to `¬`. The backward direction introduces *three* things in one go because `(A ∪ B)ᶜ` unfolds to a function type. This is `Set.compl_union`.',
      unlocks: { lemmas: ['Set.compl_union'] },
    },

    // ───────────────────────── 11 formalize
    {
      id: 'sets-11',
      kind: 'formalize',
      title: 'Saying "disjoint"',
      english: 'The sets `A` and `B` have no element in common.',
      intro:
        "Formalizing means picking a clean way to say an idea. \"Disjoint\" can be written as an equation, `A ∩ B = ∅` (type `\\empty` for the empty set `∅`), or as a quantified statement about elements. Write a Lean proposition for it. Answers are checked up to definitional equality, so notation differences like `∉` versus `¬ … ∈` don't matter.",
      binders: '(α : Type) (A B : Set α)',
      accept: [
        'A ∩ B = ∅',
        '∀ x, x ∈ A → x ∉ B',
        '∀ x, x ∈ B → x ∉ A',
        '∀ x, ¬ (x ∈ A ∧ x ∈ B)',
        '¬ ∃ x, x ∈ A ∧ x ∈ B',
        'A ⊆ Bᶜ',
        'B ⊆ Aᶜ',
      ],
      mistakes: [
        {
          statement: 'A ∩ B ≠ ∅',
          feedback: 'That says the sets *do* overlap. "No element in common" means their intersection is empty.',
        },
        {
          statement: 'A ∪ B = ∅',
          feedback: 'The union is only empty when *both* sets are empty. Disjoint sets can be huge—they just don\'t overlap.',
        },
        {
          statement: 'A = Bᶜ',
          feedback: 'Too strong: this says every element belongs to *either* `A` or `B` (and not both), so together they cover everything.',
        },
        {
          statement: '∀ x, x ∈ A → x ∈ B',
          feedback: 'This is `A ⊆ B`—the opposite of disjoint, since it forces every element of `A` into `B`.',
        },
      ],
      hints: [
        { text: 'Say it in plain English first: no `x` belongs to both sets. Which set operation collects the elements that belong to both?' },
        { text: 'The intersection `A ∩ B` collects them. "Has no element" means it equals the empty set.' },
        { text: 'Write `A ∩ B = ∅`.' },
      ],
      outro:
        'The empty set `∅` is `{x | False}`. Different formalizations are different *types*, even when they\'re provably equivalent: `A ∩ B = ∅` and `∀ x, x ∈ A → x ∉ B` aren\'t definitionally equal, whereas `A ⊆ Bᶜ` and the `∀` version are. Picking one is a design choice, and you prove the bridge whenever you need it.',
      unlocks: { codex: ['empty'] },
    },

    // ───────────────────────── 12 optional: empty / univ / diff
    {
      id: 'sets-12',
      kind: 'proof',
      optional: true,
      title: 'Nothing and everything',
      english: 'Intersecting with the empty set gives the empty set: `A ∩ ∅ = ∅`.',
      intro:
        "Side quest. The empty set is `{x | False}` and the universal set `Set.univ` is `{x | True}`, so `x ∈ ∅` is just `False`. A hypothesis `h : x ∈ ∅` closes any goal via `False.elim h` or `exfalso`. Set difference `A \\ B` (type `\\setminus`) is `{x | x ∈ A ∧ x ∉ B}`. Prove `A ∩ ∅ = ∅`.",
      header: 'theorem inter_empty {α : Type} (A : Set α) : A ∩ ∅ = ∅ := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [`  ext x
  constructor
  · rintro ⟨_, h⟩
    exact h
  · intro h
    exact False.elim h`],
      hints: [
        { text: 'Start the same way as every set equality. In which direction is there real work, and in which does the hypothesis already contradict itself?' },
        { text: 'Forward: the second half of the pair is `x ∈ ∅`, which is already the goal. Backward: `h : x ∈ ∅` is a proof of `False`.' },
        { text: 'Backward: `False.elim h` proves anything, including `x ∈ A ∩ ∅`.' },
      ],
      outro:
        'Membership in `∅` is `False`, so any hypothesis `x ∈ ∅` closes the goal right away (ex falso). Dually, `x ∈ Set.univ` is `True`, proved by `True.intro`. Both are just ordinary definitions you can unfold like everything else here. This is `Set.inter_empty`.',
      unlocks: { codex: ['univ', 'mem_empty_iff_false', 'mem_univ', 'mem_diff'], lemmas: ['Set.inter_empty'] },
    },

    {
      id: 'sets-12b',
      kind: 'proof',
      title: 'Outside the complement',
      english: 'Every element of `(Aᶜ)ᶜ` is an element of `A`.',
      intro:
        `Taking the complement twice should bring you back to the original set. In Connective Canyon, \`by_contra\` proved \`¬¬P → P\`, and this is the same idea for sets. Assume \`x ∉ A\` and check what \`hx\` tells you.`,
      header:
        'theorem compl_compl_subset {α : Type} (A : Set α) : (Aᶜ)ᶜ ⊆ A := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  intro x hx
  by_contra h
  exact hx h`,
      ],
      hints: [
        { text: 'After `intro x hx`, `hx : x ∈ (Aᶜ)ᶜ` unfolds to `x ∈ Aᶜ → False`, and the goal `x ∈ A` doesn\'t have an obvious shape to break down.' },
        { text: 'Assume the opposite of the goal with `by_contra h`. That gives `h : x ∉ A`, which is literally what `x ∈ Aᶜ` unfolds to.' },
        { text: '`hx` is a function waiting for a proof of `x ∈ Aᶜ`. Does `h` fit?' },
      ],
      outro:
        `This is \`¬¬P → P\` with \`x ∈ A\` playing the role of \`P\`. The reverse inclusion doesn't need classical reasoning at all—it's just \`P → ¬¬P\`. So the two sets are equal, even though only one direction needed \`by_contra\`.`,
    },
    {
      id: 'sets-12c',
      kind: 'proof',
      title: 'Split on membership',
      english: 'Every element of `A` is in `B` or in `A \\ B`.',
      intro:
        `Is \`x\` in \`B\` or not? That's a job for \`by_cases\` from Connective Canyon, which splits the proof into both possibilities. Then use \`show\` to view \`x ∈ A \\ B\` as the pair it really is: in \`A\` and not in \`B\`.`,
      header:
        'theorem subset_union_diff {α : Type} (A B : Set α) : A ⊆ B ∪ (A \\ B) := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  intro x hx
  by_cases hb : x ∈ B
  · left
    exact hb
  · right
    show x ∈ A ∧ x ∉ B
    exact ⟨hx, hb⟩`,
        `  intro x hx
  by_cases hb : x ∈ B
  · left
    exact hb
  · right
    exact ⟨hx, hb⟩`,
      ],
      hints: [
        { text: 'The goal is a union, so you have to pick a side—but which side depends on something you don\'t know yet: whether `x ∈ B`.' },
        { text: 'Use `by_cases hb : x ∈ B`. In the first branch choose `left`; in the second choose `right`.' },
        { text: 'In the second branch, the goal is `x ∈ A \\ B`. Use `show` to expose it as a conjunction, then build the pair from `hx` and `hb`.' },
      ],
      outro:
        `Splitting on a question you can't settle from your hypotheses is the whole point of \`by_cases\`. Because \`A \\ B\` is defined as the elements in \`A\` and not in \`B\`, \`show\` doesn't prove anything new—it just brings that definition into view.`,
    },
    // ───────────────────────── 13 boss
    {
      id: 'sets-13',
      kind: 'proof',
      boss: true,
      showTerm: true,
      title: 'Distributivity',
      english: 'Intersection distributes over union: `A ∩ (B ∪ C) = (A ∩ B) ∪ (A ∩ C)`.',
      intro:
        "Boss level. After `ext x`, the goal is `P ∧ (Q ∨ R) ↔ (P ∧ Q) ∨ (P ∧ R)`. You have everything you need: `ext`, `constructor`, `rintro` with patterns like `⟨_, _ | _⟩`, `left` and `right`, and anonymous constructors `⟨_, _⟩`. No scaffolding this time.",
      header:
        'theorem inter_union_distrib_left {α : Type} (A B C : Set α) : A ∩ (B ∪ C) = A ∩ B ∪ A ∩ C := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  ext x
  constructor
  · rintro ⟨ha, hb | hc⟩
    · left
      exact ⟨ha, hb⟩
    · right
      exact ⟨ha, hc⟩
  · rintro (⟨ha, hb⟩ | ⟨ha, hc⟩)
    · exact ⟨ha, Or.inl hb⟩
    · exact ⟨ha, Or.inr hc⟩`,
      ],
      hints: [
        { text: 'Translate to logic first: what are the two sides of the `↔` after `ext x`, and which connective sits on the outside of each?' },
        { text: 'Forward: unpack the hypothesis completely (first the pair, then the `∨` inside), and in each branch choose which side of the goal to prove.' },
        { text: 'Backward: the hypothesis is an `∨` of two pairs. Split it, then rebuild a pair with the matching disjunct inside.' },
        { text: 'Forward: `rintro ⟨ha, hb | hc⟩`, then `left`/`right` and `exact ⟨ha, _⟩`. Backward: `rintro (⟨ha, hb⟩ | ⟨ha, hc⟩)`, then `exact ⟨ha, Or.inl hb⟩` and its mirror.' },
      ],
      outro:
        'You proved distributivity by spotting `∧` distributing over `∨`. Set algebra is propositional logic viewed through `∈`, and definitional unfolding links the two: `∩` is `∧`, `∪` is `∨`, `ᶜ` is `¬`, and `⊆` is `∀ →`. This is `Set.inter_union_distrib_left`, now in your inventory.',
      unlocks: { codex: ['set-algebra-is-logic'], lemmas: ['Set.inter_union_distrib_left'] },
    },
  ],

  codex: [
    {
      id: 'set-as-predicate',
      kind: 'concept',
      name: 'Sets as predicates',
      summary: 'A `Set α` is a function `α → Prop`; `a ∈ A` means `A a`.',
      body:
        'Lean defines `Set α := α → Prop`. A set is a question asked of each element, and membership applies that predicate to the element. Set-builder notation `{x | p x}` treats the predicate `p` as a set. Because the definition unfolds automatically, a proof of `p a` already works as a proof of `a ∈ {x | p x}`.',
      example: `example (α : Type) (A : Set α) (a : α) (h : A a) : a ∈ A := h`,
      mathlib: 'Mathlib: `def Set (α : Type u) := α → Prop`.',
    },
    {
      id: 'mem',
      kind: 'symbol',
      name: '∈',
      summary: '`a ∈ A`: `a` is an element of the set `A`.',
      body: 'Membership. For a set, it unfolds to applying the set (a predicate) to the element.',
      input: '\\in',
    },
    {
      id: 'notin',
      kind: 'symbol',
      name: '∉',
      summary: '`a ∉ A` means `¬ (a ∈ A)`.',
      body: 'Non-membership: the negation of `∈`, which is `a ∈ A → False`.',
      input: '\\notin',
    },
    {
      id: 'set-builder',
      kind: 'term',
      name: '{x | p x}',
      summary: 'The set of all `x` satisfying the predicate `p`.',
      body:
        'Set-builder notation. `{x | p x}` is `setOf (fun x => p x)`, the predicate itself viewed as a set. You can annotate the type: `{x : Nat | Even x}`.',
      example: `example : {n : Nat | Even n} = {n : Nat | ∃ r, n = r + r} := rfl`,
      input: '{ ... | ... }',
    },
    {
      id: 'mem_setOf_eq',
      kind: 'definition',
      name: 'Set.mem_setOf_eq',
      summary: '`a ∈ {x | p x}` is `p a`, by `rfl`.',
      body: 'Membership in a set-builder set is just the predicate applied to the element. It holds by definition, so `rfl` proves it.',
      example: `example (α : Type) (p : α → Prop) (a : α) : (a ∈ {x | p x}) = p a := Set.mem_setOf_eq`,
      mathlib: '`Set.mem_setOf_eq`',
    },
    {
      id: 'subset',
      kind: 'symbol',
      name: '⊆',
      summary: '`A ⊆ B` unfolds to `∀ ⦃x⦄, x ∈ A → x ∈ B`.',
      body:
        'Subset. To prove it, use `intro x hx`; to use `h : A ⊆ B` with `hx : x ∈ A`, write `h hx`, which has type `x ∈ B`.',
      example: `example (α : Type) (A : Set α) : A ⊆ A := by
  intro x hx
  exact hx`,
      input: '\\sub',
    },
    {
      id: 'strict-implicit',
      kind: 'concept',
      name: 'Strict-implicit binders ⦃x⦄',
      summary: 'An argument written `⦃x⦄` is inferred, but only once a later argument is supplied.',
      body:
        'A normal implicit binder `{x}` gets filled in as soon as you mention the function, whereas `⦃x⦄` waits. So for `h : A ⊆ B`, bare `h` still has the full `∀` type, while `h hx` fills in `x` from the type of `hx`. `Function.Injective` uses the same trick. Type `⦃` as `\\{{`.',
      example: `example (α : Type) (A B : Set α) (h : A ⊆ B) (x : α) (hx : x ∈ A) : x ∈ B := h hx`,
      input: '\\{{ and \\}}',
    },
    {
      id: 'inter',
      kind: 'symbol',
      name: '∩',
      summary: '`A ∩ B` is the set of `x` with `x ∈ A ∧ x ∈ B`.',
      body: 'Intersection. Membership in `A ∩ B` unfolds to a conjunction, so `.1`, `.2`, `⟨_, _⟩`, `constructor`, and `obtain` all work directly.',
      input: '\\cap',
    },
    {
      id: 'mem_inter_iff',
      kind: 'definition',
      name: 'Set.mem_inter_iff',
      summary: '`x ∈ A ∩ B ↔ x ∈ A ∧ x ∈ B`, true by definition.',
      body: 'Use this with `rw` when you need the conjunction to be explicit; tactics like `constructor` and `intro` unfold it on their own.',
      example: `example (α : Type) (A B : Set α) (x : α) : x ∈ A ∩ B ↔ x ∈ A ∧ x ∈ B := Set.mem_inter_iff x A B`,
      mathlib: '`Set.mem_inter_iff`',
    },
    {
      id: 'union',
      kind: 'symbol',
      name: '∪',
      summary: '`A ∪ B` is the set of `x` with `x ∈ A ∨ x ∈ B`.',
      body: 'Union. Membership in `A ∪ B` unfolds to a disjunction, so `left`, `right`, `cases`, and `rcases` all apply.',
      input: '\\cup',
    },
    {
      id: 'mem_union',
      kind: 'definition',
      name: 'Set.mem_union',
      summary: '`x ∈ A ∪ B ↔ x ∈ A ∨ x ∈ B`, true by definition.',
      body: 'The unfolding lemma for union, handy with `rw` whenever the `∨` needs to be visible.',
      example: `example (α : Type) (A B : Set α) (x : α) : x ∈ A ∪ B ↔ x ∈ A ∨ x ∈ B := Set.mem_union x A B`,
      mathlib: '`Set.mem_union`',
    },
    {
      id: 'ext',
      kind: 'tactic',
      name: 'ext',
      summary: 'Prove an equality of sets (or functions) by comparing elements.',
      body:
        '`ext x` applies extensionality: to prove `A = B`, it introduces an arbitrary `x` and leaves the goal `x ∈ A ↔ x ∈ B`. On functions, it leaves `f x = g x`.',
      example: `example (α : Type) (A B : Set α) : A ∩ B = B ∩ A := by
  ext x
  constructor
  · rintro ⟨h1, h2⟩
    exact ⟨h2, h1⟩
  · rintro ⟨h1, h2⟩
    exact ⟨h2, h1⟩`,
      term: 'Set.ext (fun x => _)',
      mathlib: '`ext x` (also `Set.ext`)',
    },
    {
      id: 'set-ext',
      kind: 'concept',
      name: 'Extensionality (funext and propext)',
      summary: 'Sets with the same elements are equal; this rests on two extensionality principles.',
      body:
        '`Set.ext` is proved from `funext` (functions equal at every input are equal) and `propext` (logically equivalent propositions are equal). Neither comes from the basic rules of type theory alone: `propext` is an axiom in Lean, and `funext` is proved from another axiom, `Quot.sound`. Because a set is a function into `Prop`, both are needed.',
      example: `example (α : Type) (A B : Set α) (h : ∀ x, x ∈ A ↔ x ∈ B) : A = B := Set.ext h`,
    },
    {
      id: 'rintro',
      kind: 'tactic',
      name: 'rintro',
      summary: '`intro` and `rcases` in one step.',
      body:
        '`rintro x ⟨ha, hb⟩` introduces `x`, then introduces a hypothesis and splits it as a pair. Use `(a | b)` to split an `∨` into two cases, and nest patterns as needed: `rintro ⟨ha, hb | hc⟩`.',
      example: `example (α : Type) (A B C : Set α) (h1 : A ⊆ C) (h2 : B ⊆ C) : A ∪ B ⊆ C := by
  rintro x (ha | hb)
  · exact h1 ha
  · exact h2 hb`,
      term: 'fun x h => match h with | ⟨ha, hb⟩ => _',
      mathlib: '`rintro`',
    },
    {
      id: 'compl',
      kind: 'symbol',
      name: 'ᶜ',
      summary: '`Aᶜ` is the complement: `{x | x ∉ A}`.',
      body: 'Complement. `x ∈ Aᶜ` unfolds to `x ∉ A`, which is `x ∈ A → False`, so to prove it you `intro` a proof of `x ∈ A`.',
      input: '\\compl or \\^c',
    },
    {
      id: 'mem_compl_iff',
      kind: 'definition',
      name: 'Set.mem_compl_iff',
      summary: '`x ∈ Aᶜ ↔ x ∉ A`, true by definition.',
      body: 'The unfolding lemma for complement.',
      example: `example (α : Type) (A : Set α) (x : α) : x ∈ Aᶜ ↔ x ∉ A := Set.mem_compl_iff A x`,
      mathlib: '`Set.mem_compl_iff`',
    },
    {
      id: 'change',
      kind: 'tactic',
      name: 'change',
      summary: 'Restate the goal as a definitionally equal statement.',
      body:
        '`change T` replaces the goal with `T` if the two are equal after unfolding definitions, and fails otherwise. It doesn\'t prove anything—it just makes the goal easier to read, such as exposing a negation or conjunction hiding inside `∈`.',
      example: `example (α : Type) (A : Set α) (x : α) (h : x ∉ A) : x ∈ Aᶜ := by
  change x ∉ A
  exact h`,
      term: 'show T from e',
      mathlib: '`change`',
    },
    {
      id: 'definitional-unfolding',
      kind: 'concept',
      name: 'Definitions unfold (transparency)',
      summary: 'Some tactics see through definitions; `rw` doesn\'t.',
      body:
        'The kernel treats a term and its unfolding as the same type (δ-reduction), so `x ∈ Aᶜ` and `x ∉ A` are identical to it. Tactics like `intro`, `exact`, `constructor`, `obtain`, `left`, and `use` unfold on demand. `rw`, however, matches syntactically and can\'t see patterns hidden inside a definition—unfold first with `change`, or rewrite with a lemma like `Set.mem_inter_iff`.',
    },
    {
      id: 'empty',
      kind: 'symbol',
      name: '∅',
      summary: 'The empty set `{x | False}`.',
      body: '`x ∈ ∅` unfolds to `False`.',
      input: '\\empty',
    },
    {
      id: 'univ',
      kind: 'symbol',
      name: 'Set.univ',
      summary: 'The set of all elements of `α`, `{x | True}`.',
      body: '`x ∈ Set.univ` unfolds to `True`, so `True.intro` proves it. Set difference is `A \\ B` (type `\\setminus`), the set `{x | x ∈ A ∧ x ∉ B}`.',
      example: `example (α : Type) (x : α) : x ∈ (Set.univ : Set α) := Set.mem_univ x`,
    },
    {
      id: 'mem_empty_iff_false',
      kind: 'definition',
      name: 'Set.mem_empty_iff_false',
      summary: '`x ∈ ∅ ↔ False`, true by definition.',
      body: 'Membership in the empty set is the false proposition.',
      example: `example (α : Type) (x : α) : x ∈ (∅ : Set α) ↔ False := Set.mem_empty_iff_false x`,
      mathlib: '`Set.mem_empty_iff_false`',
    },
    {
      id: 'mem_univ',
      kind: 'definition',
      name: 'Set.mem_univ',
      summary: '`x ∈ Set.univ`, true by definition.',
      body: 'Everything belongs to the universal set.',
      example: `example (α : Type) (x : α) : x ∈ (Set.univ : Set α) := Set.mem_univ x`,
      mathlib: '`Set.mem_univ`',
    },
    {
      id: 'mem_diff',
      kind: 'definition',
      name: 'Set.mem_diff',
      summary: '`x ∈ A \\ B ↔ x ∈ A ∧ x ∉ B`, true by definition.',
      body: 'Set difference keeps the elements of `A` that aren\'t in `B`.',
      example: `example (α : Type) (A B : Set α) (x : α) : x ∈ A \\ B ↔ x ∈ A ∧ x ∉ B := Set.mem_diff x`,
      mathlib: '`Set.mem_diff`',
    },
    {
      id: 'set-algebra-is-logic',
      kind: 'concept',
      name: 'Set algebra is logic',
      summary: 'Every set identity is a logic identity with `x ∈` in front.',
      body:
        'Unfolding gives you a dictionary: `⊆` is `∀ →`, `∩` is `∧`, `∪` is `∨`, `ᶜ` is `¬`, `∅` is `False`, and `Set.univ` is `True`. After `ext x`, a set identity turns into a propositional identity, and the tactics from Connective Canyon finish the job.',
    },
  ],

  lemmas: [
    {
      name: 'Set.Subset.refl',
      origin: 'game',
      source: `theorem Set.Subset.refl {α : Type} (A : Set α) : A ⊆ A := by
  intro x hx
  exact hx`,
      doc: 'Every set is a subset of itself.',
    },
    {
      name: 'Set.Subset.trans',
      origin: 'game',
      source: `theorem Set.Subset.trans {α : Type} {A B C : Set α} (h1 : A ⊆ B) (h2 : B ⊆ C) : A ⊆ C := by
  intro x hx
  exact h2 (h1 hx)`,
      doc: 'If `A ⊆ B` and `B ⊆ C` then `A ⊆ C`.',
    },
    {
      name: 'Set.inter_subset_left',
      origin: 'game',
      source: `theorem Set.inter_subset_left {α : Type} {A B : Set α} : A ∩ B ⊆ A :=
  fun _ hx => hx.1`,
      doc: 'An intersection is contained in its left set.',
    },
    {
      name: 'Set.inter_subset_right',
      origin: 'game',
      source: `theorem Set.inter_subset_right {α : Type} {A B : Set α} : A ∩ B ⊆ B :=
  fun _ hx => hx.2`,
      doc: 'An intersection is contained in its right set.',
    },
    {
      name: 'Set.subset_union_left',
      origin: 'game',
      source: `theorem Set.subset_union_left {α : Type} {A B : Set α} : A ⊆ A ∪ B := by
  intro x hx
  left
  exact hx`,
      doc: 'A set is contained in its union with anything.',
    },
    {
      name: 'Set.inter_comm',
      origin: 'game',
      source: `theorem Set.inter_comm {α : Type} (A B : Set α) : A ∩ B = B ∩ A := by
  ext x
  constructor
  · intro h
    exact ⟨h.2, h.1⟩
  · intro h
    exact ⟨h.2, h.1⟩`,
      doc: 'Intersection is commutative.',
    },
    {
      name: 'Set.union_comm',
      origin: 'game',
      source: `theorem Set.union_comm {α : Type} (A B : Set α) : A ∪ B = B ∪ A := by
  ext x
  constructor
  · intro h
    rcases h with ha | hb
    · right
      exact ha
    · left
      exact hb
  · intro h
    rcases h with hb | ha
    · right
      exact hb
    · left
      exact ha`,
      doc: 'Union is commutative.',
    },
    {
      name: 'Set.compl_union',
      origin: 'game',
      source: `theorem Set.compl_union {α : Type} (A B : Set α) : (A ∪ B)ᶜ = Aᶜ ∩ Bᶜ := by
  ext x
  constructor
  · intro h
    constructor
    · intro ha
      exact h (Or.inl ha)
    · intro hb
      exact h (Or.inr hb)
  · rintro ⟨hna, hnb⟩ (ha | hb)
    · exact hna ha
    · exact hnb hb`,
      doc: 'De Morgan: the complement of a union is the intersection of the complements.',
    },
    {
      name: 'Set.inter_empty',
      origin: 'game',
      source: `theorem Set.inter_empty {α : Type} (A : Set α) : A ∩ ∅ = ∅ := by
  ext x
  constructor
  · rintro ⟨_, h⟩
    exact h
  · intro h
    exact False.elim h`,
      doc: 'Intersecting with the empty set gives the empty set.',
    },
    {
      name: 'Set.inter_union_distrib_left',
      origin: 'game',
      source: `theorem Set.inter_union_distrib_left {α : Type} (A B C : Set α) : A ∩ (B ∪ C) = A ∩ B ∪ A ∩ C := by
  ext x
  constructor
  · rintro ⟨ha, hb | hc⟩
    · left
      exact ⟨ha, hb⟩
    · right
      exact ⟨ha, hc⟩
  · rintro (⟨ha, hb⟩ | ⟨ha, hc⟩)
    · exact ⟨ha, Or.inl hb⟩
    · exact ⟨ha, Or.inr hc⟩`,
      doc: 'Intersection distributes over union.',
    },
  ],
};
