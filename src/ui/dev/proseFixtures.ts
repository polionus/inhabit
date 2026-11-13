/**
 * Sample prose for developing the UI with `?fixtures=1`: lessons for the fixture worlds, a few
 * Guide articles, and screen intros. Placeholder text in the right shape and length; it is never
 * shown with real content.
 */
import type { GuideArticle, ScreenId, ScreenIntro, WorldLessons } from '../../content/types.ts';

const para = (topic: string) =>
  `When you write ${topic}, Lean does not take your word for it. It checks that every step produces exactly the thing the goal asks for, and it shows you what is left after each line. This is why the goal panel matters so much: it is the conversation between you and the checker, written in the same language as the statement.`;

export const fxLessons: WorldLessons[] = [
  {
    worldId: 'basics',
    primer: `## The question this world answers

What does it mean for a computer to *check* a proof? In ordinary mathematics a proof is an argument written for a person. In Lean a proof is an object, and the statement it proves is that object's **type**. Checking the proof means checking that the object has the right type.

${para('a proof')}

## Propositions are types

A statement such as \`P ∧ Q\` is a type. A proof of it is a value of that type: a pair made of a proof of \`P\` and a proof of \`Q\`. You will build such pairs directly, and you will also let *tactics* build them for you.

\`\`\`lean
example (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := ⟨hp, hq⟩
\`\`\`

## Tactics are programs

A tactic is a small program that changes the goal. \`exact h\` closes the goal with \`h\`; \`obtain\` takes a hypothesis apart. Behind every tactic proof there is a term, and at the end of some levels you can see it.

\`\`\`text
P Q : Prop
h : P ∧ Q
⊢ Q ∧ P
\`\`\`

${para('a tactic')}

## How to read this world

Each level adds one idea. Read the lesson under the task when you want the longer explanation, and use the hints when you are stuck. Nothing here is timed.`,
    recap: `You can now read a goal, close it with a term that has exactly its type, and take a pair apart. That is the whole of the idea: a proof is a value, and a statement is the type it must have. Everything later in the game is more of the same, with richer types.`,
    levels: {
      'basics-04': {
        body: `A hypothesis in the context is a proof you already have. Its name is on the left of the colon and the statement it proves is on the right. When the goal is *exactly* one of those statements, the hypothesis is the proof.

\`exact\` hands Lean a term and asks it to check that the term's type is the goal. If it is, the goal is closed. If not, Lean tells you which type it expected and which type it got.

\`\`\`lean
example (Q : Prop) (hq : Q) : Q := by
  exact hq
\`\`\`

${para('`exact`')}`,
        pitfall: 'Writing the *statement* instead of the *proof*: `exact P` asks Lean to use the proposition itself, which is a type, not a proof of it. Use the name of the hypothesis.',
        realLean: 'Real Lean has the same `exact`. Mathlib adds `exact?`, which searches the library for a term that closes the goal.',
      },
      'basics-05': {
        body: `A proof of \`A ∧ B\` is a pair. You build one with the angle brackets \`⟨_, _⟩\`, putting a proof of \`A\` on the left and a proof of \`B\` on the right.

${para('a pair')}`,
      },
      'basics-10': {
        body: `Boss levels combine what you have learned. Plan before you type: what does the hypothesis give you, and what shape must the result have?

${para('a nested pair')}`,
        pitfall: 'The pattern must match the nesting of the hypothesis. `(P ∧ Q) ∧ R` is a pair whose first component is itself a pair.',
      },
    },
  },
];

export const fxGuide: GuideArticle[] = [
  {
    id: 'what-is-lean',
    section: 'lean',
    title: 'What Lean is',
    summary: 'A programming language whose type checker is strong enough to check mathematics.',
    minutes: 5,
    worlds: ['basics'],
    next: ['how-checking-works'],
    body: `## A language and a checker

Lean is a programming language. It is also a proof assistant: the same type checker that rejects \`"two" + 2\` rejects a proof with a gap in it.

${para('Lean')}

\`\`\`lean
example (P : Prop) (h : P) : P := h
\`\`\`

## What the game leaves out

Real Lean has features the game does not teach. Structures are one:

\`\`\`lean-real
structure Point where
  x : Nat
  y : Nat
\`\`\`

## Mathlib

Most mathematics in Lean lives in Mathlib, a community library.

\`\`\`lean-mathlib
example (a b : ℝ) : a + b = b + a := by ring
\`\`\`

### A smaller heading

${para('Mathlib')}`,
  },
  {
    id: 'how-checking-works',
    section: 'theory',
    title: 'How checking works',
    summary: 'The kernel, terms and types, and why tactics cannot cheat.',
    minutes: 7,
    worlds: ['basics', 'logic'],
    body: `## The kernel

${para('a term')}

## Tactics build terms

${para('a tactic proof')}`,
  },
  {
    id: 'reading-errors',
    section: 'practice',
    title: 'Reading error messages',
    summary: 'What Lean is telling you, and how to find the line that matters.',
    minutes: 4,
    body: `## Expected and got

${para('a wrong step')}`,
  },
];

export const fxScreens: Partial<Record<ScreenId, ScreenIntro>> = {
  map: {
    title: 'The map',
    lede: 'Ten worlds, each built around one idea. Open worlds are ready to play; the rest open when the worlds before them are done.',
    about: 'The map is the curriculum. Each world teaches one idea in short levels, ending in a boss that mixes everything. After Equality the path branches: you can do induction or sets first. If you already know a world, beat its boss to **test out**.',
    tips: ['Stars measure mastery: solve cleanly, then solve again in Review.', 'A world you can test out of shows a small badge.'],
  },
  review: {
    title: 'Review',
    lede: 'Solve finished levels again, a little later, so they stick.',
    about: 'Every level you finish joins a review deck. Items come back after 1, 3, 7, 16 and 35 days; getting one right moves it up a box, missing one moves it back. Sessions mix worlds on purpose: switching between ideas is harder and works better.',
    tips: ['A third star needs one clean review.', 'There is no penalty for skipping a day.'],
  },
  codex: {
    title: 'Codex',
    lede: 'Your own reference: every tactic, symbol and idea you have met.',
    about: 'Entries unlock as you play. Each one says what the thing does, gives an example, and shows the term a tactic builds.',
  },
  guide: {
    title: 'Guide',
    lede: 'Longer reading about Lean itself: what it is, how it works, and where to go next.',
    about: 'The Guide is independent of the levels. Read it in order or dip in. Articles link to the worlds that use their ideas.',
    tips: ['Reading an article to the end counts toward a daily quest.'],
  },
  profile: {
    title: 'Profile',
    lede: 'Your progress, achievements and settings.',
    about: 'Everything here is stored in this browser only. Export your save to keep a copy or move it to another device.',
  },
  sandbox: {
    title: 'Sandbox',
    lede: 'A free editor with everything unlocked.',
    about: 'Try `#check` and `#eval`, write your own theorems, and open them in real Lean when you want Mathlib.',
  },
  workshop: { title: 'Workshop', lede: 'Take a statement of your own from English to a proved Lean theorem.', about: 'Five steps: say it, type it, define it, state it, prove it.' },
  graduate: { title: 'Graduate', lede: 'Take what you know to real Lean and Mathlib.', about: 'The game engine is a faithful slice of Lean. This page is the bridge to the real thing.' },
};
