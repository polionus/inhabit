import type { World } from '../types.ts';

export const world: World = {
  id: 'forge',
  title: 'Formalization Forge',
  tagline: 'State and prove your own theorem',
  intro: `You can prove things now. This world teaches what comes *before* the proof: turning an idea into a precise Lean statement.

You will learn a five-step workflow (Say it, Type it, Define it, State it, Prove it), practice each step on small examples, plan proofs with \`sorry\`, read error messages instead of fearing them, and finish by formalizing and proving a theorem on your own. Every tactic and every lemma you earned is available.`,
  requires: ['fun', 'num'],
  bigIdea:
    'Formalizing is a design task with a repeatable procedure: choose the types, write the definitions, state hypotheses and conclusion precisely, and only then prove. The statement is a type, and the proof is a term inhabiting it.',
  levels: [
    // 01
    {
      id: 'forge-01',
      kind: 'choice',
      title: 'Five steps, one theorem',
      intro: `A formalization is a small project, and every project runs the same five steps:

1. **Say it**: the statement in careful English.
2. **Type it**: what are the objects, and what type does each have?
3. **Define it**: name any notion the library lacks.
4. **State it**: hypotheses as arguments, conclusion as the type.
5. **Prove it**: skeleton first, then fill, reading every error.

Below, one theorem is taken through all five steps; each comment says which step it belongs to. Read it, then answer.`,
      code: `-- 1. Say it: for all a, b, c: if a divides b, then a divides b * c.
-- 2. Type it: a, b and c are natural numbers.
-- 3. Define it: nothing new; ∣ is already in the library.
-- 4. State it: the "if" is a hypothesis, the "then" is the conclusion.
theorem dvd_mul_of_dvd (a b c : Nat) (h : a ∣ b) : a ∣ b * c := by
  -- 5. Prove it: b divides b * c, and divisibility chains.
  exact Nat.dvd_trans h (Nat.dvd_mul_right b c)`,
      question: 'Step 2 (Type it) comes before step 4 (State it). Why must it be in that order?',
      options: [
        {
          text: 'The claim `a ∣ b` only makes sense once `a` and `b` have types, so the types must be fixed before the claim can be written.',
          correct: true,
          feedback:
            'Yes. A statement is built out of typed objects: change `a b : Nat` to something else and `a ∣ b` means something different, or nothing at all.',
        },
        {
          text: 'The order does not matter; the steps are only a checklist.',
          feedback:
            'You may loop back (writing the statement often shows that a type was wrong), but each step uses the output of the one before. A statement cannot mention objects you have not typed.',
        },
        {
          text: 'Lean needs the types only to speed up the proof in step 5.',
          feedback:
            'Types are part of the *meaning* of the statement, not a hint to the prover. `n : Nat` and `n : Int` give different theorems.',
        },
        {
          text: 'Without declared types Lean assumes everything is a `Prop`.',
          feedback:
            'Lean does not guess. An unknown name is an error, and a name whose type Lean can only half infer often becomes a statement you did not intend.',
        },
      ],
      outro: `The five steps are a procedure you can run on any statement, and when you are stuck you can ask *which step am I on?* Notice what steps 4 and 5 are in type-theory terms: step 4 writes a type, step 5 finds a term that inhabits it.`,
      unlocks: { codex: ['workflow', 'say-it'] },
    },
    // 02
    {
      id: 'forge-02',
      kind: 'choice',
      title: 'Type it',
      intro: `Step 2: decide what *kind of thing* each object is. A quick guide:

- a number: \`n : Nat\`
- a collection of \`α\`s: \`A : Set α\`
- a rule sending \`α\`s to \`β\`s: \`f : α → β\`
- a property of \`α\`s: \`P : α → Prop\`
- a proof you are *given*: a hypothesis \`h : …\`

Hover over the \`#check\`: \`f '' A\` is a set of \`β\`s, not of \`α\`s. Then choose the binders for the statement below.`,
      code: `#check fun (α β : Type) (f : α → β) (A : Set α) => f '' A`,
      question:
        'The statement: "If A is contained in B, then the image of A under f is contained in the image of B." Which binders give every object its right type?',
      options: [
        {
          text: '`(α β : Type) (f : α → β) (A B : Set α)`',
          correct: true,
          feedback:
            'Yes. `f` maps elements to elements, `A` and `B` are sets of elements of `α`, and `f \'\' A` lands in `Set β`. Two type variables keep the statement as general as the English.',
        },
        {
          text: '`(α β : Type) (f : Set α → Set β) (A B : Set α)`',
          feedback:
            'Here `f` takes whole sets. But "the image of A under f" is a set *built from* `f` acting on elements; `f \'\' A` only makes sense when `f : α → β`.',
        },
        {
          text: '`(α β : Type) (f : α → β) (A B : α)`',
          feedback:
            'Then `A` and `B` are single elements, and `A ⊆ B` has no meaning. A "set of things" is `Set α`, not `α`.',
        },
        {
          text: '`(α : Type) (f : α → α) (A B : Set α)`',
          feedback:
            'This type-checks, but it only covers functions from a type to itself. The English allows `f` to go between different types, so you have proved less than you meant.',
        },
      ],
      outro: `Types are part of the statement, not decoration: \`f : α → β\` and \`f : Set α → Set β\` describe different objects. Everything in a statement is a term with a type, and the statement itself is a term whose type is \`Prop\`.`,
      unlocks: { codex: ['type-it'] },
    },
    // 03
    {
      id: 'forge-03',
      kind: 'formalize',
      title: 'State it: hypotheses and conclusion',
      english: 'If f is injective, then the preimage of the image of A is contained in A.',
      intro: `Step 4: an English "if … then" has two parts. The *hypotheses* are what you are given; the *conclusion* is what you must show. In a \`theorem\` the hypotheses become arguments before the colon; here, in a bare proposition, they become premises of \`→\`.

Mark the "if" and the "then" in the sentence first, then write the proposition. The binders are already set.`,
      binders: '(α β : Type) (f : α → β) (A : Set α)',
      accept: ['Function.Injective f → f ⁻¹\' (f \'\' A) ⊆ A'],
      mistakes: [
        {
          statement: 'Function.Injective f ∧ f ⁻¹\' (f \'\' A) ⊆ A',
          feedback:
            'A `∧` *asserts* both parts, so this claims that `f` is injective. The "if" part is something you are given, not something you claim: use `→`.',
        },
        {
          statement: 'f ⁻¹\' (f \'\' A) ⊆ A → Function.Injective f',
          feedback:
            'The implication runs the wrong way: this makes the inclusion a hypothesis and injectivity the conclusion. The hypothesis is the "if" part of the English.',
        },
        {
          statement: 'f ⁻¹\' (f \'\' A) ⊆ A',
          feedback:
            'The hypothesis is missing. Without injectivity this is false: a function that sends two points to the same value breaks it.',
        },
        {
          statement: 'A ⊆ f ⁻¹\' (f \'\' A)',
          feedback:
            'That is the opposite inclusion (you proved it in the Fjord). It holds for every function, so it does not need, or use, injectivity.',
        },
        {
          statement: 'Function.Surjective f → f ⁻¹\' (f \'\' A) ⊆ A',
          feedback:
            'Right shape, wrong hypothesis. Surjectivity says every point of `β` is hit; the inclusion fails when two points of `α` collide, which is exactly what injectivity rules out.',
        },
      ],
      hints: [
        { text: 'Which step are you on? Say it first: what is the "if", and what is the "then"?' },
        { text: 'The "if" is the single fact `Function.Injective f`. The "then" is an inclusion `_ ⊆ A` between two sets.' },
        { text: 'For the set on the left, work inside out: first the image of `A` under `f`, then the preimage of that set under `f`.' },
        { text: 'The shape is `Function.Injective f → (the inclusion)`.' },
      ],
      outro: `Hypotheses go in, the conclusion comes out: \`H → C\`, never \`H ∧ C\`. Drop the hypothesis, flip the arrow or reorder the operations and you state something else. In a theorem header the same hypothesis sits before the colon: \`(hf : Function.Injective f) : …\`. Either way a proof is a function from proofs of \`H\` to proofs of \`C\`.`,
      unlocks: { codex: ['hyp-vs-concl'] },
    },
    // 04
    {
      id: 'forge-04',
      kind: 'formalize',
      title: 'State it: odd plus odd',
      english: 'The sum of two odd numbers is even.',
      intro: `Step 1 is careful reading. "The sum of two odd numbers" hides two things: there are *two* numbers, and the claim is about *all* of them, so each gets its own \`∀\` variable.

Mark every "any", "some" and "if". Then write it with explicit binders \`∀ m n : Nat, …\`. \`Odd\` and \`Even\` are the predicates from the Dunes.`,
      accept: [
        '∀ m n : Nat, Odd m → Odd n → Even (m + n)',
        '∀ m n : Nat, Odd m ∧ Odd n → Even (m + n)',
        '∀ m : Nat, Odd m → ∀ n : Nat, Odd n → Even (m + n)',
      ],
      mistakes: [
        {
          statement: '∀ m n : Nat, Odd m → Odd n → Odd (m + n)',
          feedback: 'Test a small case: 1 + 1 = 2 is even, not odd. The conclusion of the English is "even".',
        },
        {
          statement: '∀ m n : Nat, Even (m + n) → Odd m ∧ Odd n',
          feedback:
            'This is the converse, and it is false: 2 + 2 is even, yet 2 is not odd. The odd numbers are the *hypothesis*.',
        },
        {
          statement: '∃ m n : Nat, Odd m ∧ Odd n ∧ Even (m + n)',
          feedback:
            '`∃` says an example exists (1 and 1 would do). "The sum of two odd numbers" is a claim about every pair, so it needs `∀`.',
        },
        {
          statement: '∀ m : Nat, Odd m → Odd m → Even (m + m)',
          feedback:
            'One variable used twice only covers adding an odd number to itself. Two (possibly different) numbers need two variables.',
        },
        {
          statement: '∀ m n : Nat, Odd m ∧ Odd n ∧ Even (m + n)',
          feedback:
            'Here `∧` asserts that *every* pair of numbers is odd and has an even sum. Conditions you are given go before an arrow, under the `∀`.',
        },
      ],
      hints: [
        { text: 'Say it first: how many numbers are there, and does the sentence talk about some of them or all of them?' },
        { text: 'Two numbers, all of them: `∀ m n : Nat, …`. What are you given about `m` and `n`, and what do you conclude about `m + n`?' },
        { text: 'Given: `Odd m` and `Odd n`. Conclude: `Even (m + n)`. Join the conditions to the conclusion with arrows.' },
      ],
      outro: `Rules of thumb: "any", "every", "the" become \`∀\`, and a condition on the variable becomes \`→\`; "there is", "some" become \`∃\`, with \`∧\`. Each distinct object needs its own variable. The forms \`A → B → C\` and \`A ∧ B → C\` are two ways to feed a function two arguments (currying).`,
    },
    // 05
    {
      id: 'forge-05',
      kind: 'formalize',
      title: 'State it: if and only if',
      english: 'A is a subset of B if and only if the intersection of A and B equals A.',
      intro: `"X if and only if Y" is two claims at once: \`X → Y\` and \`Y → X\`. Lean has one connective for it, \`↔\`, and a proof of it is a pair of functions.

Before typing, name the two sides: which sets appear on each? Careful with \`∪\` and \`∩\`, and with which letter ends up on the right of \`=\`. The binders are set.`,
      binders: '(α : Type) (A B : Set α)',
      accept: ['A ⊆ B ↔ A ∩ B = A', 'A ∩ B = A ↔ A ⊆ B'],
      mistakes: [
        {
          statement: 'A ⊆ B → A ∩ B = A',
          feedback: 'That is one direction only. "If and only if" also needs `A ∩ B = A → A ⊆ B`; use `↔` to say both.',
        },
        {
          statement: 'A ⊆ B ∧ A ∩ B = A',
          feedback:
            'A `∧` claims both facts hold for these particular sets. "If and only if" says the two facts are *equivalent*, whatever `A` and `B` are.',
        },
        {
          statement: 'A ⊆ B ↔ A ∪ B = A',
          feedback:
            'Wrong operation. `A ∪ B = A` holds exactly when `B ⊆ A`, not `A ⊆ B`. The English has the intersection.',
        },
        {
          statement: 'A ⊆ B ↔ A ∩ B = B',
          feedback:
            'Wrong set on the right. `A ∩ B = B` holds exactly when `B ⊆ A`. Test it with `A = {1}` and `B = {1, 2}`.',
        },
      ],
      hints: [
        { text: 'Which step are you on? Say it: split the sentence at "if and only if". What is each side?' },
        { text: 'Left side: `A ⊆ B`. Right side: an equation between sets with `∩` in it.' },
        { text: 'Connect the two sides with `↔`, which you type as `\\iff`.' },
      ],
      outro: `\`↔\` bundles both directions into one proposition. A sanity check that catches most mistakes here: test with tiny sets, \`A = {1}\`, \`B = {1, 2}\`, and swap them. Also notice that \`⊆\` is a statement (\`Prop\`) while \`A ∩ B\` is a set: \`=\` joins two sets, \`↔\` joins two statements.`,
    },
    // 06
    {
      id: 'forge-06',
      kind: 'formalize',
      title: 'State it: where the "not" goes',
      english: 'No natural number is both even and odd.',
      intro: `Where does the "no" go? "No \`x\` has property \`P\`" means "there is no \`x\` with \`P\`": negate the whole \`∃\`. Equivalently, "every \`x\` fails \`P\`", which you proved equivalent in the Quay.

The danger is negating the wrong piece. Read your Lean back aloud and ask what is *under* the \`¬\`. No binders needed.`,
      accept: [
        '¬∃ n : Nat, Even n ∧ Odd n',
        '∀ n : Nat, ¬(Even n ∧ Odd n)',
        '∀ n : Nat, Even n → ¬Odd n',
        '∀ n : Nat, Odd n → ¬Even n',
      ],
      mistakes: [
        {
          statement: '∀ n : Nat, ¬Even n ∧ ¬Odd n',
          feedback:
            'This says every number is *neither* even nor odd, which is false for every `n`. The "not" belongs on the combination "even and odd", not on each part.',
        },
        {
          statement: '∀ n : Nat, Even n → Odd n',
          feedback: 'This says every even number is odd: the "no" has disappeared. The English excludes the overlap.',
        },
        {
          statement: '∃ n : Nat, ¬(Even n ∧ Odd n)',
          feedback:
            'This says *some* number is not both, which is trivially true (take 0) and says nothing about the others. "No number" is a statement about all of them.',
        },
        {
          statement: '¬∀ n : Nat, Even n ∧ Odd n',
          feedback:
            'This says only that *not every* number is both even and odd. "No number" is far stronger: it rules out every single one.',
        },
      ],
      hints: [
        { text: 'Say it differently: "there is no number such that …" or "for every number, it is not the case that …". What is inside the "…"?' },
        { text: 'The thing that must not happen is the *conjunction* `Even n ∧ Odd n`. Put the negation outside it.' },
        { text: 'Either `¬∃ n : Nat, …` or `∀ n : Nat, ¬(…)`; both are accepted.' },
      ],
      outro: `\`¬∃ n, …\`, \`∀ n, ¬(…)\` and \`∀ n, Even n → ¬Odd n\` are three spellings of one claim. The scope of a negation is the commonest formalization bug, along with quantifier order, \`∧\` versus \`→\`, a missing hypothesis and a reversed implication: all five are in your Codex now.`,
      unlocks: { codex: ['pitfalls'] },
    },
    // 07
    {
      id: 'forge-07',
      kind: 'proof',
      mode: 'term',
      title: 'Define it',
      english: 'Define `IsSquare n`: the number `n` is a square, meaning `n = k * k` for some `k`.',
      intro: `Step 3: when a notion is not in the library, give it a name with \`def\`. In Lean a property is a *predicate*, a function into \`Prop\`. The right-hand side says what the property means.

The header is written. Complete the definition: \`n\` is a square when \`n = k * k\` for some \`k\`. The tests below your code check that \`IsSquare 9\` is provable and that \`IsSquare n\` unfolds to \`∃ k, n = k * k\`.`,
      header: 'def IsSquare (n : Nat) : Prop :=',
      starter: '  sorry',
      after: `example : IsSquare 9 := ⟨3, rfl⟩
example (m : Nat) : IsSquare (m * m) := ⟨m, rfl⟩
example (n : Nat) (h : IsSquare n) : ∃ k, n = k * k := h`,
      solutions: ['  ∃ k, n = k * k'],
      hints: [
        { text: 'Which step are you on? A definition of a property is a *statement* about `n`. Say it in English first: "there is a `k` such that …".' },
        { text: 'The body must be a `Prop` that mentions `n`. Which quantifier says "there is a `k`"?' },
        { text: 'Write `∃ k, ` followed by an equation between `n` and an expression in `k`.' },
      ],
      outro: `A definition names a proposition. \`IsSquare 9\` is not a new kind of thing: it *unfolds* to \`∃ k, 9 = k * k\`, which is why \`⟨3, rfl⟩\` proves it. That is also how \`Even\` and \`Odd\` work. Defining before stating keeps statements short; the price is that you may need to \`unfold\` it when proving.`,
      unlocks: { codex: ['def-predicate'] },
    },
    // 08
    {
      id: 'forge-08',
      kind: 'proof',
      mode: 'tactic',
      showTerm: true,
      title: 'Use your definition',
      english: 'If f is idempotent (f (f x) = f x for every x), then applying f three times is the same as applying it once.',
      intro: `Here is a definition of a property of functions, already supplied:

\`def Idempotent (f : Nat → Nat) : Prop := ∀ x, f (f x) = f x\`

Now steps 4 and 5 with it. The statement mentions \`Idempotent f\` and stays short; in the proof you *unfold* it, exactly as you unfolded \`Function.Surjective\`. The first lines are written. Finish by rewriting.`,
      setup: 'def Idempotent (f : Nat → Nat) : Prop := ∀ x, f (f x) = f x\n\n',
      header:
        'theorem idem_three (f : Nat → Nat) (h : Idempotent f) : ∀ x, f (f (f x)) = f x := by',
      starter: `  intro x
  unfold Idempotent at h
  sorry`,
      solutions: [
        `  intro x
  unfold Idempotent at h
  rw [h (f x), h x]`,
        `  intro x
  rw [h (f x), h x]`,
        `  intro x
  calc f (f (f x)) = f (f x) := h (f x)
    _ = f x := h x`,
      ],
      hints: [
        { text: 'After `unfold`, read `h` as a sentence: for every `y`, `f (f y) = f y`. Which `y` helps with `f (f (f x))`?' },
        { text: 'Take `y := f x`: `h (f x)` says `f (f (f x)) = f (f x)`. Rewrite with it, then see what is left.' },
        { text: '`rw [h (f x)]` leaves `f (f x) = f x`. One more instance of `h` finishes it.' },
      ],
      outro: `\`h (f x)\` worked because \`Idempotent f\` *is* a \`∀\` once unfolded: your own definitions behave exactly like the library's. The proof term is a chain of two equations. A definition is a name for a proposition, never a new axiom.`,
    },
    // 09
    {
      id: 'forge-09',
      kind: 'proof',
      mode: 'tactic',
      title: 'Skeleton first',
      english: 'If A ⊆ B and C ⊆ D, then A ∩ C ⊆ B ∩ D.',
      intro: `Step 5 starts with a *plan*. \`have h : T := by sorry\` states an intermediate claim and promises to prove it later. Lean checks that the claims fit together even while the holes are open, and warns "declaration uses sorry".

Below, the skeleton and the final assembly are written. Fill each \`sorry\`, one at a time. At every moment you know exactly what is left.`,
      header:
        'theorem inter_mono {α : Type} (A B C D : Set α) (hAB : A ⊆ B) (hCD : C ⊆ D) : A ∩ C ⊆ B ∩ D := by',
      starter: `  intro x hx
  have h1 : x ∈ A := by sorry
  have h2 : x ∈ C := by sorry
  have h3 : x ∈ B := by sorry
  have h4 : x ∈ D := by sorry
  exact ⟨h3, h4⟩`,
      solutions: [
        `  intro x hx
  have h1 : x ∈ A := by exact hx.1
  have h2 : x ∈ C := by exact hx.2
  have h3 : x ∈ B := by exact hAB h1
  have h4 : x ∈ D := by exact hCD h2
  exact ⟨h3, h4⟩`,
        `  intro x hx
  have h1 : x ∈ A := hx.1
  have h2 : x ∈ C := hx.2
  have h3 : x ∈ B := hAB h1
  have h4 : x ∈ D := hCD h2
  exact ⟨h3, h4⟩`,
      ],
      hints: [
        { text: 'Take the holes in order. For each, ask: which hypothesis, or which earlier `have`, already says this?' },
        { text: '`hx : x ∈ A ∩ C` is a pair. Its two components are `hx.1` and `hx.2`.' },
        { text: 'A `⊆` hypothesis is a function: `hAB h1 : x ∈ B` when `h1 : x ∈ A`.' },
      ],
      outro: `The skeleton type-checked before a single hole was filled. That is what makes it a planning tool: the shape of the argument is verified first, and each hole is a small independent task. Write the skeleton, check it compiles, then fill in the holes. If a hole turns out to be false, you find out before you have invested in the rest.`,
      unlocks: { codex: ['skeleton'] },
    },
    // 10
    {
      id: 'forge-10',
      kind: 'proof',
      mode: 'tactic',
      title: 'Read the error: what did Lean expect?',
      english: 'If f is injective and f maps A into the image of B, then A ⊆ B.',
      intro: `The proof below is plausible but broken. Lean's message has three parts. **Where**: the line and the text it underlines. **Expected**: the type it wanted. **Got**: the type you gave. Read them in that order, then ask which of *your* beliefs about the types was wrong.

Run it, read the error, and repair the proof. Do not guess: say out loud what Lean expected and what \`hx\` is.`,
      header:
        'theorem image_sub_of_inj {α β : Type} (f : α → β) (A B : Set α) (hf : Function.Injective f) (h : f \'\' A ⊆ f \'\' B) : A ⊆ B := by',
      starter: `  intro x hx
  obtain ⟨y, hy, hyx⟩ := h hx
  have hxy : y = x := hf hyx
  rw [hxy] at hy
  exact hy`,
      solutions: [
        `  intro x hx
  obtain ⟨y, hy, hyx⟩ := h ⟨x, hx, rfl⟩
  have hxy : y = x := hf hyx
  rw [hxy] at hy
  exact hy`,
        `  intro x hx
  have hfx : f x ∈ f '' A := ⟨x, hx, rfl⟩
  obtain ⟨y, hy, hyx⟩ := h hfx
  have hxy : y = x := hf hyx
  rw [hxy] at hy
  exact hy`,
      ],
      hints: [
        { text: 'Which step are you on? Read the error: *where* is it, what was *expected*, what did you *give*?' },
        { text: '`h` is a statement about membership in `f \'\' A`. What does `hx` say membership in?' },
        { text: 'To use `h` you need a proof that *something* lies in `f \'\' A`. Which element of `f \'\' A` can you build from `x`, and what is its proof?' },
        { text: 'The element is `f x`, and `⟨x, hx, rfl⟩ : f x ∈ f \'\' A`. Pass that to `h`.' },
      ],
      outro: `The mistake was confusing \`x ∈ A\` with \`f x ∈ f '' A\`: a hypothesis about the wrong object. "Expected \`?a ∈ f '' A\`, got \`x ∈ A\`" pointed straight at it. When a type mismatch appears, compare the two types symbol by symbol; the difference is the misunderstanding.`,
      unlocks: { codex: ['read-errors'] },
    },
    // 11
    {
      id: 'forge-11',
      kind: 'proof',
      mode: 'tactic',
      showTerm: true,
      title: 'Read the error: where is the pattern?',
      english: 'If f a = b and f b = a, then f (f a) = a.',
      intro: `A second kind of error. \`rw [h]\` rewrites the left-hand side of \`h\` to its right-hand side, and the left-hand side must *literally appear in the goal as it is right now*, after any earlier rewrites. If not, Lean prints the pattern it looked for and the goal it searched.

Run the proof, compare the pattern with the goal, and fix it. Which rewrite makes the other one possible?`,
      header:
        'theorem two_steps (f : Nat → Nat) (a b : Nat) (h1 : f a = b) (h2 : f b = a) : f (f a) = a := by',
      starter: '  rw [h2, h1]',
      solutions: ['  rw [h1, h2]', '  calc f (f a) = f b := congrArg f h1\n    _ = a := h2'],
      hints: [
        { text: 'Read the error: what pattern did `rw` look for, and does it occur in `f (f a) = a`?' },
        { text: 'The goal contains `f a` inside `f (f a)`. Which hypothesis has `f a` on its left-hand side?' },
        { text: 'Rewrite with that hypothesis first; the result has a shape the other hypothesis can use.' },
      ],
      outro: `Rewriting is order-sensitive: the first rewrite created the \`f b\` that the second needed. "Did not find an occurrence of the pattern" always means that the left-hand side is absent *from the current goal*. Print the goal, look for the pattern with your eyes, and decide whether to reorder, change direction with \`←\`, or rewrite elsewhere.`,
    },
    // 12
    {
      id: 'forge-12',
      kind: 'proof',
      mode: 'tactic',
      title: 'Doing things to every goal',
      english: 'If P, Q and R hold, then (P ∧ Q) ∧ R holds.',
      intro: `Three small conveniences, never required:

- \`all_goals t\` runs \`t\` on *every* open goal.
- \`try t\` runs \`t\` and, if it fails, quietly does nothing.
- \`repeat t\` runs \`t\` again and again until it fails.

The proof starts by splitting. The second line fails: one goal, \`R\`, cannot be split. Wrap it so the failure is harmless, then close all remaining goals at once.`,
      header: 'theorem nested_and (P Q R : Prop) (hp : P) (hq : Q) (hr : R) : (P ∧ Q) ∧ R := by',
      starter: `  constructor
  all_goals constructor
  sorry`,
      solutions: [
        `  constructor
  all_goals try constructor
  all_goals assumption`,
        `  constructor
  · constructor
    · exact hp
    · exact hq
  · exact hr`,
      ],
      hints: [
        { text: 'Read the error on line 2: which goal made `constructor` fail, and why?' },
        { text: 'You want `constructor` on the goals where it works and nothing on the others. Which combinator means "or do nothing"?' },
        { text: '`all_goals try constructor` leaves the goals `P`, `Q`, `R`. Then one more `all_goals`.' },
      ],
      unlocks: { tactics: ['all_goals', 'try', 'repeat'], codex: ['all_goals', 'try', 'repeat'] },
      outro: `These are conveniences: the long proof in the second solution does the same. They reduce repetition when many goals look alike, and \`try\` is the standard way to say "if this applies". Watch out for \`repeat\`: it acts on the first goal, and stops as soon as that goal fails.`,
    },
    // 13
    {
      id: 'forge-13',
      kind: 'proof',
      mode: 'tactic',
      boss: true,
      title: 'Boss: your own theorem',
      english: 'The image of a union is the union of the images.',
      intro: `This time you run all five steps yourself, with only a comment skeleton.

**Say it**: the image of a union is the union of the images. **Type it**: \`f : α → β\`, \`A B : Set α\`. **Define it**: nothing. **State it**: write the equation with \`f '' (A ∪ B)\` on the left, keeping the binders as given. **Prove it**: skeleton first, read every error.

Below your theorem, a test checks that you stated what was asked.`,
      header: '-- Final project: write the whole theorem yourself, statement and proof.',
      starter: `-- Say it: the image of a union is the union of the images.
-- Type it: f sends α to β; A and B are sets of α.
-- Define it: nothing new.
-- State it: replace the underscore by your statement.
theorem image_union (α β : Type) (f : α → β) (A B : Set α) :
    _ := by
  -- Prove it: skeleton first!
  sorry`,
      after: `example (α β : Type) (f : α → β) (A B : Set α) : f '' (A ∪ B) = f '' A ∪ f '' B :=
  image_union α β f A B`,
      solutions: [
        `theorem image_union (α β : Type) (f : α → β) (A B : Set α) :
    f '' (A ∪ B) = f '' A ∪ f '' B := by
  ext y
  constructor
  · intro h
    obtain ⟨x, hx, hxy⟩ := h
    cases hx with
    | inl ha =>
      left
      exact ⟨x, ha, hxy⟩
    | inr hb =>
      right
      exact ⟨x, hb, hxy⟩
  · intro h
    cases h with
    | inl h1 =>
      obtain ⟨x, hx, hxy⟩ := h1
      exact ⟨x, Or.inl hx, hxy⟩
    | inr h2 =>
      obtain ⟨x, hx, hxy⟩ := h2
      exact ⟨x, Or.inr hx, hxy⟩`,
      ],
      hints: [
        { text: 'Which step are you on? State it first: an equation between two sets of `β`, image of a union on the left. Make the statement compile with `sorry` before proving anything.' },
        { text: 'Set equality: start with `ext y` and split the `↔`. Membership in an image is an `∃`, and membership in a union is an `∨`.' },
        { text: 'Forward: take the `∃` apart, then `cases` the `∨` on the witness, and rebuild the `∃` on the side you are in. Backward: `cases` first.' },
        { text: 'Skeleton: `ext y`, `constructor`, then per direction `intro h`, `obtain`, `cases`, `exact ⟨x, _, hxy⟩` with `Or.inl`/`Or.inr` or `left`/`right`.' },
      ],
      outro: `You ran the whole procedure: said it, typed it, stated it, proved it. The proof used sets, a function, \`∃\` and \`∨\` together, and it is \`Set.image_union\` in Mathlib. Now do it with a statement of your own: the Workshop suggests theorems and keeps yours. When you want automation and a vast library, the Graduate guide shows the way to real Lean.`,
    },
  ],
  codex: [
    {
      id: 'workflow',
      kind: 'concept',
      name: 'The five-step workflow',
      summary: 'Say it, Type it, Define it, State it, Prove it: the procedure for formalizing any statement.',
      body: `1. **Say it**: the statement in careful English; mark every "for all", "there exists", "if … then".
2. **Type it**: give every object a type: \`n : Nat\`, \`A : Set α\`, \`f : α → β\`, \`P : α → Prop\`.
3. **Define it**: turn any notion the library lacks into a \`def\`, usually a predicate.
4. **State it**: hypotheses as arguments, conclusion as the type; read it back in English.
5. **Prove it**: skeleton first (\`have … := by sorry\`), then fill; read every error.

When stuck, ask: *which step am I on?*`,
      example: `theorem dvd_mul_of_dvd (a b c : Nat) (h : a ∣ b) : a ∣ b * c :=
  Nat.dvd_trans h (Nat.dvd_mul_right b c)`,
      mathlib: 'The same procedure applies in Mathlib; step 3 starts with searching for an existing definition.',
    },
    {
      id: 'say-it',
      kind: 'concept',
      name: 'Step 1: Say it',
      summary: 'Write the statement in careful English and mark the quantifiers and connectives.',
      body: `Before any Lean, write the claim as a sentence and mark the logical words:

- "every", "any", "for all" → \`∀\`, with conditions as \`→\`
- "some", "there is" → \`∃\`, with conditions as \`∧\`
- "if … then" → \`→\`; "A and B" → \`∧\`; "A or B" → \`∨\`
- "not", "no" → \`¬\`
- "if and only if" → \`↔\`

Then test the sentence on a tiny example. A sentence you cannot test is not yet precise.`,
      example: `#check ∀ n : Nat, 4 ∣ n → Even n`,
    },
    {
      id: 'type-it',
      kind: 'concept',
      name: 'Step 2: Type it',
      summary: 'Decide what kind of thing each object is before writing the statement.',
      body: `| English | Lean |
| --- | --- |
| a number | \`n : Nat\` |
| a set of \`α\`s | \`A : Set α\` |
| a function from \`α\` to \`β\` | \`f : α → β\` |
| a property of \`α\`s | \`P : α → Prop\` |
| a relation on \`α\` | \`R : α → α → Prop\` |
| a fact you may assume | \`h : …\` |

Use type variables (\`α β : Type\`) when the English does not fix the type; this keeps the statement general.`,
      example: `#check fun (α β : Type) (f : α → β) (A : Set α) => f '' A`,
    },
    {
      id: 'hyp-vs-concl',
      kind: 'concept',
      name: 'Hypotheses versus conclusion',
      summary: 'What you are given becomes arguments; what you must show is the type after the colon.',
      body: `In "if H then C", \`H\` is a **hypothesis** and \`C\` the **conclusion**:

\`theorem name (x : T) (h : H) : C\`

The arguments before the colon are what you may use; the type after the colon is what you must build. \`(h : H) : C\` and \`: H → C\` are the same statement, and \`intro h\` moves one into the other. A conjunction \`H ∧ C\` is something else: it *claims* \`H\`.

Check: if a hypothesis is missing, is the statement still true?`,
      example: `theorem inj_of_left_inverse (α β : Type) (f : α → β) (g : β → α) (h : Function.LeftInverse g f) : Function.Injective f :=
  Function.LeftInverse.injective h`,
    },
    {
      id: 'pitfalls',
      kind: 'concept',
      name: 'Common formalization pitfalls',
      summary: 'Five mistakes that account for most wrong statements.',
      body: `Check each before proving:

1. **Quantifier order**: \`∀ x, ∃ y\` is not \`∃ y, ∀ x\`.
2. **\`∧\` versus \`→\`**: under \`∀\` use \`→\` for conditions; under \`∃\` use \`∧\`.
3. **Missing hypothesis**: the statement may be false without it.
4. **Wrong direction**: \`P → Q\` is not \`Q → P\`; for "iff" use \`↔\`.
5. **Scope of \`¬\`**: say the negated sentence aloud and ask what is under the \`¬\`.

Also: one variable per object, and test the statement on a small example.`,
      example: `#check ∀ x : Nat, ∃ y : Nat, x = y
#check ∃ y : Nat, ∀ x : Nat, x = y`,
    },
    {
      id: 'def-predicate',
      kind: 'concept',
      name: 'Definitions are predicates',
      summary: 'A `def` names a proposition (or any term); using it unfolds to its body.',
      body: `\`def IsSquare (n : Nat) : Prop := ∃ k, n = k * k\` defines a *predicate*: a function \`Nat → Prop\`. \`IsSquare 9\` is a proposition, which unfolds to \`∃ k, 9 = k * k\`.

To **prove** \`IsSquare 9\`, give the witness: \`⟨3, rfl⟩\`. To **use** \`h : IsSquare n\`, take it apart with \`obtain ⟨k, hk⟩ := h\`, or \`unfold IsSquare at h\` first. A definition adds no axioms: it only gives a name.`,
      example: `def IsSquare (n : Nat) : Prop := ∃ k, n = k * k
example : IsSquare 9 := ⟨3, rfl⟩`,
      mathlib: 'Mathlib often already has the notion (e.g. `IsSquare`, `Even`). Search before you define.',
    },
    {
      id: 'skeleton',
      kind: 'concept',
      name: 'Prove it: skeleton first',
      summary: '`have … := by sorry` plans a proof: the shape is checked before the details exist.',
      body: `Write the proof's *shape* before its details:

\`\`\`lean
theorem demo (P Q R : Prop) (hpq : P → Q) (hqr : Q → R) (hp : P) : R := by
  have hq : Q := by sorry
  exact hqr hq
\`\`\`

Lean accepts this with a warning "declaration uses sorry". Each \`sorry\` is a small goal to fill; if one turns out to be false, you find out early. A finished proof has no \`sorry\`.`,
    },
    {
      id: 'read-errors',
      kind: 'concept',
      name: 'Reading an error',
      summary: 'Where is it, what did Lean expect, what did it get?',
      body: `Read Lean's message in this order:

1. **Where**: which line, and which piece of text is underlined.
2. **Expected**: the type Lean wanted.
3. **Got**: the type of what you wrote.

Then compare the two types symbol by symbol. The difference is the misunderstanding. For \`rw\`, "did not find the pattern" means the left-hand side is absent from the *current* goal: compare the pattern with the goal printed below it. Unsolved goals list exactly what is left to prove.`,
    },
    {
      id: 'all_goals',
      kind: 'tactic',
      name: 'all_goals',
      summary: 'Run a tactic on every open goal.',
      body: `\`all_goals t\` runs \`t\` on each goal in turn. If \`t\` fails on any of them, the whole \`all_goals\` fails. Use \`all_goals try t\` to skip goals where \`t\` does not apply.

Typical use: split with \`constructor\`, then close all pieces with \`all_goals assumption\`.`,
      example: `example (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := by
  constructor
  all_goals assumption`,
    },
    {
      id: 'try',
      kind: 'tactic',
      name: 'try',
      summary: 'Run a tactic; if it fails, do nothing.',
      body: `\`try t\` runs \`t\`, and if \`t\` fails the proof continues unchanged. It is the way to say "if this applies, do it".

Careful: \`try\` also hides real mistakes. If a line mysteriously does nothing, check whether a \`try\` swallowed an error.`,
      example: `example (P Q R : Prop) (hp : P) (hq : Q) (hr : R) : (P ∧ Q) ∧ R := by
  constructor
  all_goals try constructor
  all_goals assumption`,
    },
    {
      id: 'repeat',
      kind: 'tactic',
      name: 'repeat',
      summary: 'Run a tactic again and again until it fails.',
      body: `\`repeat t\` runs \`t\`, then runs it again on the resulting main goal, until \`t\` fails; it never fails itself. It acts on the *first* goal: after a split, it stops when the first goal cannot be split further.

Good for repeated rewriting.`,
      example: `example (f : Nat → Nat) (h : ∀ x, f x = x) : f (f (f 0)) = 0 := by
  repeat rw [h]`,
    },
  ],
  lemmas: [],
};
