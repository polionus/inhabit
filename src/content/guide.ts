import type { GuideArticle, GuideSection } from './types.ts';

/** Display order and titles of the Guide's sections. */
export const guideSections: { id: GuideSection; title: string; blurb: string }[] = [
  { id: 'lean', title: 'Lean', blurb: 'What Lean is, what it can do, and how to read what it shows you.' },
  { id: 'theory', title: 'Theory', blurb: 'The type theory underneath: types, propositions, dependent types, induction, equality and the kernel.' },
  { id: 'practice', title: 'Practice', blurb: 'How to attack a proof, how to state a theorem, and how to write programs in Lean.' },
  { id: 'ecosystem', title: 'Ecosystem', blurb: 'Mathlib, the community, and what Lean is used for in the world.' },
];

/** The Guide: long-form reading about Lean. In reading order. */
export const guide: GuideArticle[] = [
  {
    id: 'what-is-lean',
    section: 'lean',
    title: 'What Lean is',
    summary: 'Lean is a programming language and a proof assistant at once; this article shows what it means for Lean to check a proof.',
    minutes: 5,
    worlds: ['types', 'props'],
    next: ['lean-tour', 'reading-theorems'],
    body: `Lean is two things that turn out to be one. It is a **programming language**, in which you write functions and run them. It is also a **proof assistant**, a program that checks mathematical proofs written in its language. Both halves use the same machinery: Lean's language is expressive enough that a statement of mathematics and a proof of it are ordinary things inside the language, just as a number and a function are.

Lean was started by Leonardo de Moura, first at Microsoft Research, and is open source. Lean 4, the current major version, is largely written in Lean itself. Today it is developed by the Lean Focused Research Organization together with a wide community of volunteers and researchers. You can try it without installing anything at live.lean-lang.org.

## What it means to check a proof

A proof on paper is a text that persuades a reader. A proof in Lean is a text that a program verifies. "Verifies" has a precise meaning: Lean starts from a small set of logical rules and confirms that your proof follows from them, step by step, with nothing assumed that you did not state. If one step does not follow, Lean rejects the proof and says where.

The consequence is a different relationship with the reader. A paper proof can say "clearly" or "by a similar argument", and a person will fill the gap. Lean cannot be persuaded. Either the gap is filled in or the proof is not accepted. That sounds severe, and it is, but Lean also does a great deal of the bookkeeping for you, and it tells you at every moment what is still left to prove.

## A first theorem, line by line

Here is a small theorem. It says that if both \`p\` and \`q\` hold, then \`q\` and \`p\` hold.

\`\`\`lean
theorem and_swap (p q : Prop) (h : p ∧ q) : q ∧ p := by
  obtain ⟨hp, hq⟩ := h
  exact ⟨hq, hp⟩
\`\`\`

The first line is the **statement**. The word \`theorem\` begins a declaration, and \`and_swap\` is its name. Then come the assumptions. \`(p q : Prop)\` says that \`p\` and \`q\` are propositions, which are statements that can be true or false. \`(h : p ∧ q)\` says that we have a proof, called \`h\`, that \`p\` and \`q\` both hold. After the colon comes what we want to prove: \`q ∧ p\`.

Everything after \`:= by\` is the **proof**. The word \`by\` tells Lean that the proof is a sequence of commands, called *tactics*, each of which changes what remains to be proved. The first tactic, \`obtain ⟨hp, hq⟩ := h\`, takes the combined fact \`h\` apart into its two pieces, naming them \`hp\` and \`hq\`. The second, \`exact ⟨hq, hp⟩\`, builds the goal \`q ∧ p\` out of those pieces in the opposite order, using the angle brackets that mean "package these two things together".

When the last tactic runs, nothing remains to prove and Lean accepts the theorem. If you delete the second line, Lean reports an error saying that goals are left unsolved, and shows you which.

## What happens inside

The tactics are a convenient way to write the proof, but they are not what Lean trusts. Behind the scenes the tactics assemble a *proof term*, an expression in Lean's core language, and a small program called the **kernel** checks that this term really has the type that the theorem states. The kernel is the only part of Lean that has to be right for a proof to be sound. The article on the kernel returns to this, and the article on tactics and terms shows both ways of writing the same proof.

## Lean as a programming language

The same language runs programs. This definition and evaluation need no proof at all:

\`\`\`lean-real
def double (n : Nat) : Nat := n + n

#eval double 21

theorem double_eq (n : Nat) : double n = 2 * n := by
  unfold double
  omega
\`\`\`

The command \`#eval\` runs the expression and prints \`42\`. Because programs and proofs live in one language, you can write a program and then prove a theorem about it, in the same file, about the very function you just defined. The theorem \`double_eq\` above is one: it says that \`double n\` equals \`2 * n\` for every \`n\`, and its proof unfolds the definition and lets the \`omega\` tactic finish the arithmetic.

This combination is the reason Lean is used both for mathematics and for verifying software. The later articles on programming and on Lean in the world return to both uses.

## What Lean does not do

Lean checks that a proof proves the statement you wrote. It cannot check that the statement is the one you meant. If you state a theorem that is weaker than you intended, or true for a boring reason, Lean will accept its proof just as readily. Learning to state things precisely is half of the craft, and the article on translating English into Lean is about exactly that.

Lean is also not a magic prover. It will find some proofs on its own, through automation, but for most interesting theorems a person writes the argument and Lean checks it. The game you are playing teaches that writing: how to read what Lean shows you, how to choose the next step, and why the steps are justified.`,
  },
  {
    id: 'lean-tour',
    section: 'lean',
    title: 'What Lean can do: a tour',
    summary: 'A survey of Lean\'s capabilities, each with a small example, an honest limit, and a note on whether this game teaches it.',
    minutes: 7,
    next: ['reading-theorems', 'lean-programming', 'mathlib-community'],
    body: `Lean is a large system, and the game covers one part of it. This article lists what Lean can do, with a small example of each and a plain statement of its limits. For each capability it also says whether the game teaches it or only points to it. Examples marked as real Lean use features the game's engine leaves out.

## Proving theorems interactively

This is the part the game teaches in full. You state a theorem, and then build its proof with tactics while Lean shows the remaining goals. It works for logic, number theory, algebra, analysis and much else. The limit is effort: writing a formal proof takes longer than writing a paper proof, because everything a reader would skip must be spelled out.

## Writing and running programs

Lean has \`def\` for functions, pattern matching, recursion, and \`#eval\` to run them.

\`\`\`lean-real
def fib : Nat → Nat
  | 0 => 0
  | 1 => 1
  | n + 2 => fib n + fib (n + 1)

#eval fib 20
\`\`\`

This prints \`6765\`. Lean compiles programs to native code, so they are not toys, though its ecosystem of ready-made software libraries is much smaller than that of mainstream languages. The game touches this with \`def\` and \`#eval\` only; the programming article says more.

## Defining your own types and structures

You can introduce new types of data. A \`structure\` bundles named fields; an \`inductive\` type lists the ways to build a value.

\`\`\`lean-real
structure Point where
  x : Nat
  y : Nat
deriving Repr

#eval ({ x := 1, y := 2 } : Point)
\`\`\`

Printing a value of the new type needs the \`deriving Repr\` line, which asks Lean to generate a way to display it.

The game uses \`inductive\` types as a concept, since \`Nat\`, \`And\` and \`Or\` are all defined this way, but it never asks you to declare your own.

## Type classes and notation

A **type class** is a way to say that a type supports an operation, so that one symbol can work on many types. The \`+\` you write between numbers is shared by natural numbers, integers and real numbers because each has an instance of the class for addition.

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

This prints \`12\`. Type classes are the largest piece of real Lean that the game leaves out, because it hard-wires \`+\` on natural numbers. They are what makes Mathlib's general algebra work, and the cost is that error messages sometimes mention instances you did not write.

## Automation

Lean can find some proofs itself. The core language includes \`simp\` (rewriting with a library of simplification facts), \`omega\` (linear arithmetic over integers and natural numbers), \`decide\` (checking decidable statements by computation) and, in recent versions, \`grind\` (a more general solver).

\`\`\`lean-real
theorem lt_succ (a b : Nat) (h : a < b) : a + 1 ≤ b := by omega

example : 2 ^ 10 = 1024 := by decide
\`\`\`

The Mathlib library adds \`ring\` (equalities in commutative rings), \`linarith\` (linear inequalities), \`norm_num\` (numeric calculation), and more. The separate Aesop package, which Mathlib builds on, provides \`aesop\`, a general proof search. Automation is powerful for routine goals and unhelpful when the idea of a proof is missing. The game withholds it on purpose, so that you learn what the automation is doing for you. The Graduate screen lists these tactics and when to reach for each.

## Metaprogramming

Lean's tactics are programs written in Lean, and you can write your own. The simplest way is a \`macro\`, which rewrites one piece of syntax into another.

\`\`\`lean-real
macro "my_triv" : tactic => \`(tactic| first | rfl | trivial)

example : 2 + 2 = 4 := by my_triv
\`\`\`

Larger tactics are written with the full programming interface to Lean's elaborator, in Lean. This is how Mathlib's tactics are made, and it is one reason the system can be extended without changing its trusted core. The game only mentions it, and notes that tactics are programs that build proof terms.

## The Mathlib library

Mathlib is a community-built library of formalized mathematics: algebra, topology, analysis, number theory, combinatorics, and more. It is the reason you can state a theorem about real numbers or groups and have the definitions ready. It is large, and it changes constantly, which means code that compiles today may need small repairs against a later version. The game's names for sets, functions and divisibility follow Mathlib's, so they carry over.

## Verified software

Because Lean is also a programming language, you can prove that a program does what it should. Amazon Web Services, for example, uses Lean to verify parts of Cedar, its policy language for access control. Verification demands more specification work than testing does, and proofs about programs can be long. The article on Lean in the world gives more detail. The game teaches the proof side, not the software side.

## What the game covers

The game teaches interactive proving in depth: terms and types, propositions as types, tactics, induction, sets, functions, and formalizing your own statement. It shows \`def\` and \`#eval\` briefly. It leaves out type classes, automation, metaprogramming and Mathlib itself, and the Graduate screen points to where each of those begins.`,
  },
  {
    id: 'reading-theorems',
    section: 'lean',
    title: 'Reading a Lean theorem',
    summary: 'How to take a theorem statement apart: binders, implicit arguments, the arrows and quantifiers, and the naming conventions of the library.',
    minutes: 5,
    worlds: ['props', 'quant'],
    next: ['goal-view', 'tactics-and-terms'],
    body: `Before you can prove a theorem you have to read it, and Lean statements follow a regular shape. Once you know the shape, an unfamiliar statement from the library becomes legible.

## The anatomy of a declaration

Every theorem has the form

\`\`\`text
theorem name (binders) : statement := proof
\`\`\`

The **name** is how you refer to the theorem later. The **binders** introduce the objects and assumptions the statement is about. The **statement** is what is claimed. The **proof** follows \`:=\`, either a term directly or \`by\` followed by tactics.

Here is a concrete one:

\`\`\`lean
theorem swap_args {α : Type} (p q : α → Prop) (h : ∀ x, p x ∧ q x) : ∀ x, q x ∧ p x := by
  intro x
  exact ⟨(h x).2, (h x).1⟩
\`\`\`

Read it left to right. For any type \`α\`, and any two properties \`p\` and \`q\` of elements of \`α\`: if every \`x\` has both properties, then every \`x\` has them in the other order. Here \`α\` is a type and \`p\` and \`q\` are predicates, meaning functions that send each element to a statement about it. The assumption \`h\` is a proof of "for all \`x\`, \`p x\` and \`q x\`".

## Binders: round and curly

There are two kinds of binder you will see constantly. A round binder \`(p q : α → Prop)\` is **explicit**: when you use the theorem you pass these arguments yourself. A curly binder \`{α : Type}\` is **implicit**: Lean works out the value from the other arguments. In \`swap_args\`, you never write \`α\`, because it can be read off from \`p\`.

If you need to see implicit arguments, an \`@\` in front of the name makes them all explicit, so \`@swap_args\` takes \`α\` as its first argument. You rarely need this, but it helps to know that implicit arguments are ordinary arguments that Lean fills in.

A square-bracket binder \`[ ... ]\` is a third kind, used for type classes. You will meet it in real Lean and Mathlib, but not in the game.

## Reading the symbols

Three pieces of notation carry most of the meaning.

The arrow \`→\` means "implies" when it sits between statements, and "function from … to …" when it sits between types. These are one and the same, which the article on propositions as types explains. The arrow is right-associative, so \`A → B → C\` means \`A → (B → C)\`. That reads as "given \`A\` and \`B\`, get \`C\`", and it is why a theorem with two assumptions can be written either with two binders or with one arrow after the colon.

The symbol \`∀\` means "for all". \`∀ x, p x\` says that \`p x\` holds whatever \`x\` is. Lean usually infers the type of \`x\`, and you can write it with \`∀ x : Nat, p x\`.

The symbol \`∃\` means "there exists". To prove \`∃ n : Nat, n + n = 4\` you supply a witness and a proof that it works:

\`\`\`lean
theorem two_plus_two : ∃ n : Nat, n + n = 4 := ⟨2, rfl⟩
\`\`\`

The pair \`⟨2, rfl⟩\` gives the witness \`2\`, and then \`rfl\` proves \`2 + 2 = 4\`, because both sides compute to the same number.

## Where assumptions go

A theorem's assumptions can sit before the colon, as binders, or after it, as arrows. These two statements say the same thing:

\`\`\`lean
theorem mp1 (p q : Prop) (hp : p) (hpq : p → q) : q := hpq hp

theorem mp2 (p q : Prop) : p → (p → q) → q := fun hp hpq => hpq hp
\`\`\`

Use binders when you want names for the assumptions inside the proof. Use arrows when the statement should be a single proposition, for instance inside another statement. The tactic \`intro\` moves an assumption from after the colon to before it.

## Naming conventions

Library names are not arbitrary. They are built from a namespace and a description of the statement. \`Nat.add_comm\` lives in the \`Nat\` namespace and says that addition is commutative. Common patterns include:

- \`_comm\`, \`_assoc\`, \`_refl\`, \`_symm\`, \`_trans\` for the algebraic properties;
- \`_left\` and \`_right\` for which side of an operation or connective is meant, as in \`And.left\`;
- \`_iff\` for a theorem stated as an equivalence;
- \`_of_\` before the hypotheses, so \`lt_of_le_of_ne\` reads "less than, given less-or-equal and not-equal";
- \`_eq\` and \`_ne\` for equalities and inequalities.

Once you know these, you can often guess a name correctly, and when you cannot, the search tools in Lean and Mathlib work with the same vocabulary.

## Checking what you are reading

You can ask Lean about any name with \`#check\`, which prints the statement, or \`#print\`, which prints the definition. In the game's Sandbox, \`#check Nat.add_comm\` shows you the statement without opening a file. Reading a statement carefully, with its binders in order, is the first step of every proof, and it is a skill worth practicing on library theorems as well as on your own.`,
  },
  {
    id: 'goal-view',
    section: 'lean',
    title: 'The goal view',
    summary: 'How to read the state Lean shows you, including multiple goals and case tags, and how to read an error message.',
    minutes: 5,
    worlds: ['props', 'logic'],
    next: ['tactics-and-terms', 'how-to-attack-a-proof'],
    body: `When you write a proof in Lean, the most important window is not the one holding your code. It is the **goal view**, which in the real editor is called the *infoview*. It shows exactly where you stand in the proof, at whatever line your cursor is on.

## Hypotheses and the goal

Here is a goal state:

\`\`\`text
p q : Prop
hp : p
hpq : p → q
⊢ q
\`\`\`

Everything above the symbol \`⊢\`, called the turnstile, is a **hypothesis**: something you may use. Each line has a name, a colon, and a type. \`p q : Prop\` says that \`p\` and \`q\` are propositions. \`hp : p\` says you have a proof of \`p\`, named \`hp\`. \`hpq : p → q\` says you have a proof that \`p\` implies \`q\`.

The line with \`⊢\` is the **goal**, what you are trying to prove. A proof is finished when you have produced something of the goal's type, and a tactic proof is finished when no goals remain. Reading this state, you can see the proof: \`hpq\` turns a proof of \`p\` into a proof of \`q\`, and you have a proof of \`p\`, so \`exact hpq hp\` closes the goal.

This is why reading the state is the main skill. Almost every step of a proof is a response to what the state looks like. A beginner often types tactics and hopes. An experienced user reads the state, says in words what is needed, and then picks the tactic that does it.

## How tactics change the state

Each tactic transforms the state, and you can watch it happen. If the goal is \`p → q\`, the tactic \`intro h\` moves the left side into the hypotheses:

\`\`\`text
before:   ⊢ p → q
after:    h : p
          ⊢ q
\`\`\`

If the goal is \`p ∧ q\`, the tactic \`constructor\` replaces it with two goals, one for each half. If a hypothesis is \`h : p ∧ q\`, then \`obtain ⟨hp, hq⟩ := h\` replaces it with two hypotheses. You can predict the new state before running the tactic, and the game's predict levels train exactly this.

## More than one goal

Sometimes the state has several goals. Lean lists them one after another and works on the first. Each can carry a **case tag**, a label saying where it came from:

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

These two goals came from \`constructor\` on \`p ∧ q\`; the tags \`left\` and \`right\` name the two halves. Notice that each goal has its own copy of the hypotheses. When you close the first goal, the second becomes the current one. Writing a dot \`·\` before a tactic block focuses on the first goal, which keeps proofs tidy and makes errors easier to locate.

## Reading an error message

Error messages in Lean have a consistent structure. A message says where, what went wrong, and often what Lean expected and what it found. Suppose you write this proof of \`p ∧ q\` but give only the first half:

\`\`\`text
theorem e1 (p q : Prop) (hp : p) : p ∧ q := by
  constructor
  exact hp
\`\`\`

Lean reports:

\`\`\`text
error: unsolved goals
case right
p q : Prop
hp : p
⊢ q
\`\`\`

The message says that a goal is still open, shows it, and the case tag \`right\` tells you that it is the second half of the conjunction. The fix is another line proving \`q\`, or, in this case, noticing that the theorem as stated needs a proof of \`q\` that is not available.

A mismatch error looks different. If you try \`exact h\` where \`h : a = b\` but the goal is \`b + 1 = a + 1\`, Lean reports:

\`\`\`text
error: Type mismatch
  h
has type
  a = b
but is expected to have type
  b + 1 = a + 1
\`\`\`

Read it as two statements to compare: what you gave, and what was needed. Most mismatches come down to the wrong direction of an equation, a missing step, or a goal that was not what you thought it was. The wording of messages varies a little between Lean versions, but the structure stays the same.

A third common error comes from \`rw\`, which rewrites using an equation. If the left side of the equation does not appear in the goal, Lean says that it did not find an occurrence of the pattern and quotes the pattern it was looking for. The cure is to compare that pattern with the goal, character by character.

## A habit worth building

Before you type a tactic, say in words what the goal needs and what you have. After you type it, look at the new state and check that it is what you predicted. When the state surprises you, that is the useful moment: you have learned something about how Lean sees the problem. And when you cannot see how to proceed, read the hypotheses again. The answer is very often already listed above the turnstile.`,
  },
  {
    id: 'tactics-and-terms',
    section: 'lean',
    title: 'Tactics and terms: two ways to write one proof',
    summary: 'The same theorem proved as a term and with tactics, and what a tactic actually does behind the scenes.',
    minutes: 5,
    worlds: ['props'],
    next: ['types-everywhere', 'propositions-as-types'],
    body: `Lean offers two styles for writing a proof, and they are not rivals. A **term** is an expression that directly has the type of the theorem. A **tactic proof** is a sequence of commands that builds such an expression step by step. Both end in the same thing, and understanding how they relate is one of the most clarifying ideas in Lean.

## One theorem, two proofs

Take the claim that \`p ∧ q\` implies \`q ∧ p\`. As a term:

\`\`\`lean
theorem and_swap_term (p q : Prop) : p ∧ q → q ∧ p :=
  fun h => ⟨h.2, h.1⟩
\`\`\`

This reads as a function. Given a proof \`h\` of \`p ∧ q\`, it returns a proof of \`q ∧ p\`, packaged from the second component \`h.2\` and the first component \`h.1\`. There is nothing to run; the expression after \`:=\` is the proof.

As a tactic proof:

\`\`\`lean
theorem and_swap_tac (p q : Prop) : p ∧ q → q ∧ p := by
  intro h
  obtain ⟨hp, hq⟩ := h
  constructor
  · exact hq
  · exact hp
\`\`\`

This reads as a conversation with the goal. Introduce the assumption. Take it apart. Split the goal in two. Close each half with the matching fact. Lean shows the goal after each step, which is the main practical advantage of tactics: you see where you are.

## What a tactic really does

A tactic is a small program, written in Lean, that works on the proof in progress. The proof in progress is a **metavariable**, a hole of known type that is waiting for a term. A tactic fills the hole, perhaps with a term that contains new holes, and those new holes become the new goals.

When you wrote \`intro h\`, the tactic filled the hole with \`fun h => ?_\`, a function whose body is a new hole of the right type. When you wrote \`constructor\` on a conjunction, it filled the hole with a pair whose two components were two new holes. When no holes remain, the whole thing is a finished term, and that term is what the kernel checks.

You can see the term. Real Lean can print the proof it constructed:

\`\`\`lean-real
theorem and_swap (p q : Prop) (h : p ∧ q) : q ∧ p := by
  obtain ⟨hp, hq⟩ := h
  exact ⟨hq, hp⟩

#print and_swap
\`\`\`

The output is the proof term:

\`\`\`text
theorem and_swap : ∀ (p q : Prop), p ∧ q → q ∧ p :=
fun p q h => And.casesOn h fun hp hq => ⟨hq, hp⟩
\`\`\`

The tactic \`obtain\` became \`And.casesOn\`, the way of using a conjunction by unpacking its parts, and \`exact\` supplied the pair. Several game levels have a reveal that shows you the term your tactics built.

## When each style fits

Terms are short and direct when the proof is one step of application: using a known theorem on known arguments, or building a function. Writing \`hpq hp\` to apply an implication is clearer than any tactic.

Tactics are better when the proof has structure that unfolds over time: many cases, rewriting, induction, or hypotheses that change as you go. The goal view only exists for tactics, and that visible state is worth a lot while you are learning.

Real proofs mix them freely. Inside a tactic block you can write \`exact\` followed by any term. Inside a term you can write \`by\` and start a tactic block for one part. The game trains both, because the term view explains what tactics mean, and the tactic view makes longer proofs manageable.

## Why it matters for trust

The fact that tactics only build terms has a consequence for trust. The tactics themselves can be complicated, and automation tactics such as \`simp\` and \`omega\` can be very complicated. But whatever they do, they must end by producing a term, and the kernel checks that term independently. A bug in a tactic can make it fail or produce a term the kernel rejects. It cannot make Lean accept a false theorem, so long as the kernel itself is correct. The article on the kernel develops this point.

It also gives a way to think about what a tactic proof says. It is not a series of commands to a machine in the sense of a program that does work. It is a recipe for constructing evidence, and the final evidence is an expression you could have written by hand. Seeing a tactic proof as a way of building a term connects the first half of the game, where you wrote terms, to the second, where you mostly write tactics.

## Reading advice

When you meet a proof in a library, look at its shape. A line starting with \`fun\` or an application is a term. A block after \`by\` is tactics. If you want to know what a tactic block produces, print the theorem. If you want to know what a term does, imagine the goal view at each step: what type does each sub-expression have, and what is it being used for? That habit makes both styles readable.`,
  },
  {
    id: 'types-everywhere',
    section: 'theory',
    title: 'Types, and why everything has one',
    summary: 'Terms and their types, function types, Type and Prop, and a short note on universes.',
    minutes: 5,
    worlds: ['types'],
    next: ['propositions-as-types', 'dependent-types'],
    body: `In Lean, every expression has a **type**, and you cannot write an expression without one. The number \`7\` has type \`Nat\`, the natural numbers. The expression \`"hello"\` has type \`String\`. The expression \`fun n => n + 1\` has type \`Nat → Nat\`, the type of functions from natural numbers to natural numbers. A thing that has a type is called a **term**, and the relationship is written with a colon: \`7 : Nat\`.

This is the whole foundation of Lean. Types play the role that sets play in school mathematics, with one difference that matters. In set theory, an element can belong to many sets at once, and membership is a statement you can prove or disprove. In type theory, a term has exactly one type, and the type is part of what the term is. Asking whether \`7 : Nat\` is not a statement to prove; it is something Lean works out when it reads the expression.

## Function types

If \`A\` and \`B\` are types, then \`A → B\` is the type of functions that take an \`A\` and return a \`B\`. You build a function with \`fun\`, and use one by writing it next to its argument:

\`\`\`lean
def double (n : Nat) : Nat := n + n

def twice (f : Nat → Nat) (x : Nat) : Nat := f (f x)

theorem twice_double (x : Nat) : twice double x = x + x + (x + x) := rfl
\`\`\`

The function \`double\` has type \`Nat → Nat\`. The function \`twice\` takes a function as its first argument and a number as its second, and applies the function two times. Its type is \`(Nat → Nat) → Nat → Nat\`. Functions are ordinary terms, and can be passed around like numbers.

The arrow associates to the right, so \`Nat → Nat → Nat\` means \`Nat → (Nat → Nat)\`: a function that takes one number and returns a function waiting for the second. This is called **currying**. It means that applying a function to only some of its arguments is meaningful: \`twice double\` is a function of type \`Nat → Nat\` that doubles twice.

The proof of \`twice_double\` is \`rfl\`, because both sides evaluate to the same number once the definitions are unfolded. The article on equality says more about when that works.

## A type is a term too

Types themselves have types. The type \`Nat\` is a term, and its type is \`Type\`. The type \`Type\` is also a term, of type \`Type 1\`, and so on upward. These levels are called **universes**, and the reason for them is to avoid a paradox: if \`Type\` had type \`Type\`, you could build the analogue of Russell's paradox, and Lean's logic would become inconsistent. Keeping a ladder of universes avoids this. In practice you meet the ladder rarely. Lean usually infers the level, and the first levels are all you need to know about for the game: \`Nat : Type\`, and \`Type : Type 1\`.

You can ask Lean about the type of anything with \`#check\`:

\`\`\`text
#check 7               -- 7 : Nat
#check Nat             -- Nat : Type
#check Nat → Nat       -- Nat → Nat : Type
#check fun n : Nat => n + 1   -- fun n => n + 1 : Nat → Nat
\`\`\`

Comments in Lean start with two dashes. The right-hand sides above are what Lean prints in reply.

## Prop: the type of statements

Besides \`Type\`, there is a second basic sort called \`Prop\`, the type of **propositions**: statements that can be true or false. Examples are \`2 + 2 = 4\`, \`∀ n : Nat, n + 0 = n\`, and \`p → q\` for any propositions \`p\` and \`q\`. These are terms of type \`Prop\`.

A proposition is itself a type, and a proof of it is a term of that type. This is the central idea of the next article, and the reason the game is called Inhabit: to prove a proposition is to produce something of that type, to *inhabit* it. For now, the thing to notice is that \`Prop\` is just another sort of type, with the rule that all proofs of the same proposition are treated as equal. Only whether a proposition is provable matters, not which proof was given.

## Why insist on types

Types give Lean three things. First, they catch nonsense early. \`7 + "hello"\` is rejected as soon as it is read, before anything is computed, because \`"hello"\` does not have type \`Nat\`. Second, they guide the machine. When you write \`x + y\` with \`x : Nat\`, Lean knows \`y\` must be a \`Nat\` too and can often fill in details you leave out, such as which numeric type a literal \`2\` belongs to. Third, they are the language in which statements are written, as the next articles show.

The convention in Lean is to read a type as an answer to the question "what kind of thing is this?", and to expect every definition to answer it. When you meet an error that says a term "has type X but is expected to have type Y", that is the checker doing its basic job, and the fix is to find out why the two differ.

## Universe levels in one paragraph

Real Lean lets you write definitions that work at every universe level, with notation like \`Sort u\` and \`Type u\`, where \`u\` is a variable standing for a level. The standard library does this everywhere, so that a theorem about lists applies to lists of numbers and to lists of types alike. The game keeps to the first levels and does not ask you to work with \`u\`. When you read library code and meet \`universe u\`, you can treat it as bookkeeping: the same definition, available at every level.`,
  },
  {
    id: 'propositions-as-types',
    section: 'theory',
    title: 'Propositions as types',
    summary: 'The Curry–Howard correspondence, told carefully: each logical connective matches a way of building types.',
    minutes: 6,
    worlds: ['props', 'logic'],
    next: ['dependent-types', 'inductive-types'],
    body: `The idea that gives Lean its character is that **a proposition is a type, and a proof of it is a term of that type**. This is called the Curry–Howard correspondence, after two logicians who noticed it in different forms, and it is not a metaphor. Lean really does treat a proof of \`p\` as a thing of type \`p\`.

## Starting with implication

Start with the simplest case. A function from \`A\` to \`B\` is a rule that turns any \`A\` into a \`B\`. A proof of "if \`p\` then \`q\`" is a rule that turns any proof of \`p\` into a proof of \`q\`. These are the same thing. So the type \`p → q\`, which is the function type, is also the statement "\`p\` implies \`q\`", and a function of that type is a proof of it.

\`\`\`lean
theorem mp (p q : Prop) (hp : p) (hpq : p → q) : q := hpq hp
\`\`\`

Here \`hpq\` is a function, \`hp\` is its argument, and \`hpq hp\` is the function applied. Modus ponens, the rule that from \`p\` and \`p → q\` you may conclude \`q\`, is function application. No special rule of logic was needed.

## The dictionary

Each logical connective corresponds to a way of building types, and each has two sides: how to *prove* it, and how to *use* it.

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

The last two rows involve types that depend on values; the next article explains them. Two lines of the table deserve a comment. \`False\` is a type with no terms, so you can never prove it, and the rule that from \`False\` anything follows is simply that a function out of an empty type is easy to write: it has nothing to handle. And \`¬p\` is not a new idea: it is defined as \`p → False\`, meaning that a proof that \`p\` is false is a way to turn any proof of \`p\` into a proof of absurdity.

## Three small proofs

Each row can be seen in a proof. A conjunction is a pair:

\`\`\`lean
theorem and_comm' (p q : Prop) : p ∧ q → q ∧ p :=
  fun h => ⟨h.2, h.1⟩
\`\`\`

A disjunction is a value tagged with which side it came from, and using it means handling both cases:

\`\`\`lean
theorem or_comm' (p q : Prop) : p ∨ q → q ∨ p :=
  fun h => h.elim (fun hp => Or.inr hp) (fun hq => Or.inl hq)
\`\`\`

Negation chains: if \`p\` implies \`q\` and \`q\` is impossible, then \`p\` is impossible.

\`\`\`lean
theorem not_of_imp (p q : Prop) (hpq : p → q) (hnq : ¬q) : ¬p :=
  fun hp => hnq (hpq hp)
\`\`\`

In the last one, \`¬p\` unfolds to \`p → False\`, so the proof is a function that takes \`hp : p\`, passes it to \`hpq\` to get a proof of \`q\`, and gives that to \`hnq\` to reach \`False\`.

## What is gained

The correspondence makes proof-checking and type-checking the same job. To check a proof, Lean checks that a term has the type of the statement. It needs no separate engine for logic; the type checker already there for programs does everything. It also explains why the tactics for logic look the way they do. \`intro\` builds a function, \`constructor\` builds a pair, \`apply\` uses a function whose result type matches your goal.

It also explains why proofs can be given names and reused. A proof is a term, so a theorem is a definition whose type happens to be a proposition, and using a theorem is just applying a function.

## Care with the claim

The correspondence has one wrinkle, and it is worth stating plainly. Lean's logic has a special sort, \`Prop\`, with the rule that any two proofs of the same proposition are considered equal. This is called **proof irrelevance**. For a pair of numbers, \`(1, 2)\` and \`(2, 1)\` are different, and a program cares which one it gets. For a proof of \`p ∧ q\`, only the fact that it exists matters. This is why Lean separates \`Prop\` from \`Type\`: statements are for proving, and data is for computing, even though both are terms with types.

Another point of care concerns classical logic. In the pure correspondence, a proof of \`p ∨ q\` must say which side holds. The law of excluded middle, \`p ∨ ¬p\` for any \`p\`, cannot be proved that way, since it would require deciding every statement. Lean adds it as an axiom in its standard library, and the article on the kernel explains what that means for what you may trust.`,
  },
  {
    id: 'dependent-types',
    section: 'theory',
    title: 'Dependent types',
    summary: 'Types that mention values, how this makes "for all" and "there exists" ordinary constructions, and why that lets Lean state real mathematics.',
    minutes: 6,
    worlds: ['types', 'quant'],
    next: ['inductive-types', 'equality'],
    body: `So far a type like \`Nat → Nat\` has been a fixed thing. **Dependent types** are types whose description mentions a value. That one extension is what lets Lean express quantifiers and, with them, almost all of mathematics.

## A function whose result type depends on its input

Consider a function that takes a type and returns something of that type. An example is the identity function: for any type \`α\`, a function \`α → α\`. The type of the whole thing has to mention \`α\` twice, once to say what \`α\` is, and again in what follows:

\`\`\`lean
def myId (α : Type) (a : α) : α := a
\`\`\`

The type of \`myId\` is \`(α : Type) → α → α\`. Here the type of the *second* argument, \`a : α\`, depends on the value of the *first* argument. This is a **dependent function type**, sometimes called a Π-type. Writing \`(x : A) → B x\` means: a function that takes \`x\` of type \`A\` and returns something of type \`B x\`, where the result type is allowed to change with \`x\`. When \`B\` does not mention \`x\`, this is the ordinary function type \`A → B\`. So ordinary functions are a special case.

## "For all" is a dependent function

Now take a statement such as \`∀ n : Nat, n + 0 = n\`. Read it as a type. For each natural number \`n\`, there is a proposition \`n + 0 = n\`. A proof of the whole statement is a function that, given \`n\`, produces a proof of that proposition for that \`n\`. The result type depends on the input: for \`n = 3\` it is \`3 + 0 = 3\`, and for \`n = 8\` it is \`8 + 0 = 8\`.

\`\`\`lean
theorem add_zero_all : ∀ n : Nat, n + 0 = n := fun n => rfl
\`\`\`

That is exactly a dependent function type, with \`Prop\` as the sort of its results. So \`∀\` is not new machinery; it is the dependent arrow, written with a different symbol when the result is a proposition. And \`→\` between propositions is the case where the proposition on the right does not use the proof on the left. This is why the tactic \`intro\` works for both: it introduces the argument of a function, whether the argument is a number \`n\` or a proof \`h : p\`.

## "There exists" is a dependent pair

The second construction is a **dependent pair**: a pair whose second component's type depends on the first component's value. A proof of \`∃ n : Nat, n * n = 49\` is a pair: a witness \`n\`, and a proof that \`n * n = 49\` for that particular \`n\`.

\`\`\`lean
theorem square_forty_nine : ∃ n : Nat, n * n = 49 := ⟨7, rfl⟩
\`\`\`

Compare with \`∧\`. A proof of \`p ∧ q\` is a pair where the second component's type, \`q\`, does not depend on the first. For \`∃\`, the second type is \`p w\` where \`w\` is the first component. The same angle brackets build both, and the tactic \`use 7\` supplies the first component and leaves you the second.

Using an existence proof means taking the pair apart: \`obtain ⟨w, hw⟩ := h\` gives you a name \`w\` for the witness and \`hw\` for the fact that it works. You are not told what \`w\` is, only that it exists, so you can only use the properties \`hw\` provides. This is how the mathematician's "let \`w\` be such a number" is written.

## Quantifier order is a type difference

Because the types are explicit, the difference between \`∀ n, ∃ m, ...\` and \`∃ m, ∀ n, ...\` is visible as a difference between two types. In the first, a function gives a witness \`m\` for each \`n\`, and \`m\` may depend on \`n\`. In the second, a single \`m\` works for all \`n\`. Lean treats the two as different types and demands the proof you actually wrote. The article on translating English describes how this bears on formalizing.

## Why this reaches real mathematics

With dependent types, you can state things such as "for every natural number there is a larger prime", "for every function from a set to its subsets, some subset is missed", or "for every \`ε\` there is a \`δ\`". The language needs no extra constructs for these: predicates are functions into \`Prop\`, and quantifiers are dependent functions and pairs over them. The game's final theorem, Cantor's, uses exactly this: statements about all functions and all subsets.

Dependent types also let programs express invariants. A classic example is a list that carries its length in its type:

\`\`\`lean-real
inductive Vec (α : Type) : Nat → Type where
  | nil : Vec α 0
  | cons {n : Nat} : α → Vec α n → Vec α (n + 1)

def Vec.head {α : Type} {n : Nat} : Vec α (n + 1) → α
  | .cons a _ => a

#eval (Vec.cons 5 Vec.nil).head
\`\`\`

The type \`Vec α n\` is the type of lists of length \`n\`. The function \`head\` takes a \`Vec α (n + 1)\`, a list that is certainly nonempty, so there is no empty case to handle and no error to raise. The type has ruled it out. The program prints \`5\`.

## What it costs

Dependent types make type checking harder, because the checker must sometimes decide whether two values that appear in types are equal, which means evaluating them. That is part of why Lean has two kinds of equality, the subject of a later article. It also means that error messages can mention types with large expressions in them. The reward is a language in which a statement, a program and a proof can all be written without leaving it.`,
  },
  {
    id: 'inductive-types',
    section: 'theory',
    title: 'Inductive types',
    summary: 'How Nat, And, Or and False are all defined by constructors, and why recursion and induction are one principle.',
    minutes: 6,
    worlds: ['logic', 'nat'],
    next: ['equality', 'kernel-and-trust'],
    body: `Nearly everything in Lean that is not a function type or a sort is an **inductive type**. An inductive type is defined by listing its **constructors**, the only ways to build a value of that type. The type has no other values, and that closed-world rule is what makes it possible to reason about it.

## The natural numbers

The natural numbers are defined with two constructors. In Lean's library, the definition reads roughly like this:

\`\`\`text
inductive Nat where
  | zero : Nat
  | succ (n : Nat) : Nat
\`\`\`

There is a number \`zero\`, and for any number \`n\` there is a number \`succ n\`, its successor. Every natural number is built by applying \`succ\` some number of times to \`zero\`. The numeral \`3\` is shorthand for \`succ (succ (succ zero))\`. Nothing else is a natural number, which is the sense in which the definition is closed.

You can write the same kind of definition for your own type. Here is a copy of the natural numbers, with addition defined by recursion on the second argument and a function back to Lean's own numbers to check it:

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

This prints \`3\`. The function \`add\` is defined by cases on the constructors of its second argument: one equation for each.

## Logic is inductive too

The connectives of logic are inductive types, with constructors that say how to prove them.

\`\`\`text
structure And (a b : Prop) : Prop where
  intro :: (left : a) (right : b)

inductive Or (a b : Prop) : Prop where
  | inl (h : a) : Or a b
  | inr (h : b) : Or a b

inductive False : Prop
\`\`\`

\`And\` has one constructor taking two proofs, so a proof of \`p ∧ q\` is exactly a pair. \`Or\` has two constructors, one for each side, so a proof of \`p ∨ q\` is a proof of one side with a label. \`False\` has no constructors at all, so there is nothing to build, which is why it is unprovable. The existential \`∃\` has one constructor taking a witness and a proof, so it is a dependent pair. Equality, too, is inductive, with one constructor \`rfl\` saying that anything equals itself.

## Constructors say how to build; recursors say how to use

An inductive type comes with a second piece, its **recursor**, which says how to use a value of the type. For \`Or\`, using a proof means giving a case for each constructor: what to do if it came from the left, and what to do if it came from the right. That is the rule \`Or.elim\`, and it is what the tactic \`cases\` does. For \`And\`, using a proof means giving a function of both components, which is what \`obtain ⟨a, b⟩\` does. For \`False\`, with no constructors, there are no cases to give, so from it anything follows.

The pattern is uniform: to prove a statement about all values of an inductive type, it is enough to prove it for each constructor. That is the induction principle, and Lean derives it from the definition.

## Recursion and induction are the same thing

For \`Nat\`, the recursor is called \`Nat.rec\`. In one form it builds data: given a value for \`zero\` and a way to get the value for \`succ n\` from the value for \`n\`, it produces a value for every \`n\`. In another form it proves statements: given a proof for \`zero\` and a way to get a proof for \`succ n\` from the proof for \`n\`, it proves the statement for every \`n\`. These are the same rule with different result types, one in \`Type\` and one in \`Prop\`. A recursive definition and a proof by induction are the same construction, which is why they look alike.

Here is induction at work, in the shape the game teaches:

\`\`\`lean
theorem zero_add_again (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, ih]
\`\`\`

The base case is \`0 + 0 = 0\`, which holds by computation. The step case assumes \`ih : 0 + k = k\` and must prove \`0 + (k + 1) = k + 1\`; rewriting with the defining equation of addition and then with \`ih\` finishes it. The tactic \`induction\` applied the recursor, which produced exactly those two goals.

## Why "inductive" and why it is safe

Lean checks that an inductive definition is legitimate: that the type being defined appears in its constructors only in allowed places, so that values are built from smaller values and never circularly. This check, called positivity, is what ensures that recursion terminates and that no paradox sneaks in. It is part of what the kernel enforces.

## What you can do with this

Once you read a type as "its constructors", many tactics become predictable. \`constructor\` applies a constructor to the goal. \`cases\` and \`rcases\` split a hypothesis along the constructors of its type. \`induction\` does the same for a type whose constructors contain the type itself. \`injection\` and \`contradiction\` use the fact that different constructors give different values: \`succ n = zero\` is impossible, because no value is built both ways. When a proof puzzles you, asking "what are the constructors?" usually shows the next step.`,
  },
  {
    id: 'equality',
    section: 'theory',
    title: 'Two kinds of equality',
    summary: 'Definitional equality, which Lean computes, and propositional equality, which you prove; why n + 0 = n is free and 0 + n = n is not.',
    minutes: 5,
    worlds: ['eq', 'nat'],
    next: ['kernel-and-trust', 'how-to-attack-a-proof'],
    body: `Lean distinguishes two meanings of "the same", and the difference explains many things that puzzle beginners.

## Definitional equality: same by computation

Two terms are **definitionally equal** when Lean can reduce them to the same thing by unfolding definitions and computing. \`2 + 2\` and \`4\` are definitionally equal: addition on natural numbers is a function, and evaluating it on \`2\` and \`2\` gives \`4\`. Lean's checker decides this by itself, with no input from you, and it treats definitionally equal terms as interchangeable everywhere. It does not need a proof, because there is nothing to prove: they are one term written two ways.

The proof term \`rfl\`, short for reflexivity, shows two sides are the same by this route:

\`\`\`lean
theorem two_plus_two : 2 + 2 = 4 := rfl
\`\`\`

The claim \`2 + 2 = 4\` is accepted because, to check that \`rfl : 4 = 4\` has type \`2 + 2 = 4\`, Lean notes that \`2 + 2\` reduces to \`4\`.

## Propositional equality: a statement to prove

The statement \`a = b\` is a proposition, an inductive type like any other, whose only constructor is \`rfl : a = a\`. When you write a theorem like \`a + b = b + a\`, you ask for a *proof* of this proposition. It is not true by computation, because \`a\` and \`b\` are variables and the computation cannot proceed. Lean needs a proof, and the proof is built from lemmas, from \`rw\`, from induction.

A theorem that is only propositionally true cannot be settled by \`rfl\`. If you try, Lean reports that it cannot see the two sides as the same. The tool that connects the two kinds is the *rewriting* tactic \`rw\`: given a proof \`h : a = b\`, it replaces \`a\` by \`b\` in the goal, using the substitution property of equality. A proof by \`rw\` is a chain of propositional steps, with definitional equality quietly closing whatever remains.

\`\`\`lean
theorem rewrite_example (a b : Nat) (h : a = b) : a + 1 = b + 1 := by
  rw [h]
\`\`\`

After the rewrite the goal reads \`b + 1 = b + 1\`, and \`rw\` closes it by \`rfl\`.

## Why \`n + 0 = n\` is free

Addition of natural numbers is defined by recursion on the second argument:

\`\`\`text
n + 0      = n
n + succ m = succ (n + m)
\`\`\`

The first equation is a definition, so \`n + 0\` reduces to \`n\` however little we know about \`n\`. The statement \`n + 0 = n\` is therefore a definitional equality, and \`rfl\` proves it for every \`n\`:

\`\`\`lean
theorem add_zero_free (n : Nat) : n + 0 = n := rfl
\`\`\`

## Why \`0 + n = n\` is not

Now try the mirror image. The definition recurses on the second argument, and here that argument is the variable \`n\`. The computation is stuck: Lean cannot unfold \`0 + n\` without knowing whether \`n\` is \`zero\` or \`succ\` of something. So \`0 + n\` does not reduce to \`n\`, and \`rfl\` fails.

The statement is nevertheless true, and a proof exists, but it needs induction, because the proof must handle each constructor of \`n\` separately. The two cases are \`0 + 0 = 0\`, which computes, and \`0 + (k + 1) = k + 1\` assuming \`0 + k = k\`. Induction is the right tool because the equation is propositional.

Two statements that look equally obvious to a person, \`n + 0 = n\` and \`0 + n = n\`, differ in kind for Lean. The difference depends on how addition was defined. Had we defined it by recursion on the first argument, the roles would swap. This is one of the first places where you see that Lean cares about how things are built, not only about what they mean.

## Other tools for equality

A few more tools use the same idea. The lemma \`congrArg\` says that if \`a = b\` then \`f a = f b\`, for any function \`f\`. The tactic \`symm\` turns \`a = b\` into \`b = a\`, and \`calc\` chains several steps, \`a = b\`, \`b = c\`, \`c = d\`, to conclude \`a = d\`. These are all propositional manipulations, and each produces a proof term you could write by hand.

## Why the distinction is worth having

It would be simpler to have one kind of equality, but a simple design has a cost. If every equation needed an explicit proof, then checking that \`2 + 2 = 4\` would require a proof, and a type like \`Vec α (2 + 2)\` could not be recognized as \`Vec α 4\` without rewriting. Letting the checker compute definitional equalities keeps types and proofs readable. If every equation were decided by computation, checking would sometimes never end, since some equations cannot be settled by running a program. Lean splits the work: what computation settles, the checker settles, and everything else is a theorem.

You will notice the split most in error messages. When \`rw\` complains that it did not find a pattern, or \`rfl\` complains that two sides are not the same, ask whether the equation is definitional or propositional. That question usually names the missing step.`,
  },
  {
    id: 'kernel-and-trust',
    section: 'theory',
    title: 'The kernel: why you can trust a proof',
    summary: 'What Lean\'s small trusted core checks, what tactics and automation are allowed to get wrong, which axioms exist, and what no proof checker can promise.',
    minutes: 6,
    worlds: ['props', 'logic'],
    next: ['how-to-attack-a-proof', 'lean-in-the-world'],
    body: `When Lean accepts a theorem, what exactly has been checked, and by what? The answer has a layered structure, and knowing it tells you how much to trust a Lean proof and where the remaining risk lies.

## A small core and a large periphery

Lean has a **kernel**, a small program whose only job is to check that a term has the type it claims. It implements the core rules of the type theory: how types are formed, how terms are typed, when two terms are definitionally equal, and what counts as a valid inductive definition. Everything else in Lean is built on top: the parser, the elaborator that fills in implicit arguments, the tactic framework, the automation, the editor support. None of those parts is trusted. They produce terms, and the kernel checks each term from scratch.

This design is sometimes called the *de Bruijn criterion*: the proof checker should be small enough that people can read and review it, while everything clever lives outside it and produces certificates for it to check. In Lean, the certificate is a proof term. A proof of a big theorem can be an enormous term, and the kernel's check of it is a mechanical process: no search, no guessing.

## What tactics and automation may get wrong

A tactic can be wrong in several ways, and none of them lets a false statement in.

A tactic can fail, and you get an error. It can succeed but produce a very long term. It can be slow. Or it can have a bug that makes it produce an ill-typed term, in which case the kernel rejects the term and the theorem is not accepted. What a tactic cannot do, however buggy, is make the kernel accept a term of the wrong type. Automation such as \`simp\`, \`omega\` and \`grind\` is the same: it is a program that tries to build a proof term, and the kernel checks what it builds.

This is also why you can use a library without reading its proofs. A theorem in Mathlib was checked by the same kernel when the library was compiled, and its statement is exactly what \`#check\` shows. You rely on the statement, not on the person who proved it.

## Axioms

The kernel's rules include some statements that are assumed rather than proved, called **axioms**. Lean's standard library uses three beyond the basic rules, and you can ask which ones any theorem depends on:

\`\`\`lean-real
theorem em_demo (p : Prop) : p ∨ ¬p := Classical.em p

#print axioms em_demo
\`\`\`

Lean replies:

\`\`\`text
'em_demo' depends on axioms: [propext, Classical.choice, Quot.sound]
\`\`\`

These three are:

- **\`propext\`**, propositional extensionality: if two propositions imply each other, they are equal.
- **\`Quot.sound\`**, which comes with the quotient construction and is the basis of function extensionality (\`funext\`): two functions that agree at every input are equal.
- **\`Classical.choice\`**, the axiom of choice, from which the law of excluded middle follows.

A proof that avoids all three is called **constructive**: it works without assuming that every statement is decided. For example, a proof of \`p ∨ q\` in that style tells you which side holds. Proofs that use the law of excluded middle are **classical**, and give up that information. Most of Mathlib is classical, and that is the standard setting for working mathematicians. The game's logic world shows the difference: \`by_cases\` and \`by_contra\` typically rely on the classical axioms, while \`constructor\`, \`intro\` and \`cases\` do not. The \`#print axioms\` command is how you check which kind a given proof is.

A theorem that uses \`sorry\`, the placeholder for an unfinished proof, shows an extra axiom, \`sorryAx\`, which flags that it is incomplete:

\`\`\`text
'bad' depends on axioms: [sorryAx]
\`\`\`

The tactic \`native_decide\`, which evaluates a statement using compiled code rather than the kernel, adds a further axiom \`Lean.ofReduceBool\`, and so expands what you trust to include the compiler. If you want the most conservative check, look at the axioms list.

## What the kernel does not guarantee

Three limits are worth stating plainly.

**The statement may not say what you meant.** Lean checks that you proved the theorem you wrote. If the formal statement is weaker than the claim you had in mind, or accidentally trivial, the proof is still valid and still not what you wanted. This is the main practical risk in formalization, and reviewing statements and definitions matters more than reviewing proofs. The article on translating English into Lean discusses the common traps.

**The kernel could have a bug.** It is small and open to review, and independent re-implementations of the checker exist, which reduces the chance, but it is software. Soundness of the type theory itself is a mathematical result that is established on paper, relative to assumptions about stronger systems, and not something Lean proves of itself. Gödel's second incompleteness theorem rules out a system proving its own consistency in full generality.

**Declarations outside the core trust.** If you declare your own \`axiom\`, Lean will use it without proof. A tactic that adds axioms, like \`sorry\` or \`native_decide\`, shows up in \`#print axioms\`, which is why that command is the way to check what a result depends on.

## The right amount of trust

None of this is a reason to distrust Lean. A Lean-checked proof has been verified to a standard that no refereeing process on paper can match, and the places where it could fail are few and well known. The sensible habit is to know them: read the statement, check the axioms, and treat a proof as evidence about the statement you actually wrote.`,
  },
  {
    id: 'how-to-attack-a-proof',
    section: 'practice',
    title: 'How to attack a proof',
    summary: 'A working method for starting and continuing a proof, with a table from the shape of the goal or hypothesis to the tactic to try.',
    minutes: 6,
    worlds: ['props', 'logic', 'quant', 'forge'],
    next: ['english-to-lean', 'lean-programming'],
    body: `Faced with a blank proof, beginners often ask what the trick is. For most of the proofs in this game there is no trick, only a method. The method is to let the shape of the goal and the shapes of your hypotheses tell you what to do.

## The method in five moves

**Read the goal.** Say in words what you must show. Is it an implication, a conjunction, a "for all", an equation? The outermost symbol of the goal tells you what to do first.

**Introduce.** If the goal is \`p → q\`, then \`intro hp\` assumes \`p\` and leaves \`q\`. If it is \`∀ x, p x\`, then \`intro x\` picks an arbitrary \`x\`. Introduce everything you can before thinking further; it costs nothing and gives you material.

**Split.** If the goal is a conjunction, \`constructor\` gives two goals. If it is an equivalence, \`constructor\` gives the two directions. If it is a disjunction, choose a side with \`left\` or \`right\`, but only when you know which side is true. If it is an existence claim, supply a witness with \`use\`.

**Use what you have.** Look at each hypothesis. A conjunction can be taken apart with \`obtain\`. A disjunction can be split with \`cases\`. An implication or a "for all" can be applied or specialized to a particular value. An equation can rewrite the goal with \`rw\`.

**Work backwards or forwards.** Working backwards means \`apply\`: if you have \`h : p → q\` and the goal is \`q\`, then \`apply h\` changes the goal to \`p\`. Working forwards means \`have\`: derive a new fact \`have hq : q := h hp\` and add it to the hypotheses. Use whichever direction makes the gap smaller. When you are stuck, write down the statement of the gap as a \`have\` with \`sorry\`, and then prove it as its own goal.

## A table to keep nearby

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

The table covers the game's tactics, and the same habits transfer to real Lean. It is a list of reflexes, not a decision procedure: when two rows apply, either order usually works, and one of them is shorter.

## A worked example

Let us prove that the composition of two injective functions is injective. A function is **injective** when different inputs give different outputs, or equivalently when equal outputs force equal inputs.

\`\`\`lean
theorem compose_inj {α β γ : Type} (f : α → β) (g : β → γ)
    (hf : Function.Injective f) (hg : Function.Injective g) :
    Function.Injective (g ∘ f) := by
  intro a b h
  apply hf
  apply hg
  exact h
\`\`\`

The goal is \`Function.Injective (g ∘ f)\`, which unfolds to a "for all" over \`a\` and \`b\` followed by an implication. So the first move is to introduce: \`intro a b h\` names two inputs and the hypothesis \`h\` that they have equal outputs. The goal is now \`a = b\`.

We have \`hf : Function.Injective f\`, which says that \`f a = f b\` implies \`a = b\`. The goal is the conclusion of that implication, so working backwards, \`apply hf\` turns the goal into \`f a = f b\`. The same reasoning with \`hg\` turns it into \`g (f a) = g (f b)\`. That is exactly \`h\`, since \`(g ∘ f) a\` is by definition \`g (f a)\`, and \`exact h\` finishes.

Notice how little cleverness was needed. Each step was dictated by a symbol in the goal or a shape in a hypothesis.

## When you are stuck

If no row of the table applies, try one of these.

- **Write out the definitions.** Use \`unfold\` or \`show\` to replace a defined notion with its meaning. Many proofs become routine once \`A ⊆ B\` is seen as "for all \`x\`, if \`x ∈ A\` then \`x ∈ B\`".
- **Look for a lemma.** The Inventory and the Codex list what is available. A step that feels like a known fact usually is one.
- **Change direction.** If working backwards stalls, state a forward fact with \`have\`; if forwards stalls, apply something to the goal.
- **Shrink the problem.** Prove a special case, or the statement for \`0\`, to see what the general proof needs.
- **Use \`sorry\` as a placeholder.** Leave the hard step as \`sorry\`, check that the rest of the proof fits around it, and come back. This is how experienced users work.

## Reading before writing

The most reliable improvement for most learners is to slow down at the first step and read the goal view aloud. The method above is nothing more than a way of making that reading productive: every row of the table is an answer to "what is this symbol, and what does Lean give me for it?"`,
  },
  {
    id: 'english-to-lean',
    section: 'practice',
    title: 'From English to Lean',
    summary: 'How to turn a mathematical sentence into a Lean statement, and the traps that make a statement say something else.',
    minutes: 6,
    worlds: ['quant', 'forge'],
    next: ['lean-programming', 'mathlib-community'],
    body: `Writing a proof is only half of formalization. The other half is writing the statement, and here Lean cannot help you, because it will accept a proof of whatever you wrote. This article describes a way of translating English into Lean, and the mistakes that most often make the translation wrong.

## The method

The Workshop in this game follows five steps, and the first four are about the statement.

1. **Say it.** Write the claim in careful English, and mark every "for all", "there exists" and "if … then".
2. **Type it.** Decide what kind of thing each object is: a natural number, a set of numbers, a function between two types.
3. **Define it.** If the claim uses a notion that Lean does not have, write a definition.
4. **State it.** Put the objects in as binders, the conditions as hypotheses, and the conclusion after the colon.
5. **Prove it.**

Take the sentence "the sum of two even numbers is even". Marking quantifiers: "for all numbers \`m\` and \`n\`, if \`m\` is even and \`n\` is even, then \`m + n\` is even". Typing: \`m\` and \`n\` are natural numbers. Definitions: \`Even\` is available. Statement:

\`\`\`text
theorem even_add' (m n : Nat) (hm : Even m) (hn : Even n) : Even (m + n) := by
  sorry
\`\`\`

Read the statement back in English and it is the sentence we began with: two natural numbers, both even, and the sum is even. The proof is a separate job, and Lean will keep the \`sorry\` flagged until it is filled. The habit that protects you is reading the statement back. After you write it, translate it into English word for word and compare with the original.

## Trap one: quantifier order

The statements \`∀ n, ∃ m, n < m\` and \`∃ m, ∀ n, n < m\` differ only in the order of two quantifiers, and mean very different things. The first says that every number has something larger. The second says that one number is larger than every number, which is false. In the first, \`m\` may depend on \`n\`. In the second it may not.

\`\`\`lean
theorem forall_exists_succ : ∀ n : Nat, ∃ m : Nat, m = n + 1 :=
  fun n => ⟨n + 1, rfl⟩
\`\`\`

English hides this difference because the word order is flexible: "every student has a favorite book" and "there is a book that every student favors" overlap in ordinary speech. Always decide the dependency first, and write the quantifiers in that order.

## Trap two: implication under an existential

Consider "there is a number \`n\` such that, if \`n\` is \`1\`, then \`n\` is \`2\`". As Lean, \`∃ n : Nat, n = 1 → n = 2\`. This is true, and trivially: take \`n = 0\`, then the hypothesis \`0 = 1\` is false and the implication holds without any content.

\`\`\`lean
theorem vacuous_exists : ∃ n : Nat, n = 1 → n = 2 :=
  ⟨0, by intro h; contradiction⟩
\`\`\`

What most people mean when they write something like this is a conjunction, "there is a number \`n\` such that \`n\` is \`1\` and \`n\` is \`2\`", written \`∃ n, n = 1 ∧ n = 2\`, which is false. The rule of thumb: under \`∃\`, a claim about the witness is nearly always a conjunction; under \`∀\`, a condition on the variable is nearly always an implication. Swapping them gives statements that are either trivially true or false for a boring reason.

## Trap three: forgotten hypotheses

A statement can be false because a condition from the English was dropped. "For all natural numbers \`a\` and \`b\`, \`a - b + b = a\`" is false in Lean, because subtraction on natural numbers stops at zero: \`2 - 5\` is \`0\`, and \`0 + 5\` is \`5\`, not \`2\`. The English sentence silently assumed \`b ≤ a\`, and a faithful translation needs it as a hypothesis. When a proof refuses to work, a missing hypothesis is the first suspect, and a counterexample for small numbers is the quickest test.

The opposite mistake is including a hypothesis that makes the statement vacuous. If your assumptions contradict each other, anything follows, and the proof proves nothing. A way to guard against this is to check that the hypotheses are satisfiable, by exhibiting an example that meets them.

## Trap four: the wrong definition

If a notion is not in Lean's library, you write it yourself, and the definition has to capture the intended meaning. "\`n\` is prime" means that \`n\` is greater than \`1\` and its only divisors are \`1\` and \`n\`. Leave out \`n > 1\` and \`1\` counts as prime. Define "even" as \`n % 2 = 0\` and you have a good definition; define it as \`∃ r, n = r + r\` and you have another that is equivalent, and sometimes more convenient for proofs. A definition is correct when you can explain, in English, why each part is there.

Test a definition on easy examples before building on it: show that \`4\` satisfies it, that \`3\` does not, and that the edge cases behave. These small checks catch most errors.

## Why this matters

Formal proofs are only as good as their statements. In a large project the statements and definitions are what people review most carefully, because they are short, and because an error there is invisible to the checker. The reviewers ask: does this say what the paper says? Learning to answer that question about your own formalization is the skill that the Workshop is built to practice.

A useful exercise is to take a theorem you have proved in the game and write it in English without looking at the Lean, then compare. Differences are either places where your English was vague or places where the Lean said something more precise than you meant. Both teach you something.`,
  },
  {
    id: 'lean-programming',
    section: 'practice',
    title: 'Lean as a programming language',
    summary: 'Functions, recursion, structures, #eval and IO in Lean, and what it means that Lean is implemented in Lean and compiles to native code.',
    minutes: 6,
    worlds: ['types', 'nat'],
    next: ['mathlib-community', 'lean-in-the-world'],
    body: `Lean is a general-purpose functional programming language. You do not need to use it as one to prove theorems, but the language you write programs in and the language you prove in are the same, and seeing the programming side clarifies the proving side. Everything on this page uses real Lean features, some of which the game's engine leaves out.

## Functions and recursion

A function is defined with \`def\`, giving its name, its arguments with their types, its result type, and a body. Recursive functions are defined by cases, usually with pattern matching on a constructor:

\`\`\`lean-real
def fib : Nat → Nat
  | 0 => 0
  | 1 => 1
  | n + 2 => fib n + fib (n + 1)

#eval fib 20

example : fib 10 = 55 := by decide
\`\`\`

The command \`#eval\` runs an expression and prints its value, here \`6765\`. Lean insists that recursive functions terminate, because a non-terminating function would let you prove false statements: a function of type \`Nat → False\` would be a proof of absurdity. For simple recursion on a constructor, as here, the check is automatic. For more complicated recursion you supply a termination argument, and Lean checks it.

You can also state and prove facts about the function by computing. The last line of the block above does this: the tactic \`decide\` asks Lean to evaluate a decidable statement. This is a proof by computation, the same idea as \`rfl\` in the article on equality.

## Data: structures and inductive types

A \`structure\` groups named fields, and an \`inductive\` type lists constructors, as the article on inductive types described. Lists are a standard inductive type. Here is a function that sums a list of numbers, and a theorem about it:

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

The program prints \`10\`. The theorem says that summing the concatenation of two lists gives the sum of the sums, and its proof is an induction on the first list, exactly like the induction on \`Nat\`, because \`List\` is an inductive type with two constructors. This is the reason Lean is used for verified software: the program and the facts about it live side by side, in one file, checked by one kernel.

## Interacting with the world

Programs that read and write use the \`IO\` type. A \`main\` function of type \`IO Unit\` is the entry point of an executable:

\`\`\`lean-real
def main : IO Unit :=
  IO.println "Hello, Lean"

#eval main
\`\`\`

This prints \`Hello, Lean\`. \`IO\` is how Lean separates computations that have effects, such as printing and reading files, from pure functions. A pure function of type \`Nat → Nat\` cannot print or read anything, and that separation is what makes it safe to reason about: a theorem about the function is a theorem about all its uses.

## Compiled, and written in itself

Lean does not only interpret programs. It compiles them to native code, so a Lean program can be built into a fast executable. The language was designed with this in mind: its compiler does reference counting and reuses memory in place when a value is not shared, which lets purely functional code run efficiently.

Lean 4 is also largely written in Lean. The parser, the elaborator, the tactic framework and the compiler are Lean programs, and the language's own syntax extensions, such as macros, are used to define much of its notation. The kernel, the small trusted core, is a separate piece of code in a lower-level language. That a language can be used to implement itself is a good sign about its practicality, and it explains why anyone who can write Lean can also write tactics: they are the same kind of program as the rest of the system.

## Proofs inside programs

Because types can mention values, a program can carry proofs of its own properties. A common example is indexing into a list. The lookup function can require a proof that the index is in range, so a failing lookup is ruled out at compile time. The cost is that you must produce the proof when you call the function, and sometimes that proof is the hard part. Lean provides tactics such as \`omega\` and \`simp\` that discharge routine side conditions like these, and when they cannot, you can restructure the program.

## What the game does and does not teach

The game uses \`def\` and \`#eval\` and shows recursion on natural numbers, because these are the entry to induction. It does not teach \`IO\`, structures, type classes or the \`do\` notation, which together make up most of ordinary Lean programming. If that side of Lean interests you, the official documentation has a book on functional programming in Lean, and the Graduate screen lists other books to read next. The ecosystem for general-purpose software is still young compared with those of older languages, so for a project that needs a large set of libraries, check that the ones you need exist before you commit.`,
  },
  {
    id: 'mathlib-community',
    section: 'ecosystem',
    title: 'Mathlib and the community',
    summary: 'What Mathlib is, how it is built and reviewed, and where to ask questions and search for theorems.',
    minutes: 5,
    next: ['lean-in-the-world'],
    body: `Lean itself is a language and a checker. Most of what makes it useful for mathematics is a library built on top of it, and the people who maintain that library. This article describes both.

## What Mathlib is

**Mathlib** is a library of formalized mathematics for Lean, written and maintained by a community of volunteers and researchers. It contains definitions and proved theorems from algebra, linear algebra, topology, analysis, measure theory, number theory, combinatorics, category theory, logic and more, together with the tactics and infrastructure that make working in these areas practical. Everything in it has been checked by Lean's kernel.

It is large. The library's statistics page, at the time of writing, reports roughly 140,000 definitions and 290,000 theorems, contributed by several hundred people. These figures grow every week, so treat them as an order of magnitude rather than a fact to cite.

The scale is the point. When you want to say "let \`G\` be a finite group" or "let \`f\` be a continuous function on a compact space", the notions exist, with their basic theory, and your own work can build on it. It also means that a project can be far larger than what any one person could write, which is how formalizations of research-level results become possible.

## How it is built

Mathlib is developed in the open, in a public repository on GitHub. Contributions arrive as pull requests, and each one is reviewed by maintainers and other contributors before it is merged. Reviewers look at more than whether the proof compiles, which the build checks automatically. They look at whether the definitions are the right ones, whether the statements are stated at the right generality, whether names follow the library's conventions, and whether the new material duplicates something already there. A style guide and a naming guide document these expectations.

Two consequences follow. First, the library's statements are curated: the effort of review goes into the part that a proof checker cannot check, namely whether a statement means what it should. Second, the library moves quickly, and names and file locations are sometimes changed. When a name is renamed, the old one is typically kept for a while as a deprecated alias, so that projects have time to update. If you use Mathlib, you pin a version, and upgrade deliberately.

## Where people talk

The main meeting place is the **Lean Zulip**, a chat server at leanprover.zulipchat.com. It is organized into streams and topics, and it is where users ask questions, where developers discuss design, and where formalization projects are coordinated. Beginners are welcome, and there is a stream for new members. A good question includes a small piece of code that others can paste into the web editor, the error message, and what you expected. People answer such questions quickly, and often with advice that improves the whole proof rather than just fixing one line.

The community also runs workshops, summer schools and online courses, and publishes teaching books; the Graduate screen lists several.

## Finding what you need

A library this size cannot be memorized, so finding things is a skill of its own.

- **The documentation site** for Mathlib, at leanprover-community.github.io/mathlib4_docs, lists every declaration with its statement and links to its source. Each name can be looked up directly.
- **Loogle**, at loogle.lean-lang.org, searches by the shape of a statement. You can enter a pattern such as the name of a function and the form of its result, and it lists matching theorems.
- **Natural-language search engines**, such as Moogle and LeanSearch, let you describe a theorem in words and return candidates. They are useful when you know the mathematics but not the name. Treat results as suggestions and check the statement.
- **\`exact?\`** is a tactic that searches the library for a lemma that closes the current goal. When it succeeds, it prints the term it found, so you can copy it into your proof. For example, asked to prove \`a + b = b + a\` for natural numbers, it replies with \`exact Nat.add_comm a b\`. It does not always find an answer, and it can be slow on large goals, but it is often the quickest way to learn a name.
- **Naming conventions**, described in the article on reading theorems, let you guess names. Typing the start of a name in the editor lists completions.

## Projects built on it

Mathlib is a base for larger efforts, some of which are described in the next article. Many projects keep their own repositories and import Mathlib as a dependency. They are organized with a **blueprint**, a human-readable outline of the mathematical argument, linked to the Lean declarations that formalize each part, so that many contributors can work on pieces in parallel and see what remains. Projects that finish often contribute their general lemmas back to Mathlib.

## How to take part

You do not need to be an expert to contribute. Fixing a documentation error, adding a missing small lemma, or porting a result are all legitimate first contributions, and maintainers label suitable issues for newcomers. Reading someone else's merged pull request is one of the best ways to learn the library's style. A first goal might be to prove something small that you cannot find in the library, check carefully that it is not there, and offer it.

Remember that the library, and the system it is written in, change. A recipe from a tutorial written a few years ago may need updating, and the current official pages are the right place to confirm anything about installation or version choice.`,
  },
  {
    id: 'lean-in-the-world',
    section: 'ecosystem',
    title: 'Lean in the world',
    summary: 'A careful survey of what Lean has been used for: large formalizations, industrial verification and AI systems, and where to go after the game.',
    minutes: 6,
    next: ['lean-tour', 'how-to-attack-a-proof'],
    body: `It is fair to ask what Lean is used for beyond exercises. This article surveys some notable uses. It is a selection, not a ranking, and it states only what is documented by the projects themselves. Details such as the status of ongoing work date quickly, so the project pages are the places to check.

## Large formalization projects

**The Liquid Tensor Experiment.** In 2020, Peter Scholze, a leading mathematician, posed a challenge: to check by computer a difficult theorem about "liquid vector spaces", from his work with Dustin Clausen on condensed mathematics, because he was not fully certain of the proof. The Lean community took it up, led by Johan Commelin, with the participation of about a dozen mathematicians and several computer scientists. The main theorem was formally verified, and the project's announcement of completion is dated July 2022. In 2021, about half a year in, the part of the argument Scholze had been least sure of was checked, and he wrote publicly about how far the project had come. The project also showed that Lean could handle an area of mathematics that was far from the basic material of the library at that time.

**The Polynomial Freiman–Ruzsa conjecture.** In November 2023 a team led by Timothy Gowers, Ben Green, Freddie Manners and Terence Tao shared a proof of a version of this conjecture from additive combinatorics. Tao then organized a Lean formalization with many collaborators, and it was completed within about three weeks, in early December 2023. It is notable for the speed, and as an example of a crowd of people working on a fresh result in parallel, coordinated by a written blueprint.

**Sphere eversion.** Patrick Massot, Floris van Doorn and Oliver Nash formalized Smale's theorem that a sphere can be turned inside out without creasing it, as a consequence of a general result of differential topology called the h-principle. The aim was to test whether differential topology could be formalized at all. The project's authors published an account of it in 2023.

**Fermat's Last Theorem.** A project led by Kevin Buzzard at Imperial College London aims to formalize a proof of Fermat's Last Theorem, following a modern version of the argument rather than the original. It is organized with a blueprint and welcomes contributors. It is a long-term effort, and its current status is on the project page.

## Verified software

**Cedar at Amazon Web Services.** Cedar is an open-source language that AWS uses for writing authorization policies, the rules that say who may do what. The Cedar team has written a formal model of the language in Lean and proved properties of it, such as the soundness of its validator, which says that a policy accepted by the validator will not cause type errors when it is evaluated. In the course of the formal modeling and proofs, the team reported finding and fixing bugs. Cedar's own materials describe how the model was first developed in a different verification language and moved to Lean.

This is an example of Lean as a software tool. The model is a program, the properties are theorems, and the checker is the same as for mathematics.

## AI systems that write Lean

Lean's checker gives machine-learning systems something unusual: a ground truth. A proof is either accepted or not, so a system can generate attempts, have them checked, and learn from the result without a human judge.

**AlphaProof.** At the 2024 International Mathematical Olympiad, Google DeepMind's AlphaProof, together with AlphaGeometry 2, solved four of the six problems, scoring 28 of 42 points, which DeepMind reported as silver-medal standard. AlphaProof produced its solutions as formal proofs in Lean, trained by reinforcement learning, and the problems were first translated into Lean by people. The geometry problem was handled by AlphaGeometry 2.

Beyond this, many research groups and companies build tools that propose Lean proofs, complete partial proofs, or suggest lemmas, and interest in the area is growing. Details are changing quickly, and claims in the news are worth checking against a paper or a release. One important point is stable, however: whatever produced a proof, a person can check it by running Lean, and the kernel does not care who or what wrote the term.

## What this tells you

Three things stand out across these examples. The cost of formalization is falling for areas with a lot of existing library, and remains high for areas without it. The largest successes have been collaborations, organized with blueprints and a shared library, and not heroic individual efforts. And Lean has moved from a research tool to something used in engineering teams.

It also remains true that Lean checks statements, not intentions. In every project above, a large part of the work was agreeing that the definitions and statements captured the mathematics or the specification correctly.

## Where to go after the game

The game covers the core of Lean: terms, types, tactics, logic, induction, sets and functions. The next steps are real Lean with Mathlib, automation, and larger statements. The **Graduate** screen lists how to try real Lean in your browser, how to install it, which tactics the game held back and when to use them, how to search the library, and which books and courses to read next. A good first project is to take a theorem you proved in the Workshop and prove it again in Mathlib, using the library's general lemmas, then to formalize something you care about. The official sites, lean-lang.org and the Lean Zulip, are the places to find current instructions and people who will help.`,
  },
];

export const getArticle = (id: string): GuideArticle | undefined => guide.find((a) => a.id === id);
