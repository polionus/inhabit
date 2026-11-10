import type { World } from '../types.ts';

export const world: World = {
  id: 'eq',
  title: 'Equality Estuary',
  tagline: 'Two kinds of "the same": by computation, and by proof',
  intro: `What does \`a = b\` mean? Lean has two answers.

Some equalities hold because both sides *compute* to the same thing: \`2 + 2\` and \`4\`. Others need a *proof* you can carry around and use: \`h : a = b\`.

Here you learn to prove equalities by computation, to rewrite with proofs of equality, to chain them, and to see that \`Eq\` is itself an inductive type, with substitution as its eliminator.`,
  requires: ['quant'],
  bigIdea:
    'Definitional equality is computation, checked by the kernel for free; propositional equality `a = b` is a type whose proofs you build and use, and its one constructor `rfl` is also what makes substitution work.',
  levels: [
    {
      id: 'eq-01',
      kind: 'proof',
      mode: 'tactic',
      title: 'Equal by computation',
      intro: `Lean can *evaluate*. If both sides of an equation reduce to the same value, the proof is \`rfl\` ("reflexivity": \`a = a\`).

Function applications count: \`(fun x => x + 1) 2\` reduces by substituting \`2\` for \`x\`, then adding.`,
      english: 'Applying "add one" to 2 and then doubling gives 6.',
      header: 'theorem compute : (fun x => x + 1) 2 * 2 = 6 := by',
      starter: '  sorry',
      solutions: ['  rfl'],
      hints: [
        { text: 'Work out the left side by hand. Do both sides end up as the same number?' },
        { text: 'When both sides are the same after evaluation, one tactic closes the goal.' },
        { text: 'The tactic is `rfl`.' },
      ],
      showTerm: true,
      outro: `\`rfl\` succeeds because \`(fun x => x + 1) 2 * 2\` and \`6\` are *definitionally equal*: the kernel decides it by computation, with no proof steps. Notice what the proof term is: \`rfl\` itself, the proof of \`a = a\`.`,
      unlocks: { tactics: ['rfl'], codex: ['rfl', 'definitional-eq'] },
    },
    {
      id: 'eq-02',
      kind: 'choice',
      title: 'What computation can see',
      intro: `Computation only works when Lean can evaluate. With a variable \`a\` it gets stuck: it does not know what \`a\` is.

Here \`a b : Nat\` are arbitrary. Three of the equations below are settled by evaluation alone, and one is not.`,
      code: `example (a : Nat) : (fun x => x + 1) a = a + 1 := rfl
example (a : Nat) : Nat.succ a = a + 1 := rfl
example : 2 + 2 = 4 := rfl`,
      question: 'For arbitrary `a b : Nat`, which equation can **not** be proved by `rfl`?',
      options: [
        {
          text: '`(fun x => x + 1) a = a + 1`',
          feedback:
            'This is accepted above. Applying the function substitutes `a` for `x`; no knowledge about `a` is needed.',
        },
        {
          text: '`Nat.succ a = a + 1`',
          feedback:
            'Also accepted above: `a + 1` unfolds to `Nat.succ a` by the definition of `+`.',
        },
        {
          text: '`a + b = b + a`',
          correct: true,
          feedback:
            'Right. To compute `a + b` Lean needs to know what `b` is, and it does not. It is true, but needs a proof, not a computation.',
        },
        {
          text: '`2 + 2 = 4`',
          feedback:
            'Accepted above. No variables: both sides evaluate to the numeral `4`.',
        },
      ],
      outro: `Two kinds of sameness. **Definitional**: equal by unfolding definitions and computing; the kernel accepts it silently. **Propositional**: a statement \`a = b\` that needs an actual proof term. \`a + b = b + a\` is true, but only propositionally.`,
    },
    {
      id: 'eq-03',
      kind: 'predict',
      title: 'Rewrite',
      intro: `When you have a proof \`h : a = b\`, you can *rewrite*: replace occurrences of \`a\` in the goal by \`b\`.

\`rw [h]\` finds the left side of \`h\` in the goal and replaces it. Predict the result below.`,
      code: `theorem rewrite_demo (a b : Nat) (h : a = b) (h2 : b + b = 10) : a + a = 10 := by
  rw [h]
  exact h2`,
      line: 2,
      options: [
        {
          text: '`b + b = 10`',
          correct: true,
          feedback:
            'Yes. `rw` replaces *every* occurrence of `a` (the left side of `h`) with `b`.',
        },
        {
          text: '`b + a = 10`',
          feedback:
            'It is tempting to think only the first `a` changes. But once `rw` has matched the pattern `a`, every copy of it in the goal is replaced together.',
        },
        {
          text: '`a + a = 10` (unchanged: `rw` only changes hypotheses)',
          feedback:
            '`rw [h]` acts on the goal by default. To change a hypothesis you would add `at h`.',
        },
        {
          text: '`a + a = b`',
          feedback:
            'The number `10` is not mentioned in `h`, so it is not touched. `rw [h]` replaces `a` with `b` and nothing else.',
        },
      ],
      outro: `\`h : a = b\` is a *proof*, a term you can use. \`rw [h]\` builds a new proof from it: it says "to show \`… a …\` it is enough to show \`… b …\`", justified by \`h\`. That is propositional equality at work.`,
      unlocks: { tactics: ['rw'], codex: ['rw', 'propositional-eq'] },
    },
    {
      id: 'eq-04',
      kind: 'proof',
      mode: 'tactic',
      title: 'Rewrite backwards',
      intro: `\`rw [h]\` rewrites left to right: occurrences of \`a\` become \`b\`. To go the other way, write an arrow: \`rw [← h]\` replaces \`b\` by \`a\`.

Type \`←\` as \`\\l\`. The first line is given; finish the proof.`,
      english: 'If a = b and a + 1 = 5, then b + 1 = 5.',
      header: 'theorem rev (a b : Nat) (h : a = b) (ha : a + 1 = 5) : b + 1 = 5 := by',
      starter: '  rw [← h]\n  sorry',
      solutions: ['  rw [← h]\n  exact ha'],
      hints: [
        { text: 'After `rw [← h]`, look at the goal. What has replaced `b`?' },
        { text: 'The goal is now exactly one of your hypotheses.' },
        { text: '`exact ha`.' },
      ],
      outro: `\`← h\` uses \`Eq.symm h : b = a\`. A proof of \`a = b\` can always be flipped, so equality is symmetric; but note that Lean makes you say which way you are going.`,
      unlocks: { codex: ['left-arrow'] },
    },
    {
      id: 'eq-05',
      kind: 'parsons',
      title: 'Rewrite in a hypothesis',
      intro: `You can rewrite a hypothesis instead of the goal: \`rw [h1] at h\`. Here two equations carry \`a\` to \`b\` and then to \`c\`, one step at a time.

Arrange the lines. Two do not belong.`,
      english: 'If a = b, b = c and a + 1 = 7, then c + 1 = 7.',
      header:
        'theorem chain (a b c : Nat) (h1 : a = b) (h2 : b = c) (h : a + 1 = 7) : c + 1 = 7 := by',
      lines: ['  rw [h1] at h', '  rw [h2] at h', '  exact h'],
      distractors: ['  rw [← h1] at h', '  rw [h1]'],
      hints: [
        { text: 'Follow `a` through the chain: which equation applies to `h` first?' },
        { text: '`rw [← h1] at h` would look for `b` in `h`. Is there one?' },
        { text: 'The goal mentions only `c`, so `rw [h1]` on the goal finds nothing to rewrite.' },
      ],
      outro: `Rewriting goals and hypotheses are two views of the same operation. Each step uses a *proof* of equality to transport a statement along it. A chain \`a = b\`, \`b = c\` is going to turn into a single proof \`a = c\`: transitivity.`,
    },
    {
      id: 'eq-06',
      kind: 'proof',
      mode: 'tactic',
      title: 'When rw cannot find it',
      intro: `\`rw\` needs the left side of the equation to appear in the goal, exactly. If it does not, Lean says *did not find an occurrence of the pattern*.

The proof below does not work. Read the error, then fix it.`,
      english: 'If a = b and a + 1 = 3, then b + 1 = 3.',
      header: 'theorem fix_me (a b : Nat) (h : a = b) (ha : a + 1 = 3) : b + 1 = 3 := by',
      starter: '  rw [h]\n  exact ha',
      solutions: ['  rw [← h]\n  exact ha', '  rw [h] at ha\n  exact ha'],
      hints: [
        { text: 'The error names the pattern it looked for. Does that pattern occur in the goal `b + 1 = 3`?' },
        { text: 'You have two options: rewrite the goal in the other direction, or rewrite somewhere else.' },
        { text: 'Try `rw [← h]` on the goal, or `rw [h] at ha`.' },
      ],
      outro: `\`rw\` is *syntactic*: it looks for the pattern as written, then replaces. Reading "pattern" in an error message tells you which term it hunted for. Two repairs are both fine, because the equation is a proof you can use in either direction.`,
      unlocks: { codex: ['rw-pattern'] },
    },
    {
      id: 'eq-07',
      kind: 'proof',
      mode: 'tactic',
      title: 'Symmetry',
      intro: `If \`a = b\` then \`b = a\`. The tactic \`symm\` swaps the two sides of an equation goal. Its term-mode form is \`Eq.symm\`, or \`h.symm\` with dot notation.

Rewrite first, then use \`symm\` to line the goal up with \`h2\`.`,
      english: 'If a = b and c = b, then a = c.',
      header: 'theorem sym_demo (a b c : Nat) (h1 : a = b) (h2 : c = b) : a = c := by',
      starter: '  sorry',
      solutions: ['  rw [h1]\n  symm\n  exact h2', '  exact h1.trans h2.symm'],
      hints: [
        { text: 'You know `a = b` and `c = b`. What would you like the goal to look like?' },
        { text: 'Rewriting with `h1` turns the goal into `b = c`. Compare with `h2 : c = b`.' },
        { text: 'The sides are flipped: use `symm` and then `exact h2`.' },
      ],
      outro: `\`symm\` builds \`Eq.symm _ : b = a\` from a proof of \`a = b\`. Symmetry is a theorem, not a built-in; it follows from \`Eq\`'s eliminator, as you will see.`,
      unlocks: { tactics: ['symm'], codex: ['symm'] },
    },
    {
      id: 'eq-08',
      kind: 'proof',
      mode: 'tactic',
      title: 'Chains with calc',
      intro: `A chain of equalities reads like a computation on paper:

\`\`\`lean
calc a = b := proof1
  _ = c := proof2
\`\`\`

Each line justifies one step; \`_\` repeats the previous right side. The steps combine by transitivity (\`Eq.trans\`).`,
      english: 'If x = y + 2 and y = 3, then x = 5.',
      header: 'theorem calc_demo (x y : Nat) (h1 : x = y + 2) (h2 : y = 3) : x = 5 := by',
      starter: '  sorry',
      solutions: [
        '  calc x = y + 2 := h1\n    _ = 3 + 2 := by rw [h2]\n    _ = 5 := rfl',
        '  rw [h1, h2]',
      ],
      hints: [
        { text: 'Start the chain at `x` and end at `5`. What is `x` equal to by `h1`?' },
        { text: 'After `y + 2` you want `3 + 2`: that step replaces `y` using `h2`.' },
        { text: 'The last step, `3 + 2 = 5`, is a computation.' },
      ],
      showTerm: true,
      outro: `Look at the proof term: nested \`Eq.trans\`. Transitivity glues proofs of \`a = b\` and \`b = c\` into \`a = c\`. Some steps are propositional (\`h1\`, \`h2\`) and the last is definitional (\`rfl\`): a single chain can mix both.`,
      unlocks: { tactics: ['calc'], codex: ['calc', 'eq-trans'] },
    },
    {
      id: 'eq-09',
      kind: 'proof',
      mode: 'term',
      title: 'Functions respect equality',
      intro: `If \`a = b\`, then \`f a = f b\` for any function \`f\`: equal inputs give equal outputs. This is \`congrArg f h\`.

Write it as a term.`,
      english: 'If a = b then f a = f b.',
      header: 'theorem respect (f : Nat → Nat) (a b : Nat) (h : a = b) : f a = f b :=',
      starter: '  sorry',
      solutions: ['  congrArg f h'],
      hints: [
        { text: 'Two ingredients: the function and the proof that the inputs agree.' },
        { text: 'The lemma is `congrArg`: its first argument is the function.' },
        { text: '`congrArg f h`.' },
      ],
      outro: `This isn't an axiom of Lean: it falls out of \`rw\`'s principle, that equal things can replace one another. It is what lets you apply a function to both sides of an equation.`,
      unlocks: { codex: ['congrArg'] },
    },
    {
      id: 'eq-10',
      kind: 'proof',
      mode: 'tactic',
      title: 'Not equal',
      intro: `\`a ≠ b\` is notation for \`a = b → False\` (type \`≠\` as \`\\ne\`). To prove one, assume the equation and derive a contradiction: \`intro\`. To use one, apply it to an equation.

This one mixes earlier tools: \`intro\`, \`apply\`, \`rw\`.`,
      english: 'If a = b and a ≠ c, then b ≠ c.',
      header: 'theorem ne_demo (a b c : Nat) (h : a = b) (hne : a ≠ c) : b ≠ c := by',
      starter: '  sorry',
      solutions: [
        '  intro hbc\n  apply hne\n  rw [h]\n  exact hbc',
        '  intro hbc\n  exact hne (h.trans hbc)',
      ],
      hints: [
        { text: 'A `≠` goal is a function type: what does `intro` give you here?' },
        { text: 'You now need `False`. `hne` produces `False` from a proof of `a = c`.' },
        { text: '`apply hne` leaves `a = c`; rewrite with `h` and use your assumption.' },
      ],
      outro: `\`a ≠ b\` unfolds to \`a = b → False\`, so negation is just a function type, exactly as in Canyon. The \`Ne\` definition is transparent to \`intro\` and \`apply\`.`,
      unlocks: { codex: ['ne'] },
    },
    {
      id: 'eq-11',
      kind: 'proof',
      mode: 'tactic',
      title: 'Substitution',
      intro: `If \`a = b\` and \`P a\`, then \`P b\`. Equal things satisfy the same properties (Leibniz's principle).

\`subst h\` uses \`h : a = b\` to eliminate the variable \`b\` completely: everywhere \`b\` occurred, it becomes \`a\`.`,
      english: 'If a = b and a has property P, then b has property P.',
      header: 'theorem leibniz (P : Nat → Prop) (a b : Nat) (h : a = b) (ha : P a) : P b := by',
      starter: '  sorry',
      solutions: ['  subst h\n  exact ha', '  rw [← h]\n  exact ha'],
      hints: [
        { text: 'Compare the goal `P b` with `ha : P a`. What single fact connects `a` and `b`?' },
        { text: 'Use `subst` on the equation: one of the two variables disappears.' },
        { text: '`subst h`, then `exact ha`.' },
      ],
      showTerm: true,
      outro: `\`Eq\` is an inductive type with one constructor, \`rfl : a = a\`. Its eliminator says: to prove something about \`b\` given \`a = b\`, it suffices to prove it for \`a = a\`. That is substitution; \`rw\`, \`symm\`, \`congrArg\` are all consequences of it.`,
      unlocks: { tactics: ['subst'], codex: ['subst', 'leibniz', 'eq-inductive'] },
    },
    {
      id: 'eq-12',
      kind: 'proof',
      mode: 'tactic',
      title: 'Rewrite and finish',
      intro: `A common pattern: rewrite a hypothesis, then conclude with it. \`rwa [h] at hp\` means \`rw [h] at hp\` followed by \`assumption\`.

Use it with two rewrite rules.`,
      english: 'If a = b, b = c and a * 2 = 8, then c * 2 = 8.',
      header: 'theorem rwa_demo (a b c : Nat) (h1 : a = b) (h2 : b = c) (hp : a * 2 = 8) : c * 2 = 8 := by',
      starter: '  sorry',
      solutions: ['  rwa [h1, h2] at hp', '  rw [h1, h2] at hp\n  exact hp'],
      hints: [
        { text: 'Which hypothesis mentions `a`, and which side must it end up on?' },
        { text: 'Rewrite `hp` with both equations in order, then it matches the goal.' },
        { text: '`rwa [h1, h2] at hp`.' },
      ],
      outro: `\`rwa\` is only a shorthand: the proof term is the same as the long form. Use shorthands once you can write out what they do.`,
      unlocks: { tactics: ['rwa'], codex: ['rwa'] },
    },
    {
      id: 'eq-13',
      kind: 'proof',
      mode: 'tactic',
      boss: true,
      title: 'Boss: rewriting under quantifiers',
      intro: `A function \`f\` satisfies \`f x = x + 1\` for every \`x\`. Rewriting with a \`∀\`-equation works too: \`rw [hf]\` finds *some* instance of \`f ?x\` and rewrites it.

Combine \`∃\`, \`∀\`, rewriting and substitution from this world and the Quay.`,
      english:
        'Suppose f x = x + 1 for every x, and P holds of 5. If f a = 5 for some a, then P (b + 1) for some b.',
      header:
        'theorem boss (f : Nat → Nat) (hf : ∀ x, f x = x + 1) (P : Nat → Prop) (hP : P 5) :\n    (∃ a, f a = 5) → ∃ b, P (b + 1) := by',
      starter: '  sorry',
      solutions: [
        '  intro h\n  obtain ⟨a, ha⟩ := h\n  rw [hf] at ha\n  use a\n  rw [ha]\n  exact hP',
        '  intro h\n  obtain ⟨a, ha⟩ := h\n  have h2 : a + 1 = 5 := (hf a).symm.trans ha\n  exact ⟨a, by rw [h2]; exact hP⟩',
      ],
      hints: [
        { text: 'Take the `∃` hypothesis apart first. What do you know about the witness `a`?' },
        { text: '`ha : f a = 5`. Rewrite it with `hf` to learn what `a` is.' },
        { text: 'Now build the new witness (it is the same `a`) and rewrite the goal with `ha`.' },
        { text: '`rw [hf] at ha` gives `a + 1 = 5`; after `use a`, `rw [ha]` leaves `P 5`.' },
      ],
      outro: `Rewriting with \`hf\` instantiated the bound variable \`x\` with \`a\`, automatically: a \`∀\` is a function, and \`rw\` applies it as needed. Definitional equality (\`rfl\`) and propositional equality (proofs like \`ha\`) have both done their work.`,
    },
  ],
  codex: [
    {
      id: 'rfl',
      kind: 'tactic',
      name: 'rfl',
      summary: 'Close a goal `a = a`, up to computation.',
      body: `\`rfl\` proves \`a = b\` when \`a\` and \`b\` are *definitionally equal*: they reduce to the same thing by unfolding definitions and evaluating. It also closes \`↔\` goals of the form \`P ↔ P\`.

If \`rfl\` fails, the sides are different after computation: you need a proof (try \`rw\`).`,
      term: 'rfl',
      example: `example : 2 + 2 = 4 := by
  rfl`,
    },
    {
      id: 'definitional-eq',
      kind: 'concept',
      name: 'Definitional equality',
      summary: 'Two terms that reduce to the same thing; the kernel checks it automatically.',
      body: `Terms are *definitionally equal* when they become identical after β-reduction (applying functions), unfolding definitions, and evaluating recursion. Lean checks this inside its kernel without any proof term.

This is why \`rfl : 2 + 2 = 4\` works, and why \`(fun x => x + 1) 2\` and \`3\` are interchangeable anywhere a type is expected.`,
      example: `example : (fun x => x + 1) 2 = 3 := rfl`,
    },
    {
      id: 'propositional-eq',
      kind: 'concept',
      name: 'Propositional equality',
      summary: 'A statement `a = b` that is a type; you must supply a proof term.',
      body: `\`a = b\` is a proposition, an ordinary type in \`Prop\`. To use the equality you need a term \`h : a = b\`. Such a proof exists even when \`a\` and \`b\` are *not* definitionally equal, like \`a + b\` and \`b + a\` (though proving it takes work).

Definitional equality implies propositional equality, via \`rfl\`. The converse is false.`,
      example: `example (a b : Nat) (h : a = b) : b = a := h.symm`,
    },
    {
      id: 'rw',
      kind: 'tactic',
      name: 'rw',
      summary: 'Rewrite the goal (or a hypothesis) using an equation.',
      body: `\`rw [h]\` with \`h : a = b\` replaces every occurrence of \`a\` with \`b\` in the goal. \`rw [← h]\` goes right to left. \`rw [h] at h'\` rewrites a hypothesis; several rules run in sequence: \`rw [h1, h2]\`. Equations with \`∀\` get their variables filled in by matching.

After rewriting, \`rw\` tries \`rfl\`, so the goal may close on its own.`,
      term: 'h ▸ e  (Eq.subst / Eq.mpr)',
      example: `example (a b : Nat) (h : a = b) (h2 : b = 3) : a = 3 := by
  rw [h]
  exact h2`,
    },
    {
      id: 'left-arrow',
      kind: 'symbol',
      name: '←',
      summary: 'In `rw [← h]`: use the equation right to left. Type `\\l`.',
      body: `Inside \`rw [...]\`, \`←\` reverses the direction of the equation. Everywhere the *right* side appears, it is replaced by the left.

The same symbol appears as \`←\` in other Lean syntax, but here it just means "backwards".`,
      input: '\\l',
      example: `example (a b : Nat) (h : a = b) (ha : a = 1) : b = 1 := by
  rw [← h]
  exact ha`,
    },
    {
      id: 'rw-pattern',
      kind: 'definition',
      name: 'rw: pattern not found',
      summary: '`rw` needs the left side of its equation to appear syntactically in the target.',
      body: `The error *did not find an occurrence of the pattern* means the left side of the rule does not appear. Check:

- the direction (\`h\` or \`← h\`);
- whether you meant to rewrite a hypothesis (\`at h\`);
- that the term really is written that way. \`rw\` matches syntax, not meaning: \`b + a\` is not \`a + b\`.`,
      example: `example (a b : Nat) (h : a = b) (ha : a + 1 = 3) : b + 1 = 3 := by
  rw [h] at ha
  exact ha`,
    },
    {
      id: 'symm',
      kind: 'tactic',
      name: 'symm',
      summary: 'Swap the sides of an equality goal.',
      body: `\`symm\` turns \`a = b\` into \`b = a\`. In term mode: \`Eq.symm h\` or \`h.symm\`. It works for any symmetric relation, \`↔\` included.`,
      term: 'Eq.symm h  (h.symm)',
      example: `example (a b : Nat) (h : b = a) : a = b := by
  symm
  exact h`,
    },
    {
      id: 'calc',
      kind: 'tactic',
      name: 'calc',
      summary: 'Write a chain of equalities, one justified step per line.',
      body: `\`\`\`lean
calc a = b := h1
  _ = c := h2
\`\`\`

Each step has its own proof (a term, or \`by tactics\`). The result is \`a = c\`. \`calc\` also chains \`≤\` and \`<\`, and mixes relations. Works in term mode too.`,
      term: 'calc a = b := h1\n  _ = c := h2',
      example: `example (a b c : Nat) (h1 : a = b) (h2 : b = c) : a = c :=
  calc a = b := h1
    _ = c := h2`,
    },
    {
      id: 'eq-trans',
      kind: 'term',
      name: 'Eq.trans / Eq.symm',
      summary: 'Transitivity and symmetry of equality as functions on proofs.',
      body: `\`Eq.symm : a = b → b = a\` and \`Eq.trans : a = b → b = c → a = c\`. With dot notation: \`h.symm\`, \`h1.trans h2\`.

\`calc\` is Eq.trans in a readable layout.`,
      example: `example (a b c : Nat) (h1 : a = b) (h2 : b = c) : a = c := Eq.trans h1 h2`,
    },
    {
      id: 'congrArg',
      kind: 'term',
      name: 'congrArg',
      summary: '`congrArg f h : f a = f b` from `h : a = b`.',
      body: `Functions respect equality. \`congrArg f h\` applies \`f\` to both sides of \`h\`. Its sibling \`congrFun h x : f x = g x\` does the same for equal *functions*.`,
      example: `example (f : Nat → Nat) (a b : Nat) (h : a = b) : f a = f b := congrArg f h`,
    },
    {
      id: 'ne',
      kind: 'symbol',
      name: '≠',
      summary: '`a ≠ b` means `a = b → False`. Type `\\ne`.',
      body: `\`≠\` is a definition: \`a ≠ b := (a = b → False)\`. To prove it, \`intro h\` and reach \`False\`. To use \`hne : a ≠ b\`, apply it to an equation: \`hne h : False\`.

\`!=\` is accepted as an ASCII spelling.`,
      input: '\\ne',
      example: `example (a b : Nat) (h : a ≠ b) (e : a = b) : False := h e`,
    },
    {
      id: 'subst',
      kind: 'tactic',
      name: 'subst',
      summary: 'Eliminate a variable using an equation `a = b`.',
      body: `If \`h : a = b\` where \`b\` (or \`a\`) is a local variable, \`subst h\` replaces that variable everywhere by the other side and removes \`h\`. Afterwards the two sides are literally the same.

Use it when you want the equation to disappear rather than to rewrite step by step.`,
      term: 'Eq.subst h _  (h ▸ _)',
      example: `example (P : Nat → Prop) (a b : Nat) (h : a = b) (ha : P a) : P b := by
  subst h
  exact ha`,
    },
    {
      id: 'leibniz',
      kind: 'concept',
      name: 'Leibniz: equals can be substituted',
      summary: 'If `a = b` and `P a`, then `P b`.',
      body: `The principle of substitutivity of equals: any property of \`a\` is a property of \`b\`. In Lean it is the eliminator of \`Eq\` (\`Eq.subst\` / \`Eq.rec\`).

Every use of \`rw\` is an instance of it with \`P\` the goal with a hole where the rewritten term sits.`,
      example: `example (P : Nat → Prop) (a b : Nat) (h : a = b) (ha : P a) : P b :=
  Eq.subst h ha`,
    },
    {
      id: 'eq-inductive',
      kind: 'concept',
      name: 'Eq as an inductive type',
      summary: '`Eq a b` is an inductive type with one constructor, `rfl : Eq a a`.',
      body: `\`a = b\` is notation for \`Eq a b\`, defined as an inductive family: the only way to build a proof is \`rfl : a = a\`. So a proof of \`a = b\` can exist only when \`a\` and \`b\` are definitionally the same, or it was *derived* from such.

The eliminator (what you can do with an equation) is substitution. Symmetry, transitivity and \`congrArg\` all follow from it.`,
      example: `#print Eq`,
    },
    {
      id: 'rwa',
      kind: 'tactic',
      name: 'rwa',
      summary: '`rw` followed by `assumption`.',
      body: `\`rwa [h] at h'\` rewrites, then closes the goal with a matching hypothesis. It is only a shorthand for \`rw [h] at h'\` and \`assumption\`.`,
      term: 'the rewritten hypothesis, used as a term',
      example: `example (a b : Nat) (h : a = b) (hp : a = 1) : b = 1 := by
  rwa [h] at hp`,
    },
  ],
  lemmas: [],
};
