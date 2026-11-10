/** Beginner-friendly explanations for every DiagnosticCode. Lean's raw message is always shown too. */
import type { Diagnostic, DiagnosticCode } from '../../engine/types.ts';

export interface Explanation {
  /** What this means. */
  what: string;
  /** What to try. */
  tryThis: string[];
}

const q = (s: string | undefined) => (s ? `\`${s}\`` : '');
const oneLine = (s: string | undefined) => (s ? s.replace(/\s+/g, ' ').trim() : '');

type Explainer = (d: Diagnostic) => Explanation;

const table: Record<DiagnosticCode, Explainer> = {
  parse: () => ({
    what: "Lean could not read this as valid syntax, so it stopped at the marked spot. Often something just before it is missing or extra.",
    tryThis: [
      'Look at the character where the squiggle starts, and at the line above it.',
      'Check brackets pair up, and that each tactic is on its own line with the same indentation.',
      'Wrote a symbol like `→` by hand? Type `\\to` and press space.',
    ],
  }),
  'unknown-identifier': (d) => ({
    what: `Lean does not know a name ${q(d.data?.name)}. Either it is misspelled, it has not been unlocked yet, or you did not introduce it.`,
    tryThis: [
      ...(d.data?.suggestions?.length ? [`Did you mean ${d.data.suggestions.slice(0, 3).map(q).join(' or ')}?`] : []),
      'Names are case-sensitive: `Nat.add_comm` is not `nat.add_comm`.',
      'Open the inventory to see which lemmas you can use here.',
      'Variables from `intro` or `obtain` only exist after that line runs.',
    ],
  }),
  'unknown-tactic': (d) => ({
    what: `${d.data?.tactic ? q(d.data.tactic) + ' is' : 'This is'} not a tactic Lean recognises here.`,
    tryThis: [
      ...(d.data?.suggestions?.length ? [`Did you mean ${d.data.suggestions.slice(0, 3).map(q).join(' or ')}?`] : []),
      'Check the spelling, or look in the inventory for the tactics you have.',
      'Only tactics go on their own lines. A term needs `exact` in front of it.',
    ],
  }),
  'tactic-locked': (d) => ({
    what: `${q(d.data?.tactic)} is a real Lean tactic, but this level has not unlocked it yet. The game keeps your toolbox small on purpose, so each new tool lands when you are ready for it.`,
    tryThis: [
      'Try another way with the tactics in your inventory.',
      'Curious anyway? Turn off the inventory lock under Profile, or use the Sandbox.',
    ],
  }),
  'name-locked': (d) => ({
    what: `The lemma ${q(d.data?.name)} is blocked in this level, because proving it (or something like it) is the point of the exercise.`,
    tryThis: ['Build the result from simpler pieces instead.', 'The hint ladder can point at what to use.'],
  }),
  'type-mismatch': (d) => ({
    what: 'You gave Lean a term of one type where it needed another. Types are the whole game here: every proof is a term whose type is the statement.',
    tryThis: [
      d.data?.expected && d.data?.actual
        ? `Lean expected ${q(oneLine(d.data.expected))} but got something of type ${q(oneLine(d.data.actual))}.`
        : 'Compare "expected" and "has type" in the message line by line.',
      'Is it the right hypothesis? Is an argument missing, or in the wrong order?',
      'Move the cursor onto the line above and read the goal: that is the type you must produce.',
    ],
  }),
  'function-expected': () => ({
    what: 'Something was applied to an argument as if it were a function, but it is not one. In Lean, `f x` only makes sense when `f` has an arrow (or ∀) type.',
    tryThis: [
      'Check the type of the thing on the left of the argument.',
      'For `h x` the type of `h` should look like `A → B` or `∀ x, …`.',
      'If you wanted two separate things, check the parentheses.',
    ],
  }),
  'unsolved-goals': () => ({
    what: 'The proof ended, but some goals are still open. Every goal needs to be closed before the proof counts.',
    tryThis: [
      'Read the goals listed below: that is exactly what is left to prove.',
      'Keep going from the last line, using the hypotheses above the `⊢`.',
      'Use `sorry` temporarily to skip a part while you work on another.',
    ],
  }),
  'no-goals': () => ({
    what: 'A tactic ran after everything was already proved, so there is nothing left for it to do.',
    tryThis: ['Delete this line and any lines after it.', 'An earlier tactic probably finished the job; check which one by moving the cursor.'],
  }),
  'tactic-failed': (d) => ({
    what: `${d.data?.tactic ? q(d.data.tactic) : 'This tactic'} could not do what you asked on the current goal.`,
    tryThis: [
      'Check the goal at the start of this line: does its shape match what the tactic expects?',
      'Read Lean\'s message for the reason; it usually names the mismatch.',
      'Try the tactic\'s entry in the Codex for how it should be used.',
    ],
  }),
  'rewrite-failed': (d) => ({
    what: `\`rw\` looks for ${d.data?.pattern ? q(oneLine(d.data.pattern)) : 'the left side of your equation'} in the goal, character for character, and did not find it.`,
    tryThis: [
      'Look at the goal: is that exact shape in there? `rw` does not see through definitions like `∈` or `⊆`.',
      'Try `←` to rewrite right-to-left: `rw [← h]`.',
      'Supply the arguments, e.g. `rw [Nat.add_comm a b]`, so it picks the right spot.',
    ],
  }),
  'not-inductive': () => ({
    what: 'You tried to split something apart (cases, induction, constructor) that is not an inductive type with constructors to split on.',
    tryThis: [
      'Check the type of the thing you are splitting. `∧`, `∨`, `∃`, `Nat` and `False` can be split; plain functions cannot.',
      'For a statement like `¬ P` or `P → Q`, use `intro` first.',
    ],
  }),
  unification: () => ({
    what: 'Lean could not work out one of the pieces on its own (an implicit argument or a `_`), usually because it had two or more possible answers.',
    tryThis: [
      'Give the missing argument explicitly, e.g. `Nat.add_comm a b` instead of `Nat.add_comm`.',
      'Add a type annotation like `(h : P ∧ Q)` so Lean knows what to match.',
      'With `apply`, try `exact` and spell out the arguments.',
    ],
  }),
  sorry: () => ({
    what: '`sorry` is a promise to prove something later. Lean accepts it with a warning, but the proof is not finished.',
    tryThis: ['Replace each `sorry` with real steps.', 'It is great for sketching: write the plan with `sorry`, then fill the holes one by one.'],
  }),
  mode: () => ({
    what: 'This level asks you to write the proof in a particular style (a term, or tactics), and what you wrote is the other style.',
    tryThis: [
      'Term-mode levels need a plain expression after `:=`, with no `by`.',
      'Remember `fun x => …` builds a function and `⟨a, b⟩` builds a pair.',
    ],
  }),
  timeout: () => ({
    what: 'Lean gave up after too much computing. The expression is probably unfolding without end, or is very large.',
    tryThis: ['Look for a loop or an unexpected recursion.', 'Break the step into smaller `have` steps.'],
  }),
  'command-output': () => ({
    what: 'This is not an error: it is the answer to a `#check`, `#eval`, `#print` or `#reduce` command.',
    tryThis: ['`#check e` shows the type of `e`.', '`#eval e` computes it.'],
  }),
  other: () => ({
    what: 'Lean reported a problem that does not fit a familiar pattern.',
    tryThis: ['Read the message slowly; it usually names the exact thing that is wrong.', 'If stuck, delete the last line you wrote and try again.'],
  }),
};

export function explain(d: Diagnostic): Explanation {
  const f = table[d.code] ?? table.other;
  return f(d);
}

export const ALL_CODES = Object.keys(table) as DiagnosticCode[];
