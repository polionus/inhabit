import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'props' world. */
export const chapter: ChapterExplainer = {
  worldId: 'props',
  title: 'Propositions are types: what a proof really is',
  dek: "In Lean, a statement is a type and a proof is a term of that type. Here's why that's more than a slogan, and how five small tactics build proofs.",
  guide: ['propositions-as-types', 'tactics-and-terms', 'goal-view'],
  body: `## Proofs as functions

Ask a mathematician what a proof of "if it rains, the street is wet" looks like, and you'll hear something along these lines: assume it rains, then reason step by step until you arrive at "the street is wet." Look at the shape of that answer. A proof of an implication is a *method*: hand me a proof of the premise, and I'll hand you back a proof of the conclusion.

Now think back to the functions you built in Basecamp. A term of type \`A → B\` is the exact same kind of method: hand me an \`A\`, and I'll hand you back a \`B\`. That match is called the **Curry–Howard correspondence**, and Lean builds its whole foundation on it. Every mathematical statement is a type, every proof is a term of that type, and the arrow \`→\` doubles as both "function from" and "implies." Rather than bolting a separate logic onto a programming language, Lean uses the same type system for both.

That design pays off immediately: checking whether a proof is valid reduces to checking whether a term has the claimed type, which a small program can verify mechanically with zero guesswork.

## Statements live in Prop

Mathematical statements have their own sort, called \`Prop\`. When \`P : Prop\`, \`P\` is a type, and a term \`hp : P\` is a proof of it. As far as Lean is concerned, a statement is true once you've shown that its type has at least one term.

\`\`\`lean
example (P Q : Prop) (hp : P) (hpq : P → Q) : Q := hpq hp
\`\`\`

Read that line as logic: we have a proof of \`P\` and a proof that \`P\` implies \`Q\`, so we conclude \`Q\`. Read it as programming: \`hpq\` is a function, \`hp\` is its input, and \`hpq hp\` applies the function to the input. It's the exact same expression either way—the classic logical rule *modus ponens* is just function application.

Going the other way uses \`fun\`. To prove \`P → Q\`, you write a function that accepts a proof of \`P\` and returns a proof of \`Q\`:

\`\`\`lean
example (P : Prop) : P → P := fun hp => hp
\`\`\`

Here \`fun hp =>\` reads as "assume \`P\`, and call that assumption \`hp\`." Returning \`hp\` right away finishes the proof of \`P\`.

## Tactics write the term for you

Writing a long proof as one big nested term gets tangled fast. Instead, Lean lets you drop into **tactic mode** with \`by\`, where you give step-by-step instructions and Lean assembles the underlying term behind the scenes. At each step, Lean shows you a list of open goals, each with your available hypotheses above a turnstile \`⊢\` and what's still left to prove below it. Five small tactics handle everything in this chapter:

- \`exact e\` closes the goal with a finished term \`e\`.
- \`intro h\` peels the premise off a goal \`P → Q\`, leaving the goal \`Q\` and adding \`h : P\` to your hypotheses.
- \`apply f\` works backwards: if \`f\` concludes with the current goal, the goal splits into whatever inputs \`f\` still needs.
- \`have h : T := e\` names an intermediate fact so you can reuse it later.
- \`assumption\` looks through your hypotheses for one whose type matches the goal on the nose.

The biggest mental shift here is moving between *forward* reasoning (combining what you already have) and *backward* reasoning (working from what you want). \`apply\` is the backward move, and it usually takes a little practice before it feels natural.

## Working backwards through a four-step chain

Take a look at a longer chain of implications, solved backwards from the target:

\`\`\`lean
example (A B C D : Prop) : (A → B → C) → (C → D) → A → B → D := by
  intro f g a b
  apply g
  apply f
  · exact a
  · exact b
\`\`\`

At the start, the context is empty and the whole chain sits in the goal:

\`\`\`text
⊢ (A → B → C) → (C → D) → A → B → D
\`\`\`

Running \`intro f g a b\` pulls four premises off the front of the arrow chain and names them, giving us:

\`\`\`text
f : A → B → C
g : C → D
a : A
b : B
⊢ D
\`\`\`

Now we want \`D\`. Scanning the context, only \`g : C → D\` ends in \`D\`. Writing \`apply g\` tells Lean, "I'll finish this using \`g\`, so let me prove its input instead." The goal shifts to:

\`\`\`text
⊢ C
\`\`\`

Only \`f\` ends in \`C\`, and \`f\` asks for two inputs. So \`apply f\` replaces our single goal with two smaller ones:

\`\`\`text
⊢ A
⊢ B
\`\`\`

The bullets \`·\` let you focus on one goal at a time: \`exact a\` closes the first, and \`exact b\` closes the second. Under the hood, Lean stitched together the term \`fun f g a b => g (f a b)\`. Tactics are simply a more comfortable way of discovering that term.

## Five tactic snags to watch for

**Calling \`apply\` on the wrong hypothesis.** If Lean says it couldn't unify the conclusion of your hypothesis with the goal, check the *final* type after the last arrow, not the first one. \`apply\` only matches what a hypothesis produces at the very end.

**Missing extra goals left by \`apply\`.** When \`f\` takes two premises, \`apply f\` creates two goals. If you solve the first with \`exact a\` and stop, Lean flags "unsolved goals" and leaves the second one sitting in the goal view.

**Giving \`exact\` something that's almost right.** \`exact\` insists on an exact type match. If you hold \`hp : P\` while the goal is \`Q\`, \`exact hp\` fails with a type mismatch showing both types—compare them to see what bridge is missing between them.

**Leaving a \`sorry\` behind.** Lean lets you write \`sorry\` as a placeholder so you can check the rest of a proof, but it marks the file with a warning. A proof with a \`sorry\` isn't finished yet.

**Running \`intro\` when there's no arrow left.** \`intro\` only peels off an implication (or later, a \`∀\`). Once the goal has been reduced to a bare proposition like \`D\`, there's nothing left to introduce.

## What the kernel checks

At the heart of Lean sits a small, carefully audited program called the **kernel**. It never reads your tactics at all. Once tactic mode finishes, Lean hands the completed proof term to the kernel, which checks whether that term really has the stated type. That separation means tactics can be as clever or experimental as their authors like: if a buggy tactic ever builds a bogus term, the kernel rejects it. In real Lean, you can even run \`#print\` on a theorem to inspect the exact term your tactics built.

## Beyond the arrow

Every proof in this chapter used just one logical connective, the arrow \`→\`. You'll see these same five tactics on nearly every page of Mathlib—alongside helpers like \`exact?\` that search the library for a closing term. Next, in Connective Canyon, you'll bring in "and," "or," "not," and "if and only if." Each of them turns out to be an ordinary type built from constructors, and the tactics you've practiced here stay right at the center of how you work with them.`,
};
