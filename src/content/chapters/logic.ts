import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'logic' world. */
export const chapter: ChapterExplainer = {
  worldId: 'logic',
  title: 'And, or, not: how Lean builds every connective from one idea',
  dek: 'Conjunction, disjunction, falsehood and equivalence look like four new pieces of machinery. They are four inductive types, and one pattern explains how to prove and use each of them.',
  guide: ['inductive-types', 'propositions-as-types', 'how-to-attack-a-proof'],
  body: `## The question

Proposition Peaks gave you one connective, the arrow. But a real argument says "and", "or" and "not" all the time: "x is positive and even", "either the lamp is broken or the plug is out", "it is not raining". Does Lean need a separate rulebook for each?

It does not. Every connective is an **inductive type**: a type defined by listing its **constructors**, which are the only ways to build a term of it. Once you know how a connective is built, you also know how to use it, because to use a term you must handle every way it could have been built. That single pattern, build with constructors and use by cases, is the subject of this chapter.

## And: one constructor, two ingredients

A proof of \`P ∧ Q\` is built by \`And.intro\`, which takes a proof of \`P\` and a proof of \`Q\`. The anonymous constructor \`⟨hp, hq⟩\` is a shorthand. A proof of "and" is a pair of proofs.

\`\`\`lean
example (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := ⟨hp, hq⟩
example (P Q : Prop) (h : P ∧ Q) : Q ∧ P := ⟨h.2, h.1⟩
\`\`\`

The second line uses a conjunction instead of building one. \`h.1\` is its first part, \`h.2\` its second. In tactic mode, \`constructor\` splits an \`∧\` goal into two goals, and \`obtain ⟨hp, hq⟩ := h\` takes a hypothesis apart into named pieces.

## Or: two constructors, and you must choose

\`P ∨ Q\` has two constructors, \`Or.inl\` and \`Or.inr\`. A proof records which side was chosen. To prove it, you pick a side: \`left\` or \`right\`. To *use* a disjunction, you cannot choose, because the proof might have been built either way. You have to handle both cases, which is what \`rcases h with hp | hq\` does.

\`\`\`lean
example (P Q : Prop) : P ∨ Q → Q ∨ P := by
  intro h
  rcases h with hp | hq
  · right
    exact hp
  · left
    exact hq
\`\`\`

The case split is the eliminator at work. The rule is: to get something out of "P or Q", prove it from \`P\` and also prove it from \`Q\`.

## False and not

\`False\` is the inductive type with *no* constructors. There is no way to build a proof of it, which is exactly what you want from a contradiction. And what is the rule for using a term when there are no constructors? You handle every case, and there are none, so you are done. That is why a proof of \`False\` gives you anything: the tactic \`exfalso\` changes your goal to \`False\`, and then a contradiction finishes the job.

Negation is defined from it. \`¬P\` is shorthand for \`P → False\`, a function that turns any proof of \`P\` into a contradiction. So proving \`¬P\` is \`intro hp\` followed by deriving \`False\`, and using \`hn : ¬P\` is applying it to a proof of \`P\`.

## Iff

\`P ↔ Q\` has one constructor taking two proofs, \`P → Q\` and \`Q → P\`. You reach them as \`h.mp\` and \`h.mpr\`, and \`constructor\` splits an iff goal into the two directions.

\`\`\`lean
example (P Q : Prop) : P ∧ Q ↔ Q ∧ P := by
  constructor
  · intro h
    exact ⟨h.2, h.1⟩
  · intro h
    exact ⟨h.2, h.1⟩
\`\`\`

The two bullets are the two directions, and here they happen to be the same proof, because swapping is its own inverse. This is a good sanity check on the pattern: an iff is nothing more than a pair of implications, so every tool you have for \`→\` and for \`∧\` already applies. When you read "if and only if" in a textbook, you can read it as "I owe two proofs".

## One proof, step by step

Disjunctive syllogism says: if \`A ∨ B\` and not \`A\`, then \`B\`.

\`\`\`lean
example (A B : Prop) : (A ∨ B) ∧ ¬A → B := by
  intro h
  obtain ⟨hab, hna⟩ := h
  rcases hab with ha | hb
  · exfalso
    exact hna ha
  · exact hb
\`\`\`

We start with:

\`\`\`text
⊢ (A ∨ B) ∧ ¬A → B
\`\`\`

\`intro h\` moves the premise into the context. It is a conjunction, so \`obtain\` splits it:

\`\`\`text
hab : A ∨ B
hna : ¬A
⊢ B
\`\`\`

The goal \`B\` has no connective to work on. But \`hab\` is a disjunction, so we split it with \`rcases\`. That gives two goals, each with the same \`⊢ B\` but a different extra hypothesis:

\`\`\`text
Case 1:  ha : A   ⊢ B
Case 2:  hb : B   ⊢ B
\`\`\`

Case 2 is done by \`exact hb\`. In case 1 we hold \`ha : A\` and \`hna : ¬A\`. The goal \`B\` is unrelated, so \`exfalso\` changes it to \`False\`, and \`hna ha\` is a proof of \`False\`. The shape of each step was dictated by one thing: the top connective of the goal, or of a hypothesis.

## Classical logic, honestly

Everything so far is **constructive**: a proof of \`P ∨ Q\` really knows which side holds. Some familiar principles cannot be proved this way. Two of them are "\`P\` or not \`P\`" and "not not \`P\` implies \`P\`". Lean has them as the axiom \`Classical.em\`, and \`by_cases\` and \`by_contra\` use it. This is perfectly good mathematics, and Lean tracks where you relied on it. In Mathlib it is used constantly, so this is the normal way to reason there.

## Common mistakes

**Trying to \`rcases\` a goal.** Case splits apply to hypotheses. For a goal \`P ∨ Q\`, choose a side with \`left\` or \`right\`.

**Choosing a side too early.** If you write \`left\` and the left side is not provable from what you have, you are stuck, and Lean will not warn you. The proof is still valid until you hit a goal you cannot close. Backtrack and think again.

**Forgetting a case.** After \`rcases h with ha | hb\` there are two goals. Closing one leaves "unsolved goals" showing the other.

**Giving \`exact\` the wrong projection.** \`h.1\` and \`h.2\` are different. If Lean says type mismatch with \`P\` where \`Q\` was expected, swap them.

**Reading \`¬P\` as a new kind of thing.** It is a function type. If you are stuck, \`intro\` and see what you get.

## Where this leads

The idea of "constructors to build, cases to use" is not special to logic. It is how \`Nat\`, \`List\`, and every type you define work, and it is why induction exists. The next chapter, Quantifier Quay, adds statements about *all* and *some* objects. There \`∀\` becomes a dependent function and \`∃\` becomes a pair whose second part depends on the first. Same pattern, more structure.`,
};
