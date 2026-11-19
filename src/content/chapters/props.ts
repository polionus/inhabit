import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'props' world. */
export const chapter: ChapterExplainer = {
  worldId: 'props',
  title: 'Propositions are types: what a proof really is',
  dek: 'In Lean a statement is a type and a proof is a term of that type. This chapter shows why that is more than a slogan, and how five small tactics build such terms.',
  guide: ['propositions-as-types', 'tactics-and-terms', 'goal-view'],
  body: `## What is a proof, really?

Ask a mathematician what a proof of "if it rains, the street is wet" is and you will hear something like: assume it rains, then reason until you reach "the street is wet". Notice the shape. A proof of an implication is a *method*: give me a proof of the premise and I will produce a proof of the conclusion.

Now recall what you built in Basecamp. A term of type \`A → B\` is also a method: give me an \`A\` and I will produce a \`B\`. The two descriptions match. This is the **Curry–Howard correspondence**, and Lean takes it literally. A statement is a type. A proof of the statement is a term of that type. The arrow \`→\` is both the function arrow and the word "implies". There is no separate logic bolted onto the language. The logic is already there.

Why should you care? Because it turns "is this proof correct?" into "does this term have this type?", a question a small program can answer with no judgment calls.

## Statements live in Prop

The type of statements is \`Prop\`. When \`P : Prop\`, the expression \`P\` is a type, and a term \`hp : P\` is a proof of it. A statement counts as true, as far as Lean is concerned, when its type has at least one term.

\`\`\`lean
example (P Q : Prop) (hp : P) (hpq : P → Q) : Q := hpq hp
\`\`\`

Read it as logic: we have a proof of \`P\` and a proof that \`P\` implies \`Q\`, and we conclude \`Q\`. Read it as programming: \`hpq\` is a function, \`hp\` is an argument, and \`hpq hp\` is function application. It is the same line. The logical rule "modus ponens" is the typing rule for application.

The other direction is the \`fun\` rule. To prove \`P → Q\`, write a function that takes a proof of \`P\`:

\`\`\`lean
example (P : Prop) : P → P := fun hp => hp
\`\`\`

Here \`fun hp =>\` means "assume P, and call the assumption hp". The body \`hp\` then proves \`P\`.

## Tactics write the term for you

Long proofs written as bare terms get hard to read. Lean offers **tactics**: after \`by\`, you give instructions and Lean assembles the term. The state of a proof is a list of goals, each a context of hypotheses and a \`⊢\` followed by what is still to prove. Five tactics cover this chapter:

- \`exact e\` closes the goal with a finished term \`e\`.
- \`intro h\` turns a goal \`P → Q\` into the goal \`Q\`, with \`h : P\` added to the context.
- \`apply f\` works backwards: if \`f\` ends in the goal, the goal becomes whatever \`f\` still needs.
- \`have h : T := e\` records an intermediate fact under a name.
- \`assumption\` finds a hypothesis whose type is exactly the goal.

The key idea is the difference between working *forwards*, from what you have, and *backwards*, from what you want. \`apply\` is the backwards move, and it is the one that takes the most practice.

## One proof, one step at a time

Here is a four-step chain. We prove it by working backwards from the goal.

\`\`\`lean
example (A B C D : Prop) : (A → B → C) → (C → D) → A → B → D := by
  intro f g a b
  apply g
  apply f
  · exact a
  · exact b
\`\`\`

Before any tactic, the goal has no hypotheses at all:

\`\`\`text
⊢ (A → B → C) → (C → D) → A → B → D
\`\`\`

\`intro f g a b\` takes four premises off the front of the arrow chain. The state is now:

\`\`\`text
f : A → B → C
g : C → D
a : A
b : B
⊢ D
\`\`\`

We want \`D\`. Of everything in the context, only \`g : C → D\` ends in \`D\`. \`apply g\` says: "I will use \`g\`, so what remains is to produce its input." The goal becomes:

\`\`\`text
⊢ C
\`\`\`

Only \`f\` ends in \`C\`, but \`f\` needs two inputs. \`apply f\` therefore leaves two goals, one for each missing input:

\`\`\`text
⊢ A
⊢ B
\`\`\`

The bullets \`·\` focus on one goal at a time. \`exact a\` closes the first, \`exact b\` the second. Underneath, Lean built the term \`fun f g a b => g (f a b)\`. The tactics were a way of finding it.

## Common mistakes

**Using \`apply\` on the wrong hypothesis.** If Lean says it could not unify the conclusion of the hypothesis with the goal, the hypothesis does not end in what you want. Look at the *last* type after the final arrow, not the first.

**Forgetting that \`apply\` can leave several goals.** After \`apply f\` with a two-premise \`f\`, there are two goals. If you write \`exact a\` and then stop, Lean reports unsolved goals, and the goal view still shows the second one.

**Using \`exact\` with something almost right.** The type must match exactly. If you have \`hp : P\` and the goal is \`Q\`, \`exact hp\` fails with a type mismatch that shows both sides. Read the two types and ask what is missing in between.

**Calling a proof done while a \`sorry\` remains.** Lean accepts \`sorry\` with a warning so that you can check the rest. A proof with a warning is unfinished.

**Introducing too few or too many premises.** \`intro\` fails when the goal is not an arrow. If the goal has already been reduced to \`D\`, there is nothing left to introduce.

## What the kernel checks

Lean has a small trusted core called the **kernel**. It never sees your tactics. It receives the finished term and checks that its type is the statement you claimed. This is why tactics can be clever and untrusted: if one builds something wrong, the kernel rejects the result. You can inspect the term a tactic proof produced with the \`#print\` command in real Lean.

## Where this fits

Everything in this chapter was about a single connective, the arrow. In Mathlib the same tactics appear on every page, and \`exact?\` can search the library for a term that closes your goal. In Connective Canyon you add "and", "or", "not" and "if and only if". Each turns out to be a type with its own constructors, and the tactics you already know will still be the foundation.`,
};
