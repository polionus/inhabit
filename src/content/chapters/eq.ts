import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'eq' world. */
export const chapter: ChapterExplainer = {
  worldId: 'eq',
  title: 'Two kinds of "the same": equality by computation and by proof',
  dek: 'Lean treats 2 + 2 = 4 and a + b = b + a very differently. Understanding why explains rfl, rw, calc, and how an equation becomes a tool for changing a goal.',
  guide: ['equality', 'tactics-and-terms', 'kernel-and-trust'],
  body: `## The question

An equation says two things are the same. But "the same" can hold for two quite different reasons. You know \`2 + 2 = 4\` by working out the left side. You know \`a + b = b + a\` because someone proved it, and no amount of working things out will show it while \`a\` and \`b\` are unknown. A proof assistant has to tell these apart, because one needs a proof and the other needs none. That difference is the plot of this chapter.

## Sameness by computation

Two terms are **definitionally equal** when Lean can make them identical by computing: substituting arguments into function bodies, unfolding definitions, and evaluating arithmetic on numerals. The kernel does this check on its own. The tactic \`rfl\`, from "reflexivity", asks the kernel to check it.

\`\`\`lean
example : 2 + 2 = 4 := rfl
def double : Nat → Nat := fun n => n + n
example : double 3 = 6 := rfl
\`\`\`

In the second example, Lean replaces \`double 3\` by its definition and then evaluates. There is nothing to prove, only something to compute.

Computation has limits. It cannot see through a variable. Lean can evaluate \`double 3\` but is stuck on \`double n\` when \`n\` is unknown, because the definition of addition recurses on a number that is not yet a numeral. So some true equations, like \`n + 0 = n\`, are definitional, and others, like \`0 + n = n\`, are not. The difference depends on how the definitions are written, and it is one of the surprises of this chapter.

## Sameness by proof

A statement \`a = b\` is an ordinary proposition, and so a type. It is **propositionally equal** when you hold a proof \`h : a = b\`. Every definitional equality gives such a proof (namely \`rfl\`), but many true equations have no definitional proof, so they need real work.

The real work starts with a different question: how do you *use* an equation you hold? You replace one side by the other. The tactic \`rw [h]\` rewrites every occurrence of the left side of \`h\` in the goal with the right side. \`rw [← h]\` goes the other way. \`rw [h] at hx\` changes a hypothesis instead of the goal.

\`\`\`lean
example (p q r : Nat) (h1 : p = q) (h2 : q + 1 = r) : p + 1 = r := by
  rw [h1]
  exact h2
\`\`\`

## One proof, step by step

The goal and context at the start are:

\`\`\`text
p q r : Nat
h1 : p = q
h2 : q + 1 = r
⊢ p + 1 = r
\`\`\`

The left side of \`h1\` is \`p\`, which appears in the goal. After \`rw [h1]\`, every \`p\` is replaced by \`q\`:

\`\`\`text
⊢ q + 1 = r
\`\`\`

That is exactly \`h2\`, so \`exact h2\` closes it. (Lean's \`rw\` also tries \`rfl\` afterwards, so sometimes the goal is closed for you at once.)

Why does this work at all? Because \`a = b\` is notation for \`Eq a b\`, an inductive type, like the connectives of the last chapters. It has one constructor, \`rfl : a = a\`. The only way to build a proof of equality is to say that a thing equals itself. The rule for using such a proof is called **Leibniz's principle**: if you prove something about \`a\` when \`b\` is \`a\`, you have proved it for any \`b\` equal to \`a\`. Rewriting is that principle applied to your goal. So are symmetry, transitivity and the fact that functions respect equality (\`congrArg\`). All of them follow from the single constructor.

## Longer chains

When one rewrite is not enough, \`calc\` lays out a chain of equalities, one reason per step:

\`\`\`lean
example (a b c : Nat) (h1 : a = b) (h2 : b = c) : a = c :=
  calc a = b := h1
    _ = c := h2
\`\`\`

Each line says "this equals that, because of this fact". Lean checks that the steps connect. Two other tools matter. \`subst h\` uses an equation \`x = e\` to remove the variable \`x\` everywhere. \`symm\` flips an equation if you hold it the wrong way round.

Functions also respect equality. If two inputs are equal, the outputs are equal, and \`congrArg\` says exactly that:

\`\`\`lean
example (f : Nat → Nat) (a b : Nat) (h : a = b) : f a = f b := congrArg f h
\`\`\`

This looks obvious, and it is worth noticing why. Nothing in the language forces it. It is a theorem, proved from the one constructor of equality, and the converse is false: \`f a = f b\` does not give \`a = b\` unless \`f\` loses no information. Mixing up these two directions is a classic slip, so keep the arrow straight in your head.

## Common mistakes

**\`rw\` cannot find the pattern.** The most frequent error says that the pattern was not found in the goal and names the pattern. \`rw\` searches for the left side *exactly as written*. If the goal contains \`q + p\` and your rule is about \`p + q\`, there is nothing to match.

**Rewriting in the wrong direction.** If \`h : p = q\` and the goal mentions \`q\` rather than \`p\`, use \`rw [← h]\`. Check which side of the equation your goal contains.

**Expecting \`rfl\` to prove everything true.** \`rfl\` only proves what computation can show. If it fails on \`0 + n = n\`, the statement is fine. Computation is just stuck on a variable.

**Rewriting under a binder.** \`rw\` cannot rewrite a variable that a quantifier or a \`fun\` has bound. Introduce the variable first with \`intro\`, and then rewrite.

**Confusing \`≠\` with a new idea.** \`a ≠ b\` is \`a = b → False\`. To prove it, \`intro h\` and look for a contradiction.

## Where this leads

Equality is the first example in this game of an inductive type with *indices*: the type \`a = b\` depends on two terms. It is worth knowing that Mathlib has many tactics built on the same idea. \`simp\` rewrites with a large set of equations automatically, and \`ring\` and \`omega\` decide whole families of equations. Each of them ends by producing a proof term built from \`rfl\` and Leibniz's principle.

The next chapter turns to the natural numbers. There equations like \`0 + n = n\` are true but not definitional, and a new tool, induction, is how you prove them.`,
};
