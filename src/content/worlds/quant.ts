import type { World } from '../types.ts';

export const world: World = {
  id: 'quant',
  title: 'Quantifier Quay',
  tagline: 'For all and there exists — where types start to depend',
  intro: `Until now, your statements only talked about fixed propositions. Here they talk about *things*: every number, or some number.

You'll learn that "for all" is a function whose result type depends on its input, and "there exists" is a pair whose second half depends on its first. Along the way, you'll prove and use both, translate English into quantified Lean statements, and see why quantifier order matters.`,
  requires: ['logic'],
  bigIdea:
    '`∀ x, P x` is a dependent function type (its output type depends on the input), and `∃ x, P x` is a dependent pair (a witness paired with a proof about it).',
  levels: [
    {
      id: 'quant-01',
      kind: 'choice',
      title: 'Predicates',
      intro: `A *predicate* is a property of things. In Lean, it's a function from those things into \`Prop\`: hand it a number and you get back a proposition.

\`Even\` is a predicate on \`Nat\`. \`Even 4\` is a true proposition, and \`Even 5\` is a false one—but both are still propositions. Click through the snippet and see what Lean reports for each line.`,
      code: `#check Even
#check Even 4
#check ∀ n, Even n`,
      question: 'What is the type of `Even 4`?',
      options: [
        {
          text: '`Nat`',
          feedback:
            '`4` is a `Nat`, but `Even 4` applies `Even` to it, producing a statement about 4 rather than a number.',
        },
        {
          text: '`Prop`',
          correct: true,
          feedback:
            'Yes. `Even : Nat → Prop`, so applying it to `4 : Nat` gives something of type `Prop`. A proof of `Even 4` would be a term whose type is `Even 4`.',
        },
        {
          text: '`Bool`',
          feedback:
            '`Bool` is a data type with two values. `Even 4` is a proposition—something to prove, not a value computed at runtime.',
        },
        {
          text: '`Nat → Prop`',
          feedback:
            "That's the type of `Even` itself. Once you apply it to `4`, the arrow is used up and only `Prop` remains.",
        },
      ],
      outro: `A predicate is just a function into \`Prop\`. In the third line, \`∀ n, Even n\` is a proposition too—a statement *about the whole predicate*.`,
      unlocks: { codex: ['predicate'] },
    },
    {
      id: 'quant-02',
      kind: 'proof',
      mode: 'term',
      title: 'Using a ∀',
      intro: `A hypothesis \`h : ∀ n, P n\` says: give me any number \`n\` and I'll give you a proof of \`P n\`. That's just what a function does, so you *use* it by applying it.

\`h 5\` is a proof of \`P 5\`. Write it as a term—no tactics needed.`,
      english: 'If P holds for every natural number, then P holds for 5.',
      header: 'theorem use_forall (P : Nat → Prop) (h : ∀ n, P n) : P 5 :=',
      starter: '  sorry',
      solutions: ['  h 5'],
      hints: [
        { text: 'Look at the type of `h`. What do you have to hand it before it returns a proof?' },
        { text: 'A `∀` hypothesis is applied like a function: `h` followed by an argument.' },
        { text: 'You want a proof of `P 5`, so the argument is `5`.' },
      ],
      outro: `\`h 5 : P 5\`. The type of \`h 5\` depends on its argument: \`P 5\` for 5, \`P 7\` for 7. A function type whose result depends on the input is a **dependent function type** (Π-type). \`A → B\` is just the special case where \`B\` ignores the input, so \`∀\` and \`→\` are the exact same construct.`,
      unlocks: { codex: ['forall-sym', 'pi-type'] },
    },
    {
      id: 'quant-03',
      kind: 'predict',
      title: 'Proving a ∀',
      intro: `To prove \`∀ n, Q n\`, you need to build a function that takes an arbitrary \`n\` and returns a proof of \`Q n\`. You already know the tactic that starts a function: \`intro\`.

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
            'Right. `intro n` names an arbitrary number and strips off the `∀`. Nothing is assumed about `n`, so the proof works for every number.',
        },
        {
          text: 'Goal stays `∀ n, Q n ∧ P n`; `n` is just a new name.',
          feedback:
            'A goal starting with `∀` loses it when you run `intro`—the binder becomes a variable in your context.',
        },
        {
          text: 'Goal becomes `Q n ∧ P n` and there is no `n` in the context.',
          feedback:
            'Because the goal mentions `n`, `n` has to be declared somewhere: it shows up in the context as `n : Nat`.',
        },
        {
          text: 'Context gains `h2 : P n ∧ Q n` and the goal is unchanged.',
          feedback:
            'That would be `intro` on a goal shaped like `(P n ∧ Q n) → …`. Here `intro` consumes a `∀`, so it adds a variable rather than a hypothesis.',
        },
      ],
      outro: `\`intro n\` builds \`fun n => _\`, a function whose body is still a hole. The same tactic proved implications, and now it proves \`∀\`, because both are function types.`,
    },
    {
      id: 'quant-04',
      kind: 'proof',
      mode: 'tactic',
      title: 'Specialize',
      intro: `Instead of writing \`h 3\` every time, you can replace the general hypothesis with its instance for \`3\`:

\`specialize h 3\`

That replaces the old \`h\` with \`h : P 3 → Q 3\`. The first line is already there; finish the proof.`,
      english: 'If every number satisfying P satisfies Q, and 3 satisfies P, then 3 satisfies Q.',
      header: 'theorem spec (P Q : Nat → Prop) (h : ∀ n, P n → Q n) (hp : P 3) : Q 3 := by',
      starter: '  specialize h 3\n  sorry',
      solutions: ['  specialize h 3\n  exact h hp', '  exact h 3 hp'],
      hints: [
        { text: 'After `specialize`, check the type of `h` in the context. What is it now?' },
        { text: "It's an implication `P 3 → Q 3`, and you have `hp : P 3`. Use `exact`." },
        { text: '`exact h hp`.' },
      ],
      extraTactics: [],
      outro: `\`specialize h 3\` is like \`have h := h 3\`, except it overwrites the old \`h\`. Applying \`h 3 hp\` chains a Π-type (\`∀ n\`) and an arrow (\`P 3 → Q 3\`)—one function, two arguments.`,
      unlocks: { tactics: ['specialize'], codex: ['specialize'] },
    },
    {
      id: 'quant-05',
      kind: 'proof',
      mode: 'term',
      title: 'A witness',
      intro: `To prove \`∃ n, P n\`, you need to exhibit a number *and* show it works. The proof is a pair: the witness, followed by evidence about that witness.

That looks like \`⟨3, h⟩\`, where \`h : P 3\`. Here the evidence is \`3 + 2 = 5\`, which holds by computation (\`rfl\`).`,
      english: 'There is a natural number n with n + 2 = 5.',
      header: 'theorem ex_five : ∃ n : Nat, n + 2 = 5 :=',
      starter: '  sorry',
      solutions: ['  ⟨3, rfl⟩'],
      hints: [
        { text: 'The proof of an `∃` has two parts. Which number would you point to?' },
        { text: 'Write the pair with angle brackets: `⟨witness, proof⟩`.' },
        { text: 'The second part has to prove `witness + 2 = 5`. For concrete numbers, `rfl` is enough.' },
      ],
      outro: `\`∃ n, P n\` is an inductive type with one constructor, \`Exists.intro\`, taking a witness \`w\` and a proof of \`P w\`. That's a **dependent pair**: the *type* of the second part, \`P w\`, depends on the *value* of the first.`,
      unlocks: { codex: ['exists-sym', 'dependent-pair', 'exists-pair'] },
    },
    {
      id: 'quant-06',
      kind: 'proof',
      mode: 'tactic',
      title: 'Use a witness',
      intro: `In tactic mode, \`use w\` supplies the witness and leaves you to prove the property about it (trying \`rfl\` on whatever's left).

\`use\` comes from Mathlib. Core Lean has a similar tactic spelled \`exists\`, and you'll see both in the wild.`,
      english: 'If 4 satisfies P, then some number satisfies P.',
      header: 'theorem ex_of_inst (P : Nat → Prop) (h : P 4) : ∃ n, P n := by',
      starter: '  sorry',
      solutions: ['  use 4\n  exact h', '  exact ⟨4, h⟩'],
      hints: [
        { text: 'The goal begins with `∃`. Which number does `h` talk about?' },
        { text: 'Use `use` with that number as the witness.' },
        { text: 'After `use 4` the goal is `P 4`. You have a hypothesis for that.' },
      ],
      outro: `\`use 4\` acts like \`refine ⟨4, ?_⟩\`—it builds the pair and leaves the second half as a goal. Pairing and function application are two sides of the same coin: you use \`∀\` by *applying*, and you build \`∃\` by *pairing*.`,
      unlocks: { tactics: ['use', 'exists'], codex: ['use', 'exists'] },
    },
    {
      id: 'quant-07',
      kind: 'parsons',
      title: 'Taking a witness apart',
      intro: `To *use* a hypothesis \`∃ x, P x ∧ Q x\`, unpack the pair with \`obtain ⟨x, hp, hq⟩ := h\`. That gives you the witness \`x\` along with the proofs about it.

Arrange the lines. Two of them don't belong.`,
      english: 'If some x satisfies both P and Q, then some x satisfies Q.',
      header:
        'theorem ex_right (α : Type) (P Q : α → Prop) (h : ∃ x, P x ∧ Q x) : ∃ x, Q x := by',
      lines: ['  obtain ⟨x, hp, hq⟩ := h', '  use x', '  exact hq'],
      distractors: ['  intro x', '  exact ⟨hp, hq⟩'],
      hints: [
        { text: "Unpack what you're given first, then build what you need to prove." },
        { text: 'The goal is an `∃`, not a `∀`, so `intro` is the wrong tool here.' },
        { text: '`obtain`, then `use x`, then the proof of `Q x`.' },
      ],
      outro: `\`obtain\` is the eliminator for \`∃\`: it extracts the witness and its evidence from a pair so you can prove something else. Keep in mind that \`x\` is an *arbitrary* witness—you don't know anything about it except \`hp\` and \`hq\`.`,
    },
    {
      id: 'quant-08',
      kind: 'proof',
      mode: 'tactic',
      title: 'Not-exists is for-all-not',
      intro: `"There's no x with P" and "every x fails P" say the same thing. Prove both directions.

Remember that \`¬A\` is \`A → False\`. In one direction you'll *build* an \`∃\`; in the other, you'll *take one apart*.`,
      english: 'There is no x with P x if and only if every x fails P.',
      header: 'theorem not_exists_iff (α : Type) (P : α → Prop) : (¬∃ x, P x) ↔ ∀ x, ¬P x := by',
      starter: '  sorry',
      solutions: [
        '  constructor\n  · intro h x hx\n    exact h ⟨x, hx⟩\n  · intro h hex\n    obtain ⟨x, hx⟩ := hex\n    exact h x hx',
      ],
      hints: [
        { text: "It's an `↔`: split it first, then `intro` as much as each direction allows." },
        { text: 'Forward direction: after `intro h x hx` you need `False`, and `h` refutes an `∃`. Which pair can you build?' },
        { text: 'Backward direction: `intro h hex`, then unpack `hex` with `obtain`.' },
        { text: '`exact h ⟨x, hx⟩` for the first; `obtain ⟨x, hx⟩ := hex` then `exact h x hx` for the second.' },
      ],
      outro: `The proof only constructs and applies: \`h ⟨x, hx⟩\` feeds a pair to a function, and \`h x hx\` feeds two arguments. The matching rule for \`¬∀\` needs classical logic, whereas this one doesn't.`,
      unlocks: { codex: ['not-exists'] },
    },
    {
      id: 'quant-09',
      kind: 'choice',
      title: 'Order matters',
      intro: `Compare two statements about numbers:

- \`∀ n, ∃ m, m = n + 1\`: every number has a successor.
- \`∃ m, ∀ n, m = n + 1\`: one single number is the successor of every number.

Same symbols, different order. In the first, \`m\` can depend on \`n\`. In the second, \`m\` is chosen first and has to work for every \`n\`.`,
      code: `#check ∀ n : Nat, ∃ m : Nat, m = n + 1
#check ∃ m : Nat, ∀ n : Nat, m = n + 1`,
      question: 'Which is true?',
      options: [
        {
          text: 'Both are true: the quantifiers can be swapped.',
          feedback:
            "You can't swap quantifiers in general. For the second statement, try naming a single `m` that equals `n + 1` for both `n = 0` and `n = 5`.",
        },
        {
          text: 'Only the first.',
          correct: true,
          feedback:
            'Yes. Given `n`, you can pick `m := n + 1`, but no single `m` equals `n + 1` for every `n`. In general, `∃ x, ∀ y, R x y` implies `∀ y, ∃ x, R x y`, never the other way around.',
        },
        {
          text: 'Only the second.',
          feedback:
            "The second asks for one fixed `m` that's the successor of *every* `n`, which is impossible. It's the first one, where `m` can depend on `n`, that holds.",
        },
        {
          text: 'Neither: `∃` only works for numbers you can compute.',
          feedback:
            "`∃` doesn't require computability—it just asks for a witness, and here `n + 1` works.",
        },
      ],
      outro: `In \`∀ n, ∃ m, …\`, the witness is a *function of n*. In \`∃ m, ∀ n, …\`, it's a single value fixed before \`n\` is chosen. Dependence is the whole story: later quantifiers can depend on earlier ones, not the other way around.`,
      unlocks: { codex: ['quantifier-order'] },
    },
    {
      id: 'quant-10',
      kind: 'formalize',
      title: 'Say it: all P are Q',
      intro: `Translate English into a Lean proposition. Spot every "every", "some", and "if … then" first.

Watch out for the classic trap: "every P is a Q" is **not** \`∀ n, P n ∧ Q n\` (which claims every number satisfies both), and **not** \`∃ n, P n → Q n\`.`,
      english: 'Every natural number that satisfies P also satisfies Q.',
      binders: '(P Q : Nat → Prop)',
      accept: ['∀ n, P n → Q n', '∀ n : Nat, P n → Q n'],
      mistakes: [
        {
          statement: '∀ n, P n ∧ Q n',
          feedback:
            'This says *every number* satisfies both P and Q. "Every P is a Q" only talks about the numbers that satisfy P, so use `→` under `∀`.',
        },
        {
          statement: '∃ n, P n → Q n',
          feedback:
            'This says some number either fails P or satisfies Q—almost always true, and it claims nothing about *all* numbers. Use `∀`.',
        },
        {
          statement: '(∀ n, P n) → ∀ n, Q n',
          feedback:
            'This says that if everything satisfies P, then everything satisfies Q. The English talks about each number individually, so put the `→` inside the `∀`.',
        },
        {
          statement: '∀ n, Q n → P n',
          feedback: 'The implication is backwards—this says every Q is a P.',
        },
      ],
      hints: [
        { text: 'Start with the "every": which variable ranges over what?' },
        { text: '"that satisfies P also satisfies Q" is an if-then about one number.' },
        { text: '`∀ n, ` followed by an implication from `P n` to `Q n`.' },
      ],
      outro: `Good rule of thumb: \`∀\` pairs with \`→\`, and \`∃\` pairs with \`∧\`. That's no coincidence—the first is a function type, and the second is a pair type.`,
    },
    {
      id: 'quant-11',
      kind: 'formalize',
      title: 'Say it: everyone has a friend',
      intro: `Now try two variables and a relation \`R x y\`, read "x is related to y."

Watch the order. In English, "for every x there is a y" fixes \`x\` first, so \`y\` can depend on it.`,
      english: 'For every natural number x there is a natural number y such that R x y.',
      binders: '(R : Nat → Nat → Prop)',
      accept: ['∀ x, ∃ y, R x y', '∀ x : Nat, ∃ y : Nat, R x y'],
      mistakes: [
        {
          statement: '∃ y, ∀ x, R x y',
          feedback:
            'The quantifiers are swapped. This says one single `y` works for every `x`, which is much stronger than the English.',
        },
        {
          statement: '∀ x, ∀ y, R x y',
          feedback: 'This says `R x y` holds for *every* pair, whereas the English only asks for some `y` per `x`.',
        },
        {
          statement: '∃ x, ∃ y, R x y',
          feedback: 'This only says some pair is related. The English makes a claim about every `x`.',
        },
        {
          statement: '∀ x, ∃ y, R y x',
          feedback: 'The arguments to `R` are swapped: this says every `x` is related *from* some `y`.',
        },
      ],
      hints: [
        { text: 'Read left to right: which quantifier comes first in the English sentence?' },
        { text: 'The first quantifier is "for every x"; the second, nested inside, is "there is a y".' },
        { text: '`∀ x, ∃ y, …` and then `R x y`.' },
      ],
      outro: `\`∀ x, ∃ y, R x y\` asserts a *function* from \`x\` to a suitable \`y\`, together with proofs. That's why it's weaker than \`∃ y, ∀ x, R x y\`, and why quantifier order is part of the type itself.`,
    },
    {
      id: 'quant-11b',
      kind: 'proof',
      title: 'Not everything: find a counterexample',
      english: 'If not every x satisfies P, then some x fails P.',
      intro:
        `Back in Connective Canyon, \`by_contra\` let you assume the opposite of your goal. Use it here twice: once for the \`∃\`, and once to turn "not every" into a concrete \`x\`. This direction needs classical logic; the other direction didn't.`,
      header:
        'theorem not_forall_exists (α : Type) (P : α → Prop) : (¬∀ x, P x) → ∃ x, ¬P x := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  intro h
  by_contra hne
  apply h
  intro x
  by_contra hx
  apply hne
  exists x`,
        `  intro h
  by_contra hne
  apply h
  intro x
  by_contra hx
  exact hne ⟨x, hx⟩`,
      ],
      hints: [
        { text: "You can't build an `∃` directly because you don't have an `x`. Assume the opposite of the goal with `by_contra` and see what `h` can refute." },
        { text: 'After `by_contra hne`, apply `h` to turn the goal into `∀ x, P x`. Introduce an arbitrary `x`, then use `by_contra` once more.' },
        { text: 'Now you have `hx : ¬P x` and the goal is `False`. Which hypothesis refutes an `∃`, and what pair does it need?' },
      ],
      outro:
        `Every step was forced by the shape of the goal. The first \`by_contra\` gave you a hypothesis to work with, and the second handed you the exact \`x\` the theorem asks for. This is where classical logic enters quantifiers: \`¬∀\` only becomes \`∃¬\` when you're allowed to argue by contradiction.`,
    },
    {
      id: 'quant-11c',
      kind: 'proof',
      title: 'One counterexample ends it',
      english: 'If every x satisfies P, and some x fails P, then anything follows.',
      intro:
        `Two familiar tools return here. \`specialize\` aims a \`∀\` at one particular \`x\`, and \`contradiction\` spots the clash for you. Unpack the \`∃\` first so you have a concrete \`x\` in hand.`,
      header:
        'theorem forall_clash (α : Type) (P : α → Prop) (Q : Prop) (h : ∀ x, P x) (hne : ∃ x, ¬P x) : Q := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  obtain ⟨x, hx⟩ := hne
  specialize h x
  contradiction`,
        `  obtain ⟨x, hx⟩ := hne
  exfalso
  exact hx (h x)`,
      ],
      hints: [
        { text: "The goal `Q` has nothing to do with your hypotheses. Look for two hypotheses that can't both be true." },
        { text: 'Unpack `hne` to get a witness `x` and `hx : ¬P x`. Then aim `h` at that same `x`.' },
        { text: 'After `specialize h x`, you hold `P x` and `¬P x`. Which tactic finds a clash like that on its own?' },
      ],
      outro:
        `\`specialize\` turned a statement about every \`x\` into a statement about the one \`x\` that matters, exposing the clash. When the goal is unrelated to the hypotheses, the contradiction does all the work.`,
    },
    {
      id: 'quant-12',
      kind: 'proof',
      mode: 'tactic',
      boss: true,
      title: 'Boss: ∃ distributes over ∨',
      intro: `"Exists" distributes over "or": a witness for \`P x ∨ Q x\` is a witness for one side or the other.

You'll use the whole toolkit here: \`constructor\` for the iff, \`obtain\` and \`cases\` to unpack things, and \`left\`/\`right\` and \`use\` to build the goal.`,
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
      outro: `You just used every idea from the Quay: unpacking \`∃\` as a pair, rebuilding a new pair with the same witness, and splitting \`∨\` with \`cases\`. Next stop is equality—what does it really mean for two things to be the same?`,
    },
  ],
  codex: [
    {
      id: 'predicate',
      kind: 'concept',
      name: 'Predicates',
      summary: 'A predicate on `α` is a function `α → Prop`.',
      body: `A property of elements of \`α\` is a function that takes an element and returns a proposition, like \`Even : Nat → Prop\` and \`Even 4 : Prop\`.

Relations are predicates with more arguments, such as \`R : Nat → Nat → Prop\`. Later you'll see that a *set* is really just a predicate in disguise.`,
      example: `#check Even\n#check Even 4`,
    },
    {
      id: 'forall-sym',
      kind: 'symbol',
      name: '∀',
      summary: '"For all": `∀ x, P x`. Type it as \\forall.',
      body: `\`∀ x, P x\` says \`P x\` holds for every \`x\`. A proof is a function taking any \`x\` to a proof of \`P x\`. Prove it with \`intro x\`, and use it by applying it to a value like \`h a\`.

Binders can carry types too: \`∀ n : Nat, …\` or \`∀ (a b : Nat), …\`.`,
      input: '\\forall',
      example: `example (P : Nat → Prop) (h : ∀ n, P n) : P 0 := h 0`,
    },
    {
      id: 'pi-type',
      kind: 'concept',
      name: 'Dependent function types',
      summary: 'A function type whose result type depends on the argument; `∀` and `→` are the same construct.',
      body: `\`(x : A) → B x\` is the type of functions that send each \`a : A\` to an element of \`B a\`. When \`B\` doesn't mention \`x\`, we write \`A → B\`; when \`B x\` is a proposition, we write \`∀ x : A, B x\`.

So \`P → Q\` is really \`∀ _ : P, Q\`. Proving \`∀\` means writing a function, and using \`∀\` means applying it.`,
      example: `#check (n : Nat) → Fin (n + 1)\n#check ∀ n : Nat, n = n`,
    },
    {
      id: 'specialize',
      kind: 'tactic',
      name: 'specialize',
      summary: 'Replace a ∀ (or implication) hypothesis by an instance of it.',
      body: `\`specialize h a\` replaces \`h : ∀ x, P x\` with \`h : P a\`, and it works on implications too (\`specialize h hp\`).

Use it when you only need one instance. If you'll need several instances, use \`have h2 := h a\` instead so you keep the original.`,
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
      body: `An ordinary pair \`A × B\` has components of fixed types. In a dependent pair, the second type depends on the first *value*—a witness \`w\` paired with a proof of \`P w\`.

\`∃ x, P x\` is the proposition-valued version (\`Exists\`, with its single constructor \`Exists.intro w h\`), while the Σ-type is the data-valued one. Dependent function types (Π) and dependent pairs (Σ/∃) are the two core dependent constructions.`,
      example: `example : ∃ n : Nat, n + 1 = 3 := Exists.intro 2 rfl`,
    },
    {
      id: 'exists-pair',
      kind: 'term',
      name: '⟨w, h⟩',
      summary: 'A witness and a proof about it, packed with the anonymous constructor: the term that proves an `∃`.',
      body: `Angle brackets build a value of an inductive type with one constructor, and Lean infers which one from the expected type: \`⟨a, b⟩ : A ∧ B\`, \`⟨w, hw⟩ : ∃ x, P x\`. Nested pairs flatten, so \`⟨a, b, c⟩\` means \`⟨a, ⟨b, c⟩⟩\`.

Type the angle brackets as \\< and \\>.`,
      input: '\\<  \\>',
      example: `example : ∃ n : Nat, n * 2 = 8 := ⟨4, rfl⟩`,
    },
    {
      id: 'use',
      kind: 'tactic',
      name: 'use',
      summary: 'Give the witness for an `∃` goal.',
      body: `\`use w\` turns the goal \`∃ x, P x\` into \`P w\`, then tries \`rfl\`. You can pass several witnesses at once: \`use a, b\`.

If \`rfl\` closes what's left, you're done; otherwise, keep proving the remaining goal.`,
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
      body: `\`exists w\` supplies the witness just like \`use\`, then tries \`trivial\` on what's left, which closes easy goals automatically.

In plain Lean without Mathlib, \`exists\` is what's built in; Mathlib adds \`use\` with a smarter closing step.`,
      term: '⟨w, ?_⟩',
      example: `example : ∃ n : Nat, n + 2 = 5 := by
  exists 3`,
    },
    {
      id: 'not-exists',
      kind: 'definition',
      name: '¬∃ and ∀¬',
      summary: '`(¬∃ x, P x) ↔ ∀ x, ¬P x`: provable constructively.',
      body: `A proof of \`¬∃ x, P x\` refutes every witness at once, giving a refutation for each \`x\`, and vice versa. This equivalence doesn't need any classical axiom.

Its cousin \`¬∀ x, P x ↔ ∃ x, ¬P x\`, however, does need \`by_contra\` or \`Classical.em\`.`,
      example: `example (P : Nat → Prop) (h : ¬∃ x, P x) : ∀ x, ¬P x :=
  fun x hx => h ⟨x, hx⟩`,
    },
    {
      id: 'quantifier-order',
      kind: 'concept',
      name: 'Quantifier order',
      summary: '`∃ x, ∀ y, R x y` implies `∀ y, ∃ x, R x y`, never conversely in general.',
      body: `In \`∀ y, ∃ x, …\`, the witness \`x\` can depend on \`y\`—it's a function of \`y\`. In \`∃ x, ∀ y, …\`, one single \`x\` has to work for every \`y\`.

The stronger statement implies the weaker one: just hand the same witness to every \`y\`. The reverse fails, since "everyone has a mother" doesn't mean "someone is everyone's mother."`,
      example: `example (R : Nat → Nat → Prop) (h : ∃ x, ∀ y, R x y) : ∀ y, ∃ x, R x y := by
  obtain ⟨x, hx⟩ := h
  intro y
  exact ⟨x, hx y⟩`,
    },
  ],
  lemmas: [],
};
