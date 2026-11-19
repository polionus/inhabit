import type { World } from '../types.ts';

export const world: World = {
  id: 'props',
  title: 'Proposition Peaks',
  tagline: 'Proofs are programs',
  intro:
    "A statement like `P → Q` is a type, and a proof of it is a term—specifically, a function. That's the **Curry–Howard correspondence**, and this world is built on it. You'll re-solve a Basecamp puzzle as logic, then meet *tactics* as a way to build those terms step by step: `exact`, `intro`, `apply`, `have`, and `assumption`.",
  requires: ['types'],
  bigIdea:
    'Curry–Howard: propositions are types, proofs are terms, and implication is the function arrow.',
  levels: [
    {
      id: 'props-01',
      kind: 'proof',
      title: 'The same program',
      english: 'If P implies Q and Q implies R, then P implies R.',
      intro:
        "Replace `sorry` with a term of the type below. It's Basecamp's puzzle `(A → B) → (B → C) → A → C` again, so you can solve it the exact same way.\n\nThe only difference is `P Q R : Prop`: `Prop` is the type of *statements*, a term `hp : P` is a **proof** of `P`, and `P → Q` reads \"if P then Q.\"",
      outro:
        "You wrote the exact same `fun` term as in Basecamp. A proof of \"P implies Q\" *is* a function that turns any proof of `P` into a proof of `Q`—only the way we read it changed.",
      unlocks: { codex: ['prop', 'theorem'] },
      mode: 'term',
      header: 'theorem imp_trans (P Q R : Prop) : (P → Q) → (Q → R) → P → R :=',
      starter: '  sorry',
      solutions: ['  fun hpq hqr hp => hqr (hpq hp)'],
      hints: [
        { text: 'Compare with the Basecamp level on composing functions. The goal has the same shape.' },
        { text: 'The goal has three arrows, so start with `fun` and three names.' },
        { text: 'Name the proofs `hpq hqr hp`. The final answer is a proof of `R`, and only `hqr` produces one.' },
        { text: 'The term is `fun hpq hqr hp => hqr (hpq hp)`.' },
      ],
    },
    {
      id: 'props-02',
      kind: 'choice',
      title: 'Modus ponens',
      intro:
        "Read the theorem below and decide what *logical* step the application `hpq hp` performs. Hover over `hpq hp` in the panel if you'd like.\n\nHere `hpq : P → Q` is a function and `hp : P` is its argument.",
      outro:
        "Modus ponens—\"from P and P → Q, conclude Q\"—is just function application. Propositions are types, proofs are terms, and `→` is the function arrow. That's the **Curry–Howard correspondence**.",
      unlocks: { codex: ['curry-howard'] },
      question: 'What logical step does `hpq hp` perform?',
      code: 'theorem mp_demo (P Q : Prop) (hp : P) (hpq : P → Q) : Q := hpq hp',
      options: [
        {
          text: 'It combines a proof of `P` and a proof of `P → Q` into a proof of `Q` (modus ponens).',
          correct: true,
          feedback:
            'Yes. Applying the function `hpq` to the proof `hp` yields a proof of `Q`—the same rule where `f : A → B` and `a : A` give `f a : B`.',
        },
        {
          text: 'It proves `P → Q`.',
          feedback:
            "`hpq` already *is* a proof of `P → Q`; it's a hypothesis. Applying it to `hp` consumes the `P` and produces something of type `Q`.",
        },
        {
          text: 'It proves `P`, since `hp` is written last.',
          feedback:
            "The theorem states `Q`, and the type of `hpq hp` is the function's *result* type, `Q`. Argument position doesn't decide the type.",
        },
        {
          text: 'Nothing logical: it is only function application that happens to type-check.',
          feedback:
            "That's the surprise: there's no difference. Type-checking `hpq hp : Q` *is* checking that the logical step from `P` and `P → Q` to `Q` is valid.",
        },
      ],
    },
    {
      id: 'props-02b',
      kind: 'proof',
      title: 'A one-word proof',
      english: 'From a proof of P, prove P.',
      intro:
        "Write `by` and Lean waits for instructions. Your first instruction is `exact`: it closes the goal with a term of exactly the goal's type. The goal `P` is below `⊢`, and your hypotheses are above it. Which hypothesis already has the type `P`?",
      outro:
        'A tactic block is a script that builds a term. Here the script has one line, and the term is just `hp`. Next you\'ll build a slightly bigger term to hand to `exact`.',
      unlocks: { tactics: ['exact'], codex: ['by', 'tactics-concept', 'exact', 'turnstile'] },
      mode: 'tactic',
      showTerm: true,
      header: 'theorem same_thing (P : Prop) (hp : P) : P := by',
      starter: '  sorry',
      solutions: ['  exact hp'],
      hints: [
        { text: 'Look at the goal after `⊢`, then at the hypotheses. Which one has that same type?' },
        { text: '`hp : P` has exactly the type of the goal.' },
        { text: '`exact hp`' },
      ],
    },
    {
      id: 'props-03',
      kind: 'proof',
      title: 'Using exact on a function',
      english: 'From a proof of Q and a proof of Q → R, prove R.',
      intro:
        "Same tactic, one step bigger. The goal is `R`, and no hypothesis has that type. But `hqr` is a function that ends in `R`. What does it need? Build that term and give it to `exact`.",
      outro:
        "A tactic block is just a script that builds a term, and `exact` hands over a finished one. Open the proof term below: Lean checked *that* against the goal.",
      mode: 'tactic',
      showTerm: true,
      header: 'theorem use_it (P Q R : Prop) (hq : Q) (hqr : Q → R) : R := by',
      starter: '  sorry',
      solutions: ['  exact hqr hq'],
      hints: [
        { text: 'Which hypothesis gives you an `R`? What does it need?' },
        { text: 'Apply the function `hqr` to the proof `hq`, and give that to `exact`.' },
        { text: '`exact hqr hq`' },
      ],
    },
    {
      id: 'props-04',
      kind: 'predict',
      title: 'Assuming the premise',
      intro:
        "To prove `P → Q`, you assume `P` and prove `Q`. In a tactic proof, `intro hp` does just that: it peels the left side of the arrow off the goal and puts it in your context as a hypothesis called `hp`.\n\nBefore running the proof, predict what the goal looks like after `intro hp`.",
      outro:
        "`intro hp` builds `fun hp => ?_`, a function whose body is still missing. Since the goal `P → Q → P` is a function type, proving it means writing a function.",
      unlocks: { tactics: ['intro'], codex: ['intro'] },
      code: `theorem const_fn (P Q : Prop) : P → Q → P := by
  intro hp
  intro hq
  exact hp`,
      line: 2,
      options: [
        {
          text: 'Context gains `hp : P`; the goal becomes `Q → P`.',
          correct: true,
          feedback: 'Right. One `intro` removes one arrow and records its premise.',
        },
        {
          text: 'The goal becomes `Q → P`, and nothing is added to the context.',
          feedback:
            "The premise doesn't vanish—`intro` *moves* it into the context, where you can use it as `hp : P`.",
        },
        {
          text: 'Context gains `hp : P`; the goal becomes `P`.',
          feedback:
            'That would remove two arrows. A single `intro hp` introduces one premise, so the `Q →` is still there.',
        },
        {
          text: 'The goal is unchanged, and `hp : P` is added.',
          feedback:
            "The goal does change: the premise `P →` is removed, since it's now a hypothesis rather than something still waiting to be assumed.",
        },
      ],
    },
    {
      id: 'props-05',
      kind: 'proof',
      title: 'Introducing several premises',
      english: 'If P and Q together give R, then Q and P together give R.',
      intro:
        "`intro` can take several names at once: `intro h hq` is shorthand for `intro h` followed by `intro hq`. Each name peels off one arrow, left to right.\n\nPart of the proof is already written. Fill in the rest, keeping an eye on the goal after your introductions—that's what a hypothesis needs to give you.",
      outro:
        "The term Lean built is `fun h hq hp => h hp hq`, with one `fun` argument per `intro`. The tactic proof and the term proof are just two ways to write the same object.",
      mode: 'tactic',
      showTerm: true,
      header: 'theorem imp_flip (P Q R : Prop) : (P → Q → R) → Q → P → R := by',
      starter: `  intro h hq
  sorry`,
      solutions: [
        `  intro h hq hp
  exact h hp hq`,
      ],
      hints: [
        { text: 'After `intro h hq`, the goal is `P → R`—still an implication.' },
        { text: 'Introduce the last premise too, then use `exact`.' },
        { text: '`h` expects first a proof of `P`, then a proof of `Q`.' },
        { text: '`intro h hq hp`, then `exact h hp hq`.' },
      ],
    },
    {
      id: 'props-06',
      kind: 'predict',
      title: 'Working backwards',
      intro:
        "The goal is `R`, and `hqr : Q → R` gives you an `R` if you supply a `Q`. Writing `apply hqr` says, \"I'll use `hqr`; what's still missing?\" Lean replaces the goal with what `hqr` needs.\n\nPredict the goal after `apply hqr`.",
      outro:
        "`apply hqr` builds `hqr ?_`—an application with a hole, where the hole becomes your new goal. `exact` supplies the whole term, while `apply` supplies the function and leaves its arguments for you.",
      unlocks: { tactics: ['apply'], codex: ['apply'] },
      code: `theorem back_demo (P Q R : Prop) (hq : Q) (hqr : Q → R) : R := by
  apply hqr
  exact hq`,
      line: 2,
      options: [
        {
          text: 'The goal becomes `Q`.',
          correct: true,
          feedback: "Right: `hqr` turns a proof of `Q` into a proof of `R`, so all that's left is to prove `Q`.",
        },
        {
          text: 'The goal stays `R`.',
          feedback:
            'The goal changes. `apply` replaces `R` with whatever you need in order to get `R` from `hqr`.',
        },
        {
          text: 'The goal becomes `Q → R`.',
          feedback:
            "`Q → R` is the type of `hqr` itself, which you're already using. What's left is its argument.",
        },
        {
          text: 'There are no goals left: `apply` proves it.',
          feedback:
            "You still need a proof of `Q`. The proof isn't finished until `exact hq` closes that goal.",
        },
      ],
    },
    {
      id: 'props-07',
      kind: 'parsons',
      title: 'Assume, then work backwards',
      english: 'If P implies Q and Q implies R, then P implies R.',
      intro:
        "Order matters in a tactic proof. First move the premise into the context, then work backwards from the goal one `apply` at a time until a hypothesis closes it.\n\nArrange the lines. Three of them are traps.",
      outro:
        "Each `apply` peeled one implication off the goal until `exact hp` finished the job. That's the term `fun hp => hqr (hpq hp)`, built backwards instead of forwards.",
      header: 'theorem chain (P Q R : Prop) (hpq : P → Q) (hqr : Q → R) : P → R := by',
      lines: ['  intro hp', '  apply hqr', '  apply hpq', '  exact hp'],
      distractors: ['  exact hpq', '  apply hp', '  exact hqr hp'],
      hints: [
        { text: 'The goal is an implication. What must happen first?' },
        { text: 'After the `intro`, the goal is `R`. Which hypothesis ends in `R`?' },
        { text: 'Work backwards: the goal goes `R`, then `Q`, then `P`. The last goal is exactly `hp`.' },
      ],
    },
    {
      id: 'props-08',
      kind: 'proof',
      title: 'Naming an intermediate fact',
      english: 'From P, P → Q, Q → R and R → S, conclude S.',
      intro:
        "`have h : T := e` adds a new hypothesis `h : T` to the context, where `e` is a proof of `T`. It lets you name an intermediate step and keep moving.\n\nTwo steps are written, and the middle one is missing. Fill it in.",
      outro:
        "`have` builds a term where an intermediate result is named once and reused later. Naming a fact breaks a long proof into short steps, like a miniature lemma inside a proof.",
      unlocks: { tactics: ['have'], codex: ['have'] },
      mode: 'tactic',
      showTerm: true,
      header:
        'theorem three_steps (P Q R S : Prop) (hpq : P → Q) (hqr : Q → R) (hrs : R → S) (hp : P) : S := by',
      starter: `  have hq : Q := hpq hp
  have hr : R := sorry
  exact hrs hr`,
      solutions: [
        `  have hq : Q := hpq hp
  have hr : R := hqr hq
  exact hrs hr`,
        '  exact hrs (hqr (hpq hp))',
      ],
      hints: [
        { text: 'The missing term must have type `R`. What do you have that produces an `R`?' },
        { text: '`hqr : Q → R` needs a `Q`, and the first `have` already gave you one.' },
        { text: 'Replace `sorry` with `hqr hq`.' },
      ],
    },
    {
      id: 'props-09',
      kind: 'proof',
      title: 'Let Lean look it up',
      english: 'If Q holds and Q implies R, then P implies R.',
      intro:
        "`assumption` closes the goal if some hypothesis has *exactly* the goal's type, so Lean searches the context for you.\n\nUse `intro` and `apply` to reach a goal that's already in the context, then let `assumption` finish.",
      outro:
        "`assumption` is just `exact h` where Lean finds `h` for you. Notice that `hp` is never used—the proof term ignores it, and assuming something without using it is completely fine.",
      unlocks: { tactics: ['assumption'], codex: ['assumption'] },
      mode: 'tactic',
      showTerm: true,
      header: 'theorem pick (P Q R : Prop) (hq : Q) (hqr : Q → R) : P → R := by',
      starter: '  sorry',
      solutions: [
        `  intro hp
  apply hqr
  assumption`,
        `  intro hp
  exact hqr hq`,
      ],
      hints: [
        { text: 'The goal is an implication, so start with the tactic for assuming a premise.' },
        { text: 'After that the goal is `R`. Use `hqr` backwards.' },
        { text: 'After `apply hqr` the goal is `Q`, which is sitting in the context.' },
        { text: '`intro hp`, `apply hqr`, `assumption`.' },
      ],
    },
    {
      id: 'props-10',
      kind: 'proof',
      title: 'Summit: the S combinator',
      boss: true,
      english: 'If P and Q give R, and P gives Q, then P gives R.',
      intro:
        "Use whatever tactics you need here: `intro`, `apply`, `have`, `exact`, or `assumption`.\n\nThe hypothesis `P → Q → R` needs *two* proofs. Think about where each one comes from, and in what order you introduce things.",
      outro:
        "Behind your proof sits `fun h1 h2 hp => h1 hp (h2 hp)`, the S combinator of combinatory logic. Lean's **kernel** never sees your tactics—it only checks that this final term has the stated type.",
      unlocks: { codex: ['kernel-check'] },
      mode: 'tactic',
      showTerm: true,
      header: 'theorem boss (P Q R : Prop) : (P → Q → R) → (P → Q) → P → R := by',
      starter: '  sorry',
      solutions: [
        `  intro h1 h2 hp
  have hq : Q := h2 hp
  exact h1 hp hq`,
        `  intro h1 h2 hp
  exact h1 hp (h2 hp)`,
      ],
      hints: [
        { text: 'The goal is a chain of implications. Introduce all three premises first.' },
        { text: 'The goal is now `R`. Only `h1` ends in `R`, and it needs a `P` and a `Q`.' },
        { text: 'You have `hp : P`. Where can a `Q` come from? Use `have`.' },
        { text: '`intro h1 h2 hp`, `have hq : Q := h2 hp`, `exact h1 hp hq`.' },
      ],
    },
  ],
  codex: [
    {
      id: 'prop',
      kind: 'concept',
      name: 'Prop',
      summary: 'The type of statements. A term of a statement is a proof of it.',
      body: "`Prop` is the universe of propositions, and `Prop : Type`. If `P : Prop`, then `P` is itself a type, and a term `h : P` is a *proof* of `P`. Proving `P` means finding such a term—a proposition is true when its type is inhabited.",
      example: 'example (P : Prop) (h : P) : P := h',
    },
    {
      id: 'theorem',
      kind: 'term',
      name: 'theorem',
      summary: 'Like `example`, but with a name for later use.',
      body: "`theorem name (args) : statement := proof` states a proposition and proves it. The hypotheses in parentheses are arguments, and the part after the colon is the goal.",
      example: 'theorem id_prop (P : Prop) (h : P) : P := h',
    },
    {
      id: 'curry-howard',
      kind: 'concept',
      name: 'Propositions as types',
      summary: 'Curry–Howard: statements are types, proofs are terms, `→` is the function arrow.',
      body: "A proof of `P → Q` is a function that turns proofs of `P` into proofs of `Q`, and modus ponens is function application. Writing a proof is writing a program, and checking a proof is type-checking. Every connective you'll meet next has a matching type former.",
      example: 'example (P Q : Prop) (hp : P) (hpq : P → Q) : Q := hpq hp',
    },
    {
      id: 'by',
      kind: 'term',
      name: 'by',
      summary: 'Enters tactic mode: a script that builds a term.',
      body: "`:= by tac₁; tac₂ …` (or one tactic per line) tells Lean to *construct* a term by running tactics on the current goal. The result is still an ordinary term.",
      example: 'example (P : Prop) (h : P) : P := by exact h',
    },
    {
      id: 'tactics-concept',
      kind: 'concept',
      name: 'What tactics are',
      summary: 'Tactics are programs that build proof terms step by step.',
      body: "A proof state is a list of **goals**, each showing a context of hypotheses and a target type after `⊢`. Every tactic transforms the goal, sometimes leaving new ones behind. Once no goals remain, Lean has assembled a complete term. Tactics are a convenience; the term is what counts.",
    },
    {
      id: 'turnstile',
      kind: 'symbol',
      name: '⊢',
      summary: 'Separates hypotheses from the goal in the proof state.',
      body: 'In the infoview, everything left of `⊢` is in your context, and the type to its right is what you need to produce.',
      input: '\\vdash',
    },
    {
      id: 'exact',
      kind: 'tactic',
      name: 'exact',
      summary: 'Closes the goal with a term of exactly that type.',
      body: "`exact e` checks `e` against the goal. If the type matches, the goal closes; otherwise Lean reports a type mismatch. Reach for it whenever you can see the whole term.",
      example: 'example (P Q : Prop) (hp : P) (hpq : P → Q) : Q := by\n  exact hpq hp',
      term: 'e',
    },
    {
      id: 'intro',
      kind: 'tactic',
      name: 'intro',
      summary: 'Moves the premise of an implication into the context.',
      body: "On a goal `P → Q`, `intro hp` adds `hp : P` to the context and leaves the goal `Q`. Writing `intro a b c` introduces several at once. Use it whenever the goal is a function type.",
      example: 'example (P Q : Prop) : P → Q → P := by\n  intro hp hq\n  exact hp',
      term: 'fun hp => _',
    },
    {
      id: 'apply',
      kind: 'tactic',
      name: 'apply',
      summary: 'Uses a function whose result matches the goal; the arguments become new goals.',
      body: "On a goal `R` with `h : Q → R`, `apply h` leaves the goal `Q`. If `h` takes several arguments, you get one new goal per missing argument. It's *backward reasoning*: you start from the goal and ask what would be enough to prove it.",
      example: 'example (P Q : Prop) (hp : P) (hpq : P → Q) : Q := by\n  apply hpq\n  exact hp',
      term: 'h _',
    },
    {
      id: 'have',
      kind: 'tactic',
      name: 'have',
      summary: 'Adds a named intermediate fact to the context.',
      body: "`have h : T := e` gives you `h : T` for the rest of the proof. Writing `:= by ...` lets you prove it right there with tactics, without changing the main goal.",
      example: 'example (P Q R : Prop) (hpq : P → Q) (hqr : Q → R) (hp : P) : R := by\n  have hq : Q := hpq hp\n  exact hqr hq',
      term: 'have h : T := e; _',
    },
    {
      id: 'assumption',
      kind: 'tactic',
      name: 'assumption',
      summary: 'Closes the goal if a hypothesis has exactly its type.',
      body: "`assumption` searches the context for a hypothesis matching the goal, saving you from naming it. It fails if nothing matches exactly.",
      example: 'example (P Q : Prop) (hp : P) (hq : Q) : P := by\n  assumption',
      term: 'h (the matching hypothesis)',
    },
    {
      id: 'kernel-check',
      kind: 'concept',
      name: 'What the kernel checks',
      summary: 'The kernel checks only that the final term has the stated type.',
      body: "No matter what tactics you used, Lean's small, trusted **kernel** receives a finished term and type-checks it against the theorem statement. Tactics aren't trusted; the kernel is. That's why you can trust a proof assistant when it says a theorem is proved.",
    },
  ],
  lemmas: [],
};
