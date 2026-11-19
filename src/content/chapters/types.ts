import type { ChapterExplainer } from '../types.ts';

/** Chapter explainer for the 'types' world. */
export const chapter: ChapterExplainer = {
  worldId: 'types',
  title: 'Everything has a type: reading Lean before you prove anything',
  dek: 'Before Lean can check a proof, it has to know what every expression is. This chapter is about the one question Lean asks of everything you write: what is its type?',
  guide: ['types-everywhere', 'tactics-and-terms', 'dependent-types'],
  body: `## Why start with types?

Suppose you hand a friend a sealed envelope and say "this is a number". Your friend can do something with it: add it to another number, compare it, print it. Now suppose you say "this is a function from numbers to numbers". Different envelope, different uses. Telling someone what kind of thing they hold is most of what you need to tell them.

Lean makes this a hard rule. Every expression, which Lean calls a **term**, has exactly one **type**. You write \`a : A\` and read it "a has type A". Lean never guesses what you meant by a vague "thing". Either it can see the type of what you wrote, or it complains. That strictness sounds fussy, but it is the reason a proof checker can work at all. In later chapters, a statement will be a type and a proof of it will be a term of that type. Everything you learn about terms here carries over unchanged.

## Terms, types, and the colon

The smallest example is a number:

\`\`\`lean
example : Nat := 7
#check (7 : Nat)
\`\`\`

The first line says: here is a type, \`Nat\`, the natural numbers, and here is a term of that type, \`7\`. Producing a term of a given type is called **inhabiting** the type. The second line asks Lean to report the type of an expression. \`#check\` does not run anything. It only reads types.

Some types have more structure. The type \`Nat × Nat\` is the type of pairs of numbers, and \`(4, 9)\` inhabits it. You cannot put a pair where a number is wanted, and you cannot put a number where a pair is wanted. Lean says "type mismatch" and shows you both types. That message is the most common one in this chapter, and it is almost always right.

## Functions: one way in, one way out

A function type is written \`A → B\`. There is exactly one way to use a function, **application**: if \`f : A → B\` and \`a : A\`, then \`f a : B\`. No brackets around the argument, no commas. Brackets only group, so \`f (g n)\` means "apply g to n, then f to the result".

There is exactly one way to make a function, \`fun\`:

\`\`\`lean
example : Nat → Nat := fun n => n + 1
example : Nat := (fun n => n + 1) 5
\`\`\`

\`fun n => n + 1\` reads "the function that sends n to n plus one". The second line applies it to \`5\`. Lean works out \`5 + 1\` by substituting 5 for \`n\` in the body, a step called **beta reduction**. This substitution is all that computation means here.

Notice what is missing: a function of two arguments. Lean does not have one. The type \`Nat → Nat → Nat\` means \`Nat → (Nat → Nat)\`, a function that takes a number and returns another function. This is **currying**.

\`\`\`lean
example : Nat → Nat := Nat.add 2
example : Nat := Nat.add 2 3
\`\`\`

\`Nat.add 2\` is not an error even though addition wants two numbers. It is a function still waiting for the second one. A good habit is to count the arrows in a type, count the arguments you have supplied, and read off what is left.

## One term, built step by step

Here is how to build a term when the types are abstract. Nothing is known about \`A\`, \`B\` and \`C\`, so you cannot compute anything. You can only follow the types.

\`\`\`lean
example (A B C : Type) (f : A → B) (g : B → C) : A → C :=
  fun a => g (f a)
\`\`\`

Start with the goal: a term of type \`A → C\`. Written as a state of knowledge, it looks like this:

\`\`\`text
have:  f : A → B,  g : B → C
need:  A → C
\`\`\`

The goal is a function type, so the term must begin with \`fun a =>\`. That gives us an \`a : A\` to work with, and what remains is a smaller question:

\`\`\`text
have:  f : A → B,  g : B → C,  a : A
need:  C
\`\`\`

Now ask what produces a \`C\`. Only \`g\` does, and it needs a \`B\`. What produces a \`B\`? Only \`f\`, and it needs an \`A\`, which we have. So the body is \`g (f a)\`. Each step was forced by the types. You never needed to know what \`A\` is.

This habit, read the goal, then ask what produces it, is the same one you will use for every proof in the game.

## Types are terms too

If everything has a type, so does \`Nat\`. Its type is \`Type\`. And \`Type\` has the type \`Type 1\`, and so on up a ladder called the **universes**. The ladder is not decoration. If \`Type\` had type \`Type\`, you could build a version of Russell's paradox ("the set of all sets that do not contain themselves") and prove false statements. Lean avoids this by never letting a universe contain itself.

Because types are terms, a function can take a type as its first argument:

\`\`\`lean
def twice : (α : Type) → (α → α) → α → α :=
  fun α f a => f (f a)

example : twice Nat Nat.succ 0 = 2 := rfl
\`\`\`

The type \`(α : Type) → (α → α) → α → α\` is a **dependent function type**: later parts of it mention the argument \`α\`. The plain arrow \`A → B\` is the special case where \`B\` does not mention the argument. Real Lean programs usually make \`α\` implicit, written \`{α : Type}\`, so you write \`twice f a\` and Lean infers the type. This game keeps it explicit so you can see the dependency.

## Common mistakes

**Calling a function with brackets and a comma.** Writing \`f(a, b)\` fails. Lean expects \`f a b\`. A pair \`(a, b)\` is a single argument, a value of a product type, and that is a different thing.

**Mixing up the order of arguments.** \`g b a\` and \`g a b\` may both type-check and mean different things. If Lean reports a type mismatch on a variable, compare the order in your term with the order in the type.

**Using a name the \`fun\` did not introduce.** Inside \`fun n => ...\`, only \`n\` is in scope. "Unknown identifier" means you used a name that is not there.

**Forgetting a type argument.** If the first argument of a function is a type, \`twice Nat.succ 0\` fails because \`Nat.succ\` is not a type. Lean's message says it expected a \`Type\`.

**Typing the type instead of a value.** Asked for a term of \`Nat\`, writing \`Nat\` gives a mismatch: you produced something of type \`Type\`.

## Where this goes next

The next chapter, Proposition Peaks, takes the term \`fun a => g (f a)\` above and reads it again. The arrow \`A → B\` becomes "if A then B", \`fun\` becomes "assume A", and application becomes "use this implication". Nothing about the term changes. Only how you read it.

Later, the dependent function type becomes the universal quantifier \`∀\`. In Mathlib, and in real Lean generally, you will meet implicit arguments in braces, universe-polymorphic definitions, and types as the main organizing idea of the whole library. The vocabulary of this chapter is the vocabulary of all of it.`,
};
