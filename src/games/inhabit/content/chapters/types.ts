import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'types' world. */
export const chapter: ChapterExplainer = {
  worldId: 'types',
  title: 'Everything has a type: reading Lean before you prove anything',
  dek: "Before Lean can check a proof, it has to know what every expression is. This chapter is about the one question Lean asks of everything you write: what's its type?",
  guide: ['types-everywhere', 'tactics-and-terms', 'dependent-types'],
  body: `## Why start with types?

Suppose you hand a friend a sealed envelope and say, "This is a number." Right away your friend knows what to do with it: add it to another number, compare it, or print it out. Now suppose you say, "This is a function from numbers to numbers." Different envelope, different possibilities. Telling someone what kind of object they're holding covers most of what they need to know.

Lean turns that habit into a hard rule. Every expression—which Lean calls a **term**—has a single **type**. You write \`a : A\` and read it aloud as "\`a\` has type \`A\`." Lean won't guess what you meant by a vague "thing": either it can work out the type of what you wrote, or it stops and complains. That strictness can feel fussy at first, but it's what makes a proof checker possible. Starting in the next chapter, a mathematical statement will be a type, and a proof of it will be a term of that type. Every habit you build with terms here carries straight over.

## Terms, types, and the colon

The simplest place to start is a plain number:

\`\`\`lean
example : Nat := 7
#check (7 : Nat)
\`\`\`

The first line says: here's a type, \`Nat\` (the natural numbers \`0, 1, 2, ...\`), and here's a term of that type, \`7\`. Producing a term of a given type is called **inhabiting** the type. The second line asks Lean to report the type of an expression. \`#check\` doesn't compute a value or run a program; it just reads the type.

Types can also carry structure. The type \`Nat × Nat\` holds pairs of natural numbers, and \`(4, 9)\` inhabits it. You can't slip a pair into a slot expecting a single number, or vice versa. If you try, Lean reports a "type mismatch" and prints both the type it expected and the type you gave it. You'll see that message more than any other in this chapter, and it's almost always pointing straight at the bug.

## Functions: one way in, one way out

A function type is written \`A → B\`. There's only one way to use a function, **application**: if \`f : A → B\` and \`a : A\`, then \`f a : B\`. Notice there are no parentheses around the argument and no commas between arguments. Parentheses are just for grouping, so \`f (g n)\` means "apply \`g\` to \`n\`, then apply \`f\` to the result."

And there's only one way to build a function from scratch, with \`fun\`:

\`\`\`lean
example : Nat → Nat := fun n => n + 1
example : Nat := (fun n => n + 1) 5
\`\`\`

Read \`fun n => n + 1\` as "the function that sends \`n\` to \`n + 1\`." The second line applies that function to \`5\`. Lean evaluates \`(fun n => n + 1) 5\` by substituting \`5\` for \`n\` inside the body, a step called **beta reduction**. At this level, substitution is all computation really is.

You might notice something missing: a separate syntax for functions of two arguments. Lean doesn't need one. The type \`Nat → Nat → Nat\` is grouped to the right as \`Nat → (Nat → Nat)\`, meaning a function that takes a number and hands back another function. This trick is called **currying**.

\`\`\`lean
example : Nat → Nat := Nat.add 2
example : Nat := Nat.add 2 3
\`\`\`

Even though addition expects two numbers, \`Nat.add 2\` isn't an error. It's a valid function waiting for its second number. When you're reading a long function type, count the arrows, count how many arguments you've supplied, and whatever's left after those arrows is the type you'll get back.

## Chaining two functions by following the types

Now watch how you can build a term even when the types are completely abstract. We know nothing about \`A\`, \`B\`, and \`C\`, so we can't compute with them—we can only follow their shapes.

\`\`\`lean
example (A B C : Type) (f : A → B) (g : B → C) : A → C :=
  fun a => g (f a)
\`\`\`

Start by looking at what we have and what we need, written as a snapshot of our state:

\`\`\`text
have:  f : A → B,  g : B → C
need:  A → C
\`\`\`

Because we need a function of type \`A → C\`, the term has to start with \`fun a =>\`. That introduces an \`a : A\` we can use, leaving a simpler target:

\`\`\`text
have:  f : A → B,  g : B → C,  a : A
need:  C
\`\`\`

Now ask what can produce a \`C\`. Only \`g\` outputs a \`C\`, and it asks for a \`B\`. What can produce a \`B\`? Only \`f\`, and it asks for an \`A\`, which is sitting right there in our context. Put those pieces together and you get \`g (f a)\`. Every move was forced by the types alone, without ever knowing what \`A\`, \`B\`, or \`C\` stand for.

That habit—read what you need, then ask what produces it—is the exact same reflex you'll use for every proof in the rest of the game.

## Types are terms too

If every expression has a type, what's the type of \`Nat\` itself? Its type is \`Type\`. And \`Type\` has type \`Type 1\`, which has type \`Type 2\`, climbing an infinite ladder called the **universes**. This ladder isn't just formality for its own sake. If \`Type\` had type \`Type\`, you could recreate a version of Russell's paradox ("the set of all sets that don't contain themselves") and prove false statements. Keeping every universe strictly below the next one blocks that contradiction before it can start.

Because types are ordinary terms, a function can accept a type as an argument:

\`\`\`lean
def twice : (α : Type) → (α → α) → α → α :=
  fun α f a => f (f a)

example : twice Nat Nat.succ 0 = 2 := rfl
\`\`\`

The signature \`(α : Type) → (α → α) → α → α\` is a **dependent function type**, because the later parts of the type mention the first argument \`α\`. The plain arrow \`A → B\` is just the simpler case where the output type \`B\` doesn't refer to the input. In everyday Lean code, people usually mark \`α\` as implicit with braces, \`{α : Type}\`, so you can write \`twice f a\` and let Lean infer \`α\`. Here we keep it explicit so you can watch the dependency in action.

## Five type errors you'll see right away

**Calling a function with parentheses and commas.** Writing \`f(a, b)\` won't work. Lean expects \`f a b\`. Putting parentheses and a comma around \`a\` and \`b\` builds a single pair of a product type, which is a different thing entirely.

**Swapping the order of arguments.** Both \`g b a\` and \`g a b\` might be well-typed while meaning different things—or one might trigger a type mismatch on a single variable. When Lean complains about an argument's type, line up your term against the function's type one slot at a time.

**Using a variable name that isn't in scope.** Inside \`fun n => ...\`, only \`n\` (plus whatever was already given) exists. "Unknown identifier" means you typed a name you haven't introduced yet.

**Skipping a type argument.** When a function takes a type first, \`twice Nat.succ 0\` fails because \`Nat.succ\` isn't a type. Lean's error will tell you it expected a \`Type\` in that first slot.

**Handing in the type instead of a term.** If Lean asks for a term of type \`Nat\` and you write \`Nat\`, you'll get a mismatch: \`Nat\` itself has type \`Type\`, not \`Nat\`.

## From function arrows to logical proofs

In the next chapter, Proposition Peaks, you'll meet the exact same term \`fun a => g (f a)\` again, just read through a new lens. The arrow \`A → B\` becomes "if \`A\`, then \`B\`," \`fun\` becomes "assume \`A\`," and applying a function becomes using an implication. The code stays identical; only the way you interpret it shifts.

Later on, the dependent function type from \`twice\` will turn into the universal quantifier \`∀\`. In Mathlib and real-world Lean projects, you'll encounter implicit arguments in braces, universe-polymorphic definitions, and types organizing whole branches of mathematics. Everything you picked up in this chapter is the shared grammar behind all of it.`,
};
