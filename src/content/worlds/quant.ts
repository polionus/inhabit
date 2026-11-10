import type { World } from '../types.ts';

export const world: World = {
  id: 'quant',
  title: 'Quantifier Quay',
  tagline: 'For all and there exists — where types start to depend',
  intro: `Until now your statements talked about fixed propositions. Here they talk about *things*: every number, some number.

You will learn that "for all" is a function whose result type depends on its input, and "there exists" is a pair whose second half depends on its first. You will prove and use both, translate English into quantified Lean statements, and learn why the order of quantifiers matters.`,
  requires: ['logic'],
  bigIdea:
    '`∀ x, P x` is a dependent function type (a function whose output type depends on the input), and `∃ x, P x` is a dependent pair (a witness together with a proof about it).',
  levels: [
    {
      id: 'quant-01',
      kind: 'choice',
      title: 'Predicates',
      intro: `A *predicate* is a property of things. In Lean it is a function from those things into \`Prop\`: feed it a number and you get a proposition.

\`Even\` is a predicate on \`Nat\`. \`Even 4\` is a proposition (a true one); \`Even 5\` is a proposition too (a false one, but still a proposition). Click through the snippet and read what Lean says about each line.`,
      code: `#check Even
#check Even 4
#check ∀ n, Even n`,
      question: 'What is the type of `Even 4`?',
      options: [
        {
          text: '`Nat`',
          feedback:
            '`4` is a `Nat`, but `Even 4` applies `Even` to it, and the result is a statement about 4, not a number.',
        },
        {
          text: '`Prop`',
          correct: true,
          feedback:
            'Yes. `Even : Nat → Prop`, so applying it to `4 : Nat` gives something in `Prop`. A proof of `Even 4` would be a term whose type is `Even 4`.',
        },
        {
          text: '`Bool`',
          feedback:
            '`Bool` is a data type with two values. `Even 4` is a proposition: something to be proved, not a value computed at runtime.',
        },
        {
          text: '`Nat → Prop`',
          feedback:
            'That is the type of `Even` itself. Once you apply it to `4` the arrow is used up and only `Prop` is left.',
        },
      ],
      outro: `A predicate is just a function into \`Prop\`. In the third line, \`∀ n, Even n\` is also a proposition: a statement *about the whole predicate*.`,
      unlocks: { codex: ['predicate'] },
    },
    {
      id: 'quant-02',
      kind: 'proof',
      mode: 'term',
      title: 'Using a ∀',
      intro: `A hypothesis \`h : ∀ n, P n\` says: give me any number \`n\` and I give you a proof of \`P n\`. That is exactly what a function does, so you *use* it by applying it.

\`h 5\` is a proof of \`P 5\`. Write it as a term; no tactics needed.`,
      english: 'If P holds for every natural number, then P holds for 5.',
      header: 'theorem use_forall (P : Nat → Prop) (h : ∀ n, P n) : P 5 :=',
      starter: '  sorry',
      solutions: ['  h 5'],
      hints: [
        { text: 'Look at the type of `h`. What do you have to hand it before it returns a proof?' },
        { text: 'A `∀` hypothesis is applied like a function: `h` followed by an argument.' },
        { text: 'You want a proof of `P 5`, so the argument is `5`.' },
      ],
      outro: `\`h 5 : P 5\`. The type of \`h 5\` depends on the argument: \`P 5\` for 5, \`P 7\` for 7. A function type whose result depends on the input is a **dependent function type** (Π-type). \`A → B\` is the special case where \`B\` ignores the input; \`∀\` and \`→\` are the same construct.`,
      unlocks: { codex: ['forall-sym', 'pi-type'] },
    },
    {
      id: 'quant-03',
      kind: 'predict',
      title: 'Proving a ∀',
      intro: `To prove \`∀ n, Q n\` you must build a function: for an arbitrary \`n\`, a proof of \`Q n\`. You already know the tactic that starts a function: \`intro\`.

Read the proof below, then predict what \`intro n\` does to the goal.`,
      code: `theorem swap_all (P Q : Nat → Prop) (h : ∀ n, P n ∧ Q n) : ∀ n, Q n ∧ P n := by
  intro n
  exact ⟨(h n).2, (h n).1⟩`,
      line: 2,
      options: [
        {
          text: 'Context gains `n : Nat`; goal becomes `Q n ∧ P n`.',
          correct: true,
          feedback:
            'Right. `intro n` names an arbitrary number and strips the `∀`. Nothing is assumed about `n`, so the proof works for every number.',
        },
        {
          text: 'Goal stays `∀ n, Q n ∧ P n`; `n` is just a new name.',
          feedback:
            'A goal that began with `∀` loses it when you intro. The binder becomes a variable in your context.',
        },
        {
          text: 'Goal becomes `Q n ∧ P n` and there is no `n` in the context.',
          feedback:
            'The goal mentions `n`, so `n` must be declared somewhere: it appears in the context as `n : Nat`.',
        },
        {
          text: 'Context gains `h2 : P n ∧ Q n` and the goal is unchanged.',
          feedback:
            'That would be `intro` on a goal of the form `(P n ∧ Q n) → …`. Here `intro` is consuming a `∀`, so it adds a variable, not a hypothesis.',
        },
      ],
      outro: `\`intro n\` is \`fun n => _\`: you are writing a function whose body is still a hole. The same tactic proved implications; now it proves \`∀\`, because both are function types.`,
    },
    {
      id: 'quant-04',
      kind: 'proof',
      mode: 'tactic',
      title: 'Specialize',
      intro: `Instead of writing \`h 3\` each time, you can replace the general hypothesis by its instance for \`3\`:

\`specialize h 3\`

The old \`h\` is replaced by \`h : P 3 → Q 3\`. The first line is written for you; finish the proof.`,
      english: 'If every number satisfying P satisfies Q, and 3 satisfies P, then 3 satisfies Q.',
      header: 'theorem spec (P Q : Nat → Prop) (h : ∀ n, P n → Q n) (hp : P 3) : Q 3 := by',
      starter: '  specialize h 3\n  sorry',
      solutions: ['  specialize h 3\n  exact h hp', '  exact h 3 hp'],
      hints: [
        { text: 'After `specialize`, check the type of `h` in the context. What is it now?' },
        { text: 'It is an implication `P 3 → Q 3`, and you have `hp : P 3`. Use `exact`.' },
        { text: '`exact h hp`.' },
      ],
      extraTactics: [],
      outro: `\`specialize h 3\` is just \`have h := h 3\` that forgets the old \`h\`. Two applications \`h 3 hp\` chain a Π-type (\`∀ n\`) and an arrow (\`P 3 → Q 3\`): one function, two arguments.`,
      unlocks: { tactics: ['specialize'], codex: ['specialize'] },
    },
    {
      id: 'quant-05',
      kind: 'proof',
      mode: 'term',
      title: 'A witness',
      intro: `To prove \`∃ n, P n\` you must exhibit a number *and* show it works. The proof is a pair: the witness, then evidence about that witness.

\`⟨3, h⟩\` where \`h : P 3\`. Here the evidence is \`3 + 2 = 5\`, which holds by computation (\`rfl\`).`,
      english: 'There is a natural number n with n + 2 = 5.',
      header: 'theorem ex_five : ∃ n : Nat, n + 2 = 5 :=',
      starter: '  sorry',
      solutions: ['  ⟨3, rfl⟩'],
      hints: [
        { text: 'The proof of an `∃` has two parts. Which number would you point to?' },
        { text: 'Write the pair with angle brackets: `⟨witness, proof⟩`.' },
        { text: 'The second part must prove `witness + 2 = 5`. For a closed numeral sum, `rfl` suffices.' },
      ],
      outro: `\`∃ n, P n\` is an inductive type with one constructor, \`Exists.intro\`, taking a witness \`w\` and a proof of \`P w\`. This is a **dependent pair**: the *type* of the second component, \`P w\`, depends on the *value* of the first.`,
      unlocks: { codex: ['exists-sym', 'dependent-pair', 'exists-pair'] },
    },
    {
      id: 'quant-06',
      kind: 'proof',
      mode: 'tactic',
      title: 'Use a witness',
      intro: `In tactic mode, \`use w\` supplies the witness and leaves you the proof about it. It also tries \`rfl\` on whatever is left.

Core Lean spells a similar tactic \`exists\`; you will see both in the wild.`,
      english: 'If 4 satisfies P, then some number satisfies P.',
      header: 'theorem ex_of_inst (P : Nat → Prop) (h : P 4) : ∃ n, P n := by',
      starter: '  sorry',
      solutions: ['  use 4\n  exact h', '  exact ⟨4, h⟩'],
      hints: [
        { text: 'The goal begins with `∃`. Which number does `h` talk about?' },
        { text: 'Use `use` with that number as the witness.' },
        { text: 'After `use 4` the goal is `P 4`. You have a hypothesis for that.' },
      ],
      outro: `\`use 4\` is \`refine ⟨4, ?_⟩\`: build the pair, leave the second component as a goal. Pairing and function application are two sides of the same coin: \`∀\` is used by *applying*, \`∃\` is built by *pairing*.`,
      unlocks: { tactics: ['use', 'exists'], codex: ['use', 'exists'] },
    },
    {
      id: 'quant-07',
      kind: 'parsons',
      title: 'Taking a witness apart',
      intro: `To *use* a hypothesis \`∃ x, P x ∧ Q x\`, unpack the pair with \`obtain ⟨x, hp, hq⟩ := h\`. You get the witness \`x\` and the proof about it.

Arrange the lines. Two do not belong.`,
      english: 'If some x satisfies both P and Q, then some x satisfies Q.',
      header:
        'theorem ex_right (α : Type) (P Q : α → Prop) (h : ∃ x, P x ∧ Q x) : ∃ x, Q x := by',
      lines: ['  obtain ⟨x, hp, hq⟩ := h', '  use x', '  exact hq'],
      distractors: ['  intro x', '  exact ⟨hp, hq⟩'],
      hints: [
        { text: 'Unpack what you are given first, then build what you must prove.' },
        { text: 'The goal is an `∃`, not a `∀`: `intro` is the wrong tool for it.' },
        { text: '`obtain`, then `use x`, then the proof of `Q x`.' },
      ],
      outro: `\`obtain\` is the eliminator for \`∃\`: from a pair you may extract the witness and the evidence, but only to prove something else. Note that \`x\` is an *arbitrary* witness: you know nothing about it except \`hp\` and \`hq\`.`,
    },
    {
      id: 'quant-08',
      kind: 'proof',
      mode: 'tactic',
      title: 'Not-exists is for-all-not',
      intro: `"There is no x with P" and "every x fails P" say the same thing. Prove it, in both directions.

Recall \`¬A\` is \`A → False\`. For one direction you will have an \`∃\` to *build*; for the other, an \`∃\` to *take apart*.`,
      english: 'There is no x with P x if and only if every x fails P.',
      header: 'theorem not_exists_iff (α : Type) (P : α → Prop) : (¬∃ x, P x) ↔ ∀ x, ¬P x := by',
      starter: '  sorry',
      solutions: [
        '  constructor\n  · intro h x hx\n    exact h ⟨x, hx⟩\n  · intro h hex\n    obtain ⟨x, hx⟩ := hex\n    exact h x hx',
      ],
      hints: [
        { text: 'It is an `↔`: split it first. Then in each direction, `intro` as much as the goal allows.' },
        { text: 'Forward direction: after `intro h x hx` you need `False`, and `h` refutes an `∃`. Which pair can you build?' },
        { text: 'Backward direction: `intro h hex`, then unpack `hex` with `obtain`.' },
        { text: '`exact h ⟨x, hx⟩` for the first; `obtain ⟨x, hx⟩ := hex` then `exact h x hx` for the second.' },
      ],
      outro: `The proof is nothing but constructing and applying: \`h ⟨x, hx⟩\` feeds a pair to a function, \`h x hx\` feeds two arguments. The converse for \`¬∀\` needs classical logic; this one does not.`,
      unlocks: { codex: ['not-exists'] },
    },
    {
      id: 'quant-09',
      kind: 'choice',
      title: 'Order matters',
      intro: `Compare two statements about numbers:

- \`∀ n, ∃ m, m = n + 1\`: every number has a successor.
- \`∃ m, ∀ n, m = n + 1\`: one number is the successor of every number.

Same symbols, different order. In the first, \`m\` may depend on \`n\`. In the second, \`m\` is chosen first and must work for all \`n\`.`,
      code: `#check ∀ n : Nat, ∃ m : Nat, m = n + 1
#check ∃ m : Nat, ∀ n : Nat, m = n + 1`,
      question: 'Which is true?',
      options: [
        {
          text: 'Both are true: the quantifiers can be swapped.',
          feedback:
            'Swapping is not allowed in general. For the second statement, try to name one `m` that equals `n + 1` for `n = 0` and for `n = 5`.',
        },
        {
          text: 'Only the first.',
          correct: true,
          feedback:
            'Yes. Given `n`, take `m := n + 1`. But no single `m` equals `n + 1` for every `n`. In general `∃ x, ∀ y, R x y` implies `∀ y, ∃ x, R x y`, never the other way round.',
        },
        {
          text: 'Only the second.',
          feedback:
            'The second needs one fixed `m` that is the successor of *every* `n`, which is impossible. It is the first, where `m` may depend on `n`, that holds.',
        },
        {
          text: 'Neither: `∃` only works for numbers you can compute.',
          feedback:
            '`∃` has no computability condition; it just asks for a witness. The first statement has the witness `n + 1`.',
        },
      ],
      outro: `In \`∀ n, ∃ m, …\` the witness is a *function of n*. In \`∃ m, ∀ n, …\` it is a single value, fixed before \`n\` is chosen. Dependence is the whole story: later quantifiers may depend on earlier ones, not vice versa.`,
      unlocks: { codex: ['quantifier-order'] },
    },
    {
      id: 'quant-10',
      kind: 'formalize',
      title: 'Say it: all P are Q',
      intro: `Translate English into a Lean proposition. Mark every "every", "some" and "if … then" first.

The classic trap: "every P is a Q" is **not** \`∀ n, P n ∧ Q n\` (that says every number satisfies both), and **not** \`∃ n, P n → Q n\`.`,
      english: 'Every natural number that satisfies P also satisfies Q.',
      binders: '(P Q : Nat → Prop)',
      accept: ['∀ n, P n → Q n', '∀ n : Nat, P n → Q n'],
      mistakes: [
        {
          statement: '∀ n, P n ∧ Q n',
          feedback:
            'This says *every number* satisfies P and Q. "Every P is a Q" only constrains the numbers that satisfy P: use `→` under `∀`.',
        },
        {
          statement: '∃ n, P n → Q n',
          feedback:
            'This says some number either fails P or satisfies Q, which is nearly always true and claims nothing about *all* numbers. Use `∀`.',
        },
        {
          statement: '(∀ n, P n) → ∀ n, Q n',
          feedback:
            'This says: if everything satisfies P then everything satisfies Q. The English talks about each number separately; put the `→` inside the `∀`.',
        },
        {
          statement: '∀ n, Q n → P n',
          feedback: 'The implication is backwards: it says every Q is a P.',
        },
      ],
      hints: [
        { text: 'Start with the "every": which variable ranges over what?' },
        { text: '"that satisfies P also satisfies Q" is an if-then about one number.' },
        { text: '`∀ n, ` followed by an implication from `P n` to `Q n`.' },
      ],
      outro: `Rule of thumb: \`∀\` pairs with \`→\`, \`∃\` pairs with \`∧\`. This is not a coincidence; the first is a function type, the second a pair type.`,
    },
    {
      id: 'quant-11',
      kind: 'formalize',
      title: 'Say it: everyone has a friend',
      intro: `Now with two variables and a relation \`R x y\`, read "x is related to y".

Watch the order. In English, "for every x there is a y" fixes \`x\` first; the \`y\` may depend on it.`,
      english: 'For every natural number x there is a natural number y such that R x y.',
      binders: '(R : Nat → Nat → Prop)',
      accept: ['∀ x, ∃ y, R x y', '∀ x : Nat, ∃ y : Nat, R x y'],
      mistakes: [
        {
          statement: '∃ y, ∀ x, R x y',
          feedback:
            'Quantifiers swapped. This says one single `y` works for every `x`, which is much stronger than the English.',
        },
        {
          statement: '∀ x, ∀ y, R x y',
          feedback: 'This says `R x y` for *every* pair. The English only asks for some `y` per `x`.',
        },
        {
          statement: '∃ x, ∃ y, R x y',
          feedback: 'This says only that some pair is related. The English talks about every `x`.',
        },
        {
          statement: '∀ x, ∃ y, R y x',
          feedback: 'The arguments of `R` are swapped: it says every `x` is related *from* some `y`.',
        },
      ],
      hints: [
        { text: 'Read left to right: which quantifier comes first in the English sentence?' },
        { text: 'The first quantifier is "for every x"; the second, nested inside, is "there is a y".' },
        { text: '`∀ x, ∃ y, …` and then `R x y`.' },
      ],
      outro: `\`∀ x, ∃ y, R x y\` asserts a *function* from x to a suitable y, together with proofs. That is why it is weaker than \`∃ y, ∀ x, R x y\`, and why quantifier order is part of the type.`,
    },
    {
      id: 'quant-12',
      kind: 'proof',
      mode: 'tactic',
      boss: true,
      title: 'Boss: ∃ distributes over ∨',
      intro: `Exists distributes over "or": a witness for \`P x ∨ Q x\` is a witness for one of them.

This needs the whole toolkit: \`constructor\` for the iff, \`obtain\` and \`cases\` to take things apart, \`left\`/\`right\` and \`use\` to build.`,
      english: 'Some x satisfies P or Q if and only if some x satisfies P or some x satisfies Q.',
      header:
        'theorem exists_or (α : Type) (P Q : α → Prop) : (∃ x, P x ∨ Q x) ↔ (∃ x, P x) ∨ (∃ x, Q x) := by',
      starter: '  sorry',
      solutions: [
        '  constructor\n  · intro h\n    obtain ⟨x, hx⟩ := h\n    cases hx with\n    | inl hp =>\n      left\n      exact ⟨x, hp⟩\n    | inr hq =>\n      right\n      exact ⟨x, hq⟩\n  · intro h\n    cases h with\n    | inl h1 =>\n      obtain ⟨x, hx⟩ := h1\n      use x\n      left\n      exact hx\n    | inr h2 =>\n      obtain ⟨x, hx⟩ := h2\n      use x\n      right\n      exact hx',
      ],
      hints: [
        { text: 'Split the `↔`. In each half, take apart the hypothesis before building the goal.' },
        { text: 'Forward: unpack the `∃` to get `x` and `hx : P x ∨ Q x`, then `cases hx`. Choose `left` or `right` accordingly.' },
        { text: 'Backward: `cases` the `∨` first; each branch contains an `∃` to unpack, and then `use x`.' },
        { text: 'In the backward branches, after `use x` the goal is `P x ∨ Q x`: pick the matching side with `left` or `right`.' },
      ],
      outro: `You just used every Quay idea: \`∃\` taken apart as a pair, rebuilt as a new pair with the same witness, and \`∨\` cased. Next stop: equality. What does it mean for two things to be the same?`,
    },
  ],
  codex: [
    {
      id: 'predicate',
      kind: 'concept',
      name: 'Predicates',
      summary: 'A predicate on `α` is a function `α → Prop`.',
      body: `A property of elements of \`α\` is a function that, given an element, returns a proposition. \`Even : Nat → Prop\`; \`Even 4 : Prop\`.

Relations are predicates with more arguments: \`R : Nat → Nat → Prop\`. This is why a *set* will later turn out to be a predicate in disguise.`,
      example: `#check Even\n#check Even 4`,
    },
    {
      id: 'forall-sym',
      kind: 'symbol',
      name: '∀',
      summary: '"For all": `∀ x, P x`. Type it as \\forall.',
      body: `\`∀ x, P x\` says \`P x\` holds for every \`x\`. A proof is a function taking any \`x\` to a proof of \`P x\`. Prove it with \`intro x\`; use it by applying it to a value: \`h a\`.

Binders may carry types: \`∀ n : Nat, …\`, \`∀ (a b : Nat), …\`.`,
      input: '\\forall',
      example: `example (P : Nat → Prop) (h : ∀ n, P n) : P 0 := h 0`,
    },
    {
      id: 'pi-type',
      kind: 'concept',
      name: 'Dependent function types',
      summary: 'A function type whose result type depends on the argument; `∀` and `→` are the same construct.',
      body: `\`(x : A) → B x\` is the type of functions that send each \`a : A\` to an element of \`B a\`. When \`B\` does not mention \`x\` we write \`A → B\`. When \`B x\` is a proposition we write \`∀ x : A, B x\`.

So \`P → Q\` is \`∀ _ : P, Q\`. Proving \`∀\` = writing a function; using \`∀\` = applying it.`,
      example: `#check (n : Nat) → Fin (n + 1)\n#check ∀ n : Nat, n = n`,
    },
    {
      id: 'specialize',
      kind: 'tactic',
      name: 'specialize',
      summary: 'Replace a ∀ (or implication) hypothesis by an instance of it.',
      body: `\`specialize h a\` replaces \`h : ∀ x, P x\` by \`h : P a\`. It also works on implications: \`specialize h hp\`.

Use it when you plan to work with one instance. If you need several instances, use \`have h2 := h a\` to keep the original.`,
      term: 'have h := h a',
      example: `example (P : Nat → Prop) (h : ∀ n, P n) : P 2 := by
  specialize h 2
  exact h`,
    },
    {
      id: 'exists-sym',
      kind: 'symbol',
      name: '∃',
      summary: '"There exists": `∃ x, P x`. Type it as \\exists.',
      body: `\`∃ x, P x\` says some \`x\` satisfies \`P\`. A proof is a witness plus evidence: \`⟨w, hw⟩\` with \`hw : P w\`. Take it apart with \`obtain ⟨w, hw⟩ := h\`.

Also \`∃ x : Nat, …\` and \`∃ x ∈ s, …\`.`,
      input: '\\exists',
      example: `example : ∃ n : Nat, n = 3 := ⟨3, rfl⟩`,
    },
    {
      id: 'dependent-pair',
      kind: 'concept',
      name: 'Dependent pairs',
      summary: 'A pair whose second component\'s type depends on the first component\'s value.',
      body: `An ordinary pair \`A × B\` has components of fixed types. In a dependent pair the second type depends on the first *value*: the witness \`w\` and a proof of \`P w\`.

\`∃ x, P x\` is the proposition-valued version (\`Exists\`, one constructor \`Exists.intro w h\`). The Σ-type is the data-valued one. Dependent function types (Π) and dependent pairs (Σ/∃) are the two basic dependent constructions.`,
      example: `example : ∃ n : Nat, n + 1 = 3 := Exists.intro 2 rfl`,
    },
    {
      id: 'exists-pair',
      kind: 'term',
      name: '⟨w, h⟩',
      summary: 'A witness and a proof about it, packed with the anonymous constructor: the term that proves an `∃`.',
      body: `Angle brackets build a value of an inductive type with one constructor, with Lean inferring which one from the expected type. \`⟨a, b⟩ : A ∧ B\`, \`⟨w, hw⟩ : ∃ x, P x\`. Nested: \`⟨a, b, c⟩\` means \`⟨a, ⟨b, c⟩⟩\`.

Type the brackets as \\<  and \\>.`,
      input: '\\<  \\>',
      example: `example : ∃ n : Nat, n * 2 = 8 := ⟨4, rfl⟩`,
    },
    {
      id: 'use',
      kind: 'tactic',
      name: 'use',
      summary: 'Give the witness for an `∃` goal.',
      body: `\`use w\` turns the goal \`∃ x, P x\` into \`P w\`, and then tries \`rfl\`. Several witnesses may be given: \`use a, b\`.

If the leftover goal is closed by \`rfl\`, you are done; otherwise continue proving it.`,
      term: '⟨w, ?_⟩',
      mathlib: 'Mathlib `use`; core Lean has `exists`.',
      example: `example : ∃ n : Nat, n + 2 = 5 := by
  use 3`,
    },
    {
      id: 'exists',
      kind: 'tactic',
      name: 'exists',
      summary: 'Core Lean\'s spelling of `use`: `exists w`.',
      body: `\`exists w\` supplies the witness, like \`use\`. It then tries \`trivial\` on what is left, which can close easy goals.

In plain Lean without Mathlib, \`exists\` is the one available; Mathlib adds \`use\` with a smarter closing step.`,
      term: '⟨w, ?_⟩',
      example: `example : ∃ n : Nat, n + 2 = 5 := by
  exists 3`,
    },
    {
      id: 'not-exists',
      kind: 'definition',
      name: '¬∃ and ∀¬',
      summary: '`(¬∃ x, P x) ↔ ∀ x, ¬P x`: provable constructively.',
      body: `A proof of \`¬∃ x, P x\` refutes every witness at once, so it gives a refutation for each \`x\`, and conversely. This equivalence needs no classical axiom.

Its cousin \`¬∀ x, P x ↔ ∃ x, ¬P x\` does need \`by_contra\` / \`Classical.em\`.`,
      example: `example (P : Nat → Prop) (h : ¬∃ x, P x) : ∀ x, ¬P x :=
  fun x hx => h ⟨x, hx⟩`,
    },
    {
      id: 'quantifier-order',
      kind: 'concept',
      name: 'Quantifier order',
      summary: '`∃ x, ∀ y, R x y` implies `∀ y, ∃ x, R x y`, never conversely in general.',
      body: `In \`∀ y, ∃ x, …\` the witness \`x\` may depend on \`y\`: it is a function of \`y\`. In \`∃ x, ∀ y, …\` one \`x\` serves for all \`y\`.

The strong form implies the weak one: hand the same witness to every \`y\`. The reverse fails: "everyone has a mother" does not give "someone is everyone's mother".`,
      example: `example (R : Nat → Nat → Prop) (h : ∃ x, ∀ y, R x y) : ∀ y, ∃ x, R x y := by
  obtain ⟨x, hx⟩ := h
  intro y
  exact ⟨x, hx y⟩`,
    },
  ],
  lemmas: [],
};
