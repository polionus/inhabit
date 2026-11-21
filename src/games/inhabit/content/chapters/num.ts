import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'num' world. */
export const chapter: ChapterExplainer | undefined = {
  worldId: 'num',
  title: "Divisibility and parity: proofs that are a number and a check",
  dek: "Divides, even, and odd all unfold into existential statements, so proving one means picking a witness and checking an equation, while using one means unpacking it.",
  body: `## What does "6 divides 12" actually say?

You can check that 6 divides 12 in half a second by dividing. Still, what *is* the mathematical statement behind it—written precisely enough that a proof assistant can store a proof, assume it as a hypothesis, and take it apart? Without an answer to that, you can't prove general facts like "if \`a\` divides \`b\` and \`b\` divides \`c\`, then \`a\` divides \`c\`."

In Lean, all of these number-theory properties share one simple core: they assert that a specific number *exists*.

## Definitions that hide a witness

Saying "\`a\` divides \`b\`" means \`b\` is \`a\` multiplied by some number. In Lean, \`a ∣ b\` is defined as \`∃ c, b = a * c\`. (Type the divides bar with \`\\mid\`—it isn't the vertical pipe \`|\` on your keyboard.) Parity works the same way: \`Even n\` means \`∃ r, n = r + r\`, and \`Odd n\` means \`∃ k, n = 2 * k + 1\`.

To prove an existential statement, you supply a **witness** together with **evidence** that it satisfies the equation, wrapped in angle brackets as \`⟨witness, evidence⟩\`:

\`\`\`lean
example : 3 ∣ 12 := ⟨4, rfl⟩
example : Even 10 := ⟨5, rfl⟩
example : Odd 7 := ⟨3, rfl⟩
\`\`\`

In the first line, the witness is \`c = 4\` and the evidence is \`12 = 3 * 4\`, which Lean can check by computation, so \`rfl\` finishes it. The second picks \`r = 5\` to check \`10 = 5 + 5\`, and the third picks \`k = 3\` to check \`7 = 2 * 3 + 1\`. Instead of a hand-wavy claim, every proof here is concrete: a number and a verification that it works.

## Unpacking a witness vs. supplying one

When you *assume* \`h : a ∣ b\`, you don't know which number \`c\` does the job, yet you know one exists and you can give it a name. Running \`obtain ⟨c, hc⟩ := h\` adds \`c : Nat\` and \`hc : b = a * c\` to your context, and from there you just work with \`c\` and its equation.

When you want to *prove* a divisibility goal, you work in the opposite direction. Writing \`use w\` supplies your chosen witness and tries \`rfl\` on the leftover equation. If that equation still needs real proof steps, \`refine ⟨w, ?_⟩\` plugs in the witness and leaves the equation as a clean subgoal. In short, assuming a divisibility fact means unpacking someone else's witness, while proving one means choosing your own.

## Proving that divisibility is transitive

Let's see that pattern in action by proving that if \`a ∣ b\` and \`b ∣ c\`, then \`a ∣ c\`.

\`\`\`lean
example (a b c : Nat) (h1 : a ∣ b) (h2 : b ∣ c) : a ∣ c := by
  obtain ⟨m, hm⟩ := h1
  obtain ⟨n, hn⟩ := h2
  use m * n
  rw [hn, hm, Nat.mul_assoc]
\`\`\`

At the start, your goal window shows:

\`\`\`text
a b c : Nat
h1 : a ∣ b
h2 : b ∣ c
⊢ a ∣ c
\`\`\`

The two \`obtain\` lines unpack both divisibility hypotheses into ordinary numbers and equations:

\`\`\`text
m : Nat
hm : b = a * m
n : Nat
hn : c = b * n
⊢ a ∣ c
\`\`\`

Now the goal asks for a witness showing \`a ∣ c\`. Since \`b = a * m\` and \`c = b * n\`, substituting gives \`c = (a * m) * n\`, so \`m * n\` is the natural choice. Running \`use m * n\` turns the goal into the equation you still need to check:

\`\`\`text
⊢ c = a * (m * n)
\`\`\`

Rewriting with \`hn\` replaces \`c\` with \`b * n\`, and rewriting with \`hm\` replaces \`b\` with \`a * m\`:

\`\`\`text
⊢ a * m * n = a * (m * n)
\`\`\`

Finally, \`Nat.mul_assoc\`—the associativity law from Induction Isles—regroups the multiplication on the left, and the goal closes. Pay attention to that three-beat rhythm, because it shows up in almost every proof of this chapter: unpack the hypotheses, build a new witness out of the pieces, and prove the leftover equation.

## Easy mistakes with witnesses and notation

**Typing the keyboard pipe instead of \`∣\`.** If you type \`a | b\`, Lean reads the ASCII pipe as syntax for something else and throws an error. Divisibility always uses \`∣\`, entered as \`\\mid\`.

**Calling \`use\` before unpacking.** The \`use\` tactic expects a term that's already in scope. If you write \`use c\` before you've unpacked the hypothesis that introduces \`c\`, Lean will tell you it doesn't recognize \`c\`. Put your \`obtain\` lines first.

**Trying to unpack the goal.** \`obtain\` breaks apart a hypothesis you *have*. If the existential sits in the goal instead, reach for \`use\` or \`refine\`.

**Expecting \`rfl\` to compute with an unknown witness.** After \`obtain\`, you only know the equation that \`c\` satisfies—not its numerical value. If you try \`rfl\` on an expression containing \`c\`, Lean reports that the two sides aren't definitionally equal because it can't evaluate an unknown number. Rewrite with \`hc\` instead.

**Forgetting which side the variable sits on.** \`Even n\` unfolds to \`n = r + r\`, with \`n\` on the left. If your equation is flipped, a forward rewrite won't match. Check the unfolded goal before deciding whether you need \`rw [h]\` or \`rw [← h]\`.

## Number theory built from quantifiers and induction

Divisibility and parity aren't exotic new objects in Lean. They're named existential statements, and an existential proof is simply a dependent pair—a witness alongside evidence whose type depends on that witness. That's why a chapter on number theory relies so heavily on \`use\` and \`obtain\` from Quantifier Quay.

The chapter wraps up by pulling several chapters together to prove that every natural number is either even or odd. The outer structure is induction from Induction Isles, and inside the step case you unpack \`n = r + r\` or \`n = 2 * k + 1\` and build the right witness for \`n + 1\`.

In real Lean and Mathlib, \`Even\` and \`Odd\` use these same definitions, divisibility comes from the \`Dvd\` typeclass, and lemmas like \`Nat.dvd_trans\`, \`Nat.even_add\`, and \`Nat.even_or_odd\` are ready to import. Tactics like \`omega\` also solve most linear arithmetic and divisibility goals automatically. We hold those shortcuts back here so you get comfortable finding the witness yourself. Next, you'll bring every skill from the course together to state and prove theorems of your own.

## When computation finishes the job—and when algebra takes over

Why does \`⟨4, rfl⟩\` prove \`3 ∣ 12\` effortlessly while transitivity takes four lines of tactics? With concrete numbers, Lean can just multiply \`3 * 4\` and verify it equals \`12\`. The moment a variable enters the picture, computation stalls and algebra takes over—using associativity, commutativity, or rewrites from unpacked equations. A handy rule of thumb is to try \`rfl\` or \`use\` first on concrete numerals, and switch to equation rewriting as soon as variables appear. Spotting which world you're in saves a lot of trial and error, and it's the exact same split you met in Induction Isles between \`n + 0 = n\` (free by computation) and \`0 + n = n\` (needs a proof).`,
  guide: ['dependent-types','how-to-attack-a-proof'],
};
