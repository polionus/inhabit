import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'quant' world. */
export const chapter: ChapterExplainer = {
  worldId: 'quant',
  title: 'For all and there exists: where types start to depend',
  dek: 'Mathematics is about numbers, sets and functions, not bare statements. This chapter shows that "for all" is a function, "there exists" is a pair, and why the order of two quantifiers changes the meaning.',
  guide: ['dependent-types', 'english-to-lean', 'how-to-attack-a-proof'],
  body: `## The question

Compare two sentences. "It is raining" is a single statement. "Every number is either even or odd" is a statement about infinitely many things at once. Most of mathematics looks like the second kind: for every triangle, for some prime, for no function with this property. How does a proof checker deal with "every" and "some" without checking infinitely many cases?

The answer reuses what you have. A proof of "for all" is a *function*. A proof of "there exists" is a *pair*. The only new ingredient is that the type of the output is allowed to depend on the input, which is the dependent function type from Basecamp finally earning its keep.

## Predicates

A **predicate** is a property of objects. In Lean it is a function into \`Prop\`. If \`P : Nat → Prop\`, then \`P 3\` is a statement, and so is \`P 100\`. Applying a predicate does not decide whether the result is true. It only produces a statement that may or may not have a proof. A relation is a predicate with more arguments, such as \`R : Nat → Nat → Prop\`.

## For all

\`∀ x, P x\` says that \`P x\` holds for every \`x\`. A proof is a function that takes any \`x\` and returns a proof of \`P x\`. Notice that the *type* of the result, \`P x\`, mentions the argument. This is exactly a dependent function type. The ordinary implication \`A → B\` is the special case where \`B\` does not mention the argument.

\`\`\`lean
example (P : Nat → Prop) (h : ∀ n, P n) : P 5 := h 5
example (P : Nat → Prop) : (∀ n, P n) → ∀ m, P m := fun h m => h m
\`\`\`

To use a \`∀\`, apply it to an object: \`h 5\` is a proof of \`P 5\`. In tactic mode, \`specialize h 5\` replaces \`h\` with that instance. To prove a \`∀\`, introduce an arbitrary object with \`intro n\` and prove the statement for it. The word "arbitrary" matters: you may not assume anything about \`n\` that is not already in the context.

## There exists

\`∃ x, P x\` says some \`x\` has the property. A proof is a pair, a **witness** \`w\` together with a proof \`hw : P w\`. The type of the second component depends on the value of the first, so this is a *dependent pair*.

\`\`\`lean
example : ∃ n : Nat, n + 2 = 5 := ⟨3, rfl⟩
example (P : Nat → Prop) (h : ∃ n, P n) : ∃ m, P m := by
  obtain ⟨w, hw⟩ := h
  exact ⟨w, hw⟩
\`\`\`

In tactic mode, \`use w\` supplies the witness and leaves you the proof about it. To use an existence hypothesis, \`obtain ⟨w, hw⟩ := h\` takes it apart. Afterward you hold *some* \`w\` and the fact \`hw : P w\`, and nothing else about \`w\`. You do not know which one it is. That is the point: whatever you prove must work for any witness.

## Order matters

Compare two statements about a relation \`R\`:

- \`∀ n, ∃ m, R n m\`: for each \`n\`, some \`m\` works. The \`m\` may depend on \`n\`.
- \`∃ m, ∀ n, R n m\`: one single \`m\` works for every \`n\`.

Take \`R n m\` to mean "\`m\` is bigger than \`n\`" on the natural numbers. The first is true, since you can take \`m = n + 1\`. The second is false, since no number is bigger than every number. The second statement always implies the first, but not the other way round. In English, "everyone has a friend" and "someone is everyone's friend" are exactly this difference.

## Saying it in Lean

Translating English is a skill of its own. "Every P is a Q" becomes \`∀ x, P x → Q x\`, an implication under a \`∀\`. It does not become \`∀ x, P x ∧ Q x\`, which would claim that everything is a P. And "some P is a Q" becomes \`∃ x, P x ∧ Q x\`, with a conjunction, because an implication would be satisfied by any object that is not a P. A good test is to ask what a counterexample would look like. For the first form, it is an object that is a P and not a Q.

## One proof, step by step

\`\`\`lean
example (α : Type) (P Q : α → Prop) (a : α) :
    (∀ x, P x → Q x) → P a → ∃ x, Q x := by
  intro h hp
  use a
  exact h a hp
\`\`\`

We begin with the full statement as the goal, and the objects \`α\`, \`P\`, \`Q\`, \`a\` in the context:

\`\`\`text
a : α
⊢ (∀ x, P x → Q x) → P a → ∃ x, Q x
\`\`\`

\`intro h hp\` takes the two premises:

\`\`\`text
h : ∀ x, P x → Q x
hp : P a
⊢ ∃ x, Q x
\`\`\`

The goal is an existence claim, so we owe a witness. The only object of type \`α\` anywhere is \`a\`, so \`use a\` is the natural move. The goal becomes the proof about it:

\`\`\`text
⊢ Q a
\`\`\`

Now \`h a\` is the rule instantiated at \`a\`, with type \`P a → Q a\`. Applying it to \`hp\` gives \`Q a\`. Note how \`h a hp\` is a single function applied to two arguments: first the object, then the proof about it.

## Common mistakes

**Choosing a witness that is not available.** If you write \`use b\` for a \`b\` that does not exist in the context, Lean says unknown identifier. A witness has to be something you can name.

**Assuming something about an arbitrary element.** After \`intro n\`, you do not know whether \`n\` is zero or large. Lean will not let you use that. If you need a case split, ask for one.

**Swapping the quantifier order.** If you prove \`∀ n, ∃ m, ...\` and then \`use\` a witness before \`intro n\`, you have picked \`m\` too early, and it cannot mention \`n\`.

**Forgetting that \`obtain\` hides the value.** After taking apart \`∃ x, P x\`, the \`x\` is abstract. You cannot say which number it is.

**Forgetting parentheses with negation.** \`¬∃ x, P x\` and \`∃ x, ¬P x\` are different statements. The first says none work. The second says some fail.

## Where this leads

Quantifiers are what let Lean state real mathematics, such as "every continuous function on a closed interval is bounded". In Mathlib, you will see \`∀\` and \`∃\` in nearly every statement, usually with bounds, like \`∀ x ∈ s, P x\`, which unfolds to \`∀ x, x ∈ s → P x\`. The previous chapters give you the tools. The next one, Equality Estuary, asks what it means for two objects to be the same, and how to prove it.`,
};
