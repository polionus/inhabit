import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'forge' world. */
export const chapter: ChapterExplainer | undefined = {
  worldId: 'forge',
  title: "Formalize your own theorem: say it, type it, define it, state it, prove it",
  dek: "The hardest part of formalizing is getting the statement right, not the proof. Here's a five-step method for turning a math idea into a Lean theorem that actually says what you mean.",
  body: `## Why the statement is the hardest part

Up to now, every level has handed you a ready-made theorem and asked for its proof. Real formalization starts one step earlier. You begin with an idea in plain words—say, "the sum of two odd numbers is even"—and nobody gives you the Lean version. If your formal statement is slightly off, you can write a spotless proof and still end up proving the wrong claim.

This chapter walks through the whole journey from rough idea to machine-checked theorem using five steps: say it, type it, define it, state it, and prove it.

## Steps 1 and 2: say it plainly, then give everything a type

**Say it** means spelling out the claim in careful English, highlighting every "for all," "there exists," and "if … then." Then test it on a small concrete example. If you can't test a sentence on an example, it isn't precise enough yet. "The sum of two odd numbers is even" passes right away: \`3 + 5 = 8\`.

**Type it** means assigning a Lean type to every object in the sentence. A natural number is \`n : Nat\`, a set of points is \`A : Set α\`, a function is \`f : α → β\`, and a property is \`P : α → Prop\`. Types are part of the mathematical meaning, so settle them before writing the statement. For instance, is "odd" a property of natural numbers or of integers? You have to decide up front.

## Step 3: name new concepts with \`def\`

Whenever a concept isn't already in the library, introduce it with \`def\`. A property of numbers is simply a predicate—a function returning \`Prop\`—whose body explains what it means:

\`\`\`lean
def forge_IsSquare (n : Nat) : Prop := ∃ k, n = k * k

example : forge_IsSquare 9 := ⟨3, rfl⟩
example (m : Nat) : forge_IsSquare (m * m) := ⟨m, rfl⟩
\`\`\`

The first line creates a new name, \`forge_IsSquare\`, mapping each natural number to a proposition. The two examples show how cleanly it behaves: \`forge_IsSquare 9\` unfolds to \`∃ k, 9 = k * k\`, so the pair \`⟨3, rfl⟩\` proves it on the spot. Your own definitions act just like \`Even\` and \`Odd\`, because those are built the exact same way.

## Step 4: translate the claim into a Lean type

Next, turn your English sentence into a type. Hypotheses sit before the colon as named arguments, and the conclusion goes after it. Take the claim "if \`f\` sends every point of \`A\` into \`B\`, then the image of \`A\` lies inside \`B\`":

\`\`\`lean
example (α β : Type) (f : α → β) (A : Set α) (B : Set β)
    (h : ∀ x, x ∈ A → f x ∈ B) : f '' A ⊆ B := by
  intro y hy
  obtain ⟨x, hx, hxy⟩ := hy
  rw [← hxy]
  exact h x hx
\`\`\`

Notice how each piece lands. The "if" clause becomes the hypothesis \`h\`, with \`→\` tucked inside \`∀\` because the condition applies to every \`x\` belonging to \`A\`, and the conclusion becomes a subset goal.

Formal statements tend to go wrong in a handful of familiar ways, and it's worth knowing all of them by sight. Writing \`∧\` where you meant \`→\` makes a claim far stronger than intended. Dropping a hypothesis turns a true statement into an unprovable one. Flipping an implication reverses cause and effect. Swapping two quantifiers changes the meaning completely, since "for every \`x\` there's a \`y\`" isn't the same as "there's a single \`y\` that works for every \`x\`." Misplacing \`¬\` causes similar trouble: "not all numbers are even" says something very different from "all numbers are not even." Once you've typed a statement, translate it back into English word for word and check that it still matches what you had in mind.

## Step 5: sketch the proof before filling in details

The proof above only needed four lines because the claim is compact. Watch how the goal evolves as it runs. After \`intro y hy\`:

\`\`\`text
y : β
hy : y ∈ f '' A
⊢ y ∈ B
\`\`\`

Because \`hy\` unfolds to an existential, \`obtain\` hands you the input \`x\`, its membership in \`A\`, and the equation tying \`f x\` to \`y\`:

\`\`\`text
x : α
hx : x ∈ A
hxy : f x = y
⊢ y ∈ B
\`\`\`

Rewriting right to left swaps \`y\` for \`f x\`, leaving \`f x ∈ B\`, which \`h x hx\` closes immediately.

For longer theorems, start by laying down a skeleton. Write out the intermediate milestones with \`have\`, plug \`by sorry\` into each one, and let Lean check that the overall structure fits together:

\`\`\`text
have h1 : x ∈ B := by sorry
have h2 : x ∈ D := by sorry
exact ⟨h1, h2⟩
\`\`\`

Lean accepts that file while warning you that it still contains \`sorry\`. That warning isn't an error; it's just a checklist of the pieces left to prove. Fill in one hole at a time, and the warning disappears once the last \`sorry\` is gone. Better yet, if the blueprint itself doesn't line up, you catch the flaw in seconds instead of an hour into the details.

Three small combinators also cut down on repetitive typing: \`all_goals\` runs a tactic across every open subgoal, \`try\` runs a tactic without failing if it doesn't apply, and \`repeat\` keeps applying a tactic until nothing changes.

## Making sense of Lean's error messages

A huge share of formal proving is simply reading what Lean tells you. Almost every error has three parts: where it happened, what Lean expected, and what you actually gave it. A type mismatch means those last two disagree—if Lean expected \`x ∈ B\` and got \`x ∈ A\`, you probably handed it the wrong hypothesis. If \`rw\` says it didn't find the pattern, the left side of your equation doesn't appear literally in the goal, so look closely at the goal state and compare. And when Lean reports "unsolved goals," it prints the exact list of what's still open, giving you your next to-do item.

## Every chapter in one workflow

Looking back, every earlier chapter feeds one step of this method. Types and functions power step two, sets and numbers supply the objects, connectives and quantifiers power step four, and tactics drive step five. Because a statement is a type and a proof is a term inhabiting it, formalizing means designing the right type—and that's a real mathematical skill, not just busywork.

In real Lean and Mathlib, you'll follow these exact five steps on a larger scale. You'll search for existing lemmas with \`exact?\` and the documentation instead of reproving everything from scratch, and you'll let \`simp\`, \`omega\`, and \`ring\` clean up routine steps. What carries straight across is the habit you've just practiced: say precisely what you mean, and listen carefully to what Lean says back.

## Trying the five steps on your own claims

The fastest way to lock this method in is to test it on a claim you come up with yourself. Pick something modest—"the sum of two even numbers is even," "composing two injective functions yields an injective function," or "a subset of a subset is a subset." Write it in careful English, assign a type to every object, decide whether you need a \`def\`, and sketch a \`sorry\` skeleton before touching the proof details. Whenever a step feels fuzzy, that's usually a spot where the idea itself needs sharpening—and plenty of people catch a missing hypothesis in a theorem they thought they knew the very first time they try to type it.`,
  guide: ['english-to-lean','how-to-attack-a-proof'],
};
