import type { GuideArticle, GuideSection } from './types.ts';

/** Display order and titles of the Guide's sections. */
export const guideSections: { id: GuideSection; title: string; blurb: string }[] = [
  { id: 'lean', title: 'Lean', blurb: 'What Lean is, what it can do, and how to read its statements, goals, and proofs.' },
  { id: 'theory', title: 'Theory', blurb: 'The ideas underneath Lean: types, propositions, dependent types, induction, equality, and the kernel.' },
  { id: 'practice', title: 'Practice', blurb: 'How to start a proof, how to turn English into Lean, and how Lean works as a programming language.' },
  { id: 'ecosystem', title: 'Ecosystem', blurb: 'Mathlib, the people who build it, and where Lean shows up in research and industry.' },
];

/** The Guide: long-form reading about Lean. In reading order. */
export const guide: GuideArticle[] = [
  {
    id: 'what-is-lean',
    section: 'lean',
    title: 'What Lean is',
    summary: 'Lean is both a programming language and a proof assistant; here is how those two halves fit together and what it means for Lean to check a proof.',
    minutes: 5,
    worlds: ['types', 'props'],
    next: ['lean-tour', 'reading-theorems'],
    body: `Lean looks like two separate tools until you see how they're built. On one side, it's a **programming language** where you write functions and run them. On the other, it's a **proof assistant**, a program that checks mathematical proofs written in its syntax. Both sides share the same foundation: Lean's language is rich enough that a mathematical statement and a proof of it are ordinary objects right alongside numbers and functions.

Leonardo de Moura started Lean at Microsoft Research, and it has been open source from the beginning. Lean 4, the current major version, is mostly written in Lean itself. Today it's maintained by the Lean Focused Research Organization alongside a large community of researchers and volunteers. You can try it in a browser without installing anything at live.lean-lang.org.

## What it means to check a proof

A proof on paper is meant to convince a human reader. A proof in Lean has to satisfy a program. When people say Lean "verifies" a proof, they mean something specific: starting from a small set of logical rules, Lean checks that every step follows from the rules and from the assumptions you explicitly wrote down. If a single step doesn't follow, Lean rejects the proof and points straight to the gap.

That changes the feel of writing mathematics. On paper, you can write "clearly" or "by a similar argument" and trust a reader to fill in the details. Lean won't fill in a missing step on faith—either the gap is closed or the proof doesn't go through. At first that strictness feels unforgiving, though Lean gives a lot back: it tracks every assumption for you and shows you, at every line, exactly what's left to prove.

## A first theorem, line by line

Take a small theorem saying that if both \`p\` and \`q\` hold, then \`q\` and \`p\` hold too:

\`\`\`lean
theorem and_swap (p q : Prop) (h : p ∧ q) : q ∧ p := by
  obtain ⟨hp, hq⟩ := h
  exact ⟨hq, hp⟩
\`\`\`

The first line is the **statement**. \`theorem\` starts a declaration and \`and_swap\` names it. Next come the assumptions: \`(p q : Prop)\` introduces two propositions (statements that can be true or false), and \`(h : p ∧ q)\` assumes we have a proof, named \`h\`, that both \`p\` and \`q\` hold. Everything after the colon is the conclusion we're trying to prove: \`q ∧ p\`.

Everything after \`:= by\` is the **proof**. The keyword \`by\` puts Lean into tactic mode, where you write a sequence of commands—*tactics*—that gradually chip away at what remains to be proved. First, \`obtain ⟨hp, hq⟩ := h\` splits the combined fact \`h\` into its two pieces, calling them \`hp\` and \`hq\`. Then \`exact ⟨hq, hp⟩\` builds the goal \`q ∧ p\` in the reverse order, using angle brackets \`⟨...⟩\` to bundle two proofs into a pair.

Once the last tactic runs, nothing is left to prove and Lean accepts the theorem. If you delete that second line, Lean flags an error for unsolved goals and shows you exactly what's still missing.

## Inside the proof checker

Tactics are a comfortable way to write proofs, but Lean doesn't actually trust them. Behind the scenes, your tactics assemble a *proof term*—a raw expression in Lean's core language—and a small program called the **kernel** checks that this term really matches the theorem's statement. The kernel is the only piece of Lean that has to be bug-free for a proof to be sound. Later articles unpack how the kernel works and compare tactic proofs with writing proof terms directly.

## Running code and proving facts about it

The very same language runs ordinary programs. You can define a function, evaluate it, and prove a fact about it in the same file:

\`\`\`lean-real
def double (n : Nat) : Nat := n + n

#eval double 21

theorem double_eq (n : Nat) : double n = 2 * n := by
  unfold double
  omega
\`\`\`

The \`#eval\` command runs \`double 21\` and prints \`42\`. Because code and proofs live together, \`double_eq\` can talk directly about the exact \`double\` function you just defined—unfolding its definition and letting the \`omega\` tactic handle the arithmetic. That unity is why Lean shows up in both pure mathematics and software verification, two worlds we'll revisit later in the Guide.

## Where Lean stops helping

Lean guarantees that your proof proves the statement you wrote down. It can't tell whether you wrote down the statement you *meant*. If your theorem is weaker than you intended, or accidentally true for a trivial reason, Lean will accept a proof of it without complaint. Saying what you mean accurately is half the craft, and the article on translating English into Lean focuses on that skill.

Lean also isn't an automatic theorem prover that solves hard math on command. Its automation can knock out routine steps, especially arithmetic and algebraic cleanup, yet for most interesting theorems you still supply the mathematical idea while Lean checks every detail. This game trains that side of the craft: reading what Lean shows you, choosing the next move, and seeing why each move is valid.`,
  },
  {
    id: 'lean-tour',
    section: 'lean',
    title: 'What Lean can do: a tour',
    summary: 'A tour of Lean\'s capabilities—interactive proving, compiled programs, type classes, automation, and Mathlib—along with honest limits and what this game covers.',
    minutes: 7,
    next: ['reading-theorems', 'lean-programming', 'mathlib-community'],
    body: `Lean does a lot more than this game puts on screen. Below is a quick map of its main capabilities, with a small example of each, an honest look at where it gets hard, and a note on how far this game takes you. Code blocks marked as real Lean use features that the game's built-in engine leaves out.

## Interactive theorem proving

This is the heart of the game. You state a theorem, then build its proof step by step with tactics while Lean keeps track of the remaining goals. The same workflow scales from basic logic to number theory, algebra, and analysis. The catch is effort: formalizing a proof takes more work than writing one on paper, because every detail a human reader would gloss over has to be spelled out explicitly.

## Writing and running programs

Lean supports ordinary functional programming with \`def\`, pattern matching, recursion, and \`#eval\` to run expressions right in your editor:

\`\`\`lean-real
def fib : Nat → Nat
  | 0 => 0
  | 1 => 1
  | n + 2 => fib n + fib (n + 1)

#eval fib 20
\`\`\`

That prints \`6765\`. Lean compiles programs to native code, so they run fast enough for real tools—Lean's own compiler is written in Lean—though its ecosystem of everyday software libraries is still much smaller than what you'd find in Python or Rust. In this game you'll only see \`def\` and \`#eval\` briefly; the programming article goes deeper.

## Custom types and structures

You can define your own data types. A \`structure\` bundles named fields, while an \`inductive\` type lists the exact ways a value can be constructed:

\`\`\`lean-real
structure Point where
  x : Nat
  y : Nat
deriving Repr

#eval ({ x := 1, y := 2 } : Point)
\`\`\`

Adding \`deriving Repr\` asks Lean to generate a printing routine so \`#eval\` knows how to display a \`Point\`. In the game, you'll work with built-in inductive types like \`Nat\`, \`And\`, and \`Or\` and learn how they behave, without needing to declare new ones yourself.

## Type classes and shared notation

A **type class** specifies an operation that many different types can support, letting one symbol work across all of them. You can write \`+\` on natural numbers, integers, and real numbers because each type registers an instance of the addition class.

\`\`\`lean-real
structure Rect where
  w : Nat
  h : Nat

class Shape (α : Type) where
  area : α → Nat

instance : Shape Rect where
  area r := r.w * r.h

#eval Shape.area (Rect.mk 3 4)
\`\`\`

This prints \`12\`. Type classes are the biggest piece of real Lean that the game sets aside—here \`+\` is fixed to natural numbers so you can focus on proving. In Mathlib, type classes are what let one theorem about groups or rings apply to dozens of concrete structures at once. The trade-off is that error messages sometimes talk about missing instances you never explicitly wrote.

## Built-in and Mathlib automation

Lean can close many routine goals on its own. Core Lean includes \`simp\` (rewriting with a curated database of simplification rules), \`omega\` (linear arithmetic over natural numbers and integers), \`decide\` (checking finite, computable statements directly), and in newer versions \`grind\` (a broader solver).

\`\`\`lean-real
theorem lt_succ (a b : Nat) (h : a < b) : a + 1 ≤ b := by omega

example : 2 ^ 10 = 1024 := by decide
\`\`\`

Mathlib adds \`ring\` for commutative-ring equalities, \`linarith\` for linear inequalities, \`norm_num\` for numeric calculations, and several more, while the companion Aesop package provides \`aesop\` for general proof search. Automation shines on tedious bookkeeping and stalls when a proof genuinely needs a fresh idea. This game holds those tactics back on purpose so you can see what they're actually automating; the Graduate screen introduces them once you're ready.

## Writing your own tactics

Because Lean's tactics are ordinary Lean programs, users can build new ones. The lightest option is a \`macro\`, which expands custom syntax into existing tactics:

\`\`\`lean-real
macro "my_triv" : tactic => \`(tactic| first | rfl | trivial)

example : 2 + 2 = 4 := by my_triv
\`\`\`

More ambitious tactics talk directly to Lean's elaborator using Lean's metaprogramming API. That's how Mathlib's tactics are built, and it lets the community extend Lean's proof tools without touching the trusted kernel. The game won't ask you to write tactics, though it does explain how tactics assemble proof terms under the hood.

## The Mathlib library

Mathlib is a massive, community-maintained library of formalized mathematics covering algebra, topology, analysis, number theory, combinatorics, and much more. It means you can state a theorem about groups or continuous functions without spending months rebuilding the foundations first. Because Mathlib evolves quickly, code written against today's version occasionally needs small updates later on. Our game follows Mathlib's naming for sets, functions, and divisibility so the habits you pick up transfer cleanly.

## Verifying real software

Since programs and proofs share one language, teams can prove properties about actual software. Amazon Web Services, for instance, uses Lean to verify parts of Cedar, its authorization policy language. Formal verification takes more upfront specification work than testing, and program proofs can get long, so teams usually aim it at high-stakes core logic. The final article in the Guide looks closer at these real-world projects; the game itself sticks to mathematical proofs.

## Where this game fits

Here you'll learn interactive proving from the ground up: terms and types, propositions as types, tactics, induction, sets, functions, and turning English claims into Lean statements, with a short detour into \`def\` and \`#eval\`. Type classes, heavy automation, metaprogramming, and Mathlib live outside the game, and the Graduate screen maps out where to pick each one up next.`,
  },
  {
    id: 'reading-theorems',
    section: 'lean',
    title: 'Reading a Lean theorem',
    summary: 'How to unpack an unfamiliar Lean statement from left to right: binders, implicit arguments, arrows, quantifiers, and library naming conventions.',
    minutes: 5,
    worlds: ['props', 'quant'],
    next: ['goal-view', 'tactics-and-terms'],
    body: `Before you can prove a theorem, you have to read what it actually says. Fortunately, Lean declarations follow a steady pattern—once you know the layout, even a dense theorem from a library becomes much easier to parse.

## The parts of a theorem declaration

Every theorem has the same skeleton:

\`\`\`text
theorem name (binders) : statement := proof
\`\`\`

The **name** is how you'll refer to the theorem later. The **binders** introduce the objects and assumptions in play. The **statement** after the colon is the claim itself, and the **proof** after \`:=\` is either a direct proof term or \`by\` followed by tactics.

Take a concrete example:

\`\`\`lean
theorem swap_args {α : Type} (p q : α → Prop) (h : ∀ x, p x ∧ q x) : ∀ x, q x ∧ p x := by
  intro x
  exact ⟨(h x).2, (h x).1⟩
\`\`\`

Read it from left to right. Given any type \`α\` and any two predicates \`p\` and \`q\` on \`α\` (functions that send each element of \`α\` to a statement about it): if every \`x\` satisfies both \`p x\` and \`q x\`, then every \`x\` satisfies \`q x\` and \`p x\`. The hypothesis \`h\` holds the proof of "for all \`x\`, \`p x\` and \`q x\`".

## Parentheses, braces, and square brackets

You'll see two kinds of binders all the time in this game, and a third in real Lean.

Binders in **parentheses**, like \`(p q : α → Prop)\`, are **explicit**: whenever you apply the theorem, you pass those arguments yourself. Binders in **braces**, like \`{α : Type}\`, are **implicit**: Lean figures out their values from the surrounding arguments. When you use \`swap_args\`, you don't pass \`α\`, because Lean can read it straight off the type of \`p\`.

If you ever want to supply implicit arguments by hand, putting \`@\` in front of a theorem's name makes every argument explicit—so \`@swap_args\` expects \`α\` first. You won't need \`@\` often, yet it's a useful reminder that implicit arguments are just ordinary arguments Lean fills in for you.

In real Lean and Mathlib, you'll also see **square brackets** \`[ ... ]\` for type-class instances. The game leaves those out so declarations stay uncluttered.

## Arrows, "for all", and "there exists"

Three symbols carry most of the logical structure in Lean statements.

The arrow \`→\` means "implies" between propositions and "function from … to …" between types—which, as the article on propositions as types explains, turn out to be the same thing. Arrows associate to the right, so \`A → B → C\` is shorthand for \`A → (B → C)\`. You can read that as "given \`A\` and \`B\`, produce \`C\`", which is why a theorem with two assumptions can put them either in binders before the colon or behind arrows after it.

The symbol \`∀\` means "for all". Writing \`∀ x, p x\` says that \`p x\` holds for every \`x\`. Lean usually infers the type of \`x\` from context, though you can always write it out as \`∀ x : Nat, p x\`.

The symbol \`∃\` means "there exists". To prove \`∃ n : Nat, n + n = 4\`, you hand over a specific witness and a proof that it satisfies the property:

\`\`\`lean
theorem two_plus_two : ∃ n : Nat, n + n = 4 := ⟨2, rfl⟩
\`\`\`

Inside the angle brackets, \`2\` is the witness and \`rfl\` proves \`2 + 2 = 4\` by computing both sides to \`4\`.

## Binders before the colon or arrows after it

Assumptions can sit before the colon as named binders or after it as arrows. These two theorems say the exact same thing:

\`\`\`lean
theorem mp1 (p q : Prop) (hp : p) (hpq : p → q) : q := hpq hp

theorem mp2 (p q : Prop) : p → (p → q) → q := fun hp hpq => hpq hp
\`\`\`

Binders are convenient when you want names ready inside the proof right away. Arrows are handy when you want the whole claim to live as a single proposition after the colon, such as inside a larger formula. And \`intro\` bridges the two styles by moving an assumption from after the colon into your hypotheses.

## Decoding library names

Library theorem names aren't random—they combine a namespace with a compact description of the statement. \`Nat.add_comm\`, for example, lives in the \`Nat\` namespace and states that addition commutes. A handful of suffixes and connectors show up everywhere:

- \`_comm\`, \`_assoc\`, \`_refl\`, \`_symm\`, \`_trans\` for standard algebraic and relational properties;
- \`_left\` and \`_right\` to pick out one side of an operation or connective, like \`And.left\`;
- \`_iff\` for theorems phrased as an \`↔\` equivalence;
- \`_of_\` to introduce hypotheses, so \`lt_of_le_of_ne\` reads "less than, given less-or-equal and not-equal";
- \`_eq\` and \`_ne\` for equalities and inequalities.

Once these patterns click, you'll start guessing theorem names on the first try—and when a guess misses, search tools in Lean and Mathlib use the same vocabulary.

## Asking Lean with #check and #print

You never have to guess a declaration's signature from memory. \`#check\` prints a name's type or theorem statement, and \`#print\` shows its definition. Try \`#check Nat.add_comm\` in the game's Sandbox to inspect it directly. Taking a moment to read a statement carefully—binders first, conclusion second—is the habit that unlocks both your own theorems and the library.`,
  },
  {
    id: 'goal-view',
    section: 'lean',
    title: 'The goal view',
    summary: 'How to read the proof state Lean updates at every line—hypotheses, multiple goals, case tags, and the three error messages you\'ll meet first.',
    minutes: 5,
    worlds: ['props', 'logic'],
    next: ['tactics-and-terms', 'how-to-attack-a-proof'],
    body: `When you write a proof in Lean, the code editor is only half the picture. Just as important is the **goal view** (called the *infoview* in VS Code), which shows your exact situation at whichever line your cursor is on.

## Above and below the turnstile

Here's a typical goal state:

\`\`\`text
p q : Prop
hp : p
hpq : p → q
⊢ q
\`\`\`

Everything above the turnstile symbol \`⊢\` is a **hypothesis**—a variable or fact already in scope. Each line gives a name, a colon, and a type. Here \`p q : Prop\` introduces two propositions, \`hp : p\` gives you a proof of \`p\`, and \`hpq : p → q\` gives you a proof that \`p\` implies \`q\`.

The line starting with \`⊢\` is the **goal**, what you still need to prove. You finish a proof when you build a term of the goal's type, and a tactic proof ends once no goals are left. Looking at the state above, the move jumps out: \`hpq\` turns a proof of \`p\` into a proof of \`q\`, and you've got \`hp : p\` sitting right above it, so \`exact hpq hp\` closes the goal.

Reading this panel well is the single most useful skill in Lean. Rather than typing tactics by trial and error, look at the state, describe in plain English what's missing, and pick the tactic that matches.

## Watching tactics reshape the state

Every tactic transforms the goal state, and you can watch it update as you move your cursor line by line. When the goal is \`p → q\`, running \`intro h\` pulls the assumption onto the list above the turnstile:

\`\`\`text
before:   ⊢ p → q
after:    h : p
          ⊢ q
\`\`\`

When the goal is \`p ∧ q\`, \`constructor\` splits it into two separate goals, one for \`p\` and one for \`q\`. Going the other way, if you have a hypothesis \`h : p ∧ q\`, \`obtain ⟨hp, hq⟩ := h\` unpacks it into two separate hypotheses. With a bit of practice you'll know what the next state will look like before you even run the tactic—which is what the game's predict puzzles help build.

## Working through multiple goals

A single tactic often creates several subgoals at once. Lean lists them in order and focuses on the first one. Each goal can carry a **case tag** reminding you where it came from:

\`\`\`text
case left
p q : Prop
hp : p
hq : q
⊢ p

case right
p q : Prop
hp : p
hq : q
⊢ q
\`\`\`

These two goals came from running \`constructor\` on \`p ∧ q\`, so Lean labels them \`left\` and \`right\`. Notice that each subgoal carries its own list of hypotheses. Once you close the first goal, the second moves to the front. Putting a focusing dot \`·\` before the tactics for each subgoal keeps multi-branch proofs clean and pins any error to the exact branch that failed.

## Three error messages you'll meet early

Lean's error messages follow a predictable layout: they tell you where something went wrong, what kind of problem occurred, and usually what Lean expected versus what it saw. Suppose you start proving \`p ∧ q\` and only prove the first half:

\`\`\`text
theorem e1 (p q : Prop) (hp : p) : p ∧ q := by
  constructor
  exact hp
\`\`\`

Lean answers:

\`\`\`text
error: unsolved goals
case right
p q : Prop
hp : p
⊢ q
\`\`\`

That tells you a goal is still open, displays it, and uses the \`right\` tag to show it's the second half of the conjunction. Either you still need another line proving \`q\`, or—as in this broken statement—you forgot to include a hypothesis that could ever prove \`q\`.

A second familiar error is a type mismatch. If you try \`exact h\` with \`h : a = b\` when the goal is \`b + 1 = a + 1\`, Lean prints:

\`\`\`text
error: Type mismatch
  h
has type
  a = b
but is expected to have type
  b + 1 = a + 1
\`\`\`

Compare those two lines side by side: what you handed Lean versus what it asked for. Most mismatches trace back to a flipped equation, a missing intermediate step, or a goal that didn't look quite the way you assumed. Exact phrasing shifts slightly across Lean versions, though this side-by-side layout stays the same.

A third common error comes from \`rw\`. If the left-hand side of your equation doesn't appear anywhere in the goal, Lean tells you it couldn't find the pattern and prints the expression it searched for. Compare that quoted pattern against the goal character by character—often a tiny difference in parentheses or argument order is the whole reason it missed.

## Reading the state before you type

Before typing a tactic, try saying in words what the goal asks for and what you already have above the turnstile. After typing it, check whether the new state matches what you expected. Whenever the goal view surprises you, pause—that's usually the fastest way to see how Lean is interpreting your statement. And when you feel stuck, re-read your hypotheses from top to bottom; the piece you need is often already sitting there.`,
  },
  {
    id: 'tactics-and-terms',
    section: 'lean',
    title: 'Tactics and terms: two ways to write one proof',
    summary: 'The same theorem proved directly as a term and step by step with tactics, plus what tactics actually build behind the scenes.',
    minutes: 5,
    worlds: ['props'],
    next: ['types-everywhere', 'propositions-as-types'],
    body: `Lean gives you two ways to write a proof, and they work together rather than competing. A **term** is a single expression whose type matches the theorem's statement. A **tactic proof** is a script of commands that constructs that expression piece by piece. Both produce the exact same result, and seeing how they connect makes Lean feel far less mysterious.

## One theorem, two styles

Consider the claim that \`p ∧ q\` implies \`q ∧ p\`. Written directly as a term:

\`\`\`lean
theorem and_swap_term (p q : Prop) : p ∧ q → q ∧ p :=
  fun h => ⟨h.2, h.1⟩
\`\`\`

This is just a function: hand it a proof \`h\` of \`p ∧ q\`, and it hands back a proof of \`q ∧ p\` built from the second component \`h.2\` and the first component \`h.1\`. Nothing needs to run or search—the expression after \`:=\` already is the proof.

Now look at the same theorem written with tactics:

\`\`\`lean
theorem and_swap_tac (p q : Prop) : p ∧ q → q ∧ p := by
  intro h
  obtain ⟨hp, hq⟩ := h
  constructor
  · exact hq
  · exact hp
\`\`\`

Here the proof reads like a back-and-forth conversation with Lean: bring the assumption into scope, unpack its two parts, split the goal into two subgoals, and close each one with the matching piece. Because Lean updates the goal view after every line, you always know where you stand, which is the main reason people reach for tactics on anything longer than a one-liner.

## How a tactic fills holes in a term

Under the hood, a tactic is a small Lean program editing a proof in progress. An unfinished proof contains **metavariables**—typed holes waiting to be filled by terms. Each tactic plugs one hole with a partial expression, possibly leaving smaller holes inside it, and those new holes appear as your next goals.

When you run \`intro h\`, Lean fills the hole with \`fun h => ?_\`, a function whose body is a fresh hole of the conclusion's type. When you run \`constructor\` on a conjunction, it fills the hole with a pair containing two new holes. Once every hole is filled, you're left with a complete term, and that term is what Lean's kernel checks.

In real Lean, you can inspect the term your tactics built with \`#print\`:

\`\`\`lean-real
theorem and_swap (p q : Prop) (h : p ∧ q) : q ∧ p := by
  obtain ⟨hp, hq⟩ := h
  exact ⟨hq, hp⟩

#print and_swap
\`\`\`

Lean prints out the assembled proof term:

\`\`\`text
theorem and_swap : ∀ (p q : Prop), p ∧ q → q ∧ p :=
fun p q h => And.casesOn h fun hp hq => ⟨hq, hp⟩
\`\`\`

The tactic \`obtain\` turned into \`And.casesOn\` (the built-in eliminator that unpacks a conjunction), and \`exact\` supplied the reversed pair. Several levels in this game include a term reveal so you can watch your own tactics compile into terms like this.

## Choosing between terms and tactics

Terms shine when a proof is short and direct—applying a lemma to a couple of arguments, or writing a compact function. Writing \`hpq hp\` to use an implication is cleaner and faster to read than a multi-line tactic block.

Tactics earn their keep once a proof starts branching or evolving: case splits, chains of rewrites, induction, or intermediate facts that accumulate as you go. They also give you the goal view, which is invaluable while you're still mapping out an argument.

In practice, Lean users blend both freely. Inside a \`by\` block you can hand any term to \`exact\`, and inside a term you can drop into \`by\` for a tricky sub-piece. Learning both styles pays off: terms show you what tactics really mean, while tactics keep larger proofs manageable.

## Why the kernel still stays in charge

Because tactics only assemble terms, you don't have to trust them. Even heavyweight automation like \`simp\` or \`omega\` has to finish by handing a concrete proof term to the kernel, which checks it independently from scratch. A bug in a tactic can make it crash, loop, or generate an invalid term that the kernel rejects, yet it can't trick Lean into accepting a false theorem as long as the kernel itself is sound. The article on the kernel digs deeper into this safety boundary.

This also clarifies what a tactic script really is: a recipe for building a piece of evidence you could, in principle, have written by hand. Keeping that connection in mind bridges the early part of the game, where you write terms directly, with the later worlds where tactics take center stage.

## Reading mixed proofs in a library

When you open a library file, the opening token tells you which style you're looking at: \`fun\` or a lemma application signals a term, while \`by\` opens a tactic block. If a tactic proof puzzles you, \`#print\` reveals the underlying term; if a dense term puzzles you, trace it as if the goal view were open, asking what type each sub-expression has and what hole it's filling. That habit makes both styles comfortable to read.`,
  },
  {
    id: 'types-everywhere',
    section: 'theory',
    title: 'Types, and why everything has one',
    summary: 'Why every expression in Lean carries a type, how function types and Prop work, and what the universe ladder prevents.',
    minutes: 5,
    worlds: ['types'],
    next: ['propositions-as-types', 'dependent-types'],
    body: `In Lean, every expression has a **type**, and there's no such thing as an untyped value. The number \`7\` has type \`Nat\` (the natural numbers), \`"hello"\` has type \`String\`, and \`fun n => n + 1\` has type \`Nat → Nat\`, the type of functions from natural numbers to natural numbers. Any expression with a type is called a **term**, and we write that relationship with a colon: \`7 : Nat\`.

This single rule is Lean's foundation. Types fill roughly the same role that sets fill in school mathematics, with one big difference. In set theory, an object can belong to many sets at once, and membership is a claim you prove or disprove. In type theory, every term carries its type as part of its identity. Asking whether \`7 : Nat\` isn't a theorem you prove—it's something Lean checks automatically as it reads your code.

## Functions as ordinary values

Whenever \`A\` and \`B\` are types, \`A → B\` is the type of functions that accept an \`A\` and return a \`B\`. You build a function with \`fun\` and call it by placing it next to its argument:

\`\`\`lean
def double (n : Nat) : Nat := n + n

def twice (f : Nat → Nat) (x : Nat) : Nat := f (f x)

theorem twice_double (x : Nat) : twice double x = x + x + (x + x) := rfl
\`\`\`

Here \`double\` has type \`Nat → Nat\`, while \`twice\` takes a function first and a number second, applying that function two times—giving it the type \`(Nat → Nat) → Nat → Nat\`. Functions are ordinary terms, so you can pass them into other functions or return them just like numbers.

Because the arrow groups to the right, \`Nat → Nat → Nat\` means \`Nat → (Nat → Nat)\`: a function that takes one number and hands back a function waiting for the second. That convention is called **currying**, and it means partial application works out of the box—\`twice double\` is a valid term of type \`Nat → Nat\` that doubles its input twice.

Notice that \`twice_double\` is proved by \`rfl\` alone, because unfolding both definitions reduces the two sides to the exact same expression. The article on equality explains when computation is enough and when it isn't.

## Types have types, all the way up

Types are terms too, so they need types of their own. \`Nat\` has type \`Type\`, \`Type\` has type \`Type 1\`, \`Type 1\` has type \`Type 2\`, and so on up an infinite ladder of **universes**. That ladder exists to block a paradox: if \`Type\` had type \`Type\`, you could build a type-theoretic version of Russell's paradox and break Lean's logic completely. In day-to-day proving you rarely notice the ladder, because Lean infers the levels automatically. For this game, knowing \`Nat : Type\` and \`Type : Type 1\` is plenty.

You can check the type of any expression with \`#check\`:

\`\`\`text
#check 7               -- 7 : Nat
#check Nat             -- Nat : Type
#check Nat → Nat       -- Nat → Nat : Type
#check fun n : Nat => n + 1   -- fun n => n + 1 : Nat → Nat
\`\`\`

Comments start with two dashes \`--\`; the comments on the right show what Lean replies.

## Prop: the sort for mathematical statements

Alongside \`Type\`, Lean has a second basic sort called \`Prop\`, the type of **propositions**—statements that can be true or false, such as \`2 + 2 = 4\`, \`∀ n : Nat, n + 0 = n\`, or \`p → q\`.

A proposition is itself a type, and a proof of it is a term of that type. That's the main subject of the next article, and it's also why this game is called Inhabit: proving a proposition means producing a value that *inhabits* it. What sets \`Prop\` apart from \`Type\` is that Lean treats any two proofs of the same proposition as equal. All that matters is whether a statement has a proof, never which particular proof you built.

## What strict typing buys you

Insisting on types helps in three ways. First, it catches nonsense immediately: \`7 + "hello"\` fails as soon as Lean parses it, because \`"hello"\` isn't a \`Nat\`. Second, types guide Lean's inference—when you write \`x + y\` and Lean knows \`x : Nat\`, it immediately knows \`y\` should be a \`Nat\` too and fills in omitted details like the type of a numeral \`2\`. Third, types double as the language for stating theorems, as the next two articles show.

Think of a type as the answer to "what kind of thing is this?" Whenever Lean reports that an expression "has type X but is expected to have type Y", the type checker is just doing its job, and your task is to see why those two descriptions don't match.

## A quick note on universe levels

In real Lean, definitions often work across every universe level at once using variables like \`Sort u\` and \`Type u\`. Standard library definitions do this constantly so one \`List\` type works for lists of numbers and lists of types alike. This game stays on the lowest levels and never asks you to mention \`u\`. If you see \`universe u\` while browsing Mathlib, you can read it as routine bookkeeping saying the definition works at any level.`,
  },
  {
    id: 'propositions-as-types',
    section: 'theory',
    title: 'Propositions as types',
    summary: 'The Curry–Howard correspondence in plain terms: how every logical connective matches a type construction, and where Prop adds a twist.',
    minutes: 6,
    worlds: ['props', 'logic'],
    next: ['dependent-types', 'inductive-types'],
    body: `The core idea that gives Lean its distinctive flavor is simple to state: **a proposition is a type, and a proof of it is a term of that type**. Logicians call this the Curry–Howard correspondence, after Haskell Curry and William Alvin Howard, who noticed the pattern in different settings. In Lean it isn't a loose analogy—a proof of \`p\` literally is a value whose type is \`p\`.

## Implication is a function

Start with the cleanest example. A function from \`A\` to \`B\` is a rule that turns any value of type \`A\` into a value of type \`B\`. A proof of "if \`p\` then \`q\`" is a rule that turns any proof of \`p\` into a proof of \`q\`. Those two ideas match down to the last detail, so Lean uses the exact same arrow \`p → q\` for both function types and implication, and a proof of \`p → q\` is literally a function:

\`\`\`lean
theorem mp (p q : Prop) (hp : p) (hpq : p → q) : q := hpq hp
\`\`\`

Here \`hpq\` is a function, \`hp\` is its argument, and \`hpq hp\` is ordinary function application. Modus ponens—the classical rule saying that from \`p\` and \`p → q\` you may conclude \`q\`—doesn't even need to be added as a separate logical rule. Calling a function already does the job.

## Connectives and their matching types

Every logical connective pairs up with a way of forming types, and each one comes with two moves: how to *build* a proof of it, and how to *use* a proof you already have.

| Statement | Corresponding type | To prove it | To use a proof of it |
|---|---|---|---|
| \`p → q\` | function type | \`fun hp => ...\` | apply it to a proof of \`p\` |
| \`p ∧ q\` | pair (product) | \`⟨hp, hq⟩\` | take \`.1\` or \`.2\` |
| \`p ∨ q\` | tagged union (sum) | \`Or.inl hp\` or \`Or.inr hq\` | case analysis |
| \`p ↔ q\` | pair of implications | \`⟨hpq, hqp⟩\` | take \`.mp\` or \`.mpr\` |
| \`False\` | type with no terms | cannot be proved | derive anything |
| \`¬p\` | \`p → False\` | \`fun hp => ...\` | apply it to a proof of \`p\` |
| \`∀ x, p x\` | dependent function | \`fun x => ...\` | apply it to a value |
| \`∃ x, p x\` | dependent pair | \`⟨w, hw⟩\` | take it apart |

The bottom two rows involve types that depend on values, which we'll unpack in the next article. Two middle rows are worth pausing on right now. \`False\` is simply an empty type with zero constructors, so you can never construct a value of it—and the old rule "from a contradiction, anything follows" is just the fact that writing a function out of an empty type requires zero cases. Meanwhile, \`¬p\` isn't a primitive symbol at all; it's defined as \`p → False\`, meaning a proof of "not \`p\`" is a function that turns any hypothetical proof of \`p\` into a contradiction.

## Seeing the table in three short proofs

You can watch the table come alive in three one-line term proofs. Because a conjunction is a pair, swapping \`p ∧ q\` just flips its two fields:

\`\`\`lean
theorem and_comm' (p q : Prop) : p ∧ q → q ∧ p :=
  fun h => ⟨h.2, h.1⟩
\`\`\`

A disjunction is a value tagged with whether it came from the left or right, so using it means handling both branches:

\`\`\`lean
theorem or_comm' (p q : Prop) : p ∨ q → q ∨ p :=
  fun h => h.elim (fun hp => Or.inr hp) (fun hq => Or.inl hq)
\`\`\`

And negation chains like ordinary function composition—if \`p\` implies \`q\` and \`q\` is impossible, then \`p\` is impossible too:

\`\`\`lean
theorem not_of_imp (p q : Prop) (hpq : p → q) (hnq : ¬q) : ¬p :=
  fun hp => hnq (hpq hp)
\`\`\`

Since \`¬p\` unfolds to \`p → False\`, that last proof takes a hypothetical \`hp : p\`, feeds it into \`hpq\` to get \`q\`, and passes that to \`hnq\` to reach \`False\`.

## Why unifying logic and types pays off

Treating propositions as types turns proof-checking into type-checking. Lean doesn't need one engine for running programs and a separate engine for verifying logic—the same type checker verifies both. It also demystifies why logic tactics behave the way they do: \`intro\` writes a \`fun\`, \`constructor\` packs a pair, and \`apply\` calls a function whose output matches your current goal.

Better yet, theorems become ordinary reusable values. A theorem is just a named definition whose type happens to live in \`Prop\`, and applying a theorem in a later proof is nothing more than calling a function.

## Two nuances: proof irrelevance and classical logic

There are two subtle places where Lean bends the pure correspondence, and both are worth knowing upfront.

First, Lean puts propositions in their own sort, \`Prop\`, where any two proofs of the same statement are treated as equal—a rule called **proof irrelevance**. For data, \`(1, 2)\` and \`(2, 1)\` are distinct pairs and a program cares which one it gets. For a proof of \`p ∧ q\`, only the fact that a proof exists matters. Keeping \`Prop\` separate from \`Type\` lets Lean erase proofs at runtime while keeping data computable.

Second, in pure constructive type theory, proving \`p ∨ q\` requires telling the reader which side holds. You can't prove the law of excluded middle (\`p ∨ ¬p\` for every \`p\`) that way, because doing so would require a general method to decide every mathematical statement. Lean adds classical choice as an axiom in its standard library so mathematicians can use proof by contradiction and case splits on \`p ∨ ¬p\`. The article on the kernel explains what that axiom costs and how Lean tracks it.`,
  },
  {
    id: 'dependent-types',
    section: 'theory',
    title: 'Dependent types',
    summary: 'Types that mention values—how they turn "for all" and "there exists" into functions and pairs, and why that unlocks real mathematics.',
    minutes: 6,
    worlds: ['types', 'quant'],
    next: ['inductive-types', 'equality'],
    body: `Up to now, types like \`Nat → Nat\` have stayed completely fixed—they didn't refer to any specific values. **Dependent types** relax that restriction by letting a type mention a value. That single step is what lets Lean express quantifiers and state almost all of modern mathematics.

## When a return type depends on the input

Think about the identity function: for any type \`α\`, it takes a value of type \`α\` and hands it right back. Its type has to name \`α\` first so it can refer to \`α\` again in the rest of the signature:

\`\`\`lean
def myId (α : Type) (a : α) : α := a
\`\`\`

The type of \`myId\` is \`(α : Type) → α → α\`. Notice that the type of the *second* argument, \`a : α\`, depends on the actual value passed for the *first* argument. This is a **dependent function type**, often called a Π-type. In general, \`(x : A) → B x\` describes functions that accept \`x : A\` and return a value of type \`B x\`, where the output type can vary with \`x\`. Whenever \`B\` doesn't mention \`x\`, that collapses back to the familiar arrow \`A → B\`, making ordinary functions just a special case.

## "For all" as a dependent function

Now look at a mathematical statement like \`∀ n : Nat, n + 0 = n\` through the lens of types. Each natural number \`n\` produces its own proposition \`n + 0 = n\`. A proof of the universal claim is a function that takes any \`n\` and returns a proof of that specific equation—for \`n = 3\` it returns a proof of \`3 + 0 = 3\`, and for \`n = 8\` it returns a proof of \`8 + 0 = 8\`:

\`\`\`lean
theorem add_zero_all : ∀ n : Nat, n + 0 = n := fun n => rfl
\`\`\`

That's literally a dependent function whose output type lives in \`Prop\`. So \`∀\` doesn't introduce new logical machinery; it's just the dependent function arrow written with mathematical notation when the result is a proposition. And \`p → q\` is the simpler case where \`q\` never mentions the proof of \`p\`. That's why \`intro\` works identically on both \`∀\` and \`→\`—in both cases, you're just naming the input of a function.

## "There exists" as a dependent pair

The companion idea is a **dependent pair**, where the type of the second component depends on the value in the first. A proof of \`∃ n : Nat, n * n = 49\` pairs up a concrete witness \`n\` with a proof that \`n * n = 49\` holds for that exact \`n\`:

\`\`\`lean
theorem square_forty_nine : ∃ n : Nat, n * n = 49 := ⟨7, rfl⟩
\`\`\`

Compare that with \`∧\`. In a proof of \`p ∧ q\`, the second component always has type \`q\`, regardless of what's in the first slot. In a proof of \`∃ x, p x\`, the second slot has type \`p w\`, customized to the witness \`w\` you chose. Lean uses the same angle brackets \`⟨...⟩\` to build both, and in tactic mode \`use 7\` fills in the witness and leaves you to prove the property for \`7\`.

To use an existence hypothesis \`h : ∃ x, p x\`, you unpack the pair with \`obtain ⟨w, hw⟩ := h\`. That gives you a name \`w\` for the witness and a proof \`hw : p w\`. You don't learn which concrete value \`w\` is—only that it exists and satisfies \`hw\`—which matches the mathematician's "let \`w\` be such a number".

## Why quantifier order changes the type

Because quantifiers are types, the famous difference between \`∀ n, ∃ m, ...\` and \`∃ m, ∀ n, ...\` shows up directly as two incompatible types. The first is a function that picks a possibly different witness \`m\` for each \`n\`; the second is a single pair whose one fixed witness \`m\` has to work for every \`n\`. Lean won't let you slide between them—you have to prove the exact order you wrote down, a trap we revisit in the article on translating English into Lean.

## Stating real math and invariants

With dependent types on board, Lean can express statements like "for every natural number there's a larger prime", "every map from a set to its subsets misses some subset", or the \`ε\`–\`δ\` definition of continuity. Nothing extra has to be bolted onto the language: predicates are functions into \`Prop\`, and quantifiers are dependent functions and pairs over them. Cantor's theorem at the end of this game uses exactly this setup.

Dependent types also let everyday programs encode invariants directly in their types. The classic example is a vector—a list that tracks its own length:

\`\`\`lean-real
inductive Vec (α : Type) : Nat → Type where
  | nil : Vec α 0
  | cons {n : Nat} : α → Vec α n → Vec α (n + 1)

def Vec.head {α : Type} {n : Nat} : Vec α (n + 1) → α
  | .cons a _ => a

#eval (Vec.cons 5 Vec.nil).head
\`\`\`

Here \`Vec α n\` is the type of lists of length \`n\`. Because \`head\` demands a \`Vec α (n + 1)\`, it can only ever be called on a nonempty list—there's no empty case to handle and no runtime crash to guard against, and \`#eval\` cleanly prints \`5\`.

## The trade-off for all this power

All of this expressiveness comes with a price. Type checking gets harder because Lean sometimes has to evaluate expressions inside types to decide whether two types match—one of the reasons Lean distinguishes two kinds of equality, covered later in this section. Error messages can also grow verbose when large computed expressions show up inside a type. Even so, the payoff is huge: statements, programs, and proofs all live smoothly inside one unified language.`,
  },
  {
    id: 'inductive-types',
    section: 'theory',
    title: 'Inductive types',
    summary: 'How Nat, And, Or, and False are all defined by their constructors, and why recursion and induction turn out to be the same principle.',
    minutes: 6,
    worlds: ['logic', 'nat'],
    next: ['equality', 'kernel-and-trust'],
    body: `Almost everything in Lean that isn't a function type or a sort is an **inductive type**. You define an inductive type by listing its **constructors**—the complete set of ways to build a value of that type. No other values exist, and that closed list is what makes case analysis and induction possible.

## Building the natural numbers from two constructors

The natural numbers come from just two constructors. In Lean's library, the definition looks roughly like this:

\`\`\`text
inductive Nat where
  | zero : Nat
  | succ (n : Nat) : Nat
\`\`\`

There's a base number \`zero\`, and for any number \`n\` there's its successor \`succ n\`. Every natural number is just \`zero\` wrapped in \`succ\` some finite number of times—\`3\` is shorthand for \`succ (succ (succ zero))\`. Nothing else belongs to \`Nat\`.

You can define your own copy of the natural numbers the exact same way, write addition by recursing on the second argument, and convert back to Lean's \`Nat\` to test it:

\`\`\`lean-real
inductive MyNat where
  | zero : MyNat
  | succ (n : MyNat) : MyNat

def MyNat.add : MyNat → MyNat → MyNat
  | m, .zero => m
  | m, .succ n => .succ (MyNat.add m n)

def MyNat.toNat : MyNat → Nat
  | .zero => 0
  | .succ n => n.toNat + 1

#eval (MyNat.add (.succ (.succ .zero)) (.succ .zero)).toNat
\`\`\`

That evaluates to \`3\`. Notice how \`add\` has one equation for each constructor of its second argument.

## Logic is built from inductive types too

Lean's logical connectives use the exact same mechanism—their constructors specify how to prove them:

\`\`\`text
structure And (a b : Prop) : Prop where
  intro :: (left : a) (right : b)

inductive Or (a b : Prop) : Prop where
  | inl (h : a) : Or a b
  | inr (h : b) : Or a b

inductive False : Prop
\`\`\`

\`And\` has a single constructor taking two proofs, so a proof of \`p ∧ q\` is simply a pair. \`Or\` has two constructors, one per side, so a proof of \`p ∨ q\` carries a tag saying which side was proved. \`False\` has zero constructors, so there's no way to build a proof of it. Existentials \`∃\` have one constructor bundling a witness with its proof, and even equality \`=\` is an inductive type with one constructor, \`rfl\`, saying that anything equals itself.

## Constructors build values; recursors take them apart

Every inductive definition automatically generates a companion rule called its **recursor**, which tells you how to consume a value of that type. To use a proof of \`Or\`, you provide one branch for \`inl\` and one branch for \`inr\`—that's \`Or.elim\`, and it's what the \`cases\` tactic invokes. To use a proof of \`And\`, you supply a function expecting both components, which is what \`obtain ⟨a, b⟩\` sets up. And since \`False\` has zero constructors, handling all its cases takes zero work, which is why anything follows from \`False\`.

The pattern never changes: because values can only come from the listed constructors, proving a claim for every constructor proves it for the entire type. Lean derives that principle automatically from the definition.

## Why recursion and induction are the same rule

For \`Nat\`, the recursor is \`Nat.rec\`. Aim it at \`Type\` and it defines recursive functions: give a value for \`zero\` and a way to compute the value for \`succ n\` from the value for \`n\`, and you get a function defined on every natural number. Aim the exact same rule at \`Prop\` and it proves theorems by induction: give a proof for \`zero\` and a way to turn a proof for \`n\` into a proof for \`succ n\`, and you get a proof for every natural number. Writing a recursive function and writing an inductive proof are two faces of the same construction, which is why their syntax looks almost identical.

Here's induction in action, in the form you use throughout the game:

\`\`\`lean
theorem zero_add_again (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, ih]
\`\`\`

The base case \`0 + 0 = 0\` simplifies immediately by computation. The step case gives you the inductive hypothesis \`ih : 0 + k = k\` and asks for \`0 + (k + 1) = k + 1\`, which falls to rewriting with addition's recursive rule and then \`ih\`. Behind the scenes, \`induction\` just applied \`Nat.rec\` to generate those two goals.

## How Lean keeps inductive types safe

Not every recursive declaration makes sense—some self-referential definitions would sneak a logical paradox into the system. Lean's kernel enforces a rule called **strict positivity**, ensuring that the type being defined only appears in safe positions inside its constructors so every value is genuinely built from smaller pieces. That check guarantees termination for structural recursion and keeps the logic consistent.

## Seeing tactics through constructors

Once you start reading every type as its list of constructors, tactics stop feeling arbitrary. \`constructor\` picks a constructor to build the goal. \`cases\` and \`rcases\` split a hypothesis along the constructors that could have built it, and \`induction\` does the same while also handing you an inductive hypothesis for recursive fields. \`injection\` and \`contradiction\` rely on constructors being distinct—\`succ n = zero\` is impossible because two different constructors never produce the same value. Whenever a goal stalls you, asking "what are the constructors here?" usually points straight to the next line.`,
  },
  {
    id: 'equality',
    section: 'theory',
    title: 'Two kinds of equality',
    summary: 'Definitional equality, which Lean checks by computing, versus propositional equality, which you prove—and why n + 0 = n is free while 0 + n = n needs induction.',
    minutes: 5,
    worlds: ['eq', 'nat'],
    next: ['kernel-and-trust', 'how-to-attack-a-proof'],
    body: `Lean has two distinct notions of "the same", and understanding the split clears up some of the most common early surprises.

## Definitional equality: same by computation

Two expressions are **definitionally equal** when Lean can reduce them to the same form just by unfolding definitions and evaluating. For example, \`2 + 2\` and \`4\` are definitionally equal: addition on natural numbers is a computable function, and running it on \`2\` and \`2\` produces \`4\`. Lean checks this silently on its own and treats definitionally equal expressions as completely interchangeable. You don't need to prove they're equal—to the checker, they're already two spellings of the same thing.

The proof term \`rfl\` (short for reflexivity) settles any equation whose two sides are definitionally equal:

\`\`\`lean
theorem two_plus_two : 2 + 2 = 4 := rfl
\`\`\`

Lean accepts this because \`rfl\` proves \`4 = 4\`, and \`2 + 2\` computes straight to \`4\`.

## Propositional equality: a claim you have to prove

The equality symbol \`a = b\` itself forms a proposition—an inductive type whose single constructor is \`rfl : a = a\`. When you state \`a + b = b + a\`, you're asking for a *proof* of that proposition. Lean can't settle it by computing, because \`a\` and \`b\` are abstract variables, so evaluation gets stuck. Instead, you have to build a proof out of lemmas, rewrites, and induction.

If an equation is only propositionally true, \`rfl\` fails and Lean tells you it can't unify the two sides. The bridge between the two worlds is \`rw\`: given a proof \`h : a = b\`, \`rw [h]\` substitutes \`b\` for \`a\` inside the goal. A typical \`rw\` proof takes a few propositional steps and then lets definitional equality quietly close what's left:

\`\`\`lean
theorem rewrite_example (a b : Nat) (h : a = b) : a + 1 = b + 1 := by
  rw [h]
\`\`\`

Once \`rw [h]\` changes the goal to \`b + 1 = b + 1\`, \`rw\` automatically calls \`rfl\` and finishes the proof.

## Why \`n + 0 = n\` is free

Natural-number addition is defined by recursion on its *second* argument:

\`\`\`text
n + 0      = n
n + succ m = succ (n + m)
\`\`\`

Because the first clause matches whenever the right-hand argument is \`0\`, \`n + 0\` reduces directly to \`n\` even when we know nothing about \`n\`. That makes \`n + 0 = n\` a definitional equality, so \`rfl\` proves it in one word:

\`\`\`lean
theorem add_zero_free (n : Nat) : n + 0 = n := rfl
\`\`\`

## Why \`0 + n = n\` isn't

Now flip the order. Addition inspects its *second* argument, which here is the unknown variable \`n\`. Evaluation stalls immediately: Lean can't tell whether \`n\` is \`zero\` or \`succ k\`, so \`0 + n\` won't reduce to \`n\` and \`rfl\` rejects it.

Of course \`0 + n = n\` is still true—it just requires a proof by induction, breaking \`n\` into its two constructors. For \`0\`, \`0 + 0 = 0\` computes outright; for \`succ k\`, the step reduces to \`0 + (k + 1) = k + 1\`, which follows from the inductive hypothesis \`0 + k = k\`.

To a human reader, \`n + 0 = n\` and \`0 + n = n\` look equally obvious. To Lean, they belong to different categories, purely because addition was written to recurse on its second input. Had someone defined addition on its first input instead, the two equations would trade places. It's one of the clearest reminders that Lean pays attention to *how* a function is defined, not just what mathematical function it represents.

## Other tools for working with equality

Several everyday tools manipulate propositional equalities. \`congrArg\` lets you apply any function \`f\` to both sides of \`a = b\` to get \`f a = f b\`. The tactic \`symm\` flips a goal \`a = b\` into \`b = a\`, and \`calc\` lays out multi-step chains—\`a = b\`, \`b = c\`, \`c = d\`—in readable algebraic style. Under the hood, each one builds a standard proof term.

## Why Lean keeps both kinds

Having just one kind of equality might sound cleaner, yet either extreme breaks down. If every equality had to be proved explicitly, you couldn't even treat \`2 + 2\` as \`4\` inside a type like \`Vec α (2 + 2)\` without writing proof boilerplate everywhere. On the other hand, if the checker tried to decide every mathematical equality automatically by computation, type checking could loop forever—some equalities can't be decided mechanically at all. Lean splits the job down the middle: what evaluation settles, the checker handles for free; everything deeper is a theorem you prove.

You'll feel this boundary most clearly in error messages. Whenever \`rfl\` refuses to close a goal or \`rw\` can't find the pattern you expected, ask whether the step you have in mind is definitional or propositional. Nine times out of ten, that question tells you what's missing.`,
  },
  {
    id: 'kernel-and-trust',
    section: 'theory',
    title: 'The kernel: why you can trust a proof',
    summary: 'What Lean\'s small trusted kernel checks, why buggy tactics can\'t sneak in a false theorem, which axioms Lean uses, and what no proof checker can promise.',
    minutes: 6,
    worlds: ['props', 'logic'],
    next: ['how-to-attack-a-proof', 'lean-in-the-world'],
    body: `When Lean puts a green checkmark next to a theorem, what exactly got checked, and which pieces of software are you trusting? Lean's architecture separates the clever parts from the trusted parts, and knowing where that line sits tells you how much confidence a Lean proof earns—and where the real risks still live.

## A small kernel and an untrusted periphery

At the center of Lean sits the **kernel**, a relatively small program with one job: check whether a proof term actually has the type claimed by the theorem. It implements only the core rules of Lean's type theory—how types are formed, how terms are typed, when two expressions are definitionally equal, and whether an inductive type is well-formed.

Everything else lives outside the kernel: the parser, the elaborator that infers implicit arguments, the tactic engine, automation like \`simp\` and \`omega\`, and editor tooling. None of those layers is trusted. Their only role is to construct a raw proof term and hand it over, and the kernel checks that term from scratch.

This design follows what logicians call the *de Bruijn criterion*: keep the checker small enough for humans to audit closely, and let complex tools outside it produce verifiable certificates. Even when a big theorem generates an enormous proof term, checking it in the kernel is purely mechanical—there's no search and no guesswork.

## What happens when a tactic gets it wrong

Because tactics sit outside the trusted core, a buggy tactic can't smuggle in a false theorem. Plenty of things can still go wrong with a tactic—it can fail with an error, crawl slowly, or output a bloated proof term. If a bug makes it emit an invalid proof term, the kernel simply rejects the term and refuses to accept the theorem. Heavyweight automation like \`simp\`, \`omega\`, and \`grind\` follows the exact same rule: they search for a proof term, and the kernel has the final word on whatever they build.

That separation is also why you can safely import theorems from Mathlib without reading their proofs. Every theorem in the library passed the same kernel check when Mathlib was built, and \`#check\` displays its exact statement. You're trusting the kernel and the statement, not the author's infallibility.

## The three standard axioms and #print axioms

Every logical system starts from a few unproved foundations called **axioms**. Beyond the core type-theory rules, Lean's standard library includes three axioms, and \`#print axioms\` lets you see exactly which ones any theorem relies on:

\`\`\`lean-real
theorem em_demo (p : Prop) : p ∨ ¬p := Classical.em p

#print axioms em_demo
\`\`\`

Lean answers:

\`\`\`text
'em_demo' depends on axioms: [propext, Classical.choice, Quot.sound]
\`\`\`

Here's what each one says:

- **\`propext\`** (propositional extensionality): if two propositions imply each other, they're equal.
- **\`Quot.sound\`**: justifies quotient types and gives us function extensionality (\`funext\`), saying that two functions with the same output on every input are equal.
- **\`Classical.choice\`**: the axiom of choice, which implies the law of excluded middle (\`p ∨ ¬p\`).

A proof that uses none of these three is **constructive**—a constructive proof of \`p ∨ q\`, for instance, actually hands you which side is true. Proofs that invoke excluded middle are **classical** and give up that computational witness. Almost all of Mathlib works classically, matching everyday mathematics. You see the distinction in the game's logic world: \`by_cases\` and \`by_contra\` lean on classical reasoning, whereas \`constructor\`, \`intro\`, and \`cases\` stay constructive. Running \`#print axioms\` lets you verify which axioms a theorem actually touched.

If a proof still contains \`sorry\`—the placeholder for an unfinished branch—Lean flags it with an extra axiom called \`sorryAx\`:

\`\`\`text
'bad' depends on axioms: [sorryAx]
\`\`\`

Similarly, the \`native_decide\` tactic evaluates a decision procedure using compiled code instead of the kernel, which adds \`Lean.ofReduceBool\` and extends your trust to Lean's compiler. Whenever you want the strictest audit of a result, \`#print axioms\` tells the whole story.

## Three things the kernel can't guarantee

Even with a solid kernel, three caveats always apply.

**Your statement might not say what you meant.** Lean only verifies the formal statement on the page. If a missing hypothesis makes your theorem vacuously true, or a weak definition misses the real concept, Lean happily checks the proof anyway. In serious formalization projects, reviewing definitions and theorem statements matters far more than reading proofs.

**The kernel is still software.** It's small, open source, and checked by independent external type checkers written in other languages—all of which keeps the risk very low—yet bugs in software are never strictly zero. And by Gödel's second incompleteness theorem, Lean can't prove its own consistency from inside itself; soundness is a meta-mathematical result studied on paper.

**Custom axioms bypass the checker.** Anyone can write an \`axiom\` declaration in a file and assume anything without proof. Fortunately, any custom axiom—just like \`sorry\` or \`native_decide\`—shows up immediately in \`#print axioms\`.

## Knowing what a checkmark really means

None of those caveats undermines how strong a Lean proof is. Computer-checked verification catches subtle gaps that human refereeing misses all the time, and the few remaining failure modes are transparent and easy to inspect. Build the habit of checking three things—read the definitions, read the statement, and run \`#print axioms\`—and you'll know with clear eyes exactly what Lean has certified.`,
  },
  {
    id: 'how-to-attack-a-proof',
    section: 'practice',
    title: 'How to attack a proof',
    summary: 'A practical routine for starting and advancing a proof, plus quick-reference tables mapping goal and hypothesis shapes to the right tactic.',
    minutes: 6,
    worlds: ['props', 'logic', 'quant', 'forge'],
    next: ['english-to-lean', 'lean-programming'],
    body: `Staring at an empty \`by\` block, it's tempting to think there's a clever trick you're supposed to spot right away. For most proofs in this game—and a surprising fraction of real Lean proofs—there's no trick at all. You just let the outermost symbol of the goal and the shapes of your hypotheses tell you the next move.

## Five moves to get unstuck

**Read the goal first.** Say out loud what the line after \`⊢\` is asking for. Is it an implication, a conjunction, a "for all", or an equation? That outer connective almost always dictates your opening step.

**Introduce what you can.** If the goal starts with \`p → q\`, run \`intro hp\` to assume \`p\` and focus on \`q\`. If it starts with \`∀ x, p x\`, run \`intro x\` to pick an arbitrary \`x\`. Introducing early costs nothing and puts more ingredients above the turnstile.

**Break the goal down.** For \`p ∧ q\` or \`p ↔ q\`, \`constructor\` splits the job into two smaller goals. For \`p ∨ q\`, pick a side with \`left\` or \`right\` once you can see which side is provable. For \`∃ x, p x\`, supply a witness with \`use\`.

**Unpack your hypotheses.** Scan above the turnstile. Split an \`∧\` or \`∃\` hypothesis with \`obtain\`, branch on an \`∨\` hypothesis with \`cases\`, feed inputs into an implication or \`∀\` hypothesis, or rewrite with an equation using \`rw\`.

**Move backward or forward.** Working backward uses \`apply\`: if you have \`h : p → q\` and your goal is \`q\`, \`apply h\` shifts the goal back to \`p\`. Working forward uses \`have\`: derive an intermediate fact like \`have hq : q := h hp\` to add it to your hypotheses. Pick whichever direction shrinks the gap faster. When you can see a stepping stone but don't want to prove it yet, write \`have ... := by sorry\` and fill it in once the rest of the skeleton fits.

## Quick reference: goals and hypotheses

| The goal looks like | Try |
|---|---|
| \`p → q\` | \`intro hp\` |
| \`∀ x, p x\` | \`intro x\` |
| \`p ∧ q\` | \`constructor\` |
| \`p ↔ q\` | \`constructor\`, then prove each direction |
| \`p ∨ q\` | \`left\` or \`right\`, once you know which |
| \`∃ x, p x\` | \`use w\`, for a witness \`w\` |
| \`¬p\` | \`intro hp\`, then prove \`False\` |
| \`a = b\` | \`rfl\`, or \`rw\` with a known equation |
| \`x ∈ A ∩ B\` | \`constructor\` |
| \`A ⊆ B\` | \`intro x hx\` |
| \`False\` | find a contradiction among the hypotheses |
| the goal matches a hypothesis exactly | \`exact h\` or \`assumption\` |

| A hypothesis looks like | Try |
|---|---|
| \`h : p ∧ q\` | \`obtain ⟨hp, hq⟩ := h\` |
| \`h : p ∨ q\` | \`cases h\` or \`rcases h with hp \\| hq\` |
| \`h : ∃ x, p x\` | \`obtain ⟨w, hw⟩ := h\` |
| \`h : p → q\` | \`apply h\` to a goal \`q\`, or \`h hp\` with \`hp : p\` |
| \`h : ∀ x, p x\` | \`specialize h a\`, or \`h a\` as a term |
| \`h : a = b\` | \`rw [h]\` or \`rw [← h]\` |
| \`h : False\` or a contradiction | \`contradiction\` or \`exfalso\` |

These tables cover the game's tactics, and the same instincts carry straight over to real Lean. Treat them as reflexes rather than a rigid algorithm: when two rows both apply, either order usually works, though one often keeps the proof shorter.

## Walking through an injectivity proof

Take the claim that composing two injective functions gives an injective function. Recall that a function is **injective** when equal outputs force equal inputs (equivalently, distinct inputs always map to distinct outputs):

\`\`\`lean
theorem compose_inj {α β γ : Type} (f : α → β) (g : β → γ)
    (hf : Function.Injective f) (hg : Function.Injective g) :
    Function.Injective (g ∘ f) := by
  intro a b h
  apply hf
  apply hg
  exact h
\`\`\`

The goal \`Function.Injective (g ∘ f)\` unfolds to \`∀ a b, (g ∘ f) a = (g ∘ f) b → a = b\`. Following the table, \`intro a b h\` brings the two inputs and the equation \`(g ∘ f) a = (g ∘ f) b\` into scope, leaving \`a = b\`.

Now look at the hypotheses. \`hf\` turns \`f a = f b\` into \`a = b\`, which matches our goal, so working backward with \`apply hf\` changes the goal to \`f a = f b\`. Doing the same with \`apply hg\` changes it to \`g (f a) = g (f b)\`. Since \`(g ∘ f) a\` is definitionally \`g (f a)\`, that's literally \`h\`, so \`exact h\` closes the proof. Every line was prompted straight from the shapes on screen.

## What to try when the table runs out

When none of the standard moves fits right away, try one of these:

- **Unfold definitions.** Use \`unfold\` or \`show\` to expose what a name actually means. Goals like \`A ⊆ B\` become much friendlier once you see them as \`∀ x, x ∈ A → x ∈ B\`.
- **Check your lemmas.** Look through the Inventory and the Codex—if a step feels like a standard fact, there's probably already a lemma for it.
- **Switch direction.** If backward steps with \`apply\` stall, derive a helpful forward fact with \`have\`; if forward steps pile up without reaching the target, work backward from the goal.
- **Test a smaller case.** Sketch the argument on \`0\` or a tiny concrete example to see what the general step needs.
- **Sketch with \`sorry\`.** Temporarily put \`sorry\` on a hard subgoal, finish the surrounding structure, and come back with a clearer view. Experienced Lean users do this constantly.

## Read the goal aloud first

If you build just one habit from this article, make it pausing to read the goal view in plain English before typing. The tables above are really just a bridge from that reading to Lean syntax: spot the outer symbol, check what you already have, and take the step that matches.`,
  },
  {
    id: 'english-to-lean',
    section: 'practice',
    title: 'From English to Lean',
    summary: 'How to translate a mathematical sentence into a faithful Lean statement, and the four traps that quietly change its meaning.',
    minutes: 6,
    worlds: ['quant', 'forge'],
    next: ['lean-programming', 'mathlib-community'],
    body: `Proving a theorem is only half of formalization. The other half is writing the statement itself—and here Lean can't save you, because it will cheerfully verify whatever you type. What follows is a dependable workflow for turning English into Lean, along with the four mistakes that most often bend a statement out of shape.

## Five steps from English to a statement

The Workshop in this game walks through five steps, and four of them happen before you prove a single line:

1. **Say it clearly.** Rewrite the claim in plain, unambiguous English, spelling out every "for all", "there exists", and "if … then".
2. **Assign types.** Decide what kind of object each variable is: a natural number, a set of numbers, a function between two types.
3. **Define missing concepts.** If the claim uses a notion Lean doesn't already have, write a definition for it.
4. **State it.** Put the objects in as binders, the assumptions as hypotheses, and the conclusion after the colon.
5. **Prove it.**

Try that on "the sum of two even numbers is even". First, unpack the hidden quantifiers: "for all natural numbers \`m\` and \`n\`, if \`m\` is even and \`n\` is even, then \`m + n\` is even". Next, assign types: \`m\` and \`n\` are \`Nat\`, and \`Even\` is already defined. That leads straight to the declaration:

\`\`\`text
theorem even_add' (m n : Nat) (hm : Even m) (hn : Even n) : Even (m + n) := by
  sorry
\`\`\`

Now read your Lean statement back into English word for word: two natural numbers, both even, whose sum is even. That matches the original sentence. Leaving \`sorry\` as a placeholder keeps the unfinished proof flagged while you verify the statement itself. Translating your Lean back into English is the best safeguard you have.

## Trap one: swapping quantifier order

\`∀ n, ∃ m, n < m\` and \`∃ m, ∀ n, n < m\` use the exact same pieces in a different order, yet they make completely different claims. The first says every number has something bigger above it—true, because \`m\` can depend on \`n\`. The second claims a single number \`m\` is bigger than every number—false, because \`m\` has to be fixed in advance.

\`\`\`lean
theorem forall_exists_succ : ∀ n : Nat, ∃ m : Nat, m = n + 1 :=
  fun n => ⟨n + 1, rfl⟩
\`\`\`

Everyday English blurs this distinction: "every student has a favorite book" and "there is a book every student favors" can sound nearly identical in casual speech. Before writing quantifiers in Lean, decide which variable is allowed to depend on which, and put the quantifiers in that exact order.

## Trap two: putting an implication under ∃

Look at \`∃ n : Nat, n = 1 → n = 2\`, which reads "there is a number \`n\` such that if \`n = 1\`, then \`n = 2\`". That's vacuously true: just pick \`n = 0\`. Then the premise \`0 = 1\` is false, so the implication goes through with zero mathematical content:

\`\`\`lean
theorem vacuous_exists : ∃ n : Nat, n = 1 → n = 2 :=
  ⟨0, by intro h; contradiction⟩
\`\`\`

What someone usually meant was a conjunction—\`∃ n, n = 1 ∧ n = 2\`, "there is a number that is both \`1\` and \`2\`", which is false. Keep this rule of thumb handy: under \`∃\`, extra conditions on the witness are almost always joined with \`∧\`; under \`∀\`, restrictions on the variable are almost always written with \`→\`. Mixing them up produces statements that are either vacuously true or trivially false.

## Trap three: dropped or contradictory hypotheses

A translation can turn false simply because a silent condition from English got left out. "For all natural numbers \`a\` and \`b\`, \`a - b + b = a\`" is false in Lean, because natural-number subtraction truncates at zero: \`2 - 5\` evaluates to \`0\`, so \`(2 - 5) + 5\` is \`5\`, not \`2\`. The English sentence quietly assumed \`b ≤ a\`, and Lean needs that condition written explicitly as a hypothesis. Whenever a proof hits a brick wall, check for a missing hypothesis first by plugging in small test numbers.

The mirror-image mistake is writing contradictory hypotheses. If your assumptions can't all hold at once, anything follows from them and your theorem says nothing useful. A quick sanity check is to make sure you can name at least one concrete example that satisfies every hypothesis.

## Trap four: definitions that miss edge cases

Whenever you introduce a custom definition, edge cases deserve extra care. Saying "\`n\` is prime" means \`n > 1\` and its only divisors are \`1\` and \`n\`—forget \`n > 1\` and \`1\` sneaks in as a prime. Sometimes two definitions are mathematically equivalent yet behave differently in proofs: defining "even" as \`n % 2 = 0\` and defining it as \`∃ r, n = r + r\` pick out the same numbers, though the second is often much friendlier when proving algebraic identities.

Before building a whole file on top of a new definition, sanity-check it on a few concrete values: confirm that \`4\` passes, \`3\` fails, and boundary cases like \`0\` and \`1\` behave the way you expect.

## Checking your statement by translating it back

A formal proof can only vouch for the statement written at the top. In real formalization projects, reviewers scrutinize definitions and theorem statements far more carefully than proofs, because statements are short and errors there are completely invisible to the checker.

A great exercise is to take a theorem you've already proved in this game, hide the Lean code, rewrite the claim in English from memory, and compare the two. Any mismatch points straight to a spot where either your English was fuzzy or your Lean said something sharper than you realized—and spotting that difference is the core skill the Workshop builds.`,
  },
  {
    id: 'lean-programming',
    section: 'practice',
    title: 'Lean as a programming language',
    summary: 'Functions, recursion, structures, #eval, and IO in Lean—plus why Lean compiles to fast native code and implements itself.',
    minutes: 6,
    worlds: ['types', 'nat'],
    next: ['mathlib-community', 'lean-in-the-world'],
    body: `Even if you only ever open Lean to prove theorems, it helps to know that underneath it's a full-fledged functional programming language. Programs and proofs share the exact same syntax and type checker, so seeing how Lean runs code makes the proving side click even faster. The examples below use real Lean features, including several that this game's engine omits.

## Functions, pattern matching, and termination

You define a function with \`def\`, listing its name, typed parameters, return type, and body. Recursive functions usually pattern-match directly on the constructors of an input:

\`\`\`lean-real
def fib : Nat → Nat
  | 0 => 0
  | 1 => 1
  | n + 2 => fib n + fib (n + 1)

#eval fib 20

example : fib 10 = 55 := by decide
\`\`\`

Running \`#eval fib 20\` evaluates the function and prints \`6765\`. Unlike mainstream languages, Lean requires recursive functions used in logic to terminate—otherwise an infinite loop could inhabit \`Nat → False\` and wreck consistency. When recursion peels off constructors cleanly like \`fib\` does, Lean verifies termination automatically; for trickier recursion, you supply a decreasing measure and Lean checks it.

Notice the final line, too: \`decide\` proves \`fib 10 = 55\` simply by computing both sides, the same proof-by-computation idea behind \`rfl\` in the equality article.

## Structures, inductive data, and proofs about code

Just as you saw in the article on inductive types, Lean models data with \`structure\` (named fields) and \`inductive\` types (lists of constructors). Lists are a classic inductive type—either empty (\`[]\`) or a head element attached to a tail (\`x :: xs\`). Here's a list-summing function alongside a theorem about it:

\`\`\`lean-real
def sum : List Nat → Nat
  | [] => 0
  | x :: xs => x + sum xs

theorem sum_append (xs ys : List Nat) : sum (xs ++ ys) = sum xs + sum ys := by
  induction xs with
  | nil => simp [sum]
  | cons x xs ih => simp [sum, ih, Nat.add_assoc]

#eval sum [1, 2, 3, 4]
\`\`\`

\`#eval\` prints \`10\`, while \`sum_append\` proves that summing two joined lists equals the sum of their individual sums. Because \`List\` is inductive with two constructors, proving a property about \`sum\` uses \`induction\` in the exact same way induction works on \`Nat\`. That's the draw of verified software in Lean: the implementation and the proof sit in the same file, checked by the same kernel.

## Side effects and the IO type

Programs that talk to the outside world—printing to a terminal, reading files, opening sockets—return values in the \`IO\` type. An executable starts at a \`main\` function of type \`IO Unit\`:

\`\`\`lean-real
def main : IO Unit :=
  IO.println "Hello, Lean"

#eval main
\`\`\`

This prints \`Hello, Lean\`. Separating \`IO\` from pure types keeps mathematical functions clean: a function of type \`Nat → Nat\` can't secretly read a file or mutate global state, so a theorem you prove about it holds everywhere it's called.

## Native compilation and a self-hosted compiler

Lean isn't just an interpreter for small demos—it compiles programs down to native machine code so they run as standalone executables. Its runtime uses reference counting and automatically reuses memory in place whenever a value isn't shared, giving purely functional data structures surprisingly strong performance.

Even more tellingly, Lean 4 is mostly written in Lean 4. Its parser, elaborator, tactic framework, and compiler are all Lean code, and Lean's macro system powers much of its own syntax. Only the small trusted kernel is written separately in C++. Being self-hosted isn't just a badge of honor—it's why anyone who learns Lean can write custom tactics and extensions in the exact same language they use every day.

## Carrying proofs inside data and APIs

Because Lean has dependent types, functions can ask callers for proofs alongside ordinary arguments. A list lookup function, for instance, can require a proof that the index is strictly smaller than the list's length, eliminating out-of-bounds crashes at compile time. The catch is that you have to supply that proof at every call site. Tactics like \`omega\` and \`simp\` clear routine bounds checks automatically, and when a proof obligation turns messy, it's often a nudge to redesign the data structure.

## Programming features beyond this game

This game introduces \`def\`, \`#eval\`, and recursion on \`Nat\` mainly as a bridge to induction. It leaves out \`IO\`, custom \`structure\`s, type classes, and \`do\` notation, which form the backbone of everyday Lean programming. If you want to explore Lean as a software language, the official *Functional Programming in Lean* book is a welcoming start, and the Graduate screen links to more resources. Just keep in mind that Lean's general-purpose library ecosystem is still young compared to older languages, so check for the packages you need before betting a big app on it.`,
  },
  {
    id: 'mathlib-community',
    section: 'ecosystem',
    title: 'Mathlib and the community',
    summary: 'What Mathlib is, how volunteers review and maintain it, and the best ways to search for theorems and get help.',
    minutes: 5,
    next: ['lean-in-the-world'],
    body: `Core Lean gives you a language and a proof checker. What turns it into a serious home for mathematics is the library built on top of it—and the people who write, review, and answer questions about it every day.

## What lives inside Mathlib

**Mathlib** is Lean's community-built library of formalized mathematics. It gathers definitions, theorems, and specialized tactics across algebra, linear algebra, topology, analysis, measure theory, number theory, combinatorics, category theory, logic, and more—every last theorem verified by Lean's kernel.

The library is already huge. At the time of writing, its statistics page tracks roughly 140,000 definitions and 290,000 theorems from several hundred contributors, and those numbers climb every week. Treat them as a rough sense of scale rather than a fixed tally.

That scale is what changes what's possible. When you want to start a theorem with "let \`G\` be a finite group" or "let \`f\` be a continuous function on a compact space", the definitions and foundational lemmas are already waiting for you. You don't have to rebuild undergraduate math from scratch before tackling a research-level problem.

## Open review and fast-moving code

Mathlib lives in a public GitHub repository, and every addition comes through a pull request reviewed by maintainers and other contributors. Because continuous integration already confirms that proofs compile, human reviewers focus on what the kernel can't judge: Are the definitions clean? Are the theorems stated at the right level of generality? Do the names match library conventions? Does this duplicate an existing result?

That review culture has two practical effects. First, Mathlib's statements are thoughtfully curated—you're getting well-tested formalizations, not just piles of compiling code. Second, the library evolves briskly, so files occasionally move and lemmas get renamed (usually with a temporary deprecated alias to soften the transition). Real projects pin a specific Mathlib version and upgrade deliberately on their own schedule.

## The Lean Zulip and community spaces

The hub of the ecosystem is the **Lean Zulip** chat server at leanprover.zulipchat.com, organized into topic-based streams where beginners ask questions, library designers debate APIs, and large formalization teams coordinate. Newcomers are genuinely welcome—there's a dedicated stream just for new members. If you post a small, self-contained snippet others can paste into the web editor, along with the error message and what you expected, someone will usually reply quickly—often improving the whole proof instead of merely patching one line.

Beyond Zulip, the community runs workshops, summer schools, online seminars, and free interactive textbooks; the Graduate screen highlights several good starting points.

## Five ways to find a theorem you need

Nobody memorizes a library of hundreds of thousands of lemmas, so knowing how to search is half the battle:

- **Mathlib docs** (leanprover-community.github.io/mathlib4_docs) index every declaration with its full statement and direct links to the source file.
- **Loogle** (loogle.lean-lang.org) searches by type shape—hand it a function name or a pattern for the conclusion, and it lists matching theorems.
- **Natural-language search** tools like Moogle and LeanSearch let you describe a theorem in plain English and browse candidates. Always inspect the returned statement carefully to be sure it matches what you want.
- **\`exact?\`** is a Lean tactic that searches imported libraries for a single lemma that closes your current goal, printing a snippet like \`exact Nat.add_comm a b\` that you can drop straight into your proof. It can be slow on huge goals and doesn't always succeed, yet it's one of the fastest ways to learn library names.
- **Naming conventions**, covered in the article on reading theorems, let you guess names directly—and editor autocomplete fills in the rest once you type the first few letters.

## Collaborative blueprints

Many major formalization projects live in their own repositories while importing Mathlib underneath. To coordinate dozens of contributors working in parallel, teams often maintain a **blueprint**: a readable mathematical document outlining the proof, linked piece by piece to the corresponding Lean declarations so everyone can see which lemmas are proved and which still need work. Once a project wraps up, teams frequently upstream their general-purpose lemmas back into Mathlib so the whole community benefits.

## Making your first contribution

You don't need a PhD or years of Lean experience to pitch in. Fixing a typo in documentation, adding a handy missing lemma, or golfing an awkward proof are all welcome first pull requests, and maintainers tag beginner-friendly issues. Reading a few recently merged pull requests is one of the quickest ways to absorb Mathlib's style. Keep in mind that Lean and Mathlib move fast—if an older blog post or tutorial disagrees with current tooling, check the official docs and Zulip for up-to-date setup instructions.`,
  },
  {
    id: 'lean-in-the-world',
    section: 'ecosystem',
    title: 'Lean in the world',
    summary: 'Where Lean shows up outside tutorials: major math formalizations, software verification at AWS, AI proof systems, and your next steps after this game.',
    minutes: 6,
    next: ['lean-tour', 'how-to-attack-a-proof'],
    body: `Once you've spent a few hours proving logic puzzles and arithmetic identities, it's natural to ask what Lean gets used for out in the wild. Here's a grounded tour of notable real-world projects—not an exhaustive list or a ranking, just documented work showing how Lean is used in mathematics, software engineering, and AI. Because active projects move quickly, always check their home pages for the latest status.

## Landmark formalizations in mathematics

**The Liquid Tensor Experiment.** In late 2020, Fields Medalist Peter Scholze issued a public challenge: formally verify a delicate theorem about "liquid vector spaces" from his work with Dustin Clausen on condensed mathematics, a proof Scholze himself wasn't completely certain had no hidden flaw. A Lean team led by Johan Commelin—bringing together roughly a dozen mathematicians and several computer scientists—took it on. Within about six months, in 2021, they verified the exact piece Scholze had worried about most, and by July 2022 they announced the full theorem complete. Along the way, the project proved Lean could handle cutting-edge mathematics far removed from what Mathlib already contained.

**The Polynomial Freiman–Ruzsa conjecture.** In November 2023, Timothy Gowers, Ben Green, Freddie Manners, and Terence Tao released a paper proving a major conjecture in additive combinatorics. Tao immediately organized a collaborative Lean formalization using a shared blueprint, and dozens of volunteers finished verifying the entire paper in roughly three weeks, wrapping up in early December 2023. The effort stood out both for its speed and for showing how a distributed team can formalize a brand-new result in parallel.

**Sphere eversion.** Patrick Massot, Floris van Doorn, and Oliver Nash formalized Stephen Smale's famous theorem that a sphere can be turned inside out smoothly without creasing, deriving it from a general theorem in differential topology called the h-principle. Their goal was to test whether geometric, heavily visual differential topology could be formalized at all—and in 2023 they published their account of pulling it off.

**Fermat's Last Theorem.** Led by Kevin Buzzard at Imperial College London, an ongoing multi-year project aims to formalize a modern proof of Fermat's Last Theorem. Like PFR, it's organized around a public blueprint and welcomes contributors across many areas of algebraic number theory.

## Industrial software verification

**Cedar at Amazon Web Services.** Cedar is an open-source language AWS uses to write authorization policies—the rules deciding who's allowed to access what. The Cedar team built a formal model of the language in Lean and proved key security guarantees about it, including the soundness of its validator (ensuring that any policy the validator accepts won't trigger type errors during evaluation). Writing those formal models and proofs turned up real bugs that the team fixed before shipping. Notably, the team originally built their model in another verification language before migrating to Lean.

Cedar shows Lean wearing its engineering hat: the language specification is a Lean program, the safety guarantees are Lean theorems, and the exact same kernel checks both.

## AI systems trained against a proof checker

For machine learning, Lean offers something rare: an automatic, incorruptible referee. Because a proof either passes the kernel or fails, an AI system can generate candidate proofs, check them at scale, and learn from feedback without waiting on human graders.

**AlphaProof.** At the 2024 International Mathematical Olympiad, Google DeepMind's AlphaProof—paired with AlphaGeometry 2 for the geometry problem—solved four of the six problems and scored 28 out of 42 points, a silver-medal-level result. Human experts translated the competition problems into Lean statements, and AlphaProof, trained via reinforcement learning, generated complete formal proofs checked by Lean.

Across academia and industry, many other teams are building AI tools that suggest lemmas, fill in routine proof steps, or draft full proofs. The field shifts fast, so headlines are always worth checking against actual papers and code. One thing stays constant, though: Lean's kernel doesn't care whether a human or a neural network wrote a proof term—anyone can run Lean locally and verify it in seconds.

## Patterns across these projects

Three themes show up again and again. First, formalization is getting dramatically faster wherever Mathlib already has strong foundations, while staying genuinely hard in uncharted territory. Second, the headline successes have been team efforts powered by shared libraries and blueprints rather than solo marathons. Third, Lean has crossed from academic research into production software teams.

And one lesson never goes away: Lean checks the statement you wrote, not the idea in your head. In every project above, a huge share of the human effort went into agreeing that the formal definitions and theorem statements faithfully captured the real mathematics or system specification.

## Where to go after this game

By the time you finish this game, you'll have a solid grip on Lean's core—terms, types, tactics, logic, induction, sets, and functions. From here, the next step is real Lean with Mathlib, automation, and bigger theorems. The **Graduate** screen gathers everything you need: how to try real Lean in your browser, how to install it locally, which tactics this game held back, how to search Mathlib, and which books to read next. A rewarding first exercise is to pick a theorem you formalized in the Workshop, reprove it in real Lean using Mathlib lemmas, and then try formalizing a favorite result of your own. Whenever you're ready for company, lean-lang.org and the Lean Zulip are right there.`,
  },
];

export const getArticle = (id: string): GuideArticle | undefined => guide.find((a) => a.id === id);
