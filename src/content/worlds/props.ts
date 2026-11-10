import type { World } from '../types.ts';

export const world: World = {
  id: 'props',
  title: 'Proposition Peaks',
  tagline: 'Proofs are programs',
  intro:
    "A statement like `P → Q` is a type, and a proof of it is a term: a function. That is the **Curry–Howard correspondence**, and this world is built on it. You will re-solve a Basecamp puzzle as logic, then meet *tactics* as a way of building those terms step by step: `exact`, `intro`, `apply`, `have`, `assumption`.",
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
        "Basecamp's puzzle was `(A → B) → (B → C) → A → C`. Here it is again with `P Q R : Prop` instead of `A B C : Type`.\n\n`Prop` is the type of *statements*. If `P : Prop`, a term `hp : P` is a **proof** of `P`, and `P → Q` reads \"if P then Q\". `theorem` is `example` with a name.\n\nSolve it exactly as you did before.",
      outro:
        "You wrote the same `fun` term as in Basecamp. A proof of \"P implies Q\" *is* a function that turns any proof of `P` into a proof of `Q`. Only the reading changed.",
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
        "In the theorem below, `hpq : P → Q` is a function and `hp : P` is an argument. The proof is the application `hpq hp`.\n\nRead the line and decide what *logical* step it performs. Hover over `hpq hp` in the panel if you like.",
      outro:
        "Modus ponens, \"from P and P → Q conclude Q\", is function application. Propositions are types, proofs are terms, `→` is the function arrow. This is the **Curry–Howard correspondence**.",
      unlocks: { codex: ['curry-howard'] },
      question: 'What logical step does `hpq hp` perform?',
      code: 'theorem mp_demo (P Q : Prop) (hp : P) (hpq : P → Q) : Q := hpq hp',
      options: [
        {
          text: 'It combines a proof of `P` and a proof of `P → Q` into a proof of `Q` (modus ponens).',
          correct: true,
          feedback:
            'Yes. Applying the function `hpq` to the proof `hp` yields a proof of `Q`: the rule `f : A → B`, `a : A` gives `f a : B`.',
        },
        {
          text: 'It proves `P → Q`.',
          feedback:
            '`hpq` already *is* a proof of `P → Q`; it is a hypothesis. Applying it to `hp` consumes the `P` and produces something of type `Q`.',
        },
        {
          text: 'It proves `P`, since `hp` is written last.',
          feedback:
            'The theorem states `Q`, and the type of `hpq hp` is the *result* type of the function, `Q`. Argument position does not decide the type.',
        },
        {
          text: 'Nothing logical: it is only function application that happens to type-check.',
          feedback:
            'That is the surprise: there is no difference. Type-checking `hpq hp : Q` *is* checking that the step from `P` and `P → Q` to `Q` is valid.',
        },
      ],
    },
    {
      id: 'props-03',
      kind: 'proof',
      title: 'Your first tactic: exact',
      english: 'From a proof of Q and a proof of Q → R, prove R.',
      intro:
        "`by` switches from writing a term to giving *instructions* for building one. The goal is shown after `⊢`. The simplest instruction is `exact e`: \"the term `e` has exactly the goal's type\".\n\nHere the goal is `R`. Look at the hypotheses above the line and finish with `exact`.",
      outro:
        "A tactic block is a program that builds a term. `exact` just hands over a finished term. Open the term below: Lean checked *that* against the goal.",
      unlocks: { tactics: ['exact'], codex: ['by', 'tactics-concept', 'exact', 'turnstile'] },
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
        "To prove `P → Q`, assume `P` and prove `Q`. In a tactic proof, `intro hp` does exactly this. It takes the left side of the arrow off the goal and puts it in the context as a hypothesis called `hp`.\n\nBefore you run the proof, commit to a prediction for the goal after `intro hp`.",
      outro:
        "`intro hp` builds `fun hp => ?_`: a function with the body still missing. The goal `P → Q → P` was a function type, so the way to prove it is to write a function.",
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
          feedback: 'Right. One `intro` removes one arrow and records the premise.',
        },
        {
          text: 'The goal becomes `Q → P`, and nothing is added to the context.',
          feedback:
            'The premise does not vanish: `intro` *moves* it into the context, where you can use it as `hp : P`.',
        },
        {
          text: 'Context gains `hp : P`; the goal becomes `P`.',
          feedback:
            'That would remove two arrows. A single `intro hp` introduces one premise; the `Q →` is still there.',
        },
        {
          text: 'The goal is unchanged, and `hp : P` is added.',
          feedback:
            'The goal changes: the premise `P →` is removed, since it is now a hypothesis rather than something still to be assumed.',
        },
      ],
    },
    {
      id: 'props-05',
      kind: 'proof',
      title: 'Introducing several premises',
      english: 'If P and Q together give R, then Q and P together give R.',
      intro:
        "`intro` can take several names at once: `intro h hq` is `intro h` then `intro hq`. Each name matches one arrow, left to right.\n\nSome of the proof is written. Fill in the rest. Remember the goal after your introductions: it is the thing to prove, so a hypothesis has to provide it.",
      outro:
        "The term Lean built is `fun h hq hp => h hp hq`: one `fun` per `intro`. The tactic proof and the term proof are two notations for the same object.",
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
        { text: 'After `intro h hq` the goal is `P → R`. It is still an implication.' },
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
        "The goal is `R`, and `hqr : Q → R` produces an `R` if given a `Q`. `apply hqr` says: \"I will use `hqr`; what is still missing?\" The goal is replaced by what `hqr` needs.\n\nPredict the goal after `apply hqr`.",
      outro:
        "`apply hqr` builds `hqr ?_`: an application with a hole, and the hole is the new goal. `exact` gives the whole term; `apply` gives the head and leaves the arguments for you.",
      unlocks: { tactics: ['apply'], codex: ['apply'] },
      code: `theorem back_demo (P Q R : Prop) (hq : Q) (hqr : Q → R) : R := by
  apply hqr
  exact hq`,
      line: 2,
      options: [
        {
          text: 'The goal becomes `Q`.',
          correct: true,
          feedback: 'Right: `hqr` turns a proof of `Q` into a proof of `R`, so it remains to prove `Q`.',
        },
        {
          text: 'The goal stays `R`.',
          feedback:
            'The goal moves. `apply` replaces `R` with what is needed to use `hqr` to get an `R`.',
        },
        {
          text: 'The goal becomes `Q → R`.',
          feedback:
            '`Q → R` is the type of `hqr` itself, which we are already using. What is left is its argument.',
        },
        {
          text: 'There are no goals left: `apply` proves it.',
          feedback:
            'A proof of `Q` is still needed. Only after `exact hq` is everything done.',
        },
      ],
    },
    {
      id: 'props-07',
      kind: 'parsons',
      title: 'Assume, then work backwards',
      english: 'If P implies Q and Q implies R, then P implies R.',
      intro:
        "Order matters in a tactic proof. First move the premise into the context, then work backwards from the goal, one `apply` at a time, until a hypothesis closes it.\n\nArrange the lines. Three of the lines offered are traps.",
      outro:
        "Each `apply` peeled one implication off the goal until `exact hp` finished. This is the term `fun hp => hqr (hpq hp)`, found backwards instead of forwards.",
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
        "`have h : T := e` adds a new hypothesis `h : T` to the context, where `e` is a proof of `T`. It lets you name an intermediate step and keep going.\n\nTwo steps are written. One step is missing. Fill in the middle one.",
      outro:
        "`have` builds a term in which the intermediate result is named once and used later. Naming a fact breaks a long proof into short steps, like a lemma inside a proof.",
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
        "`assumption` closes the goal if some hypothesis has *exactly* the goal's type. Lean searches the context for you.\n\nUse `intro` and `apply` to reach a goal that is already in the context, then let `assumption` finish.",
      outro:
        "`assumption` is `exact h` where Lean finds `h` for you. Notice that the hypothesis `hp` is never used: the proof term ignores it. Assuming something and not using it is harmless.",
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
        "Use whatever you need: `intro`, `apply`, `have`, `exact`, `assumption`.\n\nThe hypothesis `P → Q → R` needs *two* proofs. Think about where each one comes from, and in which order you introduce things.",
      outro:
        "The term behind your proof is `fun h1 h2 hp => h1 hp (h2 hp)`, the S combinator of combinatory logic. The Lean **kernel** never sees your tactics: it only checks that this final term has the stated type.",
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
      body: "`Prop` is the universe of propositions, and `Prop : Type`. If `P : Prop` then `P` is itself a type, and a term `h : P` is a *proof* of `P`. Proving `P` means finding such a term; a proposition is true when its type is inhabited.",
      example: 'example (P : Prop) (h : P) : P := h',
    },
    {
      id: 'theorem',
      kind: 'term',
      name: 'theorem',
      summary: 'Like `example`, but with a name for later use.',
      body: "`theorem name (args) : statement := proof` states a proposition and proves it. The hypotheses in parentheses are arguments; the part after the colon is the goal.",
      example: 'theorem id_prop (P : Prop) (h : P) : P := h',
    },
    {
      id: 'curry-howard',
      kind: 'concept',
      name: 'Propositions as types',
      summary: 'Curry–Howard: statements are types, proofs are terms, `→` is the function arrow.',
      body: "A proof of `P → Q` is a function that turns proofs of `P` into proofs of `Q`; modus ponens is application. Writing a proof is writing a program, and checking a proof is type-checking. Every connective you meet next has a matching type former.",
      example: 'example (P Q : Prop) (hp : P) (hpq : P → Q) : Q := hpq hp',
    },
    {
      id: 'by',
      kind: 'term',
      name: 'by',
      summary: 'Enters tactic mode: a script that builds a term.',
      body: "`:= by tac₁; tac₂ …` (or one tactic per line) asks Lean to *construct* the term by running the tactics, each acting on the current goal. The result is an ordinary term.",
      example: 'example (P : Prop) (h : P) : P := by exact h',
    },
    {
      id: 'tactics-concept',
      kind: 'concept',
      name: 'What tactics are',
      summary: 'Tactics are programs that build proof terms step by step.',
      body: "A proof state is a list of **goals**: a context of hypotheses and a type after `⊢`. Each tactic transforms the goal, perhaps leaving new ones. When no goals remain, Lean has assembled a complete term. Tactics are a convenience; the term is the proof.",
    },
    {
      id: 'turnstile',
      kind: 'symbol',
      name: '⊢',
      summary: 'Separates hypotheses from the goal in the proof state.',
      body: 'In the infoview, everything left of `⊢` is in your context and the type to its right is what you must produce.',
      input: '\\vdash',
    },
    {
      id: 'exact',
      kind: 'tactic',
      name: 'exact',
      summary: 'Closes the goal with a term of exactly that type.',
      body: "`exact e` elaborates `e` against the goal. If the type matches, the goal is closed; otherwise Lean reports a type mismatch. Reach for it when you can see the whole term.",
      example: 'example (P Q : Prop) (hp : P) (hpq : P → Q) : Q := by\n  exact hpq hp',
      term: 'e',
    },
    {
      id: 'intro',
      kind: 'tactic',
      name: 'intro',
      summary: 'Moves the premise of an implication into the context.',
      body: "On a goal `P → Q`, `intro hp` adds `hp : P` and leaves the goal `Q`. `intro a b c` introduces several. Use it whenever the goal is a function type.",
      example: 'example (P Q : Prop) : P → Q → P := by\n  intro hp hq\n  exact hp',
      term: 'fun hp => _',
    },
    {
      id: 'apply',
      kind: 'tactic',
      name: 'apply',
      summary: 'Uses a function whose result matches the goal; the arguments become new goals.',
      body: "On goal `R` with `h : Q → R`, `apply h` leaves the goal `Q`. With several arguments, you get one goal per missing argument. It is *backward reasoning*: you start from the goal and ask what would suffice.",
      example: 'example (P Q : Prop) (hp : P) (hpq : P → Q) : Q := by\n  apply hpq\n  exact hp',
      term: 'h _',
    },
    {
      id: 'have',
      kind: 'tactic',
      name: 'have',
      summary: 'Adds a named intermediate fact to the context.',
      body: "`have h : T := e` gives you `h : T` for the rest of the proof. Writing `:= by tactics` lets you prove it right there. It does not change the goal.",
      example: 'example (P Q R : Prop) (hpq : P → Q) (hqr : Q → R) (hp : P) : R := by\n  have hq : Q := hpq hp\n  exact hqr hq',
      term: 'have h : T := e; _',
    },
    {
      id: 'assumption',
      kind: 'tactic',
      name: 'assumption',
      summary: 'Closes the goal if a hypothesis has exactly its type.',
      body: "`assumption` searches the context for a hypothesis matching the goal. It saves naming it. It fails if none matches exactly.",
      example: 'example (P Q : Prop) (hp : P) (hq : Q) : P := by\n  assumption',
      term: 'h (the matching hypothesis)',
    },
    {
      id: 'kernel-check',
      kind: 'concept',
      name: 'What the kernel checks',
      summary: 'The kernel checks only that the final term has the stated type.',
      body: "Whatever tactics you used, Lean's small trusted **kernel** receives a finished term and type-checks it against the theorem statement. Tactics are not trusted; the kernel is. That is why a proof assistant's answer \"this is proved\" can be believed.",
    },
  ],
  lemmas: [],
};
