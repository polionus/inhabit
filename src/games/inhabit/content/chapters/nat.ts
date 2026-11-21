import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'nat' world. */
export const chapter: ChapterExplainer | undefined = {
  worldId: 'nat',
  title: "From zero and succ to induction: why a proof about every number is possible",
  dek: "Every natural number is built from zero and succ. That simple structure lets you define functions by recursion and prove facts about every number in just two steps.",
  body: `## How a finite proof can cover infinitely many numbers

Try proving that \`0 + n = n\` for every natural number \`n\`. You can check it for \`n = 5\` by hand, and a computer can check it for \`n = 5000\` in a blink. Still, "every" means infinitely many numbers, so brute-force checking never reaches the end. How can a finite proof possibly cover all of them?

It isn't a trick—it comes straight from what a natural number *is*. Once you see how numbers are constructed, you can cover every single one of them with two small arguments. That's induction, and you'll come back to it more than almost any other idea in formal mathematics.

## Building every number from zero and succ

In Lean, \`Nat\` is defined by just two constructors:

\`\`\`lean
#check Nat.zero
#check Nat.succ
example : (3 : Nat) = Nat.succ (Nat.succ (Nat.succ Nat.zero)) := rfl
\`\`\`

\`Nat.zero\` is a number, and \`Nat.succ\` takes a number and hands back the next one. The third line shows that the numeral \`3\` is really just shorthand for three \`succ\`s wrapped around \`zero\`, which \`rfl\` confirms because both sides compute to the exact same term. Every natural number is built this way, and nothing else counts as a \`Nat\`. That "nothing else" clause is what gives induction its power: to say something about all numbers, you only have to handle \`zero\` and \`succ n\`.

## Defining addition: one rule per constructor

Functions on \`Nat\` follow the same shape, giving one rule for \`zero\` and one for \`succ\`. Addition is defined by these two equations:

\`\`\`text
n + 0       = n
n + (m + 1) = (n + m) + 1
\`\`\`

Read them like a recipe. To add \`0\`, leave \`n\` alone. To add \`m + 1\`, add \`m\` first and then take one more step. Notice that the rules inspect the *second* argument, so that's the one Lean knows how to take apart. This creates a surprise that catches almost everyone at first:

\`\`\`lean
example (n : Nat) : n + 0 = n := rfl
\`\`\`

That line succeeds because the second argument is literally \`0\`, so the first rule fires right away. Try the mirror image, \`0 + n = n\`, and \`rfl\` fails. Here the second argument is an unknown variable \`n\`. Lean doesn't know whether \`n\` is \`0\` or a \`succ\`, so neither rule applies and computation stalls. Even though the two equations look completely symmetric to human eyes, one is free by definition and the other needs an actual proof.

## Turning infinitely many cases into two

To prove \`P n\` for every \`n\`, you only have to show two things: first, that \`P 0\` holds; second, that whenever \`P k\` holds, \`P (k + 1)\` holds too. The assumption \`P k\` is your induction hypothesis. You're allowed to assume it because in the second step you aren't claiming \`P k\` is true on its own—you're only showing that truth carries from one number to the next.

That's enough to cover every number because every number is \`zero\` followed by some finite stack of \`succ\`s. The base case starts the chain at \`0\`, and the step case carries the result up one rung at a time. Lean checks that you've provided one branch per constructor, which is why the \`induction\` tactic splits cleanly into two cases.

## Walking through \`0 + n = n\`

Let's prove that stuck statement from earlier.

\`\`\`lean
example (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, ih]
\`\`\`

Before any tactics run, the goal sits like this:

\`\`\`text
n : Nat
⊢ 0 + n = n
\`\`\`

After \`induction n with\`, Lean opens two subgoals, one for each constructor. The first is the base case:

\`\`\`text
⊢ 0 + 0 = 0
\`\`\`

That matches the rule \`n + 0 = n\` with \`n := 0\`, so \`rfl\` finishes it immediately. The second subgoal is the inductive step, and it hands you the induction hypothesis \`ih\`:

\`\`\`text
k : Nat
ih : 0 + k = k
⊢ 0 + (k + 1) = k + 1
\`\`\`

Now the second argument of \`+\` is visibly \`k + 1\`, so the second defining rule of addition can finally fire. The lemma \`Nat.add_succ\` states that rule: \`n + succ m = succ (n + m)\`. Running \`rw [Nat.add_succ]\` turns the goal into:

\`\`\`text
⊢ (0 + k) + 1 = k + 1
\`\`\`

Right inside the parentheses sits \`0 + k\`, which is the left side of \`ih\`. Running \`rw [ih]\` turns the goal into \`k + 1 = k + 1\`, and \`rw\` closes trivial equalities automatically. Almost every proof in this chapter follows this same rhythm: peel back the definition once to expose a smaller copy of the problem, then plug in the induction hypothesis.

## Where induction proofs usually snag

**Inducting on the wrong variable.** In a theorem like \`n + m = m + n\`, you have two variables to pick from, and only one gets the defining rules moving. Because addition recurses on its second argument, \`induction m\` gives you \`n + (m + 1)\`, where \`Nat.add_succ\` applies right away. If you induct on \`n\` instead, you end up staring at \`(n + 1) + m\` while computation stays stuck. Whenever your \`succ\` case feels frozen, check which argument the operation actually inspects.

**Reaching for \`rfl\` too early.** When \`rfl\` fails, Lean says it can't show the two sides are equal, which means they don't compute down to the same value. Look at both sides and ask which expression is stuck on an unknown variable.

**\`rw\` can't find the pattern.** When Lean says the pattern wasn't found in the goal, remember that \`rw\` looks for a *literal* match to the left side of your lemma. If your lemma has \`0 + k\` and the goal says \`k + 0\`, the rewrite won't fire. Check the current goal state and reshape it first.

**Leaving \`ih\` unused.** If you've unfolded the definition in the step case and the goal still won't close, scan for a piece that matches your induction hypothesis. Nearly every time, it's waiting right there.

## Climbing the arithmetic ladder

Starting from \`zero_add\`, you build upward step by step: \`succ_add\`, commutativity of addition, associativity, and then the matching laws for multiplication. Each theorem becomes a tool for proving the next, which is exactly how real mathematical libraries grow—small, sturdy facts stacked on top of each other.

Under the hood, recursion and induction turn out to be the same mechanism. Every inductive type comes with a recursor that explains how to consume its values; for \`Nat\`, that recursor is \`Nat.rec\`. Feed it numbers as outputs and you've defined a recursive function; feed it proofs as outputs and you've proved a theorem by induction. The \`induction\` tactic simply builds a call to \`Nat.rec\` for you.

In real Lean and Mathlib, you'll rarely prove these basic identities by hand. Lemmas like \`Nat.zero_add\`, \`Nat.add_comm\`, and \`Nat.mul_comm\` are already built in, and tactics such as \`omega\`, \`simp\`, and \`ring\` settle routine arithmetic automatically. This game leaves them out on purpose so you can see what they're doing behind the scenes. Next up, we move from numbers to collections of them—sets—and the surprisingly neat idea that a set is really just a question.`,
  guide: ['inductive-types','equality'],
};
