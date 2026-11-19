import type { World } from '../types.ts';

export const world: World = {
  id: 'eq',
  title: 'Equality Estuary',
  tagline: 'Two kinds of "the same": by computation, and by proof',
  intro: `What does \`a = b\` mean? Lean has two answers.

Some equalities hold because both sides *compute* to the same thing, like \`2 + 2\` and \`4\`. Others need a *proof* you can carry around and use, like \`h : a = b\`.

Here you'll prove equalities by computation, rewrite with equality proofs, chain them together, and see that \`Eq\` is itself an inductive type whose eliminator is substitution.`,
  requires: ['quant'],
  bigIdea:
    'Definitional equality is computation, checked by the kernel for free; propositional equality `a = b` is a type whose proofs you build and use, and its single constructor `rfl` is what makes substitution work.',
  levels: [
    {
      id: 'eq-01',
      kind: 'proof',
      mode: 'tactic',
      title: 'Equal by computation',
      intro: `Lean can *evaluate*. When both sides of an equation reduce to the same value, the proof is simply \`rfl\` ("reflexivity": \`a = a\`).

Function applications count too: \`(fun x => x + 1) 2\` reduces by substituting \`2\` for \`x\`, then adding.`,
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
      outro: `\`rfl\` works because \`(fun x => x + 1) 2 * 2\` and \`6\` are *definitionally equal*—the kernel confirms it by computation, with no proof steps needed. Look at the proof term: it's just \`rfl\`, the proof of \`a = a\`.`,
      unlocks: { tactics: ['rfl'], codex: ['rfl', 'definitional-eq'] },
    },
    {
      id: 'eq-02',
      kind: 'choice',
      title: 'What computation can see',
      intro: `Computation only goes so far: when Lean hits a variable \`a\`, it gets stuck because it doesn't know what \`a\` is.

Here \`a b : Nat\` are arbitrary. Three of the equations below are settled by evaluation alone, and one isn't.`,
      code: `example (a : Nat) : (fun x => x + 1) a = a + 1 := rfl
example (a : Nat) : Nat.succ a = a + 1 := rfl
example : 2 + 2 = 4 := rfl`,
      question: 'For arbitrary `a b : Nat`, which equation can **not** be proved by `rfl`?',
      options: [
        {
          text: '`(fun x => x + 1) a = a + 1`',
          feedback:
            'This one works above. Applying the function substitutes `a` for `x`, without needing to know what `a` is.',
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
            "Right. To compute `a + b`, Lean needs to know what `b` is, and it doesn't. The equation is true, but it takes a proof rather than a computation.",
        },
        {
          text: '`2 + 2 = 4`',
          feedback:
            'Accepted above. There are no variables, so both sides evaluate straight to `4`.',
        },
      ],
      outro: `There are two kinds of sameness here. **Definitional** equality means unfolding definitions and computing, which the kernel accepts silently. **Propositional** equality is a statement \`a = b\` that needs a proof term—\`a + b = b + a\` is true, just not by computation alone.`,
    },
    {
      id: 'eq-03',
      kind: 'predict',
      title: 'Rewrite',
      intro: `When you have a proof \`h : a = b\`, you can *rewrite*—replacing occurrences of \`a\` in the goal with \`b\`.

\`rw [h]\` looks for the left side of \`h\` in the goal and swaps it out. Predict the goal after \`rw [h]\`.`,
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
            "It's tempting to think only the first `a` changes, but once `rw` matches the pattern `a`, it replaces every copy of it in the goal together.",
        },
        {
          text: '`a + a = 10` (unchanged: `rw` only changes hypotheses)',
          feedback:
            "`rw [h]` acts on the goal by default. To rewrite a hypothesis instead, you'd add `at h`.",
        },
        {
          text: '`a + a = b`',
          feedback:
            "`10` isn't mentioned in `h`, so it stays put. `rw [h]` replaces `a` with `b` and nothing else.",
        },
      ],
      outro: `\`h : a = b\` is a *proof* term you can actually use. \`rw [h]\` builds a new proof from it, saying "to show \`… a …\`, it's enough to show \`… b …\`," justified by \`h\`. That's propositional equality in action.`,
      unlocks: { tactics: ['rw'], codex: ['rw', 'propositional-eq'] },
    },
    {
      id: 'eq-04',
      kind: 'proof',
      mode: 'tactic',
      title: 'Rewrite backwards',
      intro: `\`rw [h]\` rewrites left to right, turning \`a\` into \`b\`. To go the other way, add an arrow: \`rw [← h]\` replaces \`b\` with \`a\`.

Type \`←\` as \`\\l\`. The first line is already written; finish the proof.`,
      english: 'If a = b and a + 1 = 5, then b + 1 = 5.',
      header: 'theorem rev (a b : Nat) (h : a = b) (ha : a + 1 = 5) : b + 1 = 5 := by',
      starter: '  rw [← h]\n  sorry',
      solutions: ['  rw [← h]\n  exact ha'],
      hints: [
        { text: 'After `rw [← h]`, look at the goal. What has replaced `b`?' },
        { text: 'The goal is now exactly one of your hypotheses.' },
        { text: '`exact ha`.' },
      ],
      outro: `\`← h\` uses \`Eq.symm h : b = a\`. Any proof of \`a = b\` can be flipped, so equality is symmetric—Lean just asks you to say which direction you're going.`,
      unlocks: { codex: ['left-arrow'] },
    },
    {
      id: 'eq-05',
      kind: 'parsons',
      title: 'Rewrite in a hypothesis',
      intro: `You can rewrite inside a hypothesis instead of the goal with \`rw [h1] at h\`. Here two equations carry \`a\` to \`b\` and then to \`c\`, one step at a time.

Arrange the lines. Two of them don't belong.`,
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
      outro: `Rewriting goals and rewriting hypotheses are two sides of the same operation—each step uses a *proof* of equality to move a fact along it. Soon a chain like \`a = b\` and \`b = c\` will combine into a single proof of \`a = c\`: transitivity.`,
    },
    {
      id: 'eq-06',
      kind: 'proof',
      mode: 'tactic',
      title: 'When rw cannot find it',
      intro: `\`rw\` needs the left side of your equation to show up in the goal exactly as written. If it doesn't, Lean says *did not find an occurrence of the pattern*.

The proof below is broken. Read the error message, then fix it.`,
      english: 'If a = b and a + 1 = 3, then b + 1 = 3.',
      header: 'theorem fix_me (a b : Nat) (h : a = b) (ha : a + 1 = 3) : b + 1 = 3 := by',
      starter: '  rw [h]\n  exact ha',
      solutions: ['  rw [← h]\n  exact ha', '  rw [h] at ha\n  exact ha'],
      hints: [
        { text: 'The error names the pattern Lean looked for. Does that pattern actually appear in `b + 1 = 3`?' },
        { text: 'You have two choices: rewrite the goal in the other direction, or rewrite a hypothesis instead.' },
        { text: 'Try `rw [← h]` on the goal, or `rw [h] at ha`.' },
      ],
      outro: `\`rw\` is *syntactic*: it looks for the exact pattern as written and replaces it. Reading the pattern in the error message shows you what Lean was hunting for. Either fix works here, because an equality proof can be used in both directions.`,
      unlocks: { codex: ['rw-pattern'] },
    },
    {
      id: 'eq-07',
      kind: 'proof',
      mode: 'tactic',
      title: 'Symmetry',
      intro: `If \`a = b\`, then \`b = a\`. The tactic \`symm\` swaps the two sides of an equality goal. In term mode, you can write \`Eq.symm\` or \`h.symm\` with dot notation.

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
      outro: `\`symm\` builds \`Eq.symm _ : b = a\` from a proof of \`a = b\`. Symmetry isn't built in—it's a theorem that follows from \`Eq\`'s eliminator, as you'll soon see.`,
      unlocks: { tactics: ['symm'], codex: ['symm'] },
    },
    {
      id: 'eq-08',
      kind: 'proof',
      mode: 'tactic',
      title: 'Chains with calc',
      intro: `A chain of equalities reads just like a calculation on paper:

\`\`\`lean
calc a = b := proof1
  _ = c := proof2
\`\`\`

Each line justifies one step, and \`_\` repeats the previous right side. Lean glues the steps together with transitivity (\`Eq.trans\`).`,
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
      outro: `Look at the proof term: nested \`Eq.trans\`. Transitivity glues \`a = b\` and \`b = c\` into \`a = c\`. Notice how a single chain can mix propositional steps (\`h1\`, \`h2\`) with a definitional one (\`rfl\`).`,
      unlocks: { tactics: ['calc'], codex: ['calc', 'eq-trans'] },
    },
    {
      id: 'eq-09',
      kind: 'proof',
      mode: 'term',
      title: 'Functions respect equality',
      intro: `If \`a = b\`, then \`f a = f b\` for any function \`f\`—equal inputs give equal outputs. Lean calls this \`congrArg f h\`.

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
      outro: `This isn't a built-in axiom of Lean: it falls straight out of \`rw\`'s principle that equal things can replace each other. It's what lets you apply a function to both sides of an equation.`,
      unlocks: { codex: ['congrArg'] },
    },
    {
      id: 'eq-10',
      kind: 'proof',
      mode: 'tactic',
      title: 'Not equal',
      intro: `\`a ≠ b\` is shorthand for \`a = b → False\` (type \`≠\` as \`\\ne\`). To prove it, assume the equation with \`intro\` and derive a contradiction. To use it, apply it to an equation.

This level mixes familiar tools: \`intro\`, \`apply\`, and \`rw\`.`,
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
      outro: `\`a ≠ b\` unfolds to \`a = b → False\`, so inequality is just a function type, just like negation in Connective Canyon. \`intro\` and \`apply\` see right through \`Ne\`.`,
      unlocks: { codex: ['ne'] },
    },
    {
      id: 'eq-11',
      kind: 'proof',
      mode: 'tactic',
      title: 'Substitution',
      intro: `If \`a = b\` and \`P a\`, then \`P b\`: equal things satisfy the same properties (Leibniz's principle).

\`subst h\` uses \`h : a = b\` to eliminate the variable \`b\` completely, replacing it with \`a\` everywhere it appears.`,
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
      outro: `\`Eq\` is an inductive type with a single constructor, \`rfl : a = a\`. Its eliminator says that to prove something about \`b\` given \`a = b\`, it's enough to prove it when \`b\` is \`a\`. That's substitution, and \`rw\`, \`symm\`, and \`congrArg\` all follow from it.`,
      unlocks: { tactics: ['subst'], codex: ['subst', 'leibniz', 'eq-inductive'] },
    },
    {
      id: 'eq-12',
      kind: 'proof',
      mode: 'tactic',
      title: 'Rewrite and finish',
      intro: `Here's a common pattern: rewrite a hypothesis, then close the goal with it. \`rwa [h] at hp\` runs \`rw [h] at hp\` followed immediately by \`assumption\`.

Try it with two rewrite rules.`,
      english: 'If a = b, b = c and a * 2 = 8, then c * 2 = 8.',
      header: 'theorem rwa_demo (a b c : Nat) (h1 : a = b) (h2 : b = c) (hp : a * 2 = 8) : c * 2 = 8 := by',
      starter: '  sorry',
      solutions: ['  rwa [h1, h2] at hp', '  rw [h1, h2] at hp\n  exact hp'],
      hints: [
        { text: 'Which hypothesis mentions `a`, and what does it need to turn into?' },
        { text: 'Rewrite `hp` with both equations in order so it matches the goal.' },
        { text: '`rwa [h1, h2] at hp`.' },
      ],
      outro: `\`rwa\` is just shorthand—it produces the exact same proof term as the longer version. Shorthands are great once you know what they're doing under the hood.`,
      unlocks: { tactics: ['rwa'], codex: ['rwa'] },
    },
    {
      id: 'eq-13',
      kind: 'proof',
      mode: 'tactic',
      boss: true,
      title: 'Boss: rewriting under quantifiers',
      intro: `Here a function \`f\` satisfies \`f x = x + 1\` for every \`x\`. You can rewrite with a \`∀\`-equation too: \`rw [hf]\` finds an instance of \`f ?x\` and rewrites it automatically.

Combine \`∃\`, \`∀\`, rewriting, and substitution from this world and Quantifier Quay.`,
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
        { text: 'Unpack the `∃` hypothesis first. What do you learn about the witness `a`?' },
        { text: 'You have `ha : f a = 5`. Rewrite it with `hf` to see what `a` satisfies.' },
        { text: "Now build the new witness (it's the same `a`) and rewrite the goal with `ha`." },
        { text: '`rw [hf] at ha` gives `a + 1 = 5`; after `use a`, `rw [ha]` leaves `P 5`.' },
      ],
      outro: `Rewriting with \`hf\` filled in \`x\` with \`a\` automatically: a \`∀\` is a function, and \`rw\` applies it wherever it fits. Both definitional equality (\`rfl\`) and propositional equality (proofs like \`ha\`) have done their part.`,
    },
  ],
  codex: [
    {
      id: 'rfl',
      kind: 'tactic',
      name: 'rfl',
      summary: 'Close a goal `a = a`, up to computation.',
      body: `\`rfl\` proves \`a = b\` whenever \`a\` and \`b\` are *definitionally equal*—they reduce to the same thing by unfolding definitions and evaluating. It also closes \`↔\` goals of the form \`P ↔ P\`.

If \`rfl\` fails, the two sides aren't the same after computation, so you'll need a proof (try \`rw\`).`,
      term: 'rfl',
      example: `example : 2 + 2 = 4 := by
  rfl`,
    },
    {
      id: 'definitional-eq',
      kind: 'concept',
      name: 'Definitional equality',
      summary: 'Two terms that reduce to the same thing; the kernel checks it automatically.',
      body: `Two terms are *definitionally equal* when they reduce to the exact same thing after applying functions (β-reduction), unfolding definitions, and evaluating recursion. Lean's kernel checks this automatically without needing a proof term.

That's why \`rfl : 2 + 2 = 4\` works, and why \`(fun x => x + 1) 2\` and \`3\` are interchangeable anywhere a type is expected.`,
      example: `example : (fun x => x + 1) 2 = 3 := rfl`,
    },
    {
      id: 'propositional-eq',
      kind: 'concept',
      name: 'Propositional equality',
      summary: 'A statement `a = b` that is a type; you must supply a proof term.',
      body: `\`a = b\` is a proposition, an ordinary type in \`Prop\`. To use the equality, you need a term \`h : a = b\`. Such a proof can exist even when \`a\` and \`b\` aren't definitionally equal—like \`a + b\` and \`b + a\`—though building it takes real work.

Definitional equality always implies propositional equality via \`rfl\`, but the reverse doesn't hold.`,
      example: `example (a b : Nat) (h : a = b) : b = a := h.symm`,
    },
    {
      id: 'rw',
      kind: 'tactic',
      name: 'rw',
      summary: 'Rewrite the goal (or a hypothesis) using an equation.',
      body: `\`rw [h]\` with \`h : a = b\` replaces every occurrence of \`a\` in the goal with \`b\`. Use \`rw [← h]\` to go right to left, \`rw [h] at h'\` to rewrite a hypothesis, and \`rw [h1, h2]\` to run several rules in sequence. Equations with \`∀\` have their variables filled in by matching.

After rewriting, \`rw\` tries \`rfl\`, so the goal may close right away.`,
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
      body: `Inside \`rw [...]\`, \`←\` flips the direction of an equation, replacing every occurrence of the *right* side with the left.

You'll see \`←\` in other Lean syntax too, but inside \`rw\` it simply means "backwards."`,
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
      body: `The error *did not find an occurrence of the pattern* means the left side of your rule doesn't appear where Lean is looking. Check:

- the direction (\`h\` vs. \`← h\`);
- whether you meant to rewrite a hypothesis (\`at h\`);
- whether the term is actually written that way. \`rw\` matches syntax, not meaning, so \`b + a\` won't match \`a + b\`.`,
      example: `example (a b : Nat) (h : a = b) (ha : a + 1 = 3) : b + 1 = 3 := by
  rw [h] at ha
  exact ha`,
    },
    {
      id: 'symm',
      kind: 'tactic',
      name: 'symm',
      summary: 'Swap the sides of an equality goal.',
      body: `\`symm\` turns \`a = b\` into \`b = a\`. In term mode, use \`Eq.symm h\` or \`h.symm\`. It works on any symmetric relation, including \`↔\`.`,
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

Each step carries its own proof (either a term or \`by\` tactics), and the whole chain proves \`a = c\`. \`calc\` also chains \`≤\` and \`<\`, can mix relations, and works in term mode too.`,
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
      body: `\`Eq.symm : a = b → b = a\` and \`Eq.trans : a = b → b = c → a = c\`. With dot notation, you can write \`h.symm\` and \`h1.trans h2\`.

\`calc\` is just \`Eq.trans\` in a more readable layout.`,
      example: `example (a b c : Nat) (h1 : a = b) (h2 : b = c) : a = c := Eq.trans h1 h2`,
    },
    {
      id: 'congrArg',
      kind: 'term',
      name: 'congrArg',
      summary: '`congrArg f h : f a = f b` from `h : a = b`.',
      body: `Functions respect equality: \`congrArg f h\` applies \`f\` to both sides of \`h\`. Its sibling \`congrFun h x : f x = g x\` does the same for equal *functions*.`,
      example: `example (f : Nat → Nat) (a b : Nat) (h : a = b) : f a = f b := congrArg f h`,
    },
    {
      id: 'ne',
      kind: 'symbol',
      name: '≠',
      summary: '`a ≠ b` means `a = b → False`. Type `\\ne`.',
      body: `\`≠\` is defined as \`a ≠ b := (a = b → False)\`. To prove one, \`intro h\` and reach \`False\`. To use \`hne : a ≠ b\`, apply it to an equation: \`hne h : False\`.

You can also write \`!=\` in ASCII.`,
      input: '\\ne',
      example: `example (a b : Nat) (h : a ≠ b) (e : a = b) : False := h e`,
    },
    {
      id: 'subst',
      kind: 'tactic',
      name: 'subst',
      summary: 'Eliminate a variable using an equation `a = b`.',
      body: `If \`h : a = b\` and \`b\` (or \`a\`) is a local variable, \`subst h\` replaces that variable everywhere with the other side and removes \`h\`. Afterward, the two sides are literally identical.

Reach for it when you'd rather eliminate the equation outright than rewrite step by step.`,
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
      body: `Substitutivity of equals says that any property of \`a\` is also a property of \`b\`. In Lean, it's the eliminator of \`Eq\` (\`Eq.subst\` / \`Eq.rec\`).

Every \`rw\` step is an instance of it, where \`P\` is the goal with a hole where the rewritten term sits.`,
      example: `example (P : Nat → Prop) (a b : Nat) (h : a = b) (ha : P a) : P b :=
  Eq.subst h ha`,
    },
    {
      id: 'eq-inductive',
      kind: 'concept',
      name: 'Eq as an inductive type',
      summary: '`Eq a b` is an inductive type with one constructor, `rfl : Eq a a`.',
      body: `\`a = b\` is notation for \`Eq a b\`, an inductive family whose only constructor is \`rfl : a = a\`. So a proof of \`a = b\` can only exist when \`a\` and \`b\` are definitionally equal, or when it's derived from such a proof.

Its eliminator (how you use an equation) is substitution, and symmetry, transitivity, and \`congrArg\` all follow from it.`,
      example: `#print Eq`,
    },
    {
      id: 'rwa',
      kind: 'tactic',
      name: 'rwa',
      summary: '`rw` followed by `assumption`.',
      body: `\`rwa [h] at h'\` rewrites, then closes the goal with a matching hypothesis. It's just shorthand for \`rw [h] at h'\` followed by \`assumption\`.`,
      term: 'the rewritten hypothesis, used as a term',
      example: `example (a b : Nat) (h : a = b) (hp : a = 1) : b = 1 := by
  rwa [h] at hp`,
    },
  ],
  lemmas: [],
};
