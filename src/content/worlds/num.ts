import type { World } from '../types.ts';

export const world: World = {
  id: 'num',
  title: 'Divisor Dunes',
  tagline: 'Divisibility and parity',
  intro:
    "Divisibility and parity are *existential definitions*: `a ∣ b` says some `c` satisfies `b = a * c`, and `Even n` says some `r` satisfies `n = r + r`. To prove one, you supply a witness; to use one, you take it apart. You will prove the basic facts about both, then show that every natural number is even or odd, by induction. New tool: `refine`.",
  requires: ['nat'],
  bigIdea:
    'An existential definition is a dependent pair: prove it by giving a witness and evidence, use it by unpacking the pair.',
  levels: [
    // 01
    {
      id: 'num-01',
      kind: 'choice',
      title: 'Divides means there is a multiple',
      intro:
        "`a ∣ b` (type `\\|` or `\\mid`; not the keyboard bar `|`) is *defined* as `∃ c, b = a * c`: `b` is `a` times something. A proof is a pair: the something (the witness) and a proof of the equation. Lean writes it `⟨c, proof⟩`. Look at the example.",
      code: `example : 3 ∣ 12 := ⟨4, rfl⟩`,
      question: 'What does `rfl` prove in `⟨4, rfl⟩ : 3 ∣ 12`?',
      options: [
        {
          text: '`12 = 3 * 4`',
          correct: true,
          feedback: 'Yes: `3 ∣ 12` unfolds to `∃ c, 12 = 3 * c`, and with the witness `c := 4` the remaining evidence is `12 = 3 * 4`, which holds by computation.',
        },
        {
          text: '`4 = 12 / 3`',
          feedback: 'Division does not appear in the definition. Divisibility is stated with multiplication, which avoids partial division.',
        },
        {
          text: '`3 = 12 * 4`',
          feedback: 'The roles are swapped. In `a ∣ b` the *divisor* `a` multiplies the witness, giving `b`.',
        },
        {
          text: '`3 ∣ 12`',
          feedback: 'That is the whole statement being proved, not the evidence inside the pair.',
        },
      ],
      outro:
        'A proof of `a ∣ b` is a dependent pair: a witness `c` together with a proof about that `c`. Divisibility is not a new primitive but a packaged `∃`, so `use`, `obtain` and `⟨_, _⟩` all work on it.',
      unlocks: { codex: ['dvd', 'dvd-def', 'existential-definitions'] },
    },
    // 02
    {
      id: 'num-02',
      kind: 'proof',
      title: 'Every number divides itself',
      english: 'For every `a`, `a ∣ a`.',
      intro:
        "To show `a ∣ a`, you need a `c` with `a = a * c`. Choose it with `use`, which supplies the witness and then tries `rfl`. If the equation remains, rewrite with a fact about multiplication from Induction Isles. The `use` line is written.",
      header: 'theorem dvd_refl (a : Nat) : a ∣ a := by',
      starter: `  use 1
  sorry`,
      mode: 'tactic',
      solutions: [
        `  use 1
  rw [Nat.mul_one]`,
      ],
      hints: [
        { text: 'After `use 1`, what is the goal? Does `a * 1` reduce to `a` by computation alone?' },
        { text: 'Multiplication recurses on the second argument, so `a * 1` becomes `a * 0 + a`, not `a`. You need a lemma.' },
        { text: '`Nat.mul_one : n * 1 = n`. Rewrite with it.' },
      ],
      outro:
        '`use 1` gave the witness; the rest is an ordinary equation. In Lean\'s library this is `Nat.dvd_refl`. Notice that even a fact as plain as `n * 1 = n` needed rewriting: multiplication recurses on its second argument, so `n * 1` unfolds to `0 + n`, and `0 + n = n` is not true by computation.',
      unlocks: { lemmas: ['Nat.dvd_refl'] },
    },
    // 03
    {
      id: 'num-03',
      kind: 'proof',
      title: 'Divisibility chains',
      english: 'If `a ∣ b` and `b ∣ c`, then `a ∣ c`.',
      intro:
        "To *use* `h1 : a ∣ b`, take it apart: `obtain ⟨m, hm⟩ := h1` gives `m` and `hm : b = a * m`. Do the same with `h2`. Then build the witness for `a ∣ c`. The two `obtain` lines are written; choose a witness and finish with `rw`.",
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
        { text: 'You know `b = a * m` and `c = b * n`. Express `c` as `a` times something.' },
        { text: 'Substitute for `c`, then for `b`, and the product is `a * m * n`. Which grouping do you need?' },
        { text: 'The witness is `m * n`. Then `rw [hn, hm, Nat.mul_assoc]`.' },
      ],
      outro:
        'The witness for the composite is the product of the two witnesses, the same chaining as composition of functions. This is `Nat.dvd_trans`. Using an existential is `obtain`, which is `Exists` elimination; proving one is `use`.',
      unlocks: { lemmas: ['Nat.dvd_trans'] },
    },
    // 04
    {
      id: 'num-04',
      kind: 'parsons',
      title: 'Sums of multiples',
      english: 'If `a ∣ b` and `a ∣ c`, then `a ∣ b + c`.',
      intro:
        "Take both hypotheses apart, giving `b = a * m` and `c = a * n`. The sum is `a * m + a * n`, which is `a * (m + n)` by distributivity. Arrange the lines. Beware of lines that fit a *different* proof.",
      header: 'theorem dvd_add {a b c : Nat} (h1 : a ∣ b) (h2 : a ∣ c) : a ∣ b + c := by',
      lines: [
        '  obtain ⟨m, hm⟩ := h1',
        '  obtain ⟨n, hn⟩ := h2',
        '  use m + n',
        '  rw [hm, hn, Nat.mul_add]',
      ],
      distractors: ['  use m * n', '  rw [hm, hn, Nat.add_mul]'],
      hints: [
        { text: 'Unpack both hypotheses first. Then decide what the witness for `b + c` should be, given the multiples `a * m` and `a * n`.' },
        { text: 'Factor out `a`: what is `m` added to `n`? The final rewrite distributes the multiplication.' },
        { text: 'Distributivity from the left is `Nat.mul_add : a * (m + n) = a * m + a * n`.' },
      ],
      outro:
        'The witness for the sum is the sum of the witnesses. The wrong distractors fail for instructive reasons: `m * n` was the witness for *transitivity*, and `Nat.add_mul` distributes on the other side. This is `Nat.dvd_add`.',
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
        "Here the witness is right in the statement. `a ∣ a * b` unfolds to `∃ c, a * b = a * c`, so take `c := b`. Write the proof as a term, with no tactics: the anonymous constructor `⟨b, _⟩`, where the second component proves `a * b = a * b`.",
      header: 'theorem dvd_mul_right (a b : Nat) : a ∣ a * b :=',
      starter: '  sorry',
      solutions: ['  ⟨b, rfl⟩', '  Exists.intro b rfl'],
      hints: [
        { text: 'Unfold the goal once: it is an existential. What is the term-mode way to write a witness and its evidence?' },
        { text: 'Angle brackets: `⟨witness, evidence⟩`. Which `c` makes `a * b = a * c` trivial?' },
        { text: '`⟨b, rfl⟩`' },
      ],
      outro:
        'The proof term `⟨b, rfl⟩` is literally the dependent pair, with no tactic in between. A definition built from `∃` has pairs as proofs, and `rfl` is the proof of the equation. This is `Nat.dvd_mul_right`.',
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
        "`refine ⟨b, ?_⟩` supplies a witness and leaves the evidence as a new goal marked `?_`. It is the general form of `use`: `refine` lets you state precisely what is given and what is left open. Choose the witness, then close the equation `b * a = a * b`.",
      header: 'theorem dvd_mul_left (a b : Nat) : a ∣ b * a := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  refine ⟨b, ?_⟩
  rw [Nat.mul_comm]`,
        `  use b
  rw [Nat.mul_comm]`,
      ],
      hints: [
        { text: 'What must the witness satisfy? Write down the equation `b * a = a * _` and decide what goes in the blank.' },
        { text: 'The witness is `b`. After `refine ⟨b, ?_⟩`, the goal is `b * a = a * b`.' },
        { text: 'Commutativity of multiplication closes it: `rw [Nat.mul_comm]`.' },
      ],
      outro:
        '`?_` is a hole that `refine` turns into a new goal. In terms of the proof term: `⟨b, ?_⟩` is the dependent pair with one component still to be built. `use` is `refine` plus an attempt at `rfl`. This is `Nat.dvd_mul_left`.',
      unlocks: { tactics: ['refine'], codex: ['refine'], lemmas: ['Nat.dvd_mul_left'] },
    },
    // 07
    {
      id: 'num-07',
      kind: 'choice',
      title: 'Even and odd',
      intro:
        "`Even n` is defined as `∃ r, n = r + r`, and `Odd n` as `∃ k, n = 2 * k + 1`. Both are existential definitions, just like `∣`. A proof is again a witness and an equation. Move your cursor over the examples and then answer.",
      code: `example : Even 6 := ⟨3, rfl⟩
example : Odd 7 := ⟨3, rfl⟩`,
      question: 'In `Odd 7 := ⟨3, rfl⟩`, what does `rfl` prove?',
      options: [
        {
          text: '`7 = 2 * 3 + 1`',
          correct: true,
          feedback: 'Yes. With witness `k := 3`, the evidence is `7 = 2 * 3 + 1`, which computes.',
        },
        {
          text: '`7 = 3 + 3`',
          feedback: 'That is the shape for `Even`, and it is false. `Odd` has the extra `+ 1` and a factor `2 *` instead of doubling by addition.',
        },
        {
          text: '`3 = 2 * 7 + 1`',
          feedback: 'The number being tested comes first: `7 = 2 * k + 1`. The witness `k` is the half, not the number.',
        },
        {
          text: '`7 = 3 * 2`',
          feedback: 'That would say 7 is even-like, and it is false. The definition has a `+ 1`.',
        },
      ],
      outro:
        '`Even` and `Odd` are predicates on `Nat` defined by `∃`, so their proofs are dependent pairs (a witness and an equation about it). Everything you learned for `∣` carries over unchanged.',
      unlocks: { codex: ['even', 'odd'] },
    },
    // 08
    {
      id: 'num-08',
      kind: 'proof',
      title: 'Even plus even',
      english: 'If `m` and `n` are even, so is `m + n`.',
      intro:
        "Unpack `m = a + a` and `n = b + b`. The witness for `m + n` is `a + b`, and the goal needs `a + a + (b + b) = a + b + (a + b)`. A shortcut: `subst ha` replaces `m` everywhere by `a + a`, so there is nothing to rewrite with. Then reshuffle with three `rw` steps.",
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
        { text: 'What is the witness for `m + n`, given `m = a + a` and `n = b + b`?' },
        { text: 'After `subst ha`, `subst hb` and `use a + b`, the goal is an identity between sums of `a`s and `b`s. Think of reassociating.' },
        { text: 'Associate both sides to the right, then swap `b` and `a` inside with `Nat.add_left_comm`.' },
        { text: '`rw [Nat.add_assoc a a (b + b), Nat.add_assoc a b (a + b), Nat.add_left_comm b a b]`' },
      ],
      outro:
        'Two witnesses, one new witness: `a + b`. The algebra is bookkeeping; the lesson is the existential shape. `subst` (from Equality Estuary) eliminated an equation `m = a + a` by replacing `m`. This is `Even.add`.',
      unlocks: { lemmas: ['Even.add'] },
    },
    // 09
    {
      id: 'num-09',
      kind: 'proof',
      title: 'Even times anything',
      english: 'If `m` is even, so is `m * n`, for every `n`.',
      intro:
        "No scaffolding. `m = a + a`, so `m * n = a * n + a * n`. Choose the witness, then rewrite once with the hypothesis and once with the distributive law that expands `(a + a) * n`.",
      header: 'theorem Even.mul_right {m : Nat} (hm : Even m) (n : Nat) : Even (m * n) := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  obtain ⟨a, ha⟩ := hm
  use a * n
  rw [ha, Nat.add_mul]`,
      ],
      hints: [
        { text: 'First take `hm` apart. What would half of `m * n` be, in terms of `a` and `n`?' },
        { text: 'The witness is `a * n`. The goal is `m * n = a * n + a * n`.' },
        { text: 'Rewrite `m` using the hypothesis, then expand with `Nat.add_mul : (a + b) * c = a * c + b * c`.' },
      ],
      outro:
        'A multiple of an even number is even: halve the witness. The existential structure here is `obtain` then `use`, the pattern of the whole world. This is `Even.mul_right`.',
      unlocks: { lemmas: ['Even.mul_right'] },
    },
    // 10
    {
      id: 'num-10',
      kind: 'formalize',
      title: 'Multiples of four',
      english: 'Every multiple of 4 is even.',
      intro:
        "Say it in words and mark the quantifiers: *for every* natural number `n`, *if* 4 divides `n`, *then* `n` is even. Which direction does the implication run? Write the Lean proposition.",
      accept: [
        '∀ n : Nat, 4 ∣ n → Even n',
        '∀ n : Nat, (∃ k, n = 4 * k) → Even n',
        '∀ k : Nat, Even (4 * k)',
        '∀ n : Nat, 4 ∣ n → ∃ r, n = r + r',
      ],
      mistakes: [
        {
          statement: '∀ n : Nat, Even n → 4 ∣ n',
          feedback: 'That is the converse, and it is false: 2 is even but 4 does not divide 2.',
        },
        {
          statement: '∀ n : Nat, n ∣ 4 → Even n',
          feedback: 'The divisibility is reversed: this talks about divisors of 4, such as 1, which is not even.',
        },
        {
          statement: '∀ n : Nat, 4 ∣ n ∧ Even n',
          feedback: 'This claims every number is both a multiple of 4 and even. You want an implication, not a conjunction.',
        },
        {
          statement: 'Even 4',
          feedback: 'That is one instance. The statement is about *every* multiple of 4.',
        },
      ],
      hints: [
        { text: 'Which quantifier opens the statement, and what is its variable\'s type?' },
        { text: '"Multiple of 4" is `4 ∣ n`. "If … then" is `→`.' },
        { text: '`∀ n : Nat, 4 ∣ n → Even n`' },
      ],
      outro:
        'Several shapes work: `4 ∣ n → Even n`, or the quantified form `∀ k, Even (4 * k)`. They are different types but provably equivalent. Note which direction is true: the converse fails, a classic error in formalization.',
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
        "Boss. Induct on `n`. The base case `0` is even, with a witness. In the step, `ih : Even k ∨ Odd k` splits into two cases; each case turns `k + 1` into the *other* kind, with a new witness and a short rewrite. The tools: `induction`, `rcases`, `left`/`right`, `use`, `rw`.",
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
        { text: 'Start with induction. For each of the two goals, decide first which side of the `∨` you will prove.' },
        { text: 'In the successor case, split `ih` into its two cases, taking each existential apart. If `k` is even, `k + 1` is odd, and vice versa.' },
        { text: 'Even case: choose `left`/`right` accordingly, use witness `r`, and rewrite with `hr` and `Nat.two_mul`. Odd case: witness `r + 1`.' },
        { text: 'Odd case rewrites: `rw [hr, Nat.two_mul, Nat.add_right_comm r 1 (r + 1), ← Nat.add_assoc r r 1]`.' },
      ],
      outro:
        'Induction on a disjunction: each step flips the parity, and witnesses are built from the induction hypothesis. Here induction (Induction Isles), cases on `∨` (Connective Canyon), existentials (Quantifier Quay) and rewriting (Equality Estuary) work together. This is Mathlib\'s `Nat.even_or_odd`.',
      unlocks: { lemmas: ['Nat.even_or_odd'] },
    },
  ],

  codex: [
    {
      id: 'dvd',
      kind: 'symbol',
      name: '∣',
      summary: '`a ∣ b`: `a` divides `b`.',
      body: 'Divisibility. Typed `\\|` or `\\mid` (it is *not* the ASCII bar `|`). It is defined as `∃ c, b = a * c`.',
      input: '\\| or \\mid',
    },
    {
      id: 'dvd-def',
      kind: 'definition',
      name: 'a ∣ b (definition)',
      summary: '`a ∣ b` unfolds to `∃ c, b = a * c`.',
      body: 'To prove it, give the witness: `use c` or `⟨c, proof⟩`. To use `h : a ∣ b`, `obtain ⟨c, hc⟩ := h`, giving `hc : b = a * c`.',
      example: `example : 3 ∣ 12 := ⟨4, rfl⟩`,
      mathlib: '`Nat.dvd`, `Dvd.dvd`',
    },
    {
      id: 'existential-definitions',
      kind: 'concept',
      name: 'Existential definitions',
      summary: 'Divisibility and parity are `∃` statements: proofs are witness-and-evidence pairs.',
      body:
        'A definition `P n := ∃ w, R n w` has dependent pairs as proofs. To prove `P n`, supply a witness and prove `R n w`. To use `h : P n`, take it apart to get `w` and evidence. Tools: `use`, `refine ⟨_, ?_⟩`, `⟨_, _⟩`, `obtain`.',
    },
    {
      id: 'refine',
      kind: 'tactic',
      name: 'refine',
      summary: 'Give a partial proof term; `?_` marks the goals left over.',
      body:
        '`refine ⟨w, ?_⟩` gives the witness `w` and creates a new goal for the evidence. Each `?_` becomes a goal, in order. `use w` is `refine ⟨w, ?_⟩` followed by an attempt to close the evidence with `rfl`.',
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
      body: 'Prove with a witness `r` (half of `n`); use with `obtain ⟨r, hr⟩ := h`.',
      example: `example : Even 4 := by
  use 2`,
      mathlib: '`Even` (for general additive monoids)',
    },
    {
      id: 'odd',
      kind: 'definition',
      name: 'Odd',
      summary: '`Odd n` is `∃ k, n = 2 * k + 1`.',
      body: 'Prove with a witness `k`; use with `obtain ⟨k, hk⟩ := h`.',
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
