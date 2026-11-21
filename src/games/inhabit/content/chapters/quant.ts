import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'quant' world. */
export const chapter: ChapterExplainer = {
  worldId: 'quant',
  title: 'For all and there exists: where types start to depend',
  dek: 'Mathematics is about numbers, sets, and functions, not bare statements. Here you\'ll see how "for all" is a function, "there exists" is a pair, and why quantifier order matters.',
  guide: ['dependent-types', 'english-to-lean', 'how-to-attack-a-proof'],
  body: `## Talking about infinitely many things in one statement

Compare two sentences. "It's raining" is a single claim. "Every number is either even or odd" makes a claim about infinitely many numbers in one breath. Almost all real mathematics looks like the second kind: for every triangle, for some prime, for no continuous function with this property. How can a proof checker verify "every" and "some" without testing infinitely many cases one by one?

Lean answers that by reusing tools you already know. A proof of "for all" is a *function*, and a proof of "there exists" is a *pair*. The one new twist is that the output type is allowed to depend on the input value—the dependent function type you glimpsed back in Basecamp finally earns its keep.

## Predicates: properties as functions into Prop

A **predicate** is a property that objects can have or lack. In Lean, it's a function returning a \`Prop\`. If \`P : Nat → Prop\`, then \`P 3\` is a proposition and \`P 100\` is another. Applying \`P\` to a number doesn't decide whether the claim is true or false; it simply builds the statement, which may or may not have a proof. A **relation** is just a predicate with multiple inputs, like \`R : Nat → Nat → Prop\`.

## "For all" is a dependent function

\`∀ x, P x\` says that \`P x\` holds for every \`x\`. A proof of it is a function that takes any \`x\` and returns a proof of \`P x\`. Look closely at the return type: \`P x\` mentions the input \`x\`, which makes \`∀ x, P x\` a dependent function type. Ordinary implication \`A → B\` is just the special case where \`B\` doesn't mention the argument.

\`\`\`lean
example (P : Nat → Prop) (h : ∀ n, P n) : P 5 := h 5
example (P : Nat → Prop) : (∀ n, P n) → ∀ m, P m := fun h m => h m
\`\`\`

To use a \`∀\` hypothesis, you apply it to a specific object: \`h 5\` is a proof of \`P 5\`. In tactic mode, \`specialize h 5\` replaces \`h\` with that specific instance. To *prove* a \`∀\` goal, you bring in an arbitrary element with \`intro n\` and prove the claim for it. "Arbitrary" is doing real work here: you can't assume anything about \`n\` that isn't already in your context.

## "There exists" is a dependent pair

\`∃ x, P x\` claims that at least one \`x\` satisfies \`P\`. A proof is a pair consisting of a **witness** \`w\` and a proof \`hw : P w\`. Because the type of the second piece depends on the value of the first, Lean calls this a *dependent pair*.

\`\`\`lean
example : ∃ n : Nat, n + 2 = 5 := ⟨3, rfl⟩
example (P : Nat → Prop) (h : ∃ n, P n) : ∃ m, P m := by
  obtain ⟨w, hw⟩ := h
  exact ⟨w, hw⟩
\`\`\`

In tactic mode, \`use w\` supplies the witness and leaves you to prove \`P w\`. Going the other way, \`obtain ⟨w, hw⟩ := h\` unpacks an existence hypothesis into some \`w\` together with \`hw : P w\`. You don't know which value \`w\` actually is, and that's the whole point: whatever you prove from \`w\` has to hold no matter which witness is inside \`h\`.

## Why quantifier order flips the meaning

Compare two statements about a relation \`R\`:

- \`∀ n, ∃ m, R n m\`: for each \`n\`, some \`m\` works—and \`m\` is allowed to depend on \`n\`.
- \`∃ m, ∀ n, R n m\`: a single \`m\` works for every \`n\` simultaneously.

Suppose \`R n m\` means "\`m\` is larger than \`n\`" on the natural numbers. The first statement is true, because you can always pick \`m = n + 1\`. The second is false, because no single number beats every number. The second always implies the first, never the other way around. In everyday English, that's the gap between "everyone has a friend" and "someone is everybody's friend."

## Translating "every" and "some" from English

Turning English sentences into Lean is its own skill, and two patterns come up constantly. "Every \`P\` is a \`Q\`" translates to \`∀ x, P x → Q x\`, with an implication under the \`∀\`. It doesn't become \`∀ x, P x ∧ Q x\`, which would assert that everything in the universe is a \`P\`. On the flip side, "some \`P\` is a \`Q\`" becomes \`∃ x, P x ∧ Q x\`, using a conjunction—an implication there would be trivially true whenever *any* non-\`P\` object exists. When you're unsure which connective fits, test what a counterexample would look like: a counterexample to "every \`P\` is a \`Q\`" is an object that's a \`P\` and not a \`Q\`.

## Combining a universal rule with a witness

Watch how \`∀\` and \`∃\` fit together in a short proof:

\`\`\`lean
example (α : Type) (P Q : α → Prop) (a : α) :
    (∀ x, P x → Q x) → P a → ∃ x, Q x := by
  intro h hp
  use a
  exact h a hp
\`\`\`

We start with \`α\`, \`P\`, \`Q\`, and \`a\` in scope and the implication as our goal:

\`\`\`text
a : α
⊢ (∀ x, P x → Q x) → P a → ∃ x, Q x
\`\`\`

\`intro h hp\` moves both premises into the context:

\`\`\`text
h : ∀ x, P x → Q x
hp : P a
⊢ ∃ x, Q x
\`\`\`

Since the goal asks for an existence proof, we owe a witness of type \`α\`. The only element of \`α\` in sight is \`a\`, so \`use a\` is the natural choice, leaving us to prove \`Q\` about it:

\`\`\`text
⊢ Q a
\`\`\`

Applying \`h\` to \`a\` gives \`h a : P a → Q a\`, and feeding \`hp\` into that produces \`Q a\`. Notice that \`h a hp\` is just one function applied to two arguments in a row: first the object \`a\`, then the proof \`hp\`.

## Quantifier traps to watch out for

**Naming a witness that isn't in scope.** Writing \`use b\` when there's no \`b\` in your context triggers "unknown identifier." A witness has to be an actual expression you can build from what you have.

**Assuming something special about an arbitrary variable.** After \`intro n\`, you don't know whether \`n\` is zero, even, or huge, and Lean won't let you pretend otherwise. If your argument depends on cases, split on them explicitly.

**Running \`use\` before \`intro\`.** On a goal like \`∀ n, ∃ m, ...\`, if you try to pick a witness before introducing \`n\`, you've chosen \`m\` too early and it can't mention \`n\`.

**Expecting \`obtain\` to reveal a concrete value.** Unpacking \`∃ x, P x\` gives you an abstract \`x\`. You know \`P x\` holds, and nothing else—you can't inspect which number \`x\` equals.

**Dropping parentheses around negation.** \`¬∃ x, P x\` and \`∃ x, ¬P x\` say very different things: the first says *nothing* satisfies \`P\`, while the second only says *something* fails \`P\`.

## Quantifiers in the rest of mathematics

With \`∀\` and \`∃\` in hand, Lean can state real theorems like "every continuous function on a closed interval is bounded." In Mathlib, quantifiers appear in nearly every declaration, often with bounded notation like \`∀ x ∈ s, P x\`, which is just shorthand for \`∀ x, x ∈ s → P x\`. Next, in Equality Estuary, we turn to a deceptively simple question: what does it mean for two objects to be equal, and how do you prove it?`,
};
