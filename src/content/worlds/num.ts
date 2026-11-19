import type { World } from '../types.ts';

export const world: World = {
  id: 'num',
  title: 'Divisor Dunes',
  tagline: 'Divisibility and parity',
  intro:
    "Divisibility and parity are *existential definitions*: `a ∣ b` says there's some `c` with `b = a * c`, and `Even n` says there's some `r` with `n = r + r`. To prove one, you supply a witness; to use one, you unpack it. You'll prove the basic properties of both, then show by induction that every natural number is even or odd. New tool: `refine`.",
  requires: ['nat'],
  bigIdea:
    'An existential definition is a dependent pair: prove it by supplying a witness and evidence, and use it by unpacking the pair.',
  levels: [
    // 01
    {
      id: 'num-01',
      kind: 'choice',
      title: 'Divides means there is a multiple',
      intro:
        "`a ∣ b` (type `\\|` or `\\mid`, not the keyboard bar `|`) is *defined* as `∃ c, b = a * c`—meaning `b` is `a` times something. A proof is a pair: that something (the witness) and a proof of the equation, written `⟨c, proof⟩`. Take a look at the example.",
      code: `example : 3 ∣ 12 := ⟨4, rfl⟩`,
      question: 'What does `rfl` prove in `⟨4, rfl⟩ : 3 ∣ 12`?',
      options: [
        {
          text: '`12 = 3 * 4`',
          correct: true,
          feedback: 'Yes: `3 ∣ 12` unfolds to `∃ c, 12 = 3 * c`, and with `c := 4` the remaining equation is `12 = 3 * 4`, which holds by computation.',
        },
        {
          text: '`4 = 12 / 3`',
          feedback: 'Division doesn\'t appear in the definition. Stating divisibility with multiplication avoids having to deal with partial division.',
        },
        {
          text: '`3 = 12 * 4`',
          feedback: 'The roles are flipped. In `a ∣ b`, the *divisor* `a` multiplies the witness to give `b`.',
        },
        {
          text: '`3 ∣ 12`',
          feedback: 'That\'s the whole statement being proved, not the evidence stored inside the pair.',
        },
      ],
      outro:
        'A proof of `a ∣ b` is a dependent pair: a witness `c` paired with a proof about that `c`. Divisibility isn\'t a new primitive, just a packaged `∃`, so `use`, `obtain`, and `⟨_, _⟩` all work on it.',
      unlocks: { codex: ['dvd', 'dvd-def', 'existential-definitions'] },
    },
    // 02
    {
      id: 'num-02',
      kind: 'proof',
      title: 'Every number divides itself',
      english: 'For every `a`, `a ∣ a`.',
      intro:
        "To show `a ∣ a`, you need a `c` with `a = a * c`. Pick it with `use`, which supplies the witness and then tries `rfl`. If an equation is left over, rewrite with a multiplication lemma from Induction Isles. The `use` line is already there.",
      header: 'theorem dvd_refl (a : Nat) : a ∣ a := by',
      starter: `  use 1
  sorry`,
      mode: 'tactic',
      solutions: [
        `  use 1
  rw [Nat.mul_one]`,
      ],
      hints: [
        { text: 'After `use 1`, what\'s the goal? Does `a * 1` reduce to `a` by computation alone?' },
        { text: 'Multiplication recurses on its second argument, so `a * 1` unfolds to `a * 0 + a` rather than `a`. You need a lemma.' },
        { text: '`Nat.mul_one : n * 1 = n`. Rewrite with it.' },
      ],
      outro:
        '`use 1` supplied the witness, and the rest was a plain equation. In Lean\'s library this is `Nat.dvd_refl`. Notice that even something as simple as `n * 1 = n` needed a rewrite: multiplication recurses on its second argument, so `n * 1` unfolds to `0 + n`, and `0 + n = n` doesn\'t hold by computation.',
      unlocks: { lemmas: ['Nat.dvd_refl'] },
    },
    // 03
    {
      id: 'num-03',
      kind: 'proof',
      title: 'Divisibility chains',
      english: 'If `a ∣ b` and `b ∣ c`, then `a ∣ c`.',
      intro:
        "To *use* `h1 : a ∣ b`, unpack it: `obtain ⟨m, hm⟩ := h1` gives you `m` and `hm : b = a * m`. Do the same for `h2`, then build the witness for `a ∣ c`. Both `obtain` lines are already there; supply a witness and finish with `rw`.",
      header: 'theorem dvd_trans {a b c : Nat} (h1 : a ∣ b) (h2 : b ∣ c) : a ∣ c := by',
      starter: `  obtain ⟨m, hm⟩ := h1
  obtain ⟨n, hn⟩ := h2
  sorry`,
      mode: 'tactic',
      solutions: [
        `  obtain ⟨m, hm⟩ := h1
  obtain ⟨n, hn⟩ := h2
  use m * n
  rw [hn, hm, Nat.mul_assoc]`,
      ],
      hints: [
        { text: 'You know `b = a * m` and `c = b * n`. How can you write `c` as `a` times something?' },
        { text: 'Substitute for `c`, then for `b`, to get `a * m * n`. Which grouping do you need?' },
        { text: 'The witness is `m * n`, followed by `rw [hn, hm, Nat.mul_assoc]`.' },
      ],
      outro:
        'The witness for the chain is the product of the two witnesses—the same kind of chaining you saw with function composition. This is `Nat.dvd_trans`. Unpacking an existential uses `obtain` (`Exists` elimination), while proving one uses `use`.',
      unlocks: { lemmas: ['Nat.dvd_trans'] },
    },
    // 04
    {
      id: 'num-04',
      kind: 'parsons',
      title: 'Sums of multiples',
      english: 'If `a ∣ b` and `a ∣ c`, then `a ∣ b + c`.',
      intro:
        "Unpack both hypotheses to get `b = a * m` and `c = a * n`. Their sum is `a * m + a * n`, which equals `a * (m + n)` by distributivity. Arrange the lines, and watch out for distractors that belong to a *different* proof.",
      header: 'theorem dvd_add {a b c : Nat} (h1 : a ∣ b) (h2 : a ∣ c) : a ∣ b + c := by',
      lines: [
        '  obtain ⟨m, hm⟩ := h1',
        '  obtain ⟨n, hn⟩ := h2',
        '  use m + n',
        '  rw [hm, hn, Nat.mul_add]',
      ],
      distractors: ['  use m * n', '  rw [hm, hn, Nat.add_mul]'],
      hints: [
        { text: 'Unpack both hypotheses first, then decide what witness works for `b + c` given the multiples `a * m` and `a * n`.' },
        { text: 'Factor out `a`: what\'s `m` combined with `n`? The last rewrite distributes multiplication over addition.' },
        { text: 'Left distributivity is `Nat.mul_add : a * (m + n) = a * m + a * n`.' },
      ],
      outro:
        'The witness for the sum is the sum of the witnesses. The distractors fail for good reasons: `m * n` was the witness for *transitivity*, and `Nat.add_mul` distributes on the other side. This is `Nat.dvd_add`.',
      unlocks: { lemmas: ['Nat.dvd_add'] },
    },
    // 05
    {
      id: 'num-05',
      kind: 'proof',
      mode: 'term',
      title: 'A number divides its multiples',
      english: 'For all `a` and `b`, `a ∣ a * b`.',
      intro:
        "Here the witness is staring right at you. `a ∣ a * b` unfolds to `∃ c, a * b = a * c`, so pick `c := b`. Write the proof directly as a term with no tactics—use the anonymous constructor `⟨b, _⟩`, where the second part proves `a * b = a * b`.",
      header: 'theorem dvd_mul_right (a b : Nat) : a ∣ a * b :=',
      starter: '  sorry',
      solutions: ['  ⟨b, rfl⟩', '  Exists.intro b rfl'],
      hints: [
        { text: 'Unfold the goal once to see the existential. How do you write a witness and its evidence in term mode?' },
        { text: 'Use angle brackets: `⟨witness, evidence⟩`. Which `c` makes `a * b = a * c` immediate?' },
        { text: '`⟨b, rfl⟩`' },
      ],
      outro:
        'The proof term `⟨b, rfl⟩` is literally the dependent pair itself, with no tactics in between. A definition built with `∃` takes pairs as proofs, and `rfl` handles the equation. This is `Nat.dvd_mul_right`.',
      unlocks: { lemmas: ['Nat.dvd_mul_right'] },
    },
    // 06
    {
      id: 'num-06',
      kind: 'proof',
      showTerm: true,
      title: 'Witness now, evidence later',
      english: 'For all `a` and `b`, `a ∣ b * a`.',
      intro:
        "`refine ⟨b, ?_⟩` gives the witness and leaves the evidence as a new goal marked `?_`. It's the more general version of `use`, letting you write down exactly what you know and leave holes for the rest. Pick the witness, then close `b * a = a * b`.",
      header: 'theorem dvd_mul_left (a b : Nat) : a ∣ b * a := by',
      starter: '  refine ⟨sorry, ?_⟩\n  sorry',
      mode: 'tactic',
      solutions: [
        `  refine ⟨b, ?_⟩
  rw [Nat.mul_comm]`,
        `  use b
  rw [Nat.mul_comm]`,
      ],
      hints: [
        { text: 'What equation does the witness have to satisfy? Write `b * a = a * _` and see what fits the blank.' },
        { text: 'The witness is `b`. After `refine ⟨b, ?_⟩`, the remaining goal is `b * a = a * b`.' },
        { text: 'Commutativity of multiplication finishes it: `rw [Nat.mul_comm]`.' },
      ],
      outro:
        '`?_` is a placeholder that `refine` turns into a new goal. At the proof-term level, `⟨b, ?_⟩` is the dependent pair with one piece still missing. `use` is just `refine` followed by a try at `rfl`. This is `Nat.dvd_mul_left`.',
      unlocks: { tactics: ['refine'], codex: ['refine'], lemmas: ['Nat.dvd_mul_left'] },
    },
    // 07
    {
      id: 'num-07',
      kind: 'choice',
      title: 'Even and odd',
      intro:
        "`Even n` is defined as `∃ r, n = r + r`, and `Odd n` as `∃ k, n = 2 * k + 1`. Both are existential definitions just like `∣`, so a proof is once again a witness paired with an equation. Look over the examples, then answer.",
      code: `example : Even 6 := ⟨3, rfl⟩
example : Odd 7 := ⟨3, rfl⟩`,
      question: 'In `Odd 7 := ⟨3, rfl⟩`, what does `rfl` prove?',
      options: [
        {
          text: '`7 = 2 * 3 + 1`',
          correct: true,
          feedback: 'Yes. With witness `k := 3`, the evidence is `7 = 2 * 3 + 1`, which holds by computation.',
        },
        {
          text: '`7 = 3 + 3`',
          feedback: 'That\'s the shape for `Even`, and it\'s false anyway. `Odd` adds `+ 1` and uses `2 *` instead of adding a number to itself.',
        },
        {
          text: '`3 = 2 * 7 + 1`',
          feedback: 'The number being tested comes first: `7 = 2 * k + 1`. The witness `k` is roughly half of it, not the number itself.',
        },
        {
          text: '`7 = 3 * 2`',
          feedback: 'That would mean 7 is even, which is false—the definition of `Odd` includes `+ 1`.',
        },
      ],
      outro:
        '`Even` and `Odd` are predicates on `Nat` defined using `∃`, so their proofs are dependent pairs (a witness and an equation). Everything you learned for `∣` carries straight over.',
      unlocks: { codex: ['even', 'odd'] },
    },
    // 08
    {
      id: 'num-08',
      kind: 'proof',
      title: 'Even plus even',
      english: 'If `m` and `n` are even, so is `m + n`.',
      intro:
        "Unpack `m = a + a` and `n = b + b`. The witness for `m + n` is `a + b`, leaving you to show `a + a + (b + b) = a + b + (a + b)`. Shortcut: `subst ha` replaces `m` everywhere with `a + a`, so you don't have to rewrite with it. Then rearrange in three `rw` steps.",
      header: 'theorem Even.add {m n : Nat} (hm : Even m) (hn : Even n) : Even (m + n) := by',
      starter: `  obtain ⟨a, ha⟩ := hm
  obtain ⟨b, hb⟩ := hn
  sorry`,
      mode: 'tactic',
      solutions: [
        `  obtain ⟨a, ha⟩ := hm
  obtain ⟨b, hb⟩ := hn
  subst ha
  subst hb
  use a + b
  rw [Nat.add_assoc a a (b + b), Nat.add_assoc a b (a + b), Nat.add_left_comm b a b]`,
      ],
      hints: [
        { text: 'Given `m = a + a` and `n = b + b`, what\'s the witness for `m + n`?' },
        { text: 'After `subst ha`, `subst hb`, and `use a + b`, you\'re left with an identity between sums of `a`s and `b`s. Try reassociating.' },
        { text: 'Associate both sides to the right, then swap `b` and `a` inside with `Nat.add_left_comm`.' },
        { text: '`rw [Nat.add_assoc a a (b + b), Nat.add_assoc a b (a + b), Nat.add_left_comm b a b]`' },
      ],
      outro:
        'Two witnesses combine into one new witness: `a + b`. The algebra is just bookkeeping—the main idea is the existential pattern. `subst` (from Equality Estuary) eliminated `m = a + a` by substituting for `m`. This is `Even.add`.',
      unlocks: { lemmas: ['Even.add'] },
    },
    // 09
    {
      id: 'num-09',
      kind: 'proof',
      title: 'Even times anything',
      english: 'If `m` is even, so is `m * n`, for every `n`.',
      intro:
        "No scaffolding this time. You have `m = a + a`, so `m * n = a * n + a * n`. Pick the witness, then rewrite once with the hypothesis and once with the distributive law that expands `(a + a) * n`.",
      header: 'theorem Even.mul_right {m : Nat} (hm : Even m) (n : Nat) : Even (m * n) := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  obtain ⟨a, ha⟩ := hm
  use a * n
  rw [ha, Nat.add_mul]`,
      ],
      hints: [
        { text: 'Unpack `hm` first. What\'s half of `m * n`, in terms of `a` and `n`?' },
        { text: 'The witness is `a * n`, leaving the goal `m * n = a * n + a * n`.' },
        { text: 'Rewrite `m` using your hypothesis, then expand with `Nat.add_mul : (a + b) * c = a * c + b * c`.' },
      ],
      outro:
        'Any multiple of an even number is even—just scale the witness. The `obtain`-then-`use` pattern runs through this entire world. This is `Even.mul_right`.',
      unlocks: { lemmas: ['Even.mul_right'] },
    },
    // 10
    {
      id: 'num-10',
      kind: 'formalize',
      title: 'Multiples of four',
      english: 'Every multiple of 4 is even.',
      intro:
        "Say it out loud and spot the quantifiers: *for every* natural number `n`, *if* 4 divides `n`, *then* `n` is even. Which way does the arrow point? Write the Lean proposition.",
      accept: [
        '∀ n : Nat, 4 ∣ n → Even n',
        '∀ n : Nat, (∃ k, n = 4 * k) → Even n',
        '∀ k : Nat, Even (4 * k)',
        '∀ n : Nat, 4 ∣ n → ∃ r, n = r + r',
      ],
      mistakes: [
        {
          statement: '∀ n : Nat, Even n → 4 ∣ n',
          feedback: 'That\'s the converse, and it\'s false: 2 is even, yet 4 doesn\'t divide 2.',
        },
        {
          statement: '∀ n : Nat, n ∣ 4 → Even n',
          feedback: 'The divisibility is flipped: this talks about divisors of 4, like 1, which isn\'t even.',
        },
        {
          statement: '∀ n : Nat, 4 ∣ n ∧ Even n',
          feedback: 'This claims every number is both a multiple of 4 and even. You want an implication, not a conjunction.',
        },
        {
          statement: 'Even 4',
          feedback: 'That\'s just one example. The claim is about *every* multiple of 4.',
        },
      ],
      hints: [
        { text: 'Which quantifier starts the statement, and what type does its variable have?' },
        { text: '"Multiple of 4" is `4 ∣ n`, and "if … then" is `→`.' },
        { text: '`∀ n : Nat, 4 ∣ n → Even n`' },
      ],
      outro:
        'Several phrasings work here, like `4 ∣ n → Even n` or `∀ k, Even (4 * k)`. They\'re different types, though provably equivalent. Pay close attention to which direction actually holds—flipping an implication is a classic formalization mistake.',
    },
    // 11 boss
    {
      id: 'num-11',
      kind: 'proof',
      boss: true,
      showTerm: true,
      title: 'Every number is even or odd',
      english: 'Every natural number is even or odd.',
      intro:
        "Boss level. Induct on `n`. The base case `0` is even, with an easy witness. In the step, `ih : Even k ∨ Odd k` splits into two branches, and each flips `k + 1` to the *other* parity with a new witness and a quick rewrite. Tools: `induction`, `rcases`, `left`/`right`, `use`, `rw`.",
      header: 'theorem even_or_odd (n : Nat) : Even n ∨ Odd n := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  induction n with
  | zero =>
    left
    use 0
  | succ k ih =>
    rcases ih with ⟨r, hr⟩ | ⟨r, hr⟩
    · right
      use r
      rw [hr, Nat.two_mul]
    · left
      use r + 1
      rw [hr, Nat.two_mul, Nat.add_right_comm r 1 (r + 1), ← Nat.add_assoc r r 1]`,
      ],
      hints: [
        { text: 'Start with induction. In each goal, decide first which side of the `∨` you\'re proving.' },
        { text: 'In the successor case, split `ih` into its two cases and unpack each existential. If `k` is even, `k + 1` is odd, and vice versa.' },
        { text: 'Even branch: pick `right`, use witness `r`, and rewrite with `hr` and `Nat.two_mul`. Odd branch: pick `left` and use witness `r + 1`.' },
        { text: 'Odd branch rewrites: `rw [hr, Nat.two_mul, Nat.add_right_comm r 1 (r + 1), ← Nat.add_assoc r r 1]`.' },
      ],
      outro:
        'Induction on a disjunction: every step flips the parity, building each new witness from the induction hypothesis. Here induction (Induction Isles), cases on `∨` (Connective Canyon), existentials (Quantifier Quay), and rewriting (Equality Estuary) all come together. This is Mathlib\'s `Nat.even_or_odd`.',
      unlocks: { lemmas: ['Nat.even_or_odd'] },
    },
  ],

  codex: [
    {
      id: 'dvd',
      kind: 'symbol',
      name: '∣',
      summary: '`a ∣ b`: `a` divides `b`.',
      body: 'Divisibility. Type `\\|` or `\\mid` (it\'s *not* the ASCII bar `|`). Defined as `∃ c, b = a * c`.',
      input: '\\| or \\mid',
    },
    {
      id: 'dvd-def',
      kind: 'definition',
      name: 'a ∣ b (definition)',
      summary: '`a ∣ b` unfolds to `∃ c, b = a * c`.',
      body: 'To prove it, supply a witness with `use c` or `⟨c, proof⟩`. To use `h : a ∣ b`, unpack it with `obtain ⟨c, hc⟩ := h`, giving `hc : b = a * c`.',
      example: `example : 3 ∣ 12 := ⟨4, rfl⟩`,
      mathlib: '`Nat.dvd`, `Dvd.dvd`',
    },
    {
      id: 'existential-definitions',
      kind: 'concept',
      name: 'Existential definitions',
      summary: 'Divisibility and parity are `∃` statements: proofs are witness-and-evidence pairs.',
      body:
        'A definition like `P n := ∃ w, R n w` has dependent pairs as its proofs. To prove `P n`, give a witness `w` and prove `R n w`. To use `h : P n`, unpack it to recover `w` and the evidence. Tools: `use`, `refine ⟨_, ?_⟩`, `⟨_, _⟩`, and `obtain`.',
    },
    {
      id: 'refine',
      kind: 'tactic',
      name: 'refine',
      summary: 'Give a partial proof term; `?_` marks the goals left over.',
      body:
        '`refine ⟨w, ?_⟩` supplies the witness `w` and creates a new goal for the evidence. Each `?_` becomes a separate goal, in order. `use w` is just `refine ⟨w, ?_⟩` followed by an attempt to close the remaining goal with `rfl`.',
      example: `example (a b : Nat) : a ∣ b * a := by
  refine ⟨b, ?_⟩
  rw [Nat.mul_comm]`,
      term: '⟨w, ?_⟩  (a term with holes)',
      mathlib: '`refine`',
    },
    {
      id: 'even',
      kind: 'definition',
      name: 'Even',
      summary: '`Even n` is `∃ r, n = r + r`.',
      body: 'Prove with a witness `r` (half of `n`); unpack with `obtain ⟨r, hr⟩ := h`.',
      example: `example : Even 4 := by
  use 2`,
      mathlib: '`Even` (for general additive monoids)',
    },
    {
      id: 'odd',
      kind: 'definition',
      name: 'Odd',
      summary: '`Odd n` is `∃ k, n = 2 * k + 1`.',
      body: 'Prove with a witness `k`; unpack with `obtain ⟨k, hk⟩ := h`.',
      example: `example : Odd 7 := ⟨3, rfl⟩`,
      mathlib: '`Odd`',
    },
  ],

  lemmas: [
    {
      name: 'Nat.dvd_refl',
      origin: 'core',
      source: `theorem Nat.dvd_refl (a : Nat) : a ∣ a := by
  use 1
  rw [Nat.mul_one]`,
      doc: 'Every number divides itself.',
    },
    {
      name: 'Nat.dvd_trans',
      origin: 'core',
      source: `theorem Nat.dvd_trans {a b c : Nat} (h1 : a ∣ b) (h2 : b ∣ c) : a ∣ c := by
  obtain ⟨m, hm⟩ := h1
  obtain ⟨n, hn⟩ := h2
  use m * n
  rw [hn, hm, Nat.mul_assoc]`,
      doc: 'Divisibility is transitive.',
    },
    {
      name: 'Nat.dvd_add',
      origin: 'core',
      source: `theorem Nat.dvd_add {a b c : Nat} (h1 : a ∣ b) (h2 : a ∣ c) : a ∣ b + c := by
  obtain ⟨m, hm⟩ := h1
  obtain ⟨n, hn⟩ := h2
  use m + n
  rw [hm, hn, Nat.mul_add]`,
      doc: 'A common divisor of two numbers divides their sum.',
    },
    {
      name: 'Nat.dvd_mul_right',
      origin: 'core',
      source: `theorem Nat.dvd_mul_right (a b : Nat) : a ∣ a * b := ⟨b, rfl⟩`,
      doc: '`a` divides `a * b`.',
    },
    {
      name: 'Nat.dvd_mul_left',
      origin: 'core',
      source: `theorem Nat.dvd_mul_left (a b : Nat) : a ∣ b * a := by
  refine ⟨b, ?_⟩
  rw [Nat.mul_comm]`,
      doc: '`a` divides `b * a`.',
    },
    {
      name: 'Even.add',
      origin: 'game',
      source: `theorem Even.add {m n : Nat} (hm : Even m) (hn : Even n) : Even (m + n) := by
  obtain ⟨a, ha⟩ := hm
  obtain ⟨b, hb⟩ := hn
  subst ha
  subst hb
  use a + b
  rw [Nat.add_assoc a a (b + b), Nat.add_assoc a b (a + b), Nat.add_left_comm b a b]`,
      doc: 'The sum of two even numbers is even.',
    },
    {
      name: 'Even.mul_right',
      origin: 'game',
      source: `theorem Even.mul_right {m : Nat} (hm : Even m) (n : Nat) : Even (m * n) := by
  obtain ⟨a, ha⟩ := hm
  use a * n
  rw [ha, Nat.add_mul]`,
      doc: 'An even number times anything is even.',
    },
    {
      name: 'Nat.even_or_odd',
      origin: 'game',
      source: `theorem Nat.even_or_odd (n : Nat) : Even n ∨ Odd n := by
  induction n with
  | zero =>
    left
    use 0
  | succ k ih =>
    rcases ih with ⟨r, hr⟩ | ⟨r, hr⟩
    · right
      use r
      rw [hr, Nat.two_mul]
    · left
      use r + 1
      rw [hr, Nat.two_mul, Nat.add_right_comm r 1 (r + 1), ← Nat.add_assoc r r 1]`,
      doc: 'Every natural number is even or odd.',
    },
  ],
};
