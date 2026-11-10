/** Fixture worlds: 1-2 sample levels of every kind, for developing the UI without real content. */
import type { World } from '../../content/types.ts';
import type { GraduateSection, PhrasebookRow, TheoremIdea } from '../../content/types.ts';
import { goal, hyp, registerScript } from './fakeEngine.ts';

const PQ = hyp('P Q', 'Prop', false);

const swapHeader = 'theorem and_swap (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by';
const swapLines = ['obtain ⟨hp, hq⟩ := h', 'exact ⟨hq, hp⟩'];
const swapStates = [
  [goal([PQ, hyp('h', 'P ∧ Q')], 'Q ∧ P')],
  [goal([PQ, hyp('hp', 'P'), hyp('hq', 'Q')], 'Q ∧ P')],
  [],
];
registerScript({ header: swapHeader, lines: swapLines, states: swapStates });

const impHeader = 'theorem imp_trans (P Q R : Prop) (f : P → Q) (g : Q → R) : P → R := by';
const impLines = ['intro hp', 'apply g', 'exact f hp'];
const RHyps = [hyp('P Q R', 'Prop', false), hyp('f', 'P → Q'), hyp('g', 'Q → R')];
registerScript({
  header: impHeader,
  lines: impLines,
  states: [
    [goal(RHyps, 'P → R')],
    [goal([...RHyps, hyp('hp', 'P')], 'R')],
    [goal([...RHyps, hyp('hp', 'P')], 'Q')],
    [],
  ],
  term: 'fun hp => g (f hp)',
});

const termHeader = 'theorem swap_term (P Q : Prop) : P ∧ Q → Q ∧ P :=';
registerScript({
  header: termHeader,
  lines: ['fun h => ⟨h.2, h.1⟩'],
  states: [[goal([PQ], 'P ∧ Q → Q ∧ P')], []],
  term: 'fun h => ⟨h.2, h.1⟩',
});

const bossHeader = 'theorem and_assoc_boss (P Q R : Prop) : (P ∧ Q) ∧ R → P ∧ (Q ∧ R) := by';
registerScript({
  header: bossHeader,
  lines: ['rintro ⟨⟨hp, hq⟩, hr⟩', 'exact ⟨hp, hq, hr⟩'],
  states: [
    [goal([hyp('P Q R', 'Prop', false)], '(P ∧ Q) ∧ R → P ∧ Q ∧ R')],
    [goal([hyp('P Q R', 'Prop', false), hyp('hp', 'P'), hyp('hq', 'Q'), hyp('hr', 'R')], 'P ∧ Q ∧ R')],
    [],
  ],
});

const orHeader = 'theorem or_swap (P Q : Prop) (h : P ∨ Q) : Q ∨ P := by';
registerScript({
  header: orHeader,
  lines: ['obtain hp | hq := h', 'right', 'exact hp', 'left', 'exact hq'],
  states: [
    [goal([PQ, hyp('h', 'P ∨ Q')], 'Q ∨ P')],
    [goal([PQ, hyp('hp', 'P')], 'Q ∨ P', 'inl'), goal([PQ, hyp('hq', 'Q')], 'Q ∨ P', 'inr')],
    [goal([PQ, hyp('hp', 'P')], 'P', 'inl'), goal([PQ, hyp('hq', 'Q')], 'Q ∨ P', 'inr')],
    [goal([PQ, hyp('hq', 'Q')], 'Q ∨ P', 'inr')],
    [goal([PQ, hyp('hq', 'Q')], 'Q', 'inr')],
    [],
  ],
});

const idHeader = 'theorem my_id (P : Prop) (h : P) : P := by';
registerScript({
  header: idHeader,
  lines: ['exact h'],
  states: [[goal([hyp('P', 'Prop', false), hyp('h', 'P')], 'P')], []],
  term: 'h',
});

