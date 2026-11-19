import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'eq' world. */
export const chapter: ChapterExplainer = {
  worldId: 'eq',
  title: 'Two kinds of "the same": equality by computation and by proof',
  dek: 'Lean treats 2 + 2 = 4 and a + b = b + a very differently. Seeing why unlocks rfl, rw, calc, and rewriting as a proof tool.',
  guide: ['equality', 'tactics-and-terms', 'kernel-and-trust'],
  body: `## Two reasons two things can be equal

An equation claims that two expressions are the same, yet "the same" can happen for two very different reasons. You know \`2 + 2 = 4\` just by working out the arithmetic on the left. You know \`a + b = b + a\` because it's a theorem—no amount of evaluation can simplify it while \`a\` and \`b\` are unknown variables. A proof assistant has to keep those two kinds of equality separate, because one is checked automatically and the other requires a real proof.

## Sameness by computation

Two expressions are **definitionally equal** when Lean can reduce them to the exact same term by computing: substituting arguments into function bodies, unfolding definitions, and evaluating arithmetic on concrete numbers. Lean's kernel runs this check automatically, and the tactic \`rfl\` (short for "reflexivity") asks it to confirm that both sides come out identical.

\`\`\`lean
example : 2 + 2 = 4 := rfl
def double : Nat → Nat := fun n => n + n
example : double 3 = 6 := rfl
\`\`\`

In the second example, Lean unfolds \`double 3\` to \`3 + 3\` and evaluates it to \`6\`. Since both sides compute to the same value, \`rfl\` closes the goal immediately.

Computation hits a wall, though, as soon as an unknown variable blocks the way. Lean can compute \`double 3\`, but it gets stuck on \`double n\` when \`n\` is arbitrary, because addition is defined by recursing on a number that hasn't been given a concrete value yet. As a result, some true equations like \`n + 0 = n\` are definitionally equal, while nearly identical ones like \`0 + n = n\` aren't. Which side simplifies depends on how the definition was written, and running into that asymmetry is one of the first big surprises in Lean.

## Sameness by proof

An equation \`a = b\` is a proposition like any other, which means it's a type. We say \`a\` and \`b\` are **propositionally equal** when you hold a proof term \`h : a = b\`. Every definitional equality automatically gives you a propositional proof via \`rfl\`, while true equations that computation can't reduce—like \`0 + n = n\` or \`a + b = b + a\`—need to be proved.

Once you hold an equality hypothesis, how do you actually *use* it? You substitute one side for the other. The tactic \`rw [h]\` replaces every occurrence of the left side of \`h\` in the goal with the right side. Adding a left arrow, \`rw [← h]\`, rewrites in the opposite direction, from right to left. And \`rw [h] at hx\` rewrites inside a hypothesis instead of the goal.

\`\`\`lean
example (p q r : Nat) (h1 : p = q) (h2 : q + 1 = r) : p + 1 = r := by
  rw [h1]
  exact h2
\`\`\`

## Following a rewrite through the goal

Take a closer look at how the goal state changes in that short proof. At the start, we have:

\`\`\`text
p q r : Nat
h1 : p = q
h2 : q + 1 = r
⊢ p + 1 = r
\`\`\`

The left side of \`h1\` is \`p\`, which sits right inside our goal. Running \`rw [h1]\` swaps every \`p\` in the goal for \`q\`:

\`\`\`text
⊢ q + 1 = r
\`\`\`

Now the goal matches \`h2\` on the nose, so \`exact h2\` finishes the proof. (As a convenience, Lean's \`rw\` also tries \`rfl\` right after rewriting, so if both sides become definitionally equal, the goal closes automatically.)

Why is rewriting sound in the first place? Because \`a = b\` is notation for \`Eq a b\`, an inductive type just like \`And\` and \`Or\` from earlier chapters. It has a single constructor, \`rfl : a = a\`, meaning the only primitive way to build an equality proof is to say that something equals itself. Its elimination rule is **Leibniz's principle**: if a property holds for \`a\`, and \`a = b\`, then that same property holds for \`b\`. Every rewrite in Lean is Leibniz's principle applied to your goal—and symmetry, transitivity, and congruence (\`congrArg\`) all fall straight out of that one constructor too.

## Longer chains with calc and congrArg

When a single rewrite isn't enough and you want a proof you can read like algebra on paper, \`calc\` lays out a chain of equalities with a justification on each line:

\`\`\`lean
example (a b c : Nat) (h1 : a = b) (h2 : b = c) : a = c :=
  calc a = b := h1
    _ = c := h2
\`\`\`

Each line asserts one link and names the proof behind it, while Lean checks that every step connects cleanly to the next. Two smaller tactics also pull a lot of weight: \`subst h\` takes an equation like \`x = e\` and eliminates the variable \`x\` everywhere in the context and goal, and \`symm\` flips an equality goal or hypothesis when it's pointing backwards.

Functions also respect equality: if two inputs are equal, applying the same function to both gives equal outputs. In Lean, that fact is called \`congrArg\`:

\`\`\`lean
example (f : Nat → Nat) (a b : Nat) (h : a = b) : f a = f b := congrArg f h
\`\`\`

It feels completely obvious, yet it's worth noticing that nothing special in the language hard-codes it. \`congrArg\` is an ordinary theorem proved from the single constructor of \`Eq\`. Be careful not to flip the arrow around in your head, though: \`f a = f b\` doesn't imply \`a = b\` unless \`f\` is injective (doesn't merge distinct inputs).

## Where rfl and rw usually go wrong

**\`rw\` can't find the pattern.** The most common error message from \`rw\` says the pattern wasn't found in the goal. \`rw\` looks for the left side *syntactically*, exactly as written: if your goal has \`q + p\` and your equation starts with \`p + q\`, \`rw\` won't spot a match.

**Rewriting in the wrong direction.** If you have \`h : p = q\` and the goal mentions \`q\` instead of \`p\`, use \`rw [← h]\`. Always check which side of the equation actually shows up in your target.

**Expecting \`rfl\` to prove any true equation.** \`rfl\` only verifies what computation can simplify on its own. When it fails on \`0 + n = n\`, the statement is still true—evaluation is just stuck on the variable \`n\`.

**Trying to rewrite under a binder.** \`rw\` can't reach inside a \`∀\` or \`fun\` to rewrite a bound variable. Pull the variable into your context with \`intro\` first, and then rewrite.

**Treating \`≠\` as a brand-new notion.** \`a ≠ b\` is simply shorthand for \`a = b → False\`. To prove two things aren't equal, run \`intro h\` to assume they are, and derive a contradiction.

## Equality as an inductive type, and what comes next

Equality is the first inductive type you've met whose type depends on *indices*: \`a = b\` takes two terms as part of its type. In Mathlib, a whole toolkit of automation builds on top of these same ideas—\`simp\` applies large libraries of rewrite rules automatically, while \`ring\` and \`omega\` close entire families of algebraic and arithmetic equations. Even those heavy-duty tactics end up producing an ordinary proof term built from \`rfl\` and Leibniz's principle.

Next, we step into the natural numbers, where true equations like \`0 + n = n\` refuse to fold by computation alone and mathematical induction arrives to take over.`,
};
