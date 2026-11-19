import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'fun' world. */
export const chapter: ChapterExplainer | undefined = {
  worldId: 'fun',
  title: "Injective, surjective, and Cantor: properties of functions as quantifiers",
  dek: "Ideas like 'no two inputs collide' and 'every target gets hit' unfold into plain quantifiers—and those same proof habits carry you all the way to Cantor's theorem.",
  body: `## Turning "no collisions" into something Lean can check

Anyone can grasp the sentence "this function never sends two different inputs to the same output." Mathematicians call that property *injective*, and its partner, "every possible output gets hit by some input," *surjective*. Together, those two ideas form the vocabulary of counting, inverses, and comparing the sizes of infinite sets. The question here is how to turn those everyday descriptions into statements Lean can store, assume, and prove.

The good news is you don't need any brand-new machinery. Both properties are built straight out of \`∀\`, \`∃\`, \`→\`, and \`=\`—the exact connectives and quantifiers you've already been working with.

## Composing functions and proving they're equal

The composite function \`g ∘ f\` means "run \`f\` first, then pass the result to \`g\`." It's defined as \`fun x => g (f x)\`, so applying \`g ∘ f\` to a point computes immediately to applying \`f\` and then \`g\`:

\`\`\`lean
example {α β γ : Type} (f : α → β) (g : β → γ) (x : α) : (g ∘ f) x = g (f x) := rfl
\`\`\`

Here \`rfl\` closes the goal right away because both sides reduce to the same expression. When you want to prove that two *functions* themselves are equal, you show they produce the same output on every input. The tactic \`funext x\` handles that step, turning a goal \`f = g\` into \`f x = g x\` for an arbitrary \`x\`.

## Unpacking injectivity and surjectivity

Written out in full, the two definitions look like this:

\`\`\`text
Function.Injective f   :=  ∀ a b, f a = f b → a = b
Function.Surjective f  :=  ∀ b, ∃ a, f a = b
\`\`\`

Injectivity says that equal outputs force equal inputs—which is just a crisp way of saying "no collisions." Surjectivity says that for any target \`b\`, there's some input \`a\` that lands on it. Because a proof of injectivity is a function from an equation to an equation, you can use it simply by applying it:

\`\`\`lean
example {α β : Type} (f : α → β) (h : Function.Injective f) (a b : α) (e : f a = f b) : a = b := h e
\`\`\`

And because surjectivity is a \`∀\` followed by an \`∃\`, a proof of it is a function that hands back a witness paired with evidence:

\`\`\`lean
example {α β : Type} (f : α → β) (g : β → α) (h : ∀ b, f (g b) = b) : Function.Surjective f :=
  fun b => ⟨g b, h b⟩
\`\`\`

Given a target \`b\`, the input \`g b\` serves as the witness, and \`h b\` is the proof that \`f\` sends it to \`b\`. Whenever you want to see these definitions spelled out in the goal window, the \`unfold\` tactic will open them up for you.

## Why composing two injections stays injective

Injectivity survives composition: if both \`f\` and \`g\` are injective, then \`g ∘ f\` is injective too. Think through it informally first. Suppose \`g (f a) = g (f b)\`. Because \`g\` is injective, it can't merge distinct inputs, so \`f a = f b\`. Then, because \`f\` is injective as well, \`a = b\`.

\`\`\`lean
example {α β γ : Type} (f : α → β) (g : β → γ)
    (hf : Function.Injective f) (hg : Function.Injective g) :
    Function.Injective (g ∘ f) := by
  intro a b h
  exact hf (hg h)
\`\`\`

Before any tactics run, the goal is:

\`\`\`text
⊢ Function.Injective (g ∘ f)
\`\`\`

Running \`intro a b h\` automatically unfolds \`Function.Injective\` to reveal the \`∀\` and the \`→\`:

\`\`\`text
a b : α
h : (g ∘ f) a = (g ∘ f) b
⊢ a = b
\`\`\`

Inside \`h\`, the expression \`(g ∘ f) a\` unfolds to \`g (f a)\`. That means \`h\` is already the equation \`g (f a) = g (f b)\`, so applying \`hg\` gives \`hg h : f a = f b\`. Passing that straight to \`hf\` produces \`a = b\`, closing the goal. Each injectivity hypothesis peels away one layer of the composition.

## Images, preimages, and Cantor's diagonal argument

Functions don't only act on single points; they act on whole sets too. The *image* \`f '' A\` gathers all outputs produced by points in \`A\`, so \`y ∈ f '' A\` means \`∃ x, x ∈ A ∧ f x = y\`. The *preimage* \`f ⁻¹' B\` gathers all inputs whose outputs land in \`B\`, so \`x ∈ f ⁻¹' B\` simply means \`f x ∈ B\`. Both are predicates on elements, which means every set-proof habit from Set Savanna carries straight over.

The chapter builds toward one of mathematics' great surprises: Cantor's theorem. It says that no function \`f : α → Set α\` can be surjective—you can't index every subset of \`α\` using elements of \`α\` alone. The proof defines the *diagonal set*

\`\`\`text
D = {x | x ∉ f x}
\`\`\`

which collects every point that isn't inside the subset \`f\` assigns to it. Suppose for contradiction that \`f\` actually hit \`D\`, meaning some point \`a\` satisfied \`f a = D\`. Now ask whether \`a ∈ D\`. By the definition of \`D\`, \`a ∈ D\` holds if and only if \`a ∉ f a\`, which is \`a ∉ D\`. That forces a proposition to be equivalent to its own negation, and pure logic rules that out completely:

\`\`\`lean
example (P : Prop) : ¬(P ↔ ¬P) := by
  intro h
  have hn : ¬P := fun hp => h.mp hp hp
  exact hn (h.mpr hn)
\`\`\`

Follow that short contradiction. Assuming \`h : P ↔ ¬P\`, if \`P\` were true (say \`hp : P\`), then \`h.mp hp\` would give \`¬P\`, and applying it to \`hp\` yields \`False\`—so \`¬P\` must hold. Yet once you have \`hn : ¬P\`, the backward direction \`h.mpr hn\` hands you \`P\`, contradicting \`hn\`. In Cantor's proof, \`D\` is engineered to disagree with each \`f a\` at the single spot \`a\`, and that's the entire argument.

## Where function proofs trip people up

**Losing track of the definition.** If \`intro\` refuses to run, or \`exact h\` triggers a type mismatch, pause and recall what \`Injective\` or \`Surjective\` unfolds to. Nine times out of ten, the mismatch comes from a missing \`∀\` or an equation facing backwards.

**Swapping the witness and the proof.** For \`Surjective\`, the angle-bracket pair is always \`⟨witness, evidence⟩\`. Flip the two, and Lean will complain that it expected one type and received another.

**Mixing up image and preimage.** The image lives on the output side, while the preimage lives on the input side. Seeing \`x ∈ f ⁻¹' B\` means you're looking at a statement about \`f x\`, not directly about \`x\`.

**Canceling on the wrong side.** Left-cancellation relies on injectivity; right-cancellation relies on surjectivity. If you get halfway through a proof and can't conjure up the point you need, check whether you're holding the wrong one of the two.

## Bijections, counting, and sizes of infinity

Functions are where the earlier chapters click together. Sets gave you predicates, logic gave you quantifiers, and now two compact definitions—injective and surjective—carry a huge slice of mathematics. A function that's both injective and surjective is a bijection, which is what exact counting really means on finite sets. Extending that idea to infinite sets is how Cantor proved that infinity itself comes in different sizes, a theorem you get to formalize right here.

In real Lean and Mathlib, \`Function.Injective\`, \`Function.Surjective\`, and \`Function.Bijective\` have the exact definitions above, \`Function.Injective.comp\` is the library's version of our composition proof, and Cantor's theorem lives under \`Function.cantor_surjective\`. Next, we head back to numbers, where divisibility and parity turn out to be existential statements driven by choosing and unpacking witnesses.`,
  guide: ['reading-theorems','dependent-types'],
};
