import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'logic' world. */
export const chapter: ChapterExplainer = {
  worldId: 'logic',
  title: 'And, or, not: how Lean builds every connective from one idea',
  dek: "Conjunction, disjunction, falsehood, and equivalence look like four separate pieces of machinery. They're actually four inductive types, all following one simple pattern.",
  guide: ['inductive-types', 'propositions-as-types', 'how-to-attack-a-proof'],
  body: `## One blueprint for every logical connective

Proposition Peaks gave you a single connective, the arrow \`→\`. Real mathematical arguments lean on "and," "or," and "not" all the time: "\`x\` is positive and even," "either the lamp is broken or the plug is out," "it isn't raining." Does Lean need a separate built-in rulebook for each one?

It doesn't. Every connective here is an **inductive type**—a type defined by listing its **constructors**, which are the only legal ways to build a term of it. Once you see how a connective is built, you automatically know how to take it apart, because using a term means handling every constructor that could have created it. That single rhythm—build with constructors, unpack by cases—runs through the whole chapter.

## And: one constructor, two ingredients

A proof of \`P ∧ Q\` is built with \`And.intro\`, which takes a proof of \`P\` and a proof of \`Q\`. The angle-bracket notation \`⟨hp, hq⟩\` is shorthand for the same thing. Put plainly, a proof of "and" is a pair of proofs.

\`\`\`lean
example (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := ⟨hp, hq⟩
example (P Q : Prop) (h : P ∧ Q) : Q ∧ P := ⟨h.2, h.1⟩
\`\`\`

The second line unpacks a conjunction instead of building one: \`h.1\` pulls out the first proof, and \`h.2\` pulls out the second. In tactic mode, \`constructor\` splits an \`∧\` goal into two subgoals, while \`obtain ⟨hp, hq⟩ := h\` breaks a conjunction hypothesis into two named pieces.

## Or: two constructors, and you must choose

\`P ∨ Q\` has two constructors, \`Or.inl\` and \`Or.inr\`, and a proof records which side was used. To prove a disjunction, you commit to one side with \`left\` or \`right\`. To *use* a disjunction hypothesis, though, you can't pick your favorite side—the proof could have arrived from either branch. Instead you handle both possibilities with \`rcases h with hp | hq\`.

\`\`\`lean
example (P Q : Prop) : P ∨ Q → Q ∨ P := by
  intro h
  rcases h with hp | hq
  · right
    exact hp
  · left
    exact hq
\`\`\`

That case split is the eliminator for \`Or\` doing its job: to get a conclusion out of "\`P\` or \`Q\`," you show it follows from \`P\` and also show it follows from \`Q\`.

## False and not

\`False\` is the inductive type with *no* constructors at all. Since there's no way to construct a term of it, it behaves just like a logical contradiction should. And what happens when you use a term whose type has zero constructors? You have to handle every possible case, and since there are none, you're immediately done. That's why a proof of \`False\` lets you prove anything: \`exfalso\` swaps your current goal for \`False\`, and a contradiction closes it.

Negation grows straight out of \`False\`. \`¬P\` is just shorthand for \`P → False\`—a function turning any proof of \`P\` into a contradiction. So proving \`¬P\` starts with \`intro hp\` and aims for \`False\`, while using \`hn : ¬P\` means applying \`hn\` to a proof of \`P\`.

## If and only if: two arrows in a pair

\`P ↔ Q\` has a single constructor holding two proofs, \`P → Q\` and \`Q → P\`. You access those two directions as \`h.mp\` (forward) and \`h.mpr\` (backward), and \`constructor\` splits an \`↔\` goal into both halves.

\`\`\`lean
example (P Q : Prop) : P ∧ Q ↔ Q ∧ P := by
  constructor
  · intro h
    exact ⟨h.2, h.1⟩
  · intro h
    exact ⟨h.2, h.1⟩
\`\`\`

The two bullets correspond to the two directions, and here both proofs look identical because swapping a pair undoes itself. An \`↔\` really is just a pair of implications, so every tactic you already use for \`→\` and \`∧\` works without surprises. Whenever a theorem says "if and only if," read it as "I owe two proofs."

## Walking through disjunctive syllogism

Disjunctive syllogism says that if \`A ∨ B\` holds and \`A\` doesn't, then \`B\` must hold:

\`\`\`lean
example (A B : Prop) : (A ∨ B) ∧ ¬A → B := by
  intro h
  obtain ⟨hab, hna⟩ := h
  rcases hab with ha | hb
  · exfalso
    exact hna ha
  · exact hb
\`\`\`

We start with the whole implication as our goal:

\`\`\`text
⊢ (A ∨ B) ∧ ¬A → B
\`\`\`

\`intro h\` moves the premise into the context, and since it's a conjunction, \`obtain\` splits it apart:

\`\`\`text
hab : A ∨ B
hna : ¬A
⊢ B
\`\`\`

The goal \`B\` is a bare atom, so there's no connective to peel off on the right. Looking at our hypotheses instead, \`hab\` is a disjunction, so \`rcases\` splits on it. That leaves two goals, both targeting \`B\` but with different assumptions:

\`\`\`text
Case 1:  ha : A   ⊢ B
Case 2:  hb : B   ⊢ B
\`\`\`

Case 2 closes immediately with \`exact hb\`. In case 1, we hold both \`ha : A\` and \`hna : ¬A\`. The goal \`B\` has nothing to do with \`A\`, so \`exfalso\` changes the goal to \`False\`, and \`hna ha\` hands Lean the contradiction. Notice how every move was guided by the outermost connective of either the goal or a hypothesis.

## Classical logic, honestly

Everything up to this point is **constructive**: a proof of \`P ∨ Q\` actually tells you which side holds. Some everyday reasoning principles can't be proved constructively—most famously the law of excluded middle ("\`P\` or not \`P\`") and double-negation elimination ("not not \`P\` implies \`P\`"). Lean provides them through the axiom \`Classical.em\`, which powers tactics like \`by_cases\` and \`by_contra\`. That's standard, completely sound mathematics, and Lean quietly tracks wherever a theorem depends on it. Mathlib uses classical reasoning on almost every page.

## Easy mix-ups with constructors and cases

**Running \`rcases\` on the goal.** Case splits work on hypotheses, not goals. When your *goal* is \`P ∨ Q\`, pick a side with \`left\` or \`right\`.

**Picking a side too soon.** If you write \`left\` when only the right side is provable from your context, Lean won't stop you—it simply hands you a goal you can't finish. When a branch looks hopeless, step back and check whether you chose the wrong side.

**Leaving a branch unfinished.** Splitting a disjunction with \`rcases h with ha | hb\` creates two goals. Closing the first one leaves an "unsolved goals" message showing the second.

**Mixing up \`.1\` and \`.2\`.** For \`h : P ∧ Q\`, \`h.1\` has type \`P\` and \`h.2\` has type \`Q\`. If Lean reports a type mismatch with the two sides flipped, swap the projections.

**Treating \`¬P\` as a separate kind of connective.** Remember that \`¬P\` is just \`P → False\`. If you're stuck on a negated goal, try \`intro\` and see what appears in your context.

## From connectives to quantifiers and data

Building with constructors and unpacking by cases isn't a trick reserved for logic. It's the exact same mechanism behind \`Nat\`, \`List\`, and every custom data type you'll ever define in Lean, and it's where mathematical induction comes from. In the next chapter, Quantifier Quay, you'll add statements about *all* and *some* objects: \`∀\` turns out to be a dependent function, while \`∃\` is a pair whose second half depends on the first, extending this same pattern to richer mathematics.`,
};
