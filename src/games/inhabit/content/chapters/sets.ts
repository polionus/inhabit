import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'sets' world. */
export const chapter: ChapterExplainer | undefined = {
  worldId: 'sets',
  title: "A set is a question: set theory as logic in disguise",
  dek: "Lean defines a set as a predicate, so intersection turns into 'and', union turns into 'or', and set identities become the logic proofs you already know how to write.",
  body: `## What a set looks like to a proof checker

In school, you probably pictured a set as a bag: draw a circle on paper and toss some dots inside. That intuition works well in your head, yet a proof checker can't stare at a circle. It needs a definition built out of ingredients it already understands. Lean's definition is short enough to catch you off guard: a set of elements of type \`α\` is a *predicate*—a function that takes an element and returns a proposition.

Under that view, "the even numbers" isn't a bucket waiting to be filled with numbers. It's the question "is \`n\` even?", and a number belongs to the set exactly when you can prove the answer is yes.

## Membership is just function application

Because a set is a function, writing \`a ∈ A\` simply means "apply \`A\` to \`a\`." Set-builder notation runs in the opposite direction, packaging a question into a set:

\`\`\`lean
example (α : Type) (p : α → Prop) (a : α) (h : p a) : a ∈ {x | p x} := h
\`\`\`

Here the set \`{x | p x}\` *is* the predicate \`p\`, so saying \`a\` belongs to it is literally \`p a\`. That means a proof \`h\` of \`p a\` already counts as a proof of membership, and Lean accepts \`h\` without a single extra step. Lean unfolds that definition quietly whenever it compares types. You might barely notice it during an everyday proof, yet it's the engine behind everything in this chapter.

## Intersection, union, and complement as logic

Once membership is function application, every set operation translates straight into a logical connective you've already met.

\`\`\`lean
example (α : Type) (A B : Set α) (x : α) (h : x ∈ A ∩ B) : x ∈ A := h.1
example (α : Type) (A B : Set α) (x : α) (h : x ∈ A) : x ∈ A ∪ B := Or.inl h
example (α : Type) (A : Set α) (x : α) (h : x ∈ A) (h2 : x ∈ Aᶜ) : False := h2 h
\`\`\`

In the first line, \`x ∈ A ∩ B\` means \`x ∈ A ∧ x ∈ B\`—a pair of proofs, so \`.1\` pulls out the first piece. In the second, \`x ∈ A ∪ B\` means \`x ∈ A ∨ x ∈ B\`, and \`Or.inl\` chooses the left side. In the third, \`x ∈ Aᶜ\` means \`¬ (x ∈ A)\`, a function from membership to \`False\`, so handing it \`h\` yields a contradiction. The rest of the vocabulary follows the same pattern: \`A ⊆ B\` is \`∀ x, x ∈ A → x ∈ B\`, the empty set corresponds to \`False\`, and the whole type corresponds to \`True\`.

You don't need any brand-new tactics for this. Everything you learned in the logic chapters—\`intro\`, \`constructor\`, \`left\`, \`right\`, and \`rcases\`—works on sets right out of the box.

## Proving two sets are equal with \`ext\`

There's only one genuinely new move in this chapter. Two sets are equal when they contain the exact same elements. Lean captures that principle as a theorem called set extensionality, and you invoke it with the tactic \`ext\`. Starting from \`A = B\`, \`ext x\` hands you an arbitrary element \`x\` and changes the goal to \`x ∈ A ↔ x ∈ B\`. From there, you're right back in pure logic.

## Proving that intersection commutes

Let's prove that \`A ∩ B\` and \`B ∩ A\` are the same set.

\`\`\`lean
example (α : Type) (A B : Set α) : A ∩ B = B ∩ A := by
  ext x
  constructor
  · rintro ⟨ha, hb⟩
    exact ⟨hb, ha⟩
  · rintro ⟨hb, ha⟩
    exact ⟨ha, hb⟩
\`\`\`

The goal begins as an equation between sets:

\`\`\`text
⊢ A ∩ B = B ∩ A
\`\`\`

Running \`ext x\` replaces the set equality with a biconditional about one arbitrary element:

\`\`\`text
x : α
⊢ x ∈ A ∩ B ↔ x ∈ B ∩ A
\`\`\`

Since \`↔\` is a pair of implications, \`constructor\` splits it into two subgoals. The first asks for \`x ∈ A ∩ B → x ∈ B ∩ A\`. Because membership in an intersection is a conjunction, \`rintro ⟨ha, hb⟩\` introduces the hypothesis and unpacks both halves in one move:

\`\`\`text
x : α
ha : x ∈ A
hb : x ∈ B
⊢ x ∈ B ∩ A
\`\`\`

Now the goal is another conjunction, so an anonymous pair closes it with the two pieces swapped: \`⟨hb, ha⟩\`. The second bullet runs the exact mirror image. Look closely and you'll recognize an old friend: this is the proof of \`P ∧ Q → Q ∧ P\` you wrote chapters ago, just wearing \`x ∈\` in front of every letter.

## Common snags with set goals

**Trying to rewrite instead of letting tactics unfold.** If you try using \`rw\` to turn \`x ∈ A ∩ B\` into a conjunction, Lean may complain that it couldn't find the pattern. Most of the time you don't need a rewrite at all, because \`rintro\` and \`⟨_, _⟩\` already see straight through the definition. If you'd like to *look* at the underlying logic on screen, \`change x ∈ A ∧ x ∈ B\` rewrites the goal into plain form.

**Forgetting \`ext\` before \`constructor\`.** Calling \`constructor\` directly on \`A = B\` won't work, because an equation isn't a pair of implications. Lean will tell you the goal isn't an inductive type with the shape it expects. Start with \`ext x\` to turn the equation into an \`↔\`.

**Mixing up \`∩\` and \`∪\` patterns.** When a hypothesis lives in an intersection, you unpack both sides together with \`⟨_, _⟩\`; when it lives in a union, you split into two cases with \`rintro (h | h)\`. For goals it works in reverse: to prove an intersection you build a pair, and to prove a union you pick a side with \`left\` or \`right\`.

**Typing the complement symbol \`ᶜ\`.** Type \`\\^c\` in the editor to get \`ᶜ\`. It looks a bit like a superscript, though it isn't an exponent.

## One logic underneath all of set theory

The quiet punchline of this chapter is that you didn't have to learn a separate theory of sets. De Morgan's laws, distributivity, and identities about the empty set were all logic proofs in disguise. That kind of economy is what makes Lean so clean to work in: a tiny core logic supports whole branches of mathematics on top.

In real Lean and Mathlib, \`Set α\` is literally defined as \`α → Prop\`, just as you've seen here, backed by library lemmas like \`Set.mem_inter_iff\`, \`Set.mem_union\`, and \`Set.ext\`. Tactics like \`simp\` automate much of the routine unfolding in everyday work; this game keeps them aside for now so you can see each step happen once. In the next chapter, we'll apply the same lens to functions—unpacking injective and surjective into quantifiers and working all the way up to Cantor's theorem about infinite sizes.

## Reading any set goal through a single element

Whenever a set goal looks intimidating, don't picture overlapping circles. Ask what the statement claims about a single arbitrary element, spell that out with \`ext\`, \`intro\`, or \`change\`, and read the logic that surfaces. Union hypotheses turn into case splits, intersections turn into pairs, and subsets turn into functions. A claim that feels clunky in set notation usually shrinks to a few lines of logic. Across this chapter you'll see that pattern again and again—in De Morgan's laws, in disjointness (two sets sharing no element, written \`A ∩ B ⊆ ∅\`, which is just an implication into \`False\`), and in distributing \`∩\` over \`∪\`. Every time, the rhythm stays steady: pick an element, unfold, split into cases or pairs, and put the pieces back together.`,
  guide: ['propositions-as-types','english-to-lean'],
};
