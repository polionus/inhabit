import type { World } from '../types.ts';

export const world: World = {
  id: 'forge',
  title: 'Formalization Forge',
  tagline: 'State and prove your own theorem',
  intro: `You know how to prove things now. This world teaches what comes *before* the proof: turning a mathematical idea into a precise Lean statement.

You'll pick up a five-step workflow (Say it, Type it, Define it, State it, Prove it), practice each step on small examples, sketch proof outlines with \`sorry\`, learn to read error messages calmly, and wrap up by formalizing and proving a theorem from scratch. Every tactic and lemma you've earned is at your disposal.`,
  requires: ['fun', 'num'],
  bigIdea:
    'Formalizing is a design task with a repeatable workflow: pick the types, write the definitions, state the hypotheses and conclusion cleanly, and only then prove. The statement is a type, and the proof is a term inhabiting it.',
  levels: [
    // 01
    {
      id: 'forge-01',
      kind: 'choice',
      title: 'Five steps, one theorem',
      intro: `Formalizing a theorem is a small project, and every project follows the same five steps:

1. **Say it**: write the claim in clear English.
2. **Type it**: decide what the objects are and what type each one has.
3. **Define it**: name any concept the library doesn't already have.
4. **State it**: put the hypotheses in the arguments and the conclusion as the type.
5. **Prove it**: build the skeleton first, fill in the details, and read every error.

Below, one theorem walks through all five steps, with comments showing each stage. Read through it, then answer.`,
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
            'Yes. A statement is built out of typed objects—change `a b : Nat` to another type and `a ∣ b` either means something different or stops making sense.',
        },
        {
          text: 'The order does not matter; the steps are only a checklist.',
          feedback:
            'You can always loop back (writing the statement often reveals a type you got wrong), but each step builds on the previous one. You can\'t write a claim about objects you haven\'t typed yet.',
        },
        {
          text: 'Lean needs the types only to speed up the proof in step 5.',
          feedback:
            'Types are part of the *meaning* of the statement, not a performance hint. `n : Nat` and `n : Int` give genuinely different theorems.',
        },
        {
          text: 'Without declared types Lean assumes everything is a `Prop`.',
          feedback:
            'Lean doesn\'t guess. An unknown name is an error, and a name whose type Lean can only half infer often turns into a statement you didn\'t intend.',
        },
      ],
      outro: `Those five steps work on any statement, and whenever you're stuck you can pause and ask *which step am I on?* Notice what steps 4 and 5 really are in type theory: step 4 writes down a type, and step 5 builds a term that inhabits it.`,
      unlocks: { codex: ['workflow', 'say-it'] },
    },
    // 02
    {
      id: 'forge-02',
      kind: 'choice',
      title: 'Type it',
      intro: `Step 2: decide what *kind of thing* each object is. Here's a quick cheat sheet:

- a number: \`n : Nat\`
- a collection of \`α\`s: \`A : Set α\`
- a rule mapping \`α\`s to \`β\`s: \`f : α → β\`
- a property of \`α\`s: \`P : α → Prop\`
- a proof you're *given*: a hypothesis \`h : …\`

Hover over the \`#check\`—notice that \`f '' A\` is a set of \`β\`s, not \`α\`s. Then pick the binders for the statement below.`,
      code: `#check fun (α β : Type) (f : α → β) (A : Set α) => f '' A`,
      question:
        'The statement: "If A is contained in B, then the image of A under f is contained in the image of B." Which binders give every object its right type?',
      options: [
        {
          text: '`(α β : Type) (f : α → β) (A B : Set α)`',
          correct: true,
          feedback:
            'Yes. `f` maps elements to elements, `A` and `B` are sets of elements of `α`, and `f \'\' A` lives in `Set β`. Using two type variables keeps the statement as general as the English.',
        },
        {
          text: '`(α β : Type) (f : Set α → Set β) (A B : Set α)`',
          feedback:
            'Here `f` takes whole sets. "The image of A under f" is a set *built from* `f` acting on elements, so `f \'\' A` only makes sense when `f : α → β`.',
        },
        {
          text: '`(α β : Type) (f : α → β) (A B : α)`',
          feedback:
            'That makes `A` and `B` single elements, so `A ⊆ B` doesn\'t even make sense. A set of `α`s has type `Set α`, not `α`.',
        },
        {
          text: '`(α : Type) (f : α → α) (A B : Set α)`',
          feedback:
            'This type-checks, but it restricts `f` to map a type into itself. The English lets `f` go between two different types, so you\'d be proving less than you meant to.',
        },
      ],
      outro: `Types are part of the statement itself, not decoration: \`f : α → β\` and \`f : Set α → Set β\` talk about completely different objects. Everything in a statement is a typed term, and the statement as a whole is a term of type \`Prop\`.`,
      unlocks: { codex: ['type-it'] },
    },
    // 03
    {
      id: 'forge-03',
      kind: 'formalize',
      title: 'State it: hypotheses and conclusion',
      english: 'If f is injective, then the preimage of the image of A is contained in A.',
      intro: `Step 4: an English "if … then" splits into two parts. The *hypotheses* are what you're given, and the *conclusion* is what you need to prove. In a \`theorem\` header, hypotheses sit as arguments before the colon; here, in a standalone proposition, they become premises of \`→\`.

Spot the "if" and the "then" in the sentence first, then write the proposition. The binders are already set.`,
      binders: '(α β : Type) (f : α → β) (A : Set α)',
      accept: ['Function.Injective f → f ⁻¹\' (f \'\' A) ⊆ A'],
      mistakes: [
        {
          statement: 'Function.Injective f ∧ f ⁻¹\' (f \'\' A) ⊆ A',
          feedback:
            'Using `∧` *asserts* both parts, so this claims that `f` is injective. The "if" clause is something you\'re given, not something you\'re claiming—use `→`.',
        },
        {
          statement: 'f ⁻¹\' (f \'\' A) ⊆ A → Function.Injective f',
          feedback:
            'The arrow is pointing backward: this turns the inclusion into a hypothesis and injectivity into the conclusion. The hypothesis is the "if" part of the English.',
        },
        {
          statement: 'f ⁻¹\' (f \'\' A) ⊆ A',
          feedback:
            'The hypothesis is missing. Without injectivity this claim is false—any function that sends two points to the same output breaks it.',
        },
        {
          statement: 'A ⊆ f ⁻¹\' (f \'\' A)',
          feedback:
            'That\'s the reverse inclusion (which you proved in Function Fjord). It holds for every function, so it neither needs nor uses injectivity.',
        },
        {
          statement: 'Function.Surjective f → f ⁻¹\' (f \'\' A) ⊆ A',
          feedback:
            'Right shape, wrong hypothesis. Surjectivity says every point of `β` gets hit, whereas this inclusion fails when two points of `α` collide—which is exactly what injectivity prevents.',
        },
      ],
      hints: [
        { text: 'Which step are you on? Say it first: what\'s the "if" part, and what\'s the "then" part?' },
        { text: 'The "if" is `Function.Injective f`, and the "then" is a subset claim `_ ⊆ A` between two sets.' },
        { text: 'For the set on the left, work inside out: first the image of `A` under `f`, then the preimage of that set under `f`.' },
        { text: 'The overall shape is `Function.Injective f → (the inclusion)`.' },
      ],
      outro: `Hypotheses go in and the conclusion comes out: \`H → C\`, never \`H ∧ C\`. Drop a hypothesis, flip the arrow, or swap the operations and you've stated a different claim. In a theorem header, the same hypothesis sits before the colon (\`(hf : Function.Injective f) : …\`), and either way a proof is a function from proofs of \`H\` to proofs of \`C\`.`,
      unlocks: { codex: ['hyp-vs-concl'] },
    },
    // 04
    {
      id: 'forge-04',
      kind: 'formalize',
      title: 'State it: odd plus odd',
      english: 'The sum of two odd numbers is even.',
      intro: `Step 1 is reading carefully. "The sum of two odd numbers" hides two details: there are *two* numbers, and the claim covers *all* pairs of them, so each gets its own \`∀\` variable.

Spot every "any", "some", and "if", then write the claim with explicit binders \`∀ m n : Nat, …\`. \`Odd\` and \`Even\` come from Divisor Dunes.`,
      accept: [
        '∀ m n : Nat, Odd m → Odd n → Even (m + n)',
        '∀ m n : Nat, Odd m ∧ Odd n → Even (m + n)',
        '∀ m : Nat, Odd m → ∀ n : Nat, Odd n → Even (m + n)',
      ],
      mistakes: [
        {
          statement: '∀ m n : Nat, Odd m → Odd n → Odd (m + n)',
          feedback: 'Try a tiny example: 1 + 1 = 2 is even, not odd. The English concludes "even".',
        },
        {
          statement: '∀ m n : Nat, Even (m + n) → Odd m ∧ Odd n',
          feedback:
            'That\'s the converse, and it\'s false: 2 + 2 is even, yet 2 isn\'t odd. Being odd is the *hypothesis*.',
        },
        {
          statement: '∃ m n : Nat, Odd m ∧ Odd n ∧ Even (m + n)',
          feedback:
            '`∃` only says some example exists (1 and 1 would do). "The sum of two odd numbers" is about every pair, so it needs `∀`.',
        },
        {
          statement: '∀ m : Nat, Odd m → Odd m → Even (m + m)',
          feedback:
            'Reusing one variable only covers adding an odd number to itself. Two possibly different numbers need two separate variables.',
        },
        {
          statement: '∀ m n : Nat, Odd m ∧ Odd n ∧ Even (m + n)',
          feedback:
            'Using `∧` here claims that *every* pair of numbers is odd and has an even sum. Conditions you\'re assuming go before an arrow, under the `∀`.',
        },
      ],
      hints: [
        { text: 'Say it first: how many numbers are involved, and does the claim cover some of them or all of them?' },
        { text: 'Two numbers, all of them: `∀ m n : Nat, …`. What are you given about `m` and `n`, and what do you conclude about `m + n`?' },
        { text: 'Given: `Odd m` and `Odd n`. Conclude: `Even (m + n)`. Connect the assumptions to the conclusion with arrows.' },
      ],
      outro: `Handy rules of thumb: "any", "every", and "the" become \`∀\` with conditions on \`→\`; "there is" and "some" become \`∃\` with conditions on \`∧\`. Give every distinct object its own variable. Both \`A → B → C\` and \`A ∧ B → C\` work—they're just two ways to pass two arguments to a function (currying).`,
    },
    // 05
    {
      id: 'forge-05',
      kind: 'formalize',
      title: 'State it: if and only if',
      english: 'A is a subset of B if and only if the intersection of A and B equals A.',
      intro: `"X if and only if Y" packs two claims together: \`X → Y\` and \`Y → X\`. Lean uses one connective for it, \`↔\`, whose proof is a pair of functions.

Before you type, check both sides carefully: which sets show up on each? Watch out for \`∪\` versus \`∩\`, and make sure the right letter sits on the right side of \`=\`. The binders are already set.`,
      binders: '(α : Type) (A B : Set α)',
      accept: ['A ⊆ B ↔ A ∩ B = A', 'A ∩ B = A ↔ A ⊆ B'],
      mistakes: [
        {
          statement: 'A ⊆ B → A ∩ B = A',
          feedback: 'That\'s only one direction. "If and only if" also needs `A ∩ B = A → A ⊆ B`, so use `↔` to capture both.',
        },
        {
          statement: 'A ⊆ B ∧ A ∩ B = A',
          feedback:
            'Using `∧` claims both facts hold for these particular sets. "If and only if" says the two facts are *equivalent*, whatever `A` and `B` are.',
        },
        {
          statement: 'A ⊆ B ↔ A ∪ B = A',
          feedback:
            'Wrong set operation: `A ∪ B = A` holds precisely when `B ⊆ A`, not `A ⊆ B`. The English asks for the intersection.',
        },
        {
          statement: 'A ⊆ B ↔ A ∩ B = B',
          feedback:
            'Wrong set on the right: `A ∩ B = B` holds precisely when `B ⊆ A`. Test it with `A = {1}` and `B = {1, 2}`.',
        },
      ],
      hints: [
        { text: 'Which step are you on? Say it out loud: split the sentence at "if and only if". What\'s on each side?' },
        { text: 'Left side: `A ⊆ B`. Right side: a set equation involving `∩`.' },
        { text: 'Join the two sides with `↔`, typed as `\\iff`.' },
      ],
      outro: `\`↔\` packages both directions into a single proposition. A quick sanity check that catches almost every slip here is testing tiny sets—try \`A = {1}\`, \`B = {1, 2}\`, then swap them. Notice too that \`⊆\` produces a proposition (\`Prop\`) while \`A ∩ B\` produces a set: \`=\` compares sets, and \`↔\` compares propositions.`,
    },
    // 06
    {
      id: 'forge-06',
      kind: 'formalize',
      title: 'State it: where the "not" goes',
      english: 'No natural number is both even and odd.',
      intro: `Where does the "no" go? "No \`x\` has property \`P\`" means "there isn't any \`x\` with \`P\`", so you negate the entire \`∃\`. Equivalently, "every \`x\` fails \`P\`", which you proved equivalent in Quantifier Quay.

The trap is negating the wrong piece. Read your Lean back out loud and check what sits *under* the \`¬\`. No binders needed.`,
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
            'This says every number is *neither* even nor odd, which is false for every `n`. The "not" applies to the combination "even and odd", not to each piece separately.',
        },
        {
          statement: '∀ n : Nat, Even n → Odd n',
          feedback: 'This says every even number is odd—the "no" vanished completely. The English rules out any overlap.',
        },
        {
          statement: '∃ n : Nat, ¬(Even n ∧ Odd n)',
          feedback:
            'This only says *some* number isn\'t both, which is trivially true (take 0) and says nothing about the rest. "No number" speaks about every number.',
        },
        {
          statement: '¬∀ n : Nat, Even n ∧ Odd n',
          feedback:
            'This only says *not every* number is both even and odd. "No number" is much stronger: it rules out every single one.',
        },
      ],
      hints: [
        { text: 'Rephrase it first: "there\'s no number such that …" or "for every number, it\'s not true that …". What goes inside the "…"?' },
        { text: 'What can\'t happen is the *conjunction* `Even n ∧ Odd n`. Put the negation outside it.' },
        { text: 'Either `¬∃ n : Nat, …` or `∀ n : Nat, ¬(…)` works—both are accepted.' },
      ],
      outro: `\`¬∃ n, …\`, \`∀ n, ¬(…)\`, and \`∀ n, Even n → ¬Odd n\` are three ways to say the same thing. Getting the scope of a negation wrong is the most common formalization bug, right alongside quantifier order, \`∧\` versus \`→\`, missing hypotheses, and flipped implications—all five are now in your Codex.`,
      unlocks: { codex: ['pitfalls'] },
    },
    // 07
    {
      id: 'forge-07',
      kind: 'proof',
      mode: 'term',
      title: 'Define it',
      english: 'Define `IsSquare n`: the number `n` is a square, meaning `n = k * k` for some `k`.',
      intro: `Step 3: when a concept isn't in the library, give it a name with \`def\`. In Lean, a property is a *predicate*—a function into \`Prop\`—and the right-hand side defines what it means.

The header is already written. Finish the definition: \`n\` is a square when \`n = k * k\` for some \`k\`. The tests below check that \`IsSquare 9\` is provable and that \`IsSquare n\` unfolds to \`∃ k, n = k * k\`.`,
      header: 'def IsSquare (n : Nat) : Prop :=',
      starter: '  sorry',
      after: `example : IsSquare 9 := ⟨3, rfl⟩
example (m : Nat) : IsSquare (m * m) := ⟨m, rfl⟩
example (n : Nat) (h : IsSquare n) : ∃ k, n = k * k := h`,
      solutions: ['  ∃ k, n = k * k'],
      hints: [
        { text: 'Which step are you on? Defining a property means writing a *statement* about `n`. Say it in English first: "there\'s a `k` such that …".' },
        { text: 'The body needs to be a `Prop` mentioning `n`. Which quantifier means "there\'s a `k`"?' },
        { text: 'Write `∃ k, ` followed by an equation relating `n` and `k`.' },
      ],
      outro: `A definition simply names a proposition. \`IsSquare 9\` isn't some exotic new object—it *unfolds* straight to \`∃ k, 9 = k * k\`, which is why \`⟨3, rfl⟩\` proves it. That's the exact same way \`Even\` and \`Odd\` work. Defining concepts before stating theorems keeps your statements clean, at the small cost of calling \`unfold\` when you need to look inside.`,
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
      intro: `Here's a property of functions, already defined for you:

\`def Idempotent (f : Nat → Nat) : Prop := ∀ x, f (f x) = f x\`

Now take it through steps 4 and 5. Mentioning \`Idempotent f\` keeps the theorem statement short, and inside the proof you *unfold* it just like you unfolded \`Function.Surjective\`. The opening lines are there; finish with \`rw\`.`,
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
        { text: 'Pick `y := f x`: `h (f x)` says `f (f (f x)) = f (f x)`. Rewrite with it and see what\'s left.' },
        { text: '`rw [h (f x)]` leaves `f (f x) = f x`. One more use of `h` closes it.' },
      ],
      outro: `\`h (f x)\` worked because \`Idempotent f\` *is* a \`∀\` once unfolded—your own definitions behave identically to the library's. The proof term is a chain of two equations. A definition just gives a proposition a name; it never adds an axiom.`,
    },
    // 09
    {
      id: 'forge-09',
      kind: 'proof',
      mode: 'tactic',
      title: 'Skeleton first',
      english: 'If A ⊆ B and C ⊆ D, then A ∩ C ⊆ B ∩ D.',
      intro: `Step 5 starts with a *plan*. Writing \`have h : T := by sorry\` states an intermediate fact and promises to prove it later. Lean checks that all the pieces fit together even while the holes remain, and simply warns "declaration uses sorry".

Below, the outline and final step are already in place. Fill in each \`sorry\` one at a time, so you always know what's left.`,
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
        { text: 'Take the holes in order. For each one, ask which hypothesis or earlier `have` already gives you what you need.' },
        { text: '`hx : x ∈ A ∩ C` is a pair, so its two halves are `hx.1` and `hx.2`.' },
        { text: 'A `⊆` hypothesis works like a function: `hAB h1 : x ∈ B` whenever `h1 : x ∈ A`.' },
      ],
      outro: `The skeleton type-checked before you filled a single hole. That's what makes it such a strong planning tool: you verify the shape of your argument first, and each hole becomes a small, self-contained task. Write the outline, check that it compiles, then fill the gaps—if a subgoal turns out to be false, you catch it early.`,
      unlocks: { codex: ['skeleton'] },
    },
    // 10
    {
      id: 'forge-10',
      kind: 'proof',
      mode: 'tactic',
      title: 'Read the error: what did Lean expect?',
      english: 'If f is injective and f maps A into the image of B, then A ⊆ B.',
      intro: `The proof below looks reasonable, but it's broken. Lean's error message has three parts: **Where** (the line and underlined text), **Expected** (the type Lean wanted), and **Got** (the type you supplied). Read them in that order, then ask which of *your* assumptions about the types was off.

Run it, read the error, and fix the proof. Don't guess—say out loud what Lean expected and what \`hx\` actually is.`,
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
        { text: 'Which step are you on? Read the error carefully: *where* is it, what did Lean *expect*, and what did you *give* it?' },
        { text: '`h` talks about membership in `f \'\' A`. Which set does `hx` talk about?' },
        { text: 'To call `h`, you need a proof that *something* belongs to `f \'\' A`. What element of `f \'\' A` can you build from `x`, and what proves it\'s in there?' },
        { text: 'The element is `f x`, and `⟨x, hx, rfl⟩ : f x ∈ f \'\' A`. Pass that to `h`.' },
      ],
      outro: `The bug was mixing up \`x ∈ A\` with \`f x ∈ f '' A\`—passing a proof about the wrong object. "Expected \`?a ∈ f '' A\`, got \`x ∈ A\`" pointed right at it. Whenever a type mismatch pops up, compare the two types symbol by symbol; the difference is where the misunderstanding lives.`,
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
      intro: `Here's a second kind of error. \`rw [h]\` replaces the left-hand side of \`h\` with its right-hand side, so that left-hand side has to *literally appear in the current goal* after any earlier rewrites. If it doesn't, Lean prints the pattern it looked for alongside the goal it searched.

Run the proof, compare the pattern with the goal, and fix it. Which rewrite unlocks the other one?`,
      header:
        'theorem two_steps (f : Nat → Nat) (a b : Nat) (h1 : f a = b) (h2 : f b = a) : f (f a) = a := by',
      starter: '  rw [h2, h1]',
      solutions: ['  rw [h1, h2]', '  calc f (f a) = f b := congrArg f h1\n    _ = a := h2'],
      hints: [
        { text: 'Read the error: what pattern did `rw` look for, and does it actually appear in `f (f a) = a`?' },
        { text: 'The goal has `f a` sitting inside `f (f a)`. Which hypothesis has `f a` on its left side?' },
        { text: 'Rewrite with that hypothesis first; the new goal has a shape the other hypothesis can match.' },
      ],
      outro: `Rewriting depends on order: the first rewrite produced the \`f b\` that the second one needed. "Did not find an occurrence of the pattern" always means the left-hand side isn't in the *current* goal. Read the goal, spot the pattern yourself, and decide whether to reorder, flip with \`←\`, or rewrite in a hypothesis instead.`,
    },
    // 12
    {
      id: 'forge-12',
      kind: 'proof',
      mode: 'tactic',
      title: 'Doing things to every goal',
      english: 'If P, Q and R hold, then (P ∧ Q) ∧ R holds.',
      intro: `Here are three small conveniences—never required, often handy:

- \`all_goals t\` runs \`t\` on *every* open goal.
- \`try t\` runs \`t\` and, if it fails, quietly does nothing.
- \`repeat t\` keeps running \`t\` until it fails.

The proof starts by splitting, and the second line fails because one goal (\`R\`) can't be split. Wrap it so that failure is harmless, then close all remaining goals in one move.`,
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
        { text: 'Read the error on line 2: which goal caused `constructor` to fail, and why?' },
        { text: 'You want `constructor` on the goals where it applies and nothing on the rest. Which combinator means "or do nothing"?' },
        { text: '`all_goals try constructor` leaves the goals `P`, `Q`, and `R`. One more `all_goals` finishes them.' },
      ],
      unlocks: { tactics: ['all_goals', 'try', 'repeat'], codex: ['all_goals', 'try', 'repeat'] },
      outro: `These are pure conveniences—the longer proof in the second solution does the exact same thing. They cut down repetition when several goals share a shape, and \`try\` is the standard way to say "if this applies". Just remember that \`repeat\` acts on the first goal and stops as soon as that goal fails.`,
    },
    {
      id: 'forge-12b',
      kind: 'proof',
      title: 'Many goals, one move',
      english: 'If P, Q, R and S hold, then (P or Q or R or S) and ((P and Q) and R).',
      intro:
        `Put the combinators from the last level to real work. \`repeat right\` steps through a chain of \`∨\`s until it can't go further, \`all_goals try constructor\` splits every goal that can be split and leaves the rest alone, and \`all_goals assumption\` closes the remaining goals.`,
      header:
        'theorem many_goals (P Q R S : Prop) (hp : P) (hq : Q) (hr : R) (hs : S) : (P ∨ Q ∨ R ∨ S) ∧ ((P ∧ Q) ∧ R) := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  constructor
  · repeat right
    exact hs
  · constructor
    all_goals try constructor
    all_goals assumption`,
      ],
      hints: [
        { text: 'Split the outer `∧` first. The two halves call for different tools: one is a chain of `∨`s, and the other is a nested `∧`.' },
        { text: 'For the `∨` chain, `repeat right` walks all the way to the last branch and stops once `right` no longer applies.' },
        { text: 'For the `∧` half, split once, then run `all_goals try constructor` to split only the goals that can be split. Close everything in one line.' },
      ],
      outro:
        `\`repeat\` and \`all_goals try\` are the clean ways to say "as many times as it applies" and "everywhere it applies". Both stop quietly when they run out of work, which makes them safe to keep in a proof.`,
    },
    {
      id: 'forge-12c',
      kind: 'proof',
      title: 'Leave holes, fill them all',
      english: 'If P, Q and R hold at 2, then some natural number n has P n, Q n and R n.',
      intro:
        `\`refine\` from Divisor Dunes lets you write a proof with holes \`?_\` to fill in later. Here it supplies the witness and opens three goals. Since they all have the same shape, \`all_goals\` from the previous level closes all three together.`,
      header:
        'theorem exists_all (P Q R : Nat → Prop) (hp : P 2) (hq : Q 2) (hr : R 2) : ∃ n, P n ∧ Q n ∧ R n := by',
      starter: '  sorry',
      mode: 'tactic',
      solutions: [
        `  refine ⟨2, ?_, ?_, ?_⟩
  all_goals assumption`,
        `  exact ⟨2, hp, hq, hr⟩`,
      ],
      hints: [
        { text: 'The goal is an `∃` wrapping a three-part conjunction, and the same witness `2` works everywhere.' },
        { text: 'Write `refine ⟨2, ?_, ?_, ?_⟩`. Each `?_` opens a new goal, one per conjunct.' },
        { text: 'After `refine`, three goals are left, and every one of them is already in your context. One line with `all_goals` closes them all.' },
      ],
      outro:
        `\`refine\` is just \`exact\` with permission to leave gaps. Because the anonymous constructor flattens nested pairs, \`⟨2, ?_, ?_, ?_⟩\` supplies the witness and opens a goal for every part of the \`∧\` in one step.`,
    },
    // 13
    {
      id: 'forge-13',
      kind: 'proof',
      mode: 'tactic',
      boss: true,
      title: 'Boss: your own theorem',
      english: 'The image of a union is the union of the images.',
      intro: `This time you'll run all five steps yourself, with just a comment outline to guide you.

**Say it**: the image of a union is the union of the images. **Type it**: \`f : α → β\`, \`A B : Set α\`. **Define it**: nothing new. **State it**: write the equation with \`f '' (A ∪ B)\` on the left, keeping the given binders. **Prove it**: start with a skeleton, and read every error.

A test below your theorem checks that you stated what was asked.`,
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
        { text: 'Which step are you on? State it first: an equation between two sets of `β`, with the image of a union on the left. Make sure the statement compiles with `sorry` before you start proving.' },
        { text: 'For set equality, start with `ext y` and split the `↔`. Remember that image membership is an `∃` and union membership is an `∨`.' },
        { text: 'Forward: unpack the `∃`, run `cases` on the `∨` inside, and rebuild the `∃` on the matching side. Backward: run `cases` first.' },
        { text: 'Outline: `ext y`, `constructor`, then in each direction `intro h`, `obtain`, `cases`, and `exact ⟨x, _, hxy⟩` using `Or.inl`/`Or.inr` or `left`/`right`.' },
      ],
      outro: `You ran the entire workflow from start to finish: said it, typed it, stated it, and proved it. Your proof brought sets, functions, \`∃\`, and \`∨\` together—and it's \`Set.image_union\` in Mathlib. Now try a statement of your own: the Workshop suggests theorems and saves yours, and when you're ready for automation and a vast library, the Graduate guide shows you the path to real Lean.`,
    },
  ],
  codex: [
    {
      id: 'workflow',
      kind: 'concept',
      name: 'The five-step workflow',
      summary: 'Say it, Type it, Define it, State it, Prove it: the procedure for formalizing any statement.',
      body: `1. **Say it**: write the statement in clear English; spot every "for all", "there exists", and "if … then".
2. **Type it**: assign each object a type: \`n : Nat\`, \`A : Set α\`, \`f : α → β\`, \`P : α → Prop\`.
3. **Define it**: turn any notion the library lacks into a \`def\`, usually a predicate.
4. **State it**: put hypotheses in the arguments and the conclusion as the type, then read it back in English.
5. **Prove it**: write a skeleton first (\`have … := by sorry\`), then fill the gaps and read every error.

Whenever you're stuck, ask: *which step am I on?*`,
      example: `theorem dvd_mul_of_dvd (a b c : Nat) (h : a ∣ b) : a ∣ b * c :=
  Nat.dvd_trans h (Nat.dvd_mul_right b c)`,
      mathlib: 'The same workflow carries straight over to Mathlib, except step 3 starts by searching for an existing definition.',
    },
    {
      id: 'say-it',
      kind: 'concept',
      name: 'Step 1: Say it',
      summary: 'Write the statement in careful English and mark the quantifiers and connectives.',
      body: `Before writing any Lean, write the claim as a plain sentence and mark the logical words:

- "every", "any", "for all" → \`∀\`, with conditions on \`→\`
- "some", "there is" → \`∃\`, with conditions on \`∧\`
- "if … then" → \`→\`; "A and B" → \`∧\`; "A or B" → \`∨\`
- "not", "no" → \`¬\`
- "if and only if" → \`↔\`

Then test your sentence on a tiny example. If you can't test it, it isn't precise enough yet.`,
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

Use type variables (\`α β : Type\`) whenever the English doesn't pin down a specific type—that keeps the statement general.`,
      example: `#check fun (α β : Type) (f : α → β) (A : Set α) => f '' A`,
    },
    {
      id: 'hyp-vs-concl',
      kind: 'concept',
      name: 'Hypotheses versus conclusion',
      summary: 'What you\'re given becomes arguments; what you need to show is the type after the colon.',
      body: `In "if H then C", \`H\` is a **hypothesis** and \`C\` is the **conclusion**:

\`theorem name (x : T) (h : H) : C\`

The arguments before the colon are what you get to use; the type after the colon is what you have to build. \`(h : H) : C\` and \`: H → C\` say the same thing, and \`intro h\` moves between them. A conjunction \`H ∧ C\` is different—it *asserts* \`H\`.

Quick check: if you drop a hypothesis, is the claim still true?`,
      example: `theorem inj_of_left_inverse (α β : Type) (f : α → β) (g : β → α) (h : Function.LeftInverse g f) : Function.Injective f :=
  Function.LeftInverse.injective h`,
    },
    {
      id: 'pitfalls',
      kind: 'concept',
      name: 'Common formalization pitfalls',
      summary: 'Five mistakes that account for most wrong statements.',
      body: `Check each one before starting a proof:

1. **Quantifier order**: \`∀ x, ∃ y\` isn't the same as \`∃ y, ∀ x\`.
2. **\`∧\` versus \`→\`**: under \`∀\`, use \`→\` for conditions; under \`∃\`, use \`∧\`.
3. **Missing hypothesis**: the claim might be false without it.
4. **Flipped direction**: \`P → Q\` isn't \`Q → P\`; for "iff", use \`↔\`.
5. **Scope of \`¬\`**: read the negated sentence out loud and check what sits under the \`¬\`.

Also: use a separate variable for each distinct object, and test the statement on a tiny example.`,
      example: `#check ∀ x : Nat, ∃ y : Nat, x = y
#check ∃ y : Nat, ∀ x : Nat, x = y`,
    },
    {
      id: 'def-predicate',
      kind: 'concept',
      name: 'Definitions are predicates',
      summary: 'A `def` names a proposition (or any term); using it unfolds to its body.',
      body: `\`def IsSquare (n : Nat) : Prop := ∃ k, n = k * k\` defines a *predicate*, a function \`Nat → Prop\`. \`IsSquare 9\` is a proposition that unfolds to \`∃ k, 9 = k * k\`.

To **prove** \`IsSquare 9\`, give the witness: \`⟨3, rfl⟩\`. To **use** \`h : IsSquare n\`, unpack it with \`obtain ⟨k, hk⟩ := h\`, or run \`unfold IsSquare at h\` first. A definition doesn't add any axioms—it just gives a proposition a name.`,
      example: `def IsSquare (n : Nat) : Prop := ∃ k, n = k * k
example : IsSquare 9 := ⟨3, rfl⟩`,
      mathlib: 'Mathlib already defines many standard notions (like `IsSquare` and `Even`), so search before writing your own.',
    },
    {
      id: 'skeleton',
      kind: 'concept',
      name: 'Prove it: skeleton first',
      summary: '`have … := by sorry` plans a proof: the shape is checked before the details exist.',
      body: `Write the proof's *shape* before filling in the details:

\`\`\`lean
theorem demo (P Q R : Prop) (hpq : P → Q) (hqr : Q → R) (hp : P) : R := by
  have hq : Q := by sorry
  exact hqr hq
\`\`\`

Lean accepts this with a warning ("declaration uses sorry"). Each \`sorry\` marks a small goal to fill in later, and if one turns out to be false you find out right away. A finished proof has no \`sorry\` left.`,
    },
    {
      id: 'read-errors',
      kind: 'concept',
      name: 'Reading an error',
      summary: 'Where is it, what did Lean expect, what did it get?',
      body: `Read Lean's message in this order:

1. **Where**: which line and which piece of text is underlined.
2. **Expected**: the type Lean wanted.
3. **Got**: the type of what you wrote.

Compare the two types symbol by symbol—the difference pinpoints the misunderstanding. For \`rw\`, "did not find an occurrence of the pattern" means the left-hand side isn't in the *current* goal: compare the pattern with the goal printed underneath. Any remaining unsolved goals list exactly what's left to prove.`,
    },
    {
      id: 'all_goals',
      kind: 'tactic',
      name: 'all_goals',
      summary: 'Run a tactic on every open goal.',
      body: `\`all_goals t\` runs \`t\` on each open goal in turn. If \`t\` fails on any of them, the whole \`all_goals\` fails; pair it with \`try\` (\`all_goals try t\`) to skip goals where \`t\` doesn't apply.

A common pattern is splitting with \`constructor\` and then closing every branch with \`all_goals assumption\`.`,
      example: `example (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := by
  constructor
  all_goals assumption`,
    },
    {
      id: 'try',
      kind: 'tactic',
      name: 'try',
      summary: 'Run a tactic; if it fails, do nothing.',
      body: `\`try t\` runs \`t\`, and if \`t\` fails the proof simply moves on unchanged. It's the standard way to say "if this applies, do it".

Watch out: \`try\` can also hide real bugs. If a line mysteriously does nothing, check whether a \`try\` quietly swallowed an error.`,
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
      body: `\`repeat t\` runs \`t\` over and over on the main goal until \`t\` fails, and never fails itself. Because it acts on the *first* goal, after a split it stops as soon as that first goal can't be reduced further.

Especially handy for repeated rewriting.`,
      example: `example (f : Nat → Nat) (h : ∀ x, f x = x) : f (f (f 0)) = 0 := by
  repeat rw [h]`,
    },
  ],
  lemmas: [],
};
