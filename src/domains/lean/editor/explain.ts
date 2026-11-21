/** Beginner-friendly explanations for every DiagnosticCode. Lean's raw message is always shown too. */
import type { Diagnostic, DiagnosticCode } from '../engine/types.ts';

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
    what: "Lean couldn't parse this as valid syntax, so it stopped at the underlined spot. Usually something right before it is missing or out of place.",
    tryThis: [
      'Check the character where the squiggle starts, and glance at the line right above it.',
      'Make sure parentheses and brackets pair up, and that tactics on the same level share the same indentation.',
      'Typed a symbol like `→` by hand? Try `\\to` followed by space.',
    ],
  }),
  'unknown-identifier': (d) => ({
    what: `Lean doesn't recognize the name ${q(d.data?.name)}. It may be misspelled, not unlocked yet, or not introduced yet.`,
    tryThis: [
      ...(d.data?.suggestions?.length ? [`Did you mean ${d.data.suggestions.slice(0, 3).map(q).join(' or ')}?`] : []),
      'Names are case-sensitive: `Nat.add_comm` is not the same as `nat.add_comm`.',
      'Check the Inventory to see which lemmas are available in this level.',
      'Variables introduced by `intro` or `obtain` only exist on the lines after them.',
    ],
  }),
  'unknown-tactic': (d) => ({
    what: `${d.data?.tactic ? q(d.data.tactic) + " isn't" : "This isn't"} a tactic Lean recognizes here.`,
    tryThis: [
      ...(d.data?.suggestions?.length ? [`Did you mean ${d.data.suggestions.slice(0, 3).map(q).join(' or ')}?`] : []),
      'Check the spelling, or open the Inventory to see your unlocked tactics.',
      'Only tactics go on their own line—if you meant to give a proof term directly, put `exact` in front of it.',
    ],
  }),
  'tactic-locked': (d) => ({
    what: `${q(d.data?.tactic)} is a real Lean tactic, just not unlocked yet in this level.`,
    tryThis: [
      'Try solving this with the tactics in your Inventory instead.',
      'Want to use anything you know? You can turn off the tactic lock in Profile, or experiment in the Sandbox.',
    ],
  }),
  'name-locked': (d) => ({
    what: `${q(d.data?.name)} is blocked in this level because proving it (or a close relative) is the point of the exercise.`,
    tryThis: ['Build the proof from simpler pieces instead.', 'Open the Stuck panel if you want a nudge on where to start.'],
  }),
  'type-mismatch': (d) => ({
    what: 'Lean was expecting one type here and got a different one.',
    tryThis: [
      d.data?.expected && d.data?.actual
        ? `Expected ${q(oneLine(d.data.expected))}, got ${q(oneLine(d.data.actual))}. Compare them symbol by symbol.`
        : 'Compare "expected" and "has type" in the message above.',
      'Check whether you picked the right hypothesis, missed an argument, or swapped two arguments.',
      'Put your cursor on the line above to see the exact goal Lean is asking for.',
    ],
  }),
  'function-expected': () => ({
    what: "You're applying something to an argument as if it were a function, but it isn't one. In Lean, `f x` only works when `f` has an arrow (`→`) or `∀` type.",
    tryThis: [
      'Check the type of the name on the left of the argument.',
      'For `h x` to work, `h` needs a type like `A → B` or `∀ x, …`.',
      'If you meant to group an argument differently, check your parentheses.',
    ],
  }),
  'unsolved-goals': () => ({
    what: "Your proof ran to the end, but there's still at least one open goal left to close.",
    tryThis: [
      'Read the remaining goals below—they show exactly what still needs proving.',
      'Add another step at the end using the hypotheses above `⊢`.',
      'If there are multiple goals, you can drop `sorry` into one while you work on another.',
    ],
  }),
  'no-goals': () => ({
    what: "There are no goals left to prove here—an earlier line already finished the proof.",
    tryThis: ['Delete this line and anything after it.', 'Move your cursor up line by line to see which tactic closed the last goal.'],
  }),
  'tactic-failed': (d) => ({
    what: `${d.data?.tactic ? q(d.data.tactic) : 'This tactic'} couldn't apply to the current goal.`,
    tryThis: [
      'Put your cursor at the start of this line and check whether the goal shape matches what the tactic expects.',
      "Read Lean's raw message above—it usually names the exact mismatch.",
      "Check the tactic's Codex entry for a quick usage example.",
    ],
  }),
  'rewrite-failed': (d) => ({
    what: `\`rw\` searched the goal for ${d.data?.pattern ? q(oneLine(d.data.pattern)) : 'the left side of your equation'} literally and didn't find it.`,
    tryThis: [
      "Check whether that exact expression appears in the goal—`rw` won't unfold definitions like `∈` or `⊆` on its own.",
      'Need to rewrite right-to-left instead? Put a left arrow in front: `rw [← h]`.',
      'Pass explicit arguments, like `rw [Nat.add_comm a b]`, so Lean knows which subexpression to match.',
    ],
  }),
  'not-inductive': () => ({
    what: "You tried to split or do cases on something that isn't an inductive type.",
    tryThis: [
      'Check the type of what you are splitting: `∧`, `∨`, `∃`, `Nat`, and `False` can be taken apart; plain implications and functions cannot.',
      'If the goal is `¬P` or `P → Q`, start with `intro` instead.',
    ],
  }),
  unification: () => ({
    what: "Lean couldn't figure out one of the missing pieces (an implicit argument or `_`) on its own—usually because more than one choice could fit.",
    tryThis: [
      'Spell out the missing arguments, like `Nat.add_comm a b` instead of plain `Nat.add_comm`.',
      'Add a type annotation like `(h : P ∧ Q)` so Lean has more to match against.',
      'If `apply` got stuck, try `exact` with the arguments written out.',
    ],
  }),
  sorry: () => ({
    what: '`sorry` is a placeholder saying "I\'ll prove this part later." Lean accepts it with a warning, so the proof isn\'t complete yet.',
    tryThis: ['Replace each `sorry` with real steps.', "It's handy for outlining: sketch the structure with `sorry`, then fill in one hole at a time."],
  }),
  mode: () => ({
    what: 'This level expects the other proof style—a direct term instead of tactics, or tactics instead of a term.',
    tryThis: [
      'Term-mode levels take a plain expression right after `:=`, without `by`.',
      'Remember `fun x => …` builds a function and `⟨a, b⟩` builds a pair.',
    ],
  }),
  timeout: () => ({
    what: 'Lean ran out of steps while trying to simplify this expression—it is probably unfolding in a loop or getting huge.',
    tryThis: ['Check for an unintended recursive loop.', 'Break the proof into smaller `have` steps.'],
  }),
  'command-output': () => ({
    what: "Not an error—this is Lean's output from a `#check`, `#eval`, `#print`, or `#reduce` command.",
    tryThis: ['`#check e` shows the type of `e`.', '`#eval e` computes its value.'],
  }),
  other: () => ({
    what: "Lean hit an error that doesn't match one of the usual categories.",
    tryThis: ['Read the raw message slowly—it usually points to the exact expression that went wrong.', 'If you are stuck, undo your last line and build back up one step at a time.'],
  }),
};

export function explain(d: Diagnostic): Explanation {
  const f = table[d.code] ?? table.other;
  return f(d);
}

export const ALL_CODES = Object.keys(table) as DiagnosticCode[];
