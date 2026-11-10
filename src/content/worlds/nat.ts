import type { World } from '../types.ts';

export const world: World = {
  id: 'nat',
  title: 'Induction Isles',
  tagline: 'Numbers built from zero and succ, and proofs built the same way',
  intro: `The natural numbers are not given; they are *built*: start at \`zero\`, apply \`succ\` as often as you like. Because every number is built this way, you can define functions by saying what happens at zero and at \`succ\`, and prove theorems the same way: that is induction.

You will define a function by recursion, see why \`n + 0 = n\` is free but \`0 + n = n\` is not, and climb the ladder up to commutativity of multiplication.`,
  requires: ['eq'],
  bigIdea:
    'An inductive type comes with a recursor: the same principle that defines functions out of it by recursion proves statements about it by induction.',
  levels: [
    {
      id: 'nat-01',
      kind: 'choice',
      title: 'Numbers from zero and succ',
      intro: `\`Nat\` is an *inductive type*: a type defined by listing its constructors. There are two:

- \`Nat.zero : Nat\`
- \`Nat.succ : Nat → Nat\`

The numeral \`2\` is just a short way to write \`Nat.succ (Nat.succ Nat.zero)\`. Lean usually shows \`n.succ\` as \`n + 1\`.`,
      code: `#print Nat
#check Nat.succ (Nat.succ Nat.zero)
example : Nat.succ (Nat.succ Nat.zero) = 2 := rfl`,
      question: 'Which statement describes every natural number?',
      options: [
        {
          text: 'It is either `Nat.zero`, or `Nat.succ n` for some natural number `n`.',
          correct: true,
          feedback:
            'Yes: two cases, and the second refers back to a smaller number. Everything that follows (recursion, induction) rests on this shape.',
        },
        {
          text: 'It is one of the numerals `0, 1, 2, 3, …`, each a separate constructor.',
          feedback:
            'There is no constructor for `5`; numerals are shorthand for `succ` applied to `zero` that many times. Only two constructors exist.',
        },
        {
          text: 'It is `Nat.succ n` for some natural number `n`; `zero` is not needed.',
          feedback:
            'Without `zero` there would be nowhere to start, since `succ` needs a number to act on.',
        },
        {
          text: 'It is `Nat.zero`, or a list of digits.',
          feedback:
            'Digits are only notation for reading and typing. Inside Lean a number is the `succ` tower, no digits.',
        },
      ],
      outro: `An inductive type is determined by its constructors, and every value is built from them. This is the same pattern as \`And\`, \`Or\` and \`Exists\`; the new thing is that \`succ\` takes an argument *of the type itself*.`,
      unlocks: { codex: ['nat-inductive', 'nat-sym'] },
    },
    {
      id: 'nat-02',
      kind: 'proof',
      mode: 'term',
      title: 'Define by recursion',
      intro: `To define a function on \`Nat\`, say what it does on each constructor. For \`succ\`, you may call the function on the smaller number.

\`double\` should satisfy \`double 0 = 0\` and \`double (k + 1) = double k + 2\`. Fill in both cases of the \`match\`. Lean checks them with the tests below the editor.`,
      english: 'Define double : Nat → Nat by recursion, so that double 3 = 6.',
      header: 'def double (n : Nat) : Nat :=',
      starter: '  match n with\n  | 0 => sorry\n  | k + 1 => sorry',
      after: `example : double 3 = 6 := rfl
example (n : Nat) : double (n + 1) = double n + 2 := rfl`,
      solutions: ['  match n with\n  | 0 => 0\n  | k + 1 => double k + 2'],
      hints: [
        { text: 'What is the double of zero? Write the answer directly.' },
        { text: 'In the `k + 1` case, `double k` is available: the double of the smaller number.' },
        { text: 'Doubling `k + 1` adds two to doubling `k`.' },
      ],
      outro: `The tests are \`rfl\` proofs: \`double 3\` *computes* to \`6\`. A recursive definition is a recipe with one rule per constructor, and Lean unfolds the rule whenever the argument has a constructor on the outside.`,
      unlocks: { codex: ['def-recursion'] },
    },
    {
      id: 'nat-03',
      kind: 'proof',
      mode: 'tactic',
      title: 'The defining equations',
      intro: `Addition and multiplication are defined by recursion on the **second** argument. Lean provides their defining equations as theorems:

- \`Nat.add_zero : n + 0 = n\`
- \`Nat.add_succ : n + (m + 1) = (n + m) + 1\`
- \`Nat.mul_zero : n * 0 = 0\`
- \`Nat.mul_succ : n * (m + 1) = n * m + n\`

Use one with \`rw\`. The first line is given.`,
      english: 'If a + b = 5, then a + (b + 1) = 6.',
      header: 'theorem step (a b : Nat) (h : a + b = 5) : a + (b + 1) = 6 := by',
      starter: '  rw [Nat.add_succ]\n  sorry',
      solutions: ['  rw [Nat.add_succ]\n  rw [h]', '  rw [Nat.add_succ, h]'],
      hints: [
        { text: 'After the first `rw`, look at the goal. Does it contain the left side of `h`?' },
        { text: 'It contains `a + b`. You have an equation for that.' },
        { text: '`rw [h]`; the result `5 + 1 = 6` is checked by computation.' },
      ],
      outro: `These equations are the *definition* of \`+\` and \`*\`, written as theorems: they say what the recursion does at \`zero\` and at \`succ\`. Everything you prove about arithmetic from here is built on them.`,
      unlocks: { codex: ['Nat.add_zero', 'Nat.add_succ', 'Nat.mul_zero', 'Nat.mul_succ'] },
    },
    {
      id: 'nat-04',
      kind: 'choice',
      title: 'Which side is stuck?',
      intro: `Because \`+\` recurses on its *second* argument, \`n + 0\` computes: Lean sees \`0\` and applies the rule \`n + 0 = n\`.

But \`0 + n\`: the second argument is the variable \`n\`. Lean cannot tell which rule applies.`,
      code: `example (n : Nat) : n + 0 = n := rfl`,
      question: 'Lean accepts the example above. Will `example (n : Nat) : 0 + n = n := rfl` be accepted?',
      options: [
        {
          text: 'Yes: addition is commutative, so it is the same statement.',
          feedback:
            'Commutativity is a *theorem*, and `rfl` only knows computation. The two statements are not the same term, and computing does not turn one into the other.',
        },
        {
          text: 'No: the statement `0 + n = n` is false.',
          feedback:
            'It is true for every `n`. It just cannot be shown by computation alone.',
        },
        {
          text: 'No: `0 + n` cannot be evaluated because `n` is a variable, so the two sides are not definitionally equal.',
          correct: true,
          feedback:
            'Right. Lean needs to see `zero` or `succ` in the second slot to unfold `+`. `0 + n = n` is true, but a proof must go through all the cases of `n`.',
        },
        {
          text: 'Yes: `rfl` can prove any true statement about numbers.',
          feedback:
            '`rfl` proves only definitional equalities. Many true statements, like `a + b = b + a`, are not definitional.',
        },
      ],
      outro: `So \`n + 0 = n\` is definitional, but \`0 + n = n\` is only propositional. To prove it you need to handle *every* \`n\`, using the fact that every \`n\` is \`zero\` or \`succ k\`. That is the job of induction.`,
      unlocks: { codex: ['add-recursion'] },
    },
    {
      id: 'nat-05',
      kind: 'predict',
      title: 'Induction: two goals',
      intro: `To prove \`P n\` for every \`n\`, prove it for the two kinds of numbers:

- **zero**: prove \`P 0\`.
- **succ**: assume \`P k\` (the *induction hypothesis*) and prove \`P (k + 1)\`.

The tactic \`induction n with\` sets this up. Predict the goals.`,
      code: `theorem zero_add_demo (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, ih]`,
      line: 2,
      question: 'Which goals does `induction n with` produce?',
      options: [
        {
          text: '`zero`: `0 + 0 = 0`.  `succ`: with `ih : 0 + k = k`, prove `0 + (k + 1) = k + 1`.',
          correct: true,
          feedback:
            'Yes. One goal per constructor; the `succ` goal comes with the induction hypothesis for the smaller number `k`.',
        },
        {
          text: '`zero`: `0 + 0 = 0`.  `succ`: prove `0 + (k + 1) = k + 1` (nothing else).',
          feedback:
            'Without the hypothesis for `k` the step would be unprovable. Induction gives you `ih` for free; that is its whole point.',
        },
        {
          text: 'A single goal `0 + n = n`, now with `n` marked as arbitrary.',
          feedback:
            '`induction` splits the goal by the constructors of `Nat`. You get one goal per constructor.',
        },
        {
          text: 'One goal for each number: `0 + 0 = 0`, `0 + 1 = 1`, `0 + 2 = 2`, …',
          feedback:
            'Infinitely many goals could never be finished. Induction packages them into two: the base, and a step that works for *every* `k`.',
        },
      ],
      outro: `Zero for the base, \`succ\` with a hypothesis for the step: induction mirrors the *shape of the type*. Each constructor gives a case; a constructor that takes a \`Nat\` argument gives an induction hypothesis for that argument.`,
      unlocks: { tactics: ['induction'], codex: ['induction'] },
    },
    {
      id: 'nat-06',
      kind: 'proof',
      mode: 'tactic',
      title: 'Zero plus n',
      intro: `Your first induction. The base case is written for you.

In the step, the goal is \`0 + (k + 1) = k + 1\`. Use \`Nat.add_succ\` to expose \`0 + k\`, then the induction hypothesis \`ih\`.`,
      english: 'Adding zero on the left does nothing: 0 + n = n.',
      header: 'theorem zero_add (n : Nat) : 0 + n = n := by',
      starter: '  induction n with\n  | zero => rfl\n  | succ k ih => sorry',
      solutions: [
        '  induction n with\n  | zero => rfl\n  | succ k ih => rw [Nat.add_succ, ih]',
      ],
      forbidden: ['Nat.zero_add'],
      hints: [
        { text: 'Look at the `succ` goal. Which defining equation rewrites `0 + (k + 1)`?' },
        { text: '`Nat.add_succ` turns it into `(0 + k) + 1`. Now there is a `0 + k` you know something about.' },
        { text: '`ih : 0 + k = k`. Rewrite with it; the goal becomes `k + 1 = k + 1`.' },
      ],
      showTerm: true,
      outro: `This is \`Nat.zero_add\` in Lean's library; it is now in your inventory. Look at the proof term: it is a call to \`Nat.rec\`, with your base case and step as arguments. Induction is just a function built from the recursor.`,
      unlocks: { lemmas: ['Nat.zero_add'] },
    },
    {
      id: 'nat-07',
      kind: 'choice',
      title: 'Recursion is induction',
      intro: `Every inductive type has a *recursor* that says how to build a function out of it. For \`Nat\` it is \`Nat.rec\`. It takes a **base case**, a **step** from \`n\` to \`n + 1\`, and returns the result for every number.

The type \`motive : Nat → Sort u\` says what is being produced for each \`n\`.`,
      code: `#check @Nat.rec`,
      question:
        'Take `motive n := (0 + n = n)`. What do the two arguments of `Nat.rec` have to be?',
      options: [
        {
          text: 'A proof of `0 + 0 = 0`, and for every `n` a function from a proof of `0 + n = n` to a proof of `0 + (n + 1) = n + 1`.',
          correct: true,
          feedback:
            'Exactly: your base case, and your inductive step. With `motive n := (0 + n = n)` this *is* induction.',
        },
        {
          text: 'A proof of `0 + n = n` for one fixed `n`, and a proof for `n + 1`.',
          feedback:
            'The step has to work for every `n`: it is a *function* taking the proof for `n` to the proof for `n + 1`.',
        },
        {
          text: 'Two numbers: one for zero, one for `succ`.',
          feedback:
            'That would be so if `motive` returned numbers, as in `double`. Here `motive n` is a *proposition*, so the arguments are proofs.',
        },
        {
          text: 'A proof of `0 + n = n` for every `n`.',
          feedback:
            'That is what `Nat.rec` *returns*: the conclusion. The arguments are the base case and the step.',
        },
      ],
      outro: `If \`motive n := Nat\`, the recursor builds numbers: that is recursion, and it defined \`double\`. If \`motive n := (0 + n = n)\`, it builds proofs: that is induction. **Recursion and induction are one principle**, given by one recursor.`,
      unlocks: { codex: ['nat-rec', 'recursion-induction'] },
    },
    {
      id: 'nat-08',
      kind: 'parsons',
      title: 'Succ plus m',
      intro: `Addition recurses on the second argument, so moving a \`succ\` from the *first* argument out needs induction on the second.

Arrange the proof of \`succ_add\`. Two lines do not belong.`,
      english: 'Adding after succ: succ n + m = succ (n + m).',
      header: 'theorem succ_add (n m : Nat) : Nat.succ n + m = Nat.succ (n + m) := by',
      lines: [
        '  induction m with',
        '  | zero => rfl',
        '  | succ k ih =>',
        '    rw [Nat.add_succ, Nat.add_succ, ih]',
      ],
      distractors: ['  induction n with', '    rw [Nat.add_succ, ih]'],
      hints: [
        { text: 'The variable that `+` recurses on is the second one.' },
        { text: 'In the step, both sides contain `… + (k + 1)`: each needs `Nat.add_succ`.' },
        { text: 'First induction line, then `zero` and `succ` cases, then the rewrite with `ih` last.' },
      ],
      outro: `This is \`Nat.succ_add\` in Lean's library. Notice the choice of variable: induct on whichever argument the recursion looks at. A good first move is to ask where the definition gets stuck.`,
      unlocks: { lemmas: ['Nat.succ_add'] },
    },
    {
      id: 'nat-09',
      kind: 'proof',
      mode: 'tactic',
      title: 'Commutativity of addition',
      intro: `Now the first big theorem. Induct on \`m\`.

- Base: \`n + 0 = 0 + n\`. One side is computed by \`Nat.add_zero\`; for the other you have \`Nat.zero_add\`.
- Step: use \`Nat.add_succ\`, the hypothesis, and \`Nat.succ_add\`.

Both lemmas you proved are available.`,
      english: 'Addition is commutative: n + m = m + n.',
      header: 'theorem add_comm (n m : Nat) : n + m = m + n := by',
      starter: '  sorry',
      solutions: [
        '  induction m with\n  | zero => rw [Nat.add_zero, Nat.zero_add]\n  | succ k ih => rw [Nat.add_succ, ih, Nat.succ_add]',
      ],
      forbidden: ['Nat.add_comm'],
      hints: [
        { text: 'Which variable do you do induction on? The one `+` recurses on in `n + m`.' },
        { text: 'In the base case the goal is `n + 0 = 0 + n`. Two rewrites, one for each side.' },
        { text: 'In the step, rewrite `n + (k + 1)` first, then use `ih`; what remains has `(k + 1) + n`.' },
        { text: '`rw [Nat.add_succ, ih, Nat.succ_add]`.' },
      ],
      outro: `This is \`Nat.add_comm\`. Notice what your proof used: the *definition* (\`add_succ\`), the previous lemma (\`zero_add\`, \`succ_add\`) and the induction hypothesis. Each lemma was a stepping stone for the next.`,
      unlocks: { lemmas: ['Nat.add_comm'] },
    },
    {
      id: 'nat-10',
      kind: 'proof',
      mode: 'tactic',
      title: 'Associativity of addition',
      intro: `This time the base case is \`rfl\`, and the step is three uses of the defining equation \`Nat.add_succ\`, followed by \`ih\`.

Which variable should you induct on? Remember what \`+\` looks at.`,
      english: 'Addition is associative: (a + b) + c = a + (b + c).',
      header: 'theorem add_assoc (a b c : Nat) : a + b + c = a + (b + c) := by',
      starter: '  sorry',
      solutions: [
        '  induction c with\n  | zero => rfl\n  | succ k ih => rw [Nat.add_succ, Nat.add_succ, Nat.add_succ, ih]',
      ],
      forbidden: ['Nat.add_assoc'],
      hints: [
        { text: 'The variable that appears last in every `+` is `c`.' },
        { text: 'The base case: both sides reduce to `a + b`. No lemmas needed.' },
        { text: 'In the step, `c` becomes `k + 1` in three places. Rewrite each, then `ih`.' },
      ],
      outro: `This is \`Nat.add_assoc\`. Together with \`add_comm\` it lets you rearrange any sum. The kernel never sees any of this "rearranging": it only sees terms of type \`Eq\`, built from \`Nat.rec\` and \`Eq.trans\`.`,
      unlocks: { lemmas: ['Nat.add_assoc'] },
    },
    {
      id: 'nat-11',
      kind: 'proof',
      mode: 'tactic',
      optional: true,
      title: 'Side-quest: swap in the middle',
      intro: `Sometimes \`rw\` needs a hint about *which* instance of a lemma to use. Give the arguments explicitly: \`rw [Nat.add_comm a b]\` rewrites only \`a + b\`.

Prove that \`a + (b + c) = b + (a + c)\` using \`add_assoc\` and \`add_comm\`.`,
      english: 'Addition can swap the first two summands: a + (b + c) = b + (a + c).',
      header: 'theorem add_left_comm (a b c : Nat) : a + (b + c) = b + (a + c) := by',
      starter: '  sorry',
      solutions: ['  rw [← Nat.add_assoc, Nat.add_comm a b, Nat.add_assoc]'],
      forbidden: ['Nat.add_left_comm', 'Nat.add_right_comm'],
      hints: [
        { text: 'Regroup the left side so that `a + b` appears as a unit.' },
        { text: '`← Nat.add_assoc` does the regrouping. Then swap just `a + b`.' },
        { text: 'Without arguments, `Nat.add_comm` would grab the first sum it sees. Write `Nat.add_comm a b`.' },
      ],
      outro: `This is \`Nat.add_left_comm\`; \`Nat.add_right_comm\` (also added to your inventory) is its twin. Explicit arguments, as in \`Nat.add_comm a b\`, are an ordinary function application: the lemma is a function from \`a\` and \`b\` to a proof.`,
      unlocks: { lemmas: ['Nat.add_left_comm', 'Nat.add_right_comm'], codex: ['rw-explicit'] },
    },
    {
      id: 'nat-12',
      kind: 'proof',
      mode: 'tactic',
      title: 'Zero times n',
      intro: `Multiplication has its own defining equations: \`n * 0 = 0\` is definitional, but \`0 * n = 0\` is not, just like \`0 + n\`.

Prove it by induction. Use \`Nat.mul_succ\` and then the hypothesis.`,
      english: 'Zero times anything is zero: 0 * n = 0.',
      header: 'theorem zero_mul (n : Nat) : 0 * n = 0 := by',
      starter: '  sorry',
      solutions: ['  induction n with\n  | zero => rfl\n  | succ k ih => rw [Nat.mul_succ, ih]'],
      forbidden: ['Nat.zero_mul'],
      hints: [
        { text: 'Same shape as `zero_add`: one induction, two cases.' },
        { text: 'The `succ` case: `0 * (k + 1)` unfolds with `Nat.mul_succ`.' },
        { text: 'After rewriting with `ih`, what remains is `0 + 0 = 0`, which holds by computation.' },
      ],
      outro: `This is \`Nat.zero_mul\`. The pattern is the same as for addition: a fact that is definitional on one side of the operator needs induction on the other.`,
      unlocks: { lemmas: ['Nat.zero_mul'] },
    },
    {
      id: 'nat-13',
      kind: 'proof',
      mode: 'tactic',
      title: 'Succ times m',
      intro: `Now \`(n + 1) * m = n * m + m\`: pull the extra \`n\` out. Induct on \`m\`.

The step needs a bit of bookkeeping: after unfolding and using \`ih\`, regroup with \`Nat.add_assoc\`, and swap two summands with \`Nat.add_left_comm k n 1\`.`,
      english: 'Multiplying a successor: (n + 1) * m = n * m + m.',
      header: 'theorem succ_mul (n m : Nat) : Nat.succ n * m = n * m + m := by',
      starter: '  sorry',
      solutions: [
        '  induction m with\n  | zero => rfl\n  | succ k ih =>\n    rw [Nat.mul_succ, Nat.mul_succ, ih, Nat.add_assoc, Nat.add_assoc, Nat.add_left_comm k n 1]',
      ],
      forbidden: ['Nat.succ_mul'],
      hints: [
        { text: 'Start the step by unfolding both multiplications with the defining equation, then use `ih`.' },
        { text: 'You are left with sums in different orders. Make the brackets match with `Nat.add_assoc` first.' },
        { text: 'The remaining difference is `k + (n + 1)` versus `n + (k + 1)`: exactly `Nat.add_left_comm k n 1`.' },
      ],
      outro: `This is \`Nat.succ_mul\`. Notice that \`add_assoc\` and \`add_left_comm\` do the work that a person would call "rearranging terms". In Lean every such rearrangement is a visible step.`,
      unlocks: { lemmas: ['Nat.succ_mul'] },
    },
    {
      id: 'nat-14',
      kind: 'proof',
      mode: 'tactic',
      boss: true,
      title: 'Boss: commutativity of multiplication',
      intro: `The top of the ladder. Everything you built is available: the defining equations, \`zero_mul\`, \`succ_mul\`.

Think about which variable to induct on, what each case becomes, and which lemma fits.`,
      english: 'Multiplication is commutative: n * m = m * n.',
      header: 'theorem mul_comm (n m : Nat) : n * m = m * n := by',
      starter: '  sorry',
      solutions: [
        '  induction m with\n  | zero => rw [Nat.mul_zero, Nat.zero_mul]\n  | succ k ih => rw [Nat.mul_succ, ih, Nat.succ_mul]',
      ],
      forbidden: ['Nat.mul_comm'],
      hints: [
        { text: 'Which argument does `*` recurse on? Induct on that one.' },
        { text: 'Base case: one side is `n * 0` (a defining equation), the other is `0 * n` (a lemma you proved).' },
        { text: 'Step: unfold `n * (k + 1)`, rewrite with `ih`, and finish with the lemma about `(k + 1) * n`.' },
        { text: '`rw [Nat.mul_succ, ih, Nat.succ_mul]`.' },
      ],
      outro: `This is \`Nat.mul_comm\`, and with it, your inventory holds the algebra of the natural numbers: the extra lemmas \`mul_one\`, \`one_mul\`, \`mul_add\`, \`add_mul\`, \`mul_assoc\`, \`two_mul\` are unlocked too, each provable by the same method.`,
      unlocks: {
        lemmas: [
          'Nat.mul_comm',
          'Nat.mul_one',
          'Nat.one_mul',
          'Nat.mul_add',
          'Nat.add_mul',
          'Nat.mul_assoc',
          'Nat.two_mul',
        ],
      },
    },
  ],
  codex: [
    {
      id: 'nat-inductive',
      kind: 'concept',
      name: 'Nat as an inductive type',
      summary: '`Nat` has two constructors: `Nat.zero` and `Nat.succ`.',
      body: `\`\`\`lean
inductive Nat : Type
  | zero : Nat
  | succ : Nat → Nat
\`\`\`

Every natural number is built by finitely many \`succ\`s on \`zero\`; distinct constructors give distinct values, and \`succ\` is injective. Numerals are shorthand: \`3\` is \`succ (succ (succ zero))\`. Lean displays \`succ n\` as \`n + 1\`.`,
      example: `#print Nat`,
    },
    {
      id: 'nat-sym',
      kind: 'symbol',
      name: 'ℕ',
      summary: 'Mathlib\'s notation for `Nat`. Type `\\N`.',
      body: `In this game the type is written \`Nat\`. In Mathlib the same type has the notation \`ℕ\`. They are identical; you will meet both.`,
      input: '\\N',
      mathlib: '`ℕ` (Mathlib notation for `Nat`)',
    },
    {
      id: 'def-recursion',
      kind: 'term',
      name: 'match / recursive def',
      summary: 'Define a function by cases on constructors, calling itself on smaller arguments.',
      body: `\`\`\`lean
def double : Nat → Nat
  | 0 => 0
  | n + 1 => double n + 2
\`\`\`

or \`match n with | 0 => … | k + 1 => …\` inside a body. The recursive call must be on a structurally smaller argument (here \`k\`). Lean unfolds the matching case by computation, so \`double 3 = 6\` is \`rfl\`.`,
      example: `def twice (n : Nat) : Nat :=
  match n with
  | 0 => 0
  | k + 1 => twice k + 2

example : twice 2 = 4 := rfl`,
    },
    {
      id: 'Nat.add_zero',
      kind: 'definition',
      name: 'Nat.add_zero',
      summary: '`n + 0 = n`. Definitional.',
      body: `The first rule of addition. It is true by \`rfl\`; the theorem exists so that you can use it in \`rw\`.`,
      example: `example (n : Nat) : n + 0 = n := Nat.add_zero n`,
    },
    {
      id: 'Nat.add_succ',
      kind: 'definition',
      name: 'Nat.add_succ',
      summary: '`n + (m + 1) = (n + m) + 1`.',
      body: `The second rule of addition: to add \`m + 1\`, add \`m\` and then take a successor. Also definitional. Lean may show the right side as \`(n + m).succ\`.

This is how \`rw\` exposes the recursion step in an induction.`,
      example: `example (n m : Nat) : n + (m + 1) = (n + m) + 1 := Nat.add_succ n m`,
    },
    {
      id: 'Nat.mul_zero',
      kind: 'definition',
      name: 'Nat.mul_zero',
      summary: '`n * 0 = 0`. Definitional.',
      body: `The first rule of multiplication.`,
      example: `example (n : Nat) : n * 0 = 0 := Nat.mul_zero n`,
    },
    {
      id: 'Nat.mul_succ',
      kind: 'definition',
      name: 'Nat.mul_succ',
      summary: '`n * (m + 1) = n * m + n`.',
      body: `The second rule of multiplication: to multiply by \`m + 1\`, multiply by \`m\` and add \`n\` once more.`,
      example: `example (n m : Nat) : n * (m + 1) = n * m + n := Nat.mul_succ n m`,
    },
    {
      id: 'add-recursion',
      kind: 'concept',
      name: 'Which argument is recursed on',
      summary: '`+` and `*` recurse on the second argument, so `n + 0` computes but `0 + n` is stuck.',
      body: `Unfolding \`a + b\` needs \`b\` to be \`0\` or \`succ _\`. If \`b\` is a variable, evaluation stops: the term is *stuck*.

So \`n + 0 = n\` is \`rfl\`, but \`0 + n = n\` is not: it holds for every \`n\`, but only propositionally, and its proof needs induction. A good habit: find the stuck variable, and do induction on that.`,
      example: `example (n : Nat) : n + 1 = Nat.succ n := rfl`,
    },
    {
      id: 'induction',
      kind: 'tactic',
      name: 'induction',
      summary: 'Prove a statement for all `n` by a base case and a step.',
      body: `\`\`\`lean
induction n with
| zero => …
| succ k ih => …
\`\`\`

The \`zero\` goal replaces \`n\` by \`0\`. The \`succ\` goal replaces it by \`k + 1\` and provides \`ih\`, the statement for \`k\`. Use \`rw [Nat.add_succ, ih]\`-style steps. Only the variable you induct on changes; other hypotheses mentioning it are generalized automatically only if they are in the goal.`,
      term: 'Nat.rec base step',
      example: `example (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, ih]`,
    },
    {
      id: 'nat-rec',
      kind: 'term',
      name: 'Nat.rec',
      summary: 'The recursor of `Nat`: base case and step give a result for every `n`.',
      body: `\`\`\`lean
Nat.rec : motive 0 → ((n : Nat) → motive n → motive (n + 1)) → (t : Nat) → motive t
\`\`\`

\`motive\` says what is produced for each number. Given a result for zero and a way to go from \`n\` to \`n + 1\`, you get a result for every \`t\`.`,
      example: `#check @Nat.rec`,
    },
    {
      id: 'recursion-induction',
      kind: 'concept',
      name: 'Recursion = induction',
      summary: 'Recursion and induction are the same principle: the recursor, with different motives.',
      body: `With \`motive n := Nat\`, \`Nat.rec\` defines a *function* by recursion: \`double\`. With \`motive n := (P n)\` for a proposition \`P\`, the same recursor *proves* \`∀ n, P n\`: induction.

Every inductive type has its own recursor; \`induction\` and \`cases\` are tactics that apply it. This is why proofs by induction look like recursive programs.`,
      example: `#check @Nat.rec`,
    },
    {
      id: 'rw-explicit',
      kind: 'term',
      name: 'rw [lemma a b]',
      summary: 'Give a lemma explicit arguments to rewrite one specific instance.',
      body: `A lemma like \`Nat.add_comm : ∀ n m, n + m = m + n\` is a function. \`rw [Nat.add_comm a b]\` instantiates it, so it only rewrites \`a + b\`. Without arguments, \`rw\` picks the first match it finds, which may not be the one you want.`,
      example: `example (a b c : Nat) : a + b + c = b + a + c := by
  rw [Nat.add_comm a b]`,
    },
  ],
  lemmas: [
    {
      name: 'Nat.zero_add',
      origin: 'core',
      doc: '`0 + n = n`',
      source: `theorem Nat.zero_add (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, ih]`,
    },
    {
      name: 'Nat.succ_add',
      origin: 'core',
      doc: '`succ n + m = succ (n + m)`',
      source: `theorem Nat.succ_add (n m : Nat) : Nat.succ n + m = Nat.succ (n + m) := by
  induction m with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, Nat.add_succ, ih]`,
    },
    {
      name: 'Nat.add_comm',
      origin: 'core',
      doc: '`n + m = m + n`',
      source: `theorem Nat.add_comm (n m : Nat) : n + m = m + n := by
  induction m with
  | zero => rw [Nat.add_zero, Nat.zero_add]
  | succ k ih => rw [Nat.add_succ, ih, Nat.succ_add]`,
    },
    {
      name: 'Nat.add_assoc',
      origin: 'core',
      doc: '`(a + b) + c = a + (b + c)`',
      source: `theorem Nat.add_assoc (a b c : Nat) : a + b + c = a + (b + c) := by
  induction c with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, Nat.add_succ, Nat.add_succ, ih]`,
    },
    {
      name: 'Nat.add_left_comm',
      origin: 'core',
      doc: '`a + (b + c) = b + (a + c)`',
      source: `theorem Nat.add_left_comm (a b c : Nat) : a + (b + c) = b + (a + c) := by
  rw [← Nat.add_assoc, Nat.add_comm a b, Nat.add_assoc]`,
    },
    {
      name: 'Nat.add_right_comm',
      origin: 'core',
      doc: '`(a + b) + c = (a + c) + b`',
      source: `theorem Nat.add_right_comm (a b c : Nat) : a + b + c = a + c + b := by
  rw [Nat.add_assoc, Nat.add_comm b c, ← Nat.add_assoc]`,
    },
    {
      name: 'Nat.zero_mul',
      origin: 'core',
      doc: '`0 * n = 0`',
      source: `theorem Nat.zero_mul (n : Nat) : 0 * n = 0 := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.mul_succ, ih]`,
    },
    {
      name: 'Nat.succ_mul',
      origin: 'core',
      doc: '`succ n * m = n * m + m`',
      source: `theorem Nat.succ_mul (n m : Nat) : Nat.succ n * m = n * m + m := by
  induction m with
  | zero => rfl
  | succ k ih =>
    rw [Nat.mul_succ, Nat.mul_succ, ih, Nat.add_assoc, Nat.add_assoc, Nat.add_left_comm k n 1]`,
    },
    {
      name: 'Nat.mul_comm',
      origin: 'core',
      doc: '`n * m = m * n`',
      source: `theorem Nat.mul_comm (n m : Nat) : n * m = m * n := by
  induction m with
  | zero => rw [Nat.mul_zero, Nat.zero_mul]
  | succ k ih => rw [Nat.mul_succ, ih, Nat.succ_mul]`,
    },
    {
      name: 'Nat.mul_one',
      origin: 'core',
      doc: '`n * 1 = n`',
      source: `theorem Nat.mul_one (n : Nat) : n * 1 = n := by
  rw [Nat.mul_succ, Nat.mul_zero, Nat.zero_add]`,
    },
    {
      name: 'Nat.one_mul',
      origin: 'core',
      doc: '`1 * n = n`',
      source: `theorem Nat.one_mul (n : Nat) : 1 * n = n := by
  rw [Nat.mul_comm, Nat.mul_one]`,
    },
    {
      name: 'Nat.mul_add',
      origin: 'core',
      doc: '`a * (b + c) = a * b + a * c`',
      source: `theorem Nat.mul_add (a b c : Nat) : a * (b + c) = a * b + a * c := by
  induction c with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, Nat.mul_succ, Nat.mul_succ, ih, Nat.add_assoc]`,
    },
    {
      name: 'Nat.add_mul',
      origin: 'core',
      doc: '`(a + b) * c = a * c + b * c`',
      source: `theorem Nat.add_mul (a b c : Nat) : (a + b) * c = a * c + b * c := by
  rw [Nat.mul_comm, Nat.mul_add, Nat.mul_comm c a, Nat.mul_comm c b]`,
    },
    {
      name: 'Nat.mul_assoc',
      origin: 'core',
      doc: '`(a * b) * c = a * (b * c)`',
      source: `theorem Nat.mul_assoc (a b c : Nat) : a * b * c = a * (b * c) := by
  induction c with
  | zero => rfl
  | succ k ih => rw [Nat.mul_succ, Nat.mul_succ, Nat.mul_add, ih]`,
    },
    {
      name: 'Nat.two_mul',
      origin: 'core',
      doc: '`2 * n = n + n`',
      source: `theorem Nat.two_mul (n : Nat) : 2 * n = n + n := by
  rw [Nat.succ_mul, Nat.one_mul]`,
    },
  ],
};