export const fxWorlds: World[] = [
  {
    id: 'basics',
    title: 'Fixture Basecamp',
    tagline: 'Sample levels of every kind',
    intro: 'A **fixture** world for developing the UI. Try each kind of level: predict, choice, proof, Parsons, term mode, formalize.',
    requires: [],
    bigIdea: 'A proof is a term whose type is the statement.',
    codex: [
      { id: 'exact', kind: 'tactic', name: 'exact', summary: 'Close the goal with a term of exactly that type.', body: '`exact e` checks that `e` has the type of the goal and closes it.\n\nReach for it when you can *see* the proof term.', example: 'example (P : Prop) (h : P) : P := by\n  exact h', term: 'h', mathlib: 'Same in Mathlib.' },
      { id: 'obtain', kind: 'tactic', name: 'obtain', summary: 'Take a hypothesis apart into its pieces.', body: '`obtain ⟨a, b⟩ := h` splits `h : A ∧ B` into `a : A` and `b : B`.', example: 'example (P Q : Prop) (h : P ∧ Q) : Q := by\n  obtain ⟨hp, hq⟩ := h\n  exact hq', term: 'match h with | ⟨a, b⟩ => _' },
      { id: 'and-intro', kind: 'concept', name: 'Conjunction', summary: '`P ∧ Q` is a pair of proofs.', body: 'To prove `P ∧ Q` give a proof of `P` and a proof of `Q`: `⟨hp, hq⟩`.' },
      { id: 'sym-and', kind: 'symbol', name: '∧', summary: 'logical and', body: 'Typed with `\\and`.', input: '\\and' },
      { id: 'intro', kind: 'tactic', name: 'intro', summary: 'Assume the hypothesis of an implication.', body: '`intro h` turns the goal `P → Q` into `Q`, with `h : P`.', term: 'fun h => _' },
      { id: 'locked-thing', kind: 'definition', name: 'Hidden definition', summary: 'Not unlocked in the fixtures.', body: 'Never unlocked.' },
    ],
    lemmas: [
      { name: 'And.swap', source: 'theorem And.swap (h : P ∧ Q) : Q ∧ P := ⟨h.2, h.1⟩', origin: 'core', doc: 'Swap the sides of a conjunction.' },
    ],
    levels: [
      {
        id: 'basics-01', kind: 'predict', title: 'Watch a proof run',
        intro: 'Before you write anything, watch one run. `obtain` takes a hypothesis apart. See [[obtain]].\n\nDecide what the goal looks like *after* line 2.',
        outro: 'A conjunction hypothesis is just a pair; `obtain` unpacks it.',
        unlocks: { codex: ['obtain', 'and-intro'], tactics: ['obtain'] },
        code: swapHeader + '\n' + swapLines.map((l) => '  ' + l).join('\n'),
        line: 2,
        options: [
          { text: 'Goal `Q ∧ P` with `hp : P` and `hq : Q` in context', correct: true, feedback: 'Right: `h` is replaced by its two components.' },
          { text: 'Goal `P` only', feedback: 'The goal is not changed by `obtain`; only the context is.' },
          { text: 'Goal `Q ∧ P` and `h` is still there, untouched', feedback: '`obtain` consumes `h` and replaces it with the pieces.' },
        ],
      },
      {
        id: 'basics-02', kind: 'choice', title: 'What is a proof?',
        intro: 'A quick concept check on [[and-intro]].',
        question: 'Which term proves `P ∧ Q` given `hp : P` and `hq : Q`?',
        options: [
          { text: '`⟨hp, hq⟩`', correct: true, feedback: 'Yes. The anonymous constructor builds the pair.' },
          { text: '`hp hq`', feedback: '`hp` is not a function, so you cannot apply it to `hq`.' },
          { text: '`hp ∨ hq`', feedback: '`∨` is a *type*, not a proof term.' },
        ],
      },
      {
        id: 'basics-03', kind: 'choice', title: 'Read the proof',
        intro: 'Move the cursor through the code and watch the goals.',
        question: 'After `intro hp`, what is the new goal?',
        code: impHeader + '\n  ' + impLines.join('\n  '),
        options: [
          { text: '`R`', correct: true, feedback: 'Right, `intro hp` moves `P` into the context.' },
          { text: '`P → R`', feedback: 'That was the goal before `intro`.' },
        ],
      },
      {
        id: 'basics-04', kind: 'proof', mode: 'tactic', title: 'The identity proof',
        english: 'Show that if `P` holds then `P` holds.',
        intro: 'Use `exact` with the hypothesis. See [[exact]]. The Lean:\n\n```lean\nexact h\n```',
        outro: 'You inhabited the type `P` with `h`.',
        header: idHeader, starter: '  sorry', solutions: ['  exact h'],
        hints: [{ text: 'Look at the goal. Which hypothesis has exactly that type?' }, { text: 'Use `exact` with that name.' }],
        unlocks: { tactics: ['exact'], codex: ['exact'] },
        showTerm: true,
      },
      {
        id: 'basics-05', kind: 'proof', mode: 'tactic', title: 'Swap, finish it',
        english: 'Show `Q ∧ P` from `P ∧ Q`.',
        intro: 'A completion problem: the first line is written. Finish it.',
        outro: 'Swapping is just reading a pair backwards.',
        header: swapHeader, starter: '  obtain ⟨hp, hq⟩ := h\n  sorry', solutions: ['  obtain ⟨hp, hq⟩ := h\n  exact ⟨hq, hp⟩'],
        hints: [{ text: 'Look at the goal: it is a pair.' }, { text: 'Build a pair with `⟨_, _⟩`.' }, { text: 'Use\n\n```lean\nexact ⟨hq, hp⟩\n```' }],
        unlocks: { tactics: ['intro'], codex: ['intro'] },
      },
      {
        id: 'basics-06', kind: 'parsons', title: 'Put it in order',
        english: 'Arrange the lines to prove `P → R`.',
        intro: 'Drag the lines (or use the buttons) into a working proof. Beware of distractors.',
        outro: 'Order matters: `intro` first, then work backwards.',
        header: impHeader,
        lines: impLines.map((l) => '  ' + l),
        distractors: ['  exact g hp', '  intro f'],
        hints: [{ text: 'What must come first when the goal is an implication?' }, { text: 'Start with `intro hp`.' }],
      },
      {
        id: 'basics-07', kind: 'proof', mode: 'term', title: 'Say it as a term',
        english: 'Prove `P ∧ Q → Q ∧ P` with a term.',
        intro: 'No `by` here. Write a function with `fun`.',
        outro: 'A proof of an implication is a function.',
        header: termHeader, starter: '  sorry', solutions: ['  fun h => ⟨h.2, h.1⟩'],
        hints: [{ text: 'A proof of `A → B` is a function.' }, { text: '`fun h => ⟨_, _⟩`' }],
      },
      {
        id: 'basics-08', kind: 'formalize', title: 'From English to Lean',
        english: 'For every natural number n, if n is even then n + 1 is odd.',
        intro: 'Translate the sentence into a Lean `Prop`. Mark the *for all* and the *if … then*.',
        outro: 'Quantifier first, then the implication.',
        binders: '',
        starter: '',
        accept: ['∀ n : Nat, Even n → Odd (n + 1)'],
        mistakes: [{ statement: '∃ n : Nat, Even n → Odd (n + 1)', feedback: 'That says *some* n works, not every n.' }],
        hints: [{ text: 'Which quantifier means "for every"?' }, { text: 'Start with `∀ n : Nat,`' }],
      },
      {
        id: 'basics-09', kind: 'formalize', title: 'Sets and subsets', optional: true,
        english: 'Every element of A is an element of B.',
        intro: 'Optional side-quest. Variables are already in scope.',
        binders: '(α : Type) (A B : Set α)',
        accept: ['A ⊆ B'],
        mistakes: [],
        hints: [{ text: 'There is a one-symbol answer.' }],
      },
      {
        id: 'basics-10', kind: 'proof', mode: 'tactic', title: 'Boss: reassociate', boss: true,
        english: 'Show `(P ∧ Q) ∧ R → P ∧ (Q ∧ R)`.',
        intro: 'Combine what you have learned.',
        outro: 'Both directions of associativity are just rearranged pairs.',
        header: bossHeader, starter: '  sorry', solutions: ['  rintro ⟨⟨hp, hq⟩, hr⟩\n  exact ⟨hp, hq, hr⟩'],
        hints: [{ text: 'Pattern-match on the nested pair.' }, { text: '`rintro ⟨⟨hp, hq⟩, hr⟩`' }, { text: '```lean\nrintro ⟨⟨hp, hq⟩, hr⟩\nexact ⟨hp, hq, hr⟩\n```' }],
        extraTactics: ['rintro'],
      },
    ],
  },
  {
    id: 'logic', title: 'Fixture Canyon', tagline: 'Branching and cases', intro: 'Second fixture world.', requires: ['basics'], bigIdea: 'Or is a choice of constructor.', codex: [], lemmas: [],
    levels: [
      {
        id: 'logic-01', kind: 'proof', mode: 'tactic', title: 'Swap an or',
        english: 'Show `Q ∨ P` from `P ∨ Q`.', intro: 'Use `obtain` with `|` to split.', outro: 'Cases on a disjunction.',
        header: orHeader, starter: '  sorry', solutions: ['  obtain hp | hq := h\n  right\n  exact hp\n  left\n  exact hq'],
        hints: [{ text: 'Split `h` into its two cases.' }, { text: '`obtain hp | hq := h`' }],
        extraTactics: ['left', 'right'],
      },
    ],
  },
  { id: 'sets', title: 'Fixture Savanna', tagline: 'Parallel branch', intro: '', requires: ['basics'], bigIdea: '', codex: [], lemmas: [], levels: [] },
  { id: 'empty', title: 'Fixture Empty', tagline: 'A world with zero levels', intro: '', requires: ['logic', 'sets'], bigIdea: '', codex: [], lemmas: [], levels: [] },
];

