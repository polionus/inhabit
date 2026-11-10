import type { World } from '../types.ts';

export const world: World = {
  id: 'logic',
  title: 'Connective Canyon',
  tagline: 'And, or, not, iff',
  intro:
    "Each logical connective is an **inductive type**. Its *constructors* say how to prove it; its *eliminator* says how to use it. You will meet `∧`, `∨`, `False`/`¬` and `↔` this way, learn the tactics that build and take apart their proofs, and run into the one place where Lean needs an extra axiom: classical reasoning.",
  requires: ['props'],
  bigIdea:
    'Connectives are inductive types: constructors say how to prove them, eliminators say how to use them.',
  levels: [
    {
      id: 'logic-01',
      kind: 'choice',
      title: 'Proving a conjunction',
      intro:
        "`P ∧ Q` (\"P and Q\") is an **inductive type** with one constructor, `And.intro`, which takes a proof of `P` and a proof of `Q`. The shorthand `⟨hp, hq⟩` builds it. To *use* a proof `h : P ∧ Q`, take its parts: `h.1 : P` and `h.2 : Q`.\n\nStudy the code, then answer.",
      outro:
        "A proof of `P ∧ Q` is literally a pair of proofs. The constructor says how to *prove* it (give both parts), and the projections say how to *use* it (take either part).",
      unlocks: { codex: ['inductive-types', 'and', 'anon-ctor'] },
      question: 'What do you need in order to build a proof of `P ∧ Q`?',
      code: `theorem and_demo (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := ⟨hp, hq⟩
theorem left_demo (P Q : Prop) (h : P ∧ Q) : P := h.1
#check @And.intro`,
      options: [
        {
          text: 'A proof of `P` or a proof of `Q`: one is enough.',
          feedback:
            'That describes `P ∨ Q`. For `∧` the constructor `And.intro` takes *both* arguments.',
        },
        {
          text: 'A proof of `P` and a proof of `Q`, packaged as `⟨hp, hq⟩`.',
          correct: true,
          feedback: 'Yes. `And.intro : P → Q → P ∧ Q`, and `⟨hp, hq⟩` is shorthand for it.',
        },
        {
          text: 'A function that turns proofs of `P` into proofs of `Q`.',
          feedback:
            'That is a proof of `P → Q`. A conjunction asserts both facts outright, with no "if".',
        },
      ],
    },
    {
      id: 'logic-02',
      kind: 'proof',
      title: 'Pairs and projections',
      english: 'From ((P and Q) and R), conclude (R and P).',
      intro:
        "Build with `⟨_, _⟩`, take apart with `.1` and `.2` (also written `.left` and `.right`). They chain: if `h : (P ∧ Q) ∧ R`, then `h.1 : P ∧ Q` and `h.1.2 : Q`.\n\nUse them to rearrange the parts of `h` into the goal. This is term mode: no `by`.",
      outro:
        "`h.1` and `h.2` are the eliminators of `∧`, and `⟨_, _⟩` its constructor. Proving a conjunction is building a pair; using one is reading from it.",
      unlocks: { codex: ['and-proj'] },
      mode: 'term',
      header: 'theorem rotate (P Q R : Prop) (h : (P ∧ Q) ∧ R) : R ∧ P :=',
      starter: '  sorry',
      solutions: ['  ⟨h.2, h.1.1⟩', '  ⟨h.right, h.left.left⟩'],
      hints: [
        { text: 'The goal is a conjunction, so the term is a pair. What are its two halves?' },
        { text: 'Start with `⟨_, _⟩`. The first slot needs an `R`: where is `R` inside `h`?' },
        { text: '`h.2` is the `R`. For `P`, go through `h.1` first.' },
        { text: '`⟨h.2, h.1.1⟩`' },
      ],
    },
    {
      id: 'logic-03',
      kind: 'predict',
      title: 'Splitting a goal',
      intro:
        "A goal `P ∧ Q` needs a pair. The tactic `constructor` applies the constructor and leaves one new goal per argument. Each goal is tagged with the argument's name. The bullet `·` focuses on one goal at a time.\n\nPredict the goals after `constructor`.",
      outro:
        "`constructor` built `And.intro ?_ ?_`, with two holes that became two goals. It is the tactic form of the anonymous constructor `⟨_, _⟩`.",
      unlocks: { tactics: ['constructor'], codex: ['constructor', 'focus-dot'] },
      code: `theorem and_demo (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := by
  constructor
  · exact hp
  · exact hq`,
      line: 2,
      options: [
        {
          text: 'Two goals: `case left ⊢ P` and `case right ⊢ Q`.',
          correct: true,
          feedback: 'Right. `And.intro` has two arguments, so there are two goals.',
        },
        {
          text: 'One goal, `⊢ P`; the rest is dropped.',
          feedback:
            'Nothing is dropped. A conjunction needs *both* halves, so both become goals.',
        },
        {
          text: 'One goal: `⊢ Q ∧ P`.',
          feedback:
            '`constructor` does not reorder anything. It splits the conjunction into its two components.',
        },
        {
          text: 'No goals: `constructor` finds `hp` and `hq` itself.',
          feedback:
            '`constructor` only applies the constructor. Finding the proofs of the parts is your job (or `assumption`\'s).',
        },
      ],
    },
    {
      id: 'logic-04',
      kind: 'proof',
      title: 'Taking a hypothesis apart',
      english: 'If P and Q, and P implies R, then Q and R.',
      intro:
        "To use a hypothesis `h : P ∧ Q` in a tactic proof, `obtain ⟨hp, hq⟩ := h` takes it apart and names the two parts. The angle brackets are a *pattern* mirroring the pair.\n\nThe introductions and the `obtain` are written. Finish with `constructor` and the two parts.",
      outro:
        "`obtain` uses the eliminator of `∧`: from a pair, it extracts the components. After it, `h` is gone and `hp`, `hq` are in the context.",
      unlocks: { tactics: ['obtain'], codex: ['obtain'] },
      mode: 'tactic',
      header: 'theorem and_chain (P Q R : Prop) : P ∧ Q → (P → R) → Q ∧ R := by',
      starter: `  intro h hpr
  obtain ⟨hp, hq⟩ := h
  sorry`,
      solutions: [
        `  intro h hpr
  obtain ⟨hp, hq⟩ := h
  constructor
  · exact hq
  · exact hpr hp`,
      ],
      hints: [
        { text: 'Look at the goal: it is `Q ∧ R`. Which tactic splits it?' },
        { text: 'After `constructor`, handle `Q` first, then `R`, each with a bullet.' },
        { text: '`hq` is the `Q`. For `R`, apply `hpr` to `hp`.' },
      ],
    },
    {
      id: 'logic-05',
      kind: 'proof',
      title: 'Choosing a side',
      english: 'If Q holds, then P or (Q or R).',
      intro:
        "`P ∨ Q` (\"P or Q\") has *two* constructors: `Or.inl` (from a proof of `P`) and `Or.inr` (from a proof of `Q`). To prove a disjunction, pick a side and prove that side. The tactics are `left` and `right`.\n\nThe goal nests: `P ∨ (Q ∨ R)`. Which side holds the `Q`?",
      outro:
        "To prove `∨` you *commit* to a side. That choice is the constructor `Or.inl` or `Or.inr`. If you pick the wrong side, the goal becomes unprovable, so choose with care.",
      unlocks: { tactics: ['left', 'right'], codex: ['or', 'or-intro', 'left', 'right'] },
      mode: 'tactic',
      header: 'theorem pick_second (P Q R : Prop) (hq : Q) : P ∨ (Q ∨ R) := by',
      starter: '  sorry',
      solutions: [
        `  right
  left
  exact hq`,
      ],
      hints: [
        { text: 'The goal is `P ∨ (Q ∨ R)`. Is `Q` the left part or the right part?' },
        { text: 'Use `right` to choose the whole `Q ∨ R`. You then face another `∨`.' },
        { text: '`right`, then `left`, then `exact hq`.' },
      ],
    },
    {
      id: 'logic-06',
      kind: 'proof',
      title: 'Using a disjunction',
      english: 'If P or Q, then Q or P.',
      intro:
        "To *use* `h : P ∨ Q` you must handle both cases, since you do not know which holds. `cases h with | inl hp => … | inr hq => …` splits `h` into one goal per constructor: in the first, `hp : P`; in the second, `hq : Q`.\n\nThe first case is written. Do the second.",
      outro:
        "`cases` uses the eliminator `Or.elim`: to get something out of `P ∨ Q`, show it follows from `P` and from `Q`. Proving `∨` is a choice; using `∨` is a case split.",
      unlocks: { tactics: ['cases'], codex: ['cases'] },
      mode: 'tactic',
      header: 'theorem or_swap (P Q : Prop) : P ∨ Q → Q ∨ P := by',
      starter: `  intro h
  cases h with
  | inl hp => right; exact hp
  | inr hq => sorry`,
      solutions: [
        `  intro h
  cases h with
  | inl hp => right; exact hp
  | inr hq => left; exact hq`,
      ],
      hints: [
        { text: 'In the second case you hold `hq : Q` and the goal is `Q ∨ P`.' },
        { text: 'Compare with the first case, where the hypothesis went to the right side.' },
        { text: '`left; exact hq`' },
      ],
    },
    {
      id: 'logic-07',
      kind: 'parsons',
      title: 'A shorter case split',
      english: 'If P or Q, and each implies R, then R.',
      intro:
        "`rcases h with hp | hq` does the same case split as `cases`, in one line. The `|` in the pattern separates the cases; each case gets its own goal and its own bullet.\n\nArrange the lines. Be careful with the traps: one is Lean 3 syntax.",
      outro:
        "This theorem is the eliminator of `∨` itself, `Or.elim`: to conclude `R` from `P ∨ Q`, give a way to get `R` from each side.",
      unlocks: { tactics: ['rcases'], codex: ['rcases'] },
      header: "theorem or_elim' (P Q R : Prop) : P ∨ Q → (P → R) → (Q → R) → R := by",
      lines: [
        '  intro h hpr hqr',
        '  rcases h with hp | hq',
        '  · exact hpr hp',
        '  · exact hqr hq',
      ],
      distractors: ['  cases h with hp hq', '  · exact hpr hq', '  rcases h with ⟨hp, hq⟩'],
      hints: [
        { text: 'Premises first: three arrows, so one `intro` with three names.' },
        { text: 'Then split `h`. A disjunction splits with `|`, not with a pair pattern.' },
        { text: 'In the case with `hp : P`, only `hpr` can give `R`.' },
      ],
    },
    {
      id: 'logic-08',
      kind: 'proof',
      title: 'From falsehood, anything',
      english: 'If P holds and P does not hold, then anything holds.',
      intro:
        "`False` is an inductive type with *no* constructors: there is no way to prove it. And `¬P` is defined as `P → False`. So from `hp : P` and `hnp : ¬P`, the term `hnp hp : False` exists. From `False`, everything follows.\n\nThe tactic `exfalso` changes any goal to `False`.",
      outro:
        "`False` has no constructors, so its eliminator has *no* cases to handle: from a proof of `False` you can build a proof of anything. `exfalso` applies that eliminator (`False.elim`).",
      unlocks: { tactics: ['exfalso'], codex: ['false-not', 'not', 'exfalso'] },
      mode: 'tactic',
      showTerm: true,
      header: 'theorem explode (P Q : Prop) (hp : P) (hnp : ¬P) : Q := by',
      starter: '  sorry',
      solutions: [
        `  exfalso
  exact hnp hp`,
        `  exfalso
  apply hnp
  exact hp`,
      ],
      hints: [
        { text: 'You cannot prove `Q` directly. But your hypotheses contradict each other.' },
        { text: 'Change the goal to `False` with `exfalso`. Then use that `¬P` is `P → False`.' },
        { text: '`exfalso`, then `exact hnp hp`.' },
      ],
    },
    {
      id: 'logic-09',
      kind: 'proof',
      title: 'Spotting a contradiction',
      english: 'If P and not-P both hold, anything follows.',
      intro:
        "`contradiction` closes any goal if the context holds an obvious contradiction, such as `hp : P` together with `hnp : ¬P`, or a hypothesis `False`.\n\nIt only looks at *separate* hypotheses. Here the contradiction is hidden inside a conjunction, so you must unpack it first.",
      outro:
        "`contradiction` automates `exfalso; exact hnp hp`, and the term is `absurd hp hnp`. The combination of a proof and a refutation of the same statement is how `False` is reached.",
      unlocks: { tactics: ['contradiction'], codex: ['contradiction', 'absurd'] },
      mode: 'tactic',
      header: 'theorem no_way (P Q : Prop) (h : P ∧ ¬P) : Q := by',
      starter: '  sorry',
      solutions: [
        `  obtain ⟨hp, hnp⟩ := h
  contradiction`,
        `  exact absurd h.1 h.2`,
      ],
      hints: [
        { text: 'Try `contradiction` right away and read what Lean says. Where is the contradiction hiding?' },
        { text: 'Use `obtain` to separate the two halves of `h`.' },
        { text: '`obtain ⟨hp, hnp⟩ := h`, then `contradiction`.' },
      ],
    },
    {
      id: 'logic-10',
      kind: 'proof',
      title: 'Both directions',
      english: 'If P iff Q, then Q iff P.',
      intro:
        "`P ↔ Q` is an inductive type with one constructor, `Iff.intro`, taking two proofs: `P → Q` and `Q → P`. So `constructor` produces two goals. To *use* `h : P ↔ Q`, take `h.mp : P → Q` or `h.mpr : Q → P`.\n\nProve the symmetry of `↔`.",
      outro:
        "`↔` is a pair of implications: `P ↔ Q` is `(P → Q) ∧ (Q → P)` in a wrapper of its own. `.mp` and `.mpr` (\"modus ponens\" and its reverse) are its two projections.",
      unlocks: { codex: ['iff', 'iff-proj'] },
      mode: 'tactic',
      header: "theorem iff_symm' (P Q : Prop) (h : P ↔ Q) : Q ↔ P := by",
      starter: '  sorry',
      solutions: [
        `  constructor
  · intro hq
    exact h.mpr hq
  · intro hp
    exact h.mp hp`,
        `  constructor
  · exact h.mpr
  · exact h.mp`,
        '  exact ⟨h.mpr, h.mp⟩',
      ],
      hints: [
        { text: 'The goal is an `↔`. It is built from two implications.' },
        { text: '`constructor` gives two goals: `Q → P` first, then `P → Q`. Which direction of `h` serves each?' },
        { text: '`h.mpr : Q → P` for the first goal, `h.mp : P → Q` for the second.' },
      ],
    },
    {
      id: 'logic-11',
      kind: 'proof',
      title: 'De Morgan, and saying what you mean',
      english: 'If not (P or Q), then not P and not Q.',
      intro:
        "`show T` states what the goal currently is. Lean checks that it matches `T` up to unfolding, and then displays it as `T`. It does not change the proof, only readability.\n\nSince `¬P` is `P → False`, `show P → False` is accepted for the goal `¬P`. Half of the proof is written, using `show` to spell out each goal.",
      outro:
        "`show` is a type annotation: it records the type you expect. Lean accepted `P → False` for `¬P` because they are *definitionally* equal. This direction of De Morgan's law needs no classical logic.",
      unlocks: { tactics: ['show'], codex: ['show'] },
      mode: 'tactic',
      header: 'theorem not_or_to_and (P Q : Prop) : ¬(P ∨ Q) → ¬P ∧ ¬Q := by',
      starter: `  intro h
  constructor
  · show P → False
    sorry
  · sorry`,
      solutions: [
        `  intro h
  constructor
  · show P → False
    intro hp
    exact h (Or.inl hp)
  · show Q → False
    intro hq
    exact h (Or.inr hq)`,
        `  intro h
  constructor
  · intro hp
    exact h (Or.inl hp)
  · intro hq
    exact h (Or.inr hq)`,
      ],
      hints: [
        { text: 'After `show P → False`, the goal is an implication. How do you prove one?' },
        { text: 'Introduce `hp : P`. You need `False`, and `h : ¬(P ∨ Q)` turns a proof of `P ∨ Q` into one.' },
        { text: 'Build `P ∨ Q` from `hp` with `Or.inl hp`. The second bullet is the same with `Or.inr`.' },
      ],
    },
    {
      id: 'logic-12',
      kind: 'proof',
      title: 'Either it is, or it is not',
      english: 'If P gives Q and not-P gives Q, then Q.',
      intro:
        "Every statement is either true or false: `P ∨ ¬P`. This is the *law of excluded middle*, and it is **not** provable from Lean's constructive rules: it is a separate axiom, `Classical.em`. Using it means your proof is *classical*.\n\n`by_cases h : P` splits the proof into two goals, one with `h : P` and one with `h : ¬P`.",
      outro:
        "`by_cases` is `Or.elim` applied to `Classical.em P`. Constructive proofs carry computational content (a proof of `P ∨ Q` tells you which side). Classical ones do not, and Lean marks that by the axiom used.",
      unlocks: {
        tactics: ['by_cases'],
        codex: ['by_cases', 'classical-vs-constructive', 'excluded-middle'],
      },
      mode: 'tactic',
      header: 'theorem cases_demo (P Q : Prop) (h1 : P → Q) (h2 : ¬P → Q) : Q := by',
      starter: '  sorry',
      solutions: [
        `  by_cases hp : P
  · exact h1 hp
  · exact h2 hp`,
        '  exact (Classical.em P).elim h1 h2',
      ],
      hints: [
        { text: 'You cannot tell whether `P` holds, but you can consider both possibilities.' },
        { text: 'Use `by_cases hp : P`. You get two goals, one for each answer.' },
        { text: 'In the first goal `hp : P`, so `h1` applies. In the second, `hp : ¬P` fits `h2`.' },
      ],
    },
    {
      id: 'logic-13',
      kind: 'proof',
      title: 'Proof by contradiction',
      english: 'If it is not the case that P is false, then P.',
      intro:
        "To prove `P`, assume `¬P` and derive `False`: that is `by_contra h`. It gives `h : ¬P` and the goal `False`.\n\nHeads up: `¬¬P → P` (double negation elimination) can **not** be proved without classical reasoning. `by_contra` is the classical principle at work here.",
      outro:
        "`P → ¬¬P` is provable constructively, but `¬¬P → P` is not: knowing that `P` can't be false doesn't give you a way to prove `P`. Lean's `Classical.byContradiction` supplies it, via the axiom of excluded middle.",
      unlocks: { tactics: ['by_contra'], codex: ['by_contra'] },
      mode: 'tactic',
      header: 'theorem dne (P : Prop) : ¬¬P → P := by',
      starter: '  sorry',
      solutions: [
        `  intro h
  by_contra hn
  exact h hn`,
      ],
      hints: [
        { text: 'The goal is an implication. Start there.' },
        { text: 'After `intro h`, assume the opposite of the goal with `by_contra hn`. What is the goal now?' },
        { text: '`h : ¬¬P` is a function from `¬P` to `False`, and `hn : ¬P`.' },
        { text: '`exact h hn`' },
      ],
    },
    {
      id: 'logic-14',
      kind: 'proof',
      title: 'Canyon crossing: or-to-and',
      boss: true,
      english: 'P-or-Q implies R holds exactly when P implies R and Q implies R.',
      intro:
        "This law says an implication from a disjunction is the same as two implications. Use whatever you need: `constructor`, `intro`, `obtain`, `rcases`, `exact`, `apply`.\n\nBoth directions need a different tool. Look at each goal's shape before choosing.",
      outro:
        "Each connective has an introduction rule (a constructor) and an elimination rule (an eliminator): `∧` pairs and projects, `∨` injects and splits, `→` abstracts and applies, `False` has no way in and explodes out. Your proof used all of them.",
      unlocks: { codex: ['intro-elim'] },
      mode: 'tactic',
      header: 'theorem or_imp_iff (P Q R : Prop) : (P ∨ Q → R) ↔ (P → R) ∧ (Q → R) := by',
      starter: '  sorry',
      solutions: [
        `  constructor
  · intro h
    constructor
    · intro hp
      exact h (Or.inl hp)
    · intro hq
      exact h (Or.inr hq)
  · intro h hpq
    obtain ⟨hpr, hqr⟩ := h
    rcases hpq with hp | hq
    · exact hpr hp
    · exact hqr hq`,
        `  constructor
  · intro h
    exact ⟨fun hp => h (Or.inl hp), fun hq => h (Or.inr hq)⟩
  · intro h hpq
    cases hpq with
    | inl hp => exact h.1 hp
    | inr hq => exact h.2 hq`,
      ],
      hints: [
        { text: 'The statement is an `↔`, so split it first. Then handle each direction separately.' },
        { text: 'Forward: you must produce a pair of implications. Backward: you must use a pair and a disjunction.' },
        { text: 'Forward: `Or.inl` and `Or.inr` build the disjunction `h` needs. Backward: unpack `h` with `obtain`, split with `rcases`.' },
      ],
    },
  ],
  codex: [
    {
      id: 'inductive-types',
      kind: 'concept',
      name: 'Inductive types',
      summary: 'Types defined by constructors; each has an eliminator that says how to use them.',
      body: "An inductive type is generated by its **constructors**: they are the only ways to build a term. To *use* a term, an **eliminator** (recursor) says what you must provide for each constructor. `And` has one constructor; `Or` has two; `False` has none. `Nat` has two, `zero` and `succ`.",
      example: '#check @And.intro',
    },
    {
      id: 'and',
      kind: 'symbol',
      name: '∧',
      summary: 'Conjunction: `P ∧ Q` is proved by a proof of each.',
      body: "`P ∧ Q` is the type of pairs of a proof of `P` and a proof of `Q`. It binds tighter than `∨` and `→`. `/\\` also works.",
      input: '\\and',
      example: 'example (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := ⟨hp, hq⟩',
    },
    {
      id: 'anon-ctor',
      kind: 'symbol',
      name: '⟨ ⟩',
      summary: 'Anonymous constructor: builds a term of an inductive type with one constructor.',
      body: "`⟨a, b⟩` builds a pair for `∧` and `↔` (and, later, `∃`). With three parts, `⟨a, b, c⟩` is `⟨a, ⟨b, c⟩⟩`. Lean works out the constructor from the expected type.",
      input: '\\< and \\>',
      example: 'example (P Q R : Prop) (hp : P) (hq : Q) (hr : R) : P ∧ Q ∧ R := ⟨hp, hq, hr⟩',
    },
    {
      id: 'and-proj',
      kind: 'term',
      name: 'h.1, h.2',
      summary: 'The two parts of a conjunction (also `h.left`, `h.right`).',
      body: "If `h : P ∧ Q` then `h.1 : P` and `h.2 : Q`. They chain: `h.2.1` is the first part of the second part. These are the eliminators of `∧` in term mode.",
      example: 'example (P Q : Prop) (h : P ∧ Q) : Q := h.2',
    },
    {
      id: 'constructor',
      kind: 'tactic',
      name: 'constructor',
      summary: 'Applies the constructor of the goal; each argument becomes a goal.',
      body: "On `P ∧ Q` it gives goals `P` and `Q`; on `P ↔ Q` it gives `P → Q` and `Q → P`. Use bullets `·` to handle each goal in turn.",
      example: 'example (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := by\n  constructor\n  · exact hp\n  · exact hq',
      term: '⟨_, _⟩',
    },
    {
      id: 'focus-dot',
      kind: 'symbol',
      name: '·',
      summary: 'Focuses on the first goal; the bullet block must close it.',
      body: 'After a tactic leaves several goals, `· tactics` works on the first one only and must finish it. Indent the block.',
      input: '\\.',
    },
    {
      id: 'obtain',
      kind: 'tactic',
      name: 'obtain',
      summary: 'Takes apart a hypothesis by pattern, naming its parts.',
      body: "`obtain ⟨hp, hq⟩ := h` splits `h : P ∧ Q` into `hp : P` and `hq : Q`. Patterns nest: `⟨⟨a, b⟩, c⟩`. It uses the eliminator of the hypothesis's type.",
      example: 'example (P Q : Prop) (h : P ∧ Q) : Q := by\n  obtain ⟨hp, hq⟩ := h\n  exact hq',
      term: 'match h with | ⟨hp, hq⟩ => _',
    },
    {
      id: 'or',
      kind: 'symbol',
      name: '∨',
      summary: 'Disjunction: `P ∨ Q` is proved by a proof of `P` or a proof of `Q`.',
      body: "`P ∨ Q` has two constructors, `Or.inl` and `Or.inr`. A proof records which side was chosen. To use one, you must handle both cases. `\\/` also works.",
      input: '\\or',
      example: 'example (P Q : Prop) (hp : P) : P ∨ Q := Or.inl hp',
    },
    {
      id: 'or-intro',
      kind: 'term',
      name: 'Or.inl, Or.inr',
      summary: 'The constructors of `∨`.',
      body: "`Or.inl : P → P ∨ Q` and `Or.inr : Q → P ∨ Q`. In a tactic proof, use `left` and `right`.",
      example: 'example (P Q : Prop) (hq : Q) : P ∨ Q := Or.inr hq',
    },
    {
      id: 'left',
      kind: 'tactic',
      name: 'left',
      summary: 'For `P ∨ Q`, commit to proving `P`.',
      body: "Applies `Or.inl`; the goal becomes `P`. Only choose `left` if you are sure `P` is provable.",
      example: 'example (P Q : Prop) (hp : P) : P ∨ Q := by\n  left\n  exact hp',
      term: 'Or.inl _',
    },
    {
      id: 'right',
      kind: 'tactic',
      name: 'right',
      summary: 'For `P ∨ Q`, commit to proving `Q`.',
      body: "Applies `Or.inr`; the goal becomes `Q`.",
      example: 'example (P Q : Prop) (hq : Q) : P ∨ Q := by\n  right\n  exact hq',
      term: 'Or.inr _',
    },
    {
      id: 'cases',
      kind: 'tactic',
      name: 'cases',
      summary: 'Splits a hypothesis by its constructors, one goal per case.',
      body: "`cases h with | inl hp => … | inr hq => …` handles both ways a disjunction could hold. The same tactic splits other inductive types.",
      example:
        'example (P Q : Prop) (h : P ∨ Q) : Q ∨ P := by\n  cases h with\n  | inl hp => right; exact hp\n  | inr hq => left; exact hq',
      term: 'Or.elim h (fun hp => _) (fun hq => _)',
    },
    {
      id: 'rcases',
      kind: 'tactic',
      name: 'rcases',
      summary: 'Pattern-matching `cases`: `|` for alternatives, `⟨ ⟩` for parts.',
      body: "`rcases h with hp | hq` splits a disjunction; `rcases h with ⟨a, b⟩ | c` mixes both. Nested patterns handle nested connectives in one line.",
      example:
        'example (P Q : Prop) (h : P ∨ Q) : Q ∨ P := by\n  rcases h with hp | hq\n  · right; exact hp\n  · left; exact hq',
      term: 'Or.elim h (fun hp => _) (fun hq => _)',
    },
    {
      id: 'false-not',
      kind: 'concept',
      name: 'False and negation',
      summary: '`False` has no constructors; `¬P` means `P → False`.',
      body: "There is no way to prove `False`, so a proof of it is a contradiction. `¬P` is *defined* as `P → False`: a refutation is a function that turns any proof of `P` into a contradiction. From `False` you can derive anything (`False.elim`).",
      example: 'example (P : Prop) (hp : P) (hnp : ¬P) : False := hnp hp',
    },
    {
      id: 'not',
      kind: 'symbol',
      name: '¬',
      summary: 'Negation: `¬P` unfolds to `P → False`.',
      body: "Binds tighter than every other connective: `¬P ∧ Q` is `(¬P) ∧ Q`. `Not P` also works.",
      input: '\\not',
      example: 'example (P : Prop) : ¬P → P → False := fun hn hp => hn hp',
    },
    {
      id: 'exfalso',
      kind: 'tactic',
      name: 'exfalso',
      summary: 'Changes the goal to `False`.',
      body: "Use it when your hypotheses are contradictory and the goal is unrelated. Afterwards, derive `False`, usually with `exact hnp hp`.",
      example: 'example (P Q : Prop) (hp : P) (hnp : ¬P) : Q := by\n  exfalso\n  exact hnp hp',
      term: 'False.elim _',
    },
    {
      id: 'contradiction',
      kind: 'tactic',
      name: 'contradiction',
      summary: 'Closes the goal when the context contains an obvious contradiction.',
      body: "It finds `h : P` with `h' : ¬P`, or `h : False`, and so on. It does not look inside conjunctions: unpack with `obtain` first.",
      example: 'example (P Q : Prop) (hp : P) (hnp : ¬P) : Q := by\n  contradiction',
      term: 'absurd hp hnp',
    },
    {
      id: 'absurd',
      kind: 'term',
      name: 'absurd',
      summary: '`absurd hp hnp` proves anything from `hp : P` and `hnp : ¬P`.',
      body: "`absurd : P → ¬P → Q`. The term-mode way to say \"these contradict\".",
      example: 'example (P Q : Prop) (hp : P) (hnp : ¬P) : Q := absurd hp hnp',
    },
    {
      id: 'iff',
      kind: 'symbol',
      name: '↔',
      summary: 'Biconditional: `P ↔ Q` is proved by proving both `P → Q` and `Q → P`.',
      body: "`↔` is an inductive type with one constructor, `Iff.intro`, taking both directions. `constructor` splits it; `⟨f, g⟩` builds it. `<->` also works.",
      input: '\\iff',
      example: "example (P : Prop) : P ↔ P := ⟨fun h => h, fun h => h⟩",
    },
    {
      id: 'iff-proj',
      kind: 'term',
      name: 'h.mp, h.mpr',
      summary: 'The two directions of an `↔`.',
      body: "If `h : P ↔ Q`, then `h.mp : P → Q` and `h.mpr : Q → P`. Use them like any function.",
      example: 'example (P Q : Prop) (h : P ↔ Q) (hp : P) : Q := h.mp hp',
    },
    {
      id: 'show',
      kind: 'tactic',
      name: 'show',
      summary: 'States the current goal, up to unfolding; a readability aid.',
      body: "`show T` checks that the goal is the same as `T` (after unfolding definitions) and displays it as `T`. Use it to remind yourself, or to see through a definition such as `¬P` as `P → False`.",
      example: 'example (P : Prop) : ¬P → ¬P := by\n  intro h\n  show P → False\n  exact h',
      term: '(e : T)',
    },
    {
      id: 'classical-vs-constructive',
      kind: 'concept',
      name: 'Classical vs constructive',
      summary: 'Constructive proofs build things; classical ones add excluded middle.',
      body: "Lean's core logic is constructive: a proof of `P ∨ Q` says *which* side holds. Classical reasoning adds the axiom `Classical.em : P ∨ ¬P`, so you can reason without knowing. It is perfectly valid, but non-constructive. Statements like `¬¬P → P` need it.",
      example: 'example (P : Prop) : P ∨ ¬P := Classical.em P',
    },
    {
      id: 'excluded-middle',
      kind: 'term',
      name: 'Classical.em',
      summary: 'The law of excluded middle: `P ∨ ¬P` for every `P`.',
      body: "`Classical.em P : P ∨ ¬P`. An axiom: it is not provable from Lean's constructive rules.",
      example: 'example (P : Prop) : P ∨ ¬P := Classical.em P',
    },
    {
      id: 'by_cases',
      kind: 'tactic',
      name: 'by_cases',
      summary: 'Splits the proof on whether `P` holds: classical.',
      body: "`by_cases h : P` gives two goals: one with `h : P`, the other with `h : ¬P`. It relies on excluded middle.",
      example:
        'example (P Q : Prop) (h1 : P → Q) (h2 : ¬P → Q) : Q := by\n  by_cases hp : P\n  · exact h1 hp\n  · exact h2 hp',
      term: 'Or.elim (Classical.em P) (fun h => _) (fun h => _)',
    },
    {
      id: 'by_contra',
      kind: 'tactic',
      name: 'by_contra',
      summary: 'Proof by contradiction: assume `¬goal`, derive `False`. Classical.',
      body: "`by_contra h` adds `h : ¬(goal)` and sets the goal to `False`. It uses `Classical.byContradiction`, so it is classical.",
      example: 'example (P : Prop) : ¬¬P → P := by\n  intro h\n  by_contra hn\n  exact h hn',
      term: 'Classical.byContradiction (fun h => _)',
      mathlib: 'In Mathlib `by_contra` can also work without classical logic in decidable cases.',
    },
    {
      id: 'intro-elim',
      kind: 'concept',
      name: 'Introduction and elimination',
      summary: 'Each connective: constructors to prove it, an eliminator to use it.',
      body: "`→`: `fun` / application. `∧`: `⟨_, _⟩` / `.1 .2`. `∨`: `Or.inl, Or.inr` / `cases`. `↔`: `⟨f, g⟩` / `.mp .mpr`. `False`: none / `False.elim`. `¬P` is `P → False`. Proofs are built from these pieces, and the kernel checks them.",
    },
  ],
  lemmas: [],
};