export const fxIdeas: TheoremIdea[] = [
  { id: 'idea-1', area: 'logic', difficulty: 1, title: 'And is commutative', english: 'If P and Q, then Q and P.', statement: '(P Q : Prop) : P ∧ Q → Q ∧ P', strategy: 'Take the pair apart and rebuild it.', proof: '  intro h\n  exact ⟨h.2, h.1⟩' },
  { id: 'idea-2', area: 'numbers', difficulty: 2, title: 'Double is even', english: 'Twice any natural number is even.', statement: '(n : Nat) : Even (2 * n)', strategy: 'Give a witness.', definitions: '', proof: '  exact ⟨n, by rfl⟩' },
];
export const fxGraduate: GraduateSection[] = [
  { id: 'why', title: 'Why move to real Lean?', body: 'The game engine is a **small subset**. Real Lean has `simp`, `omega` and [[exact]] and all of Mathlib.\n\n```lean\nexample : 2 + 2 = 4 := by norm_num\n```' },
];
export const fxPhrasebook: PhrasebookRow[] = [
  { game: 'Nat.add_comm', mathlib: 'Nat.add_comm', note: 'Same name.' },
  { game: 'obtain ⟨a, b⟩ := h', mathlib: 'obtain ⟨a, b⟩ := h' },
];
