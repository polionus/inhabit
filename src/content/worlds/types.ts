import type { World } from '../types.ts';

export const world: World = {
  id: 'types',
  title: 'Basecamp',
  tagline: 'Terms, types and functions',
  intro:
    "Everything in Lean is a **term**, and every term has a **type**. In Basecamp, you'll write terms by hand: numbers, functions, functions that return functions, and finally functions whose result *type* depends on their input. There aren't any tactics yet—just the raw material that all later proofs are built from. By the end, you'll be able to read `(A → B) → (B → C) → A → C` and write a term that inhabits it.",
  requires: [],
  bigIdea:
    'Every expression has a type, functions are the basic building block, and types themselves can depend on values.',
  levels: [
    {
      id: 'types-01',
      kind: 'proof',
      title: 'Something of type Nat',
      english: 'Give any natural number.',
      intro:
        "Replace `sorry` with any natural number, like `7`.\n\nWriting `7 : Nat` means the term `7` has type `Nat`, the natural numbers 0, 1, 2, …",
      outro:
        "You just *inhabited* the type `Nat` by producing a term of it. Hold onto that word—the whole game is about inhabiting types, and soon those types will be statements you want to prove.",
      unlocks: { codex: ['terms-types', 'nat', 'sorry', 'example-cmd'] },
      mode: 'term',
      header: 'example : Nat :=',
      starter: '  sorry',
      solutions: ['  7', '  0', '  42'],
      hints: [
        { text: 'A term of type `Nat` is any natural number: 0, 1, 2, and so on.' },
        { text: 'Delete `sorry` and type a numeral in its place.' },
        { text: 'For example, the line `  7` works.' },
      ],
    },
    {
      id: 'types-02',
      kind: 'choice',
      title: 'Asking for a type',
      intro:
        "Put your cursor on each `#check` line and read Lean's answer in the panel. Then answer the question.\n\n`#check e` asks Lean for the type of `e`; it doesn't compute anything. `Nat.succ` is the function for \"the next number.\"",
      outro:
        "`Nat → Nat` is a **function type**: \"give me a `Nat`, get a `Nat` back.\" And `Nat.succ 3` has type `Nat`—applying a function to an argument gives something of the result type.",
      unlocks: { codex: ['check', 'function-types', 'arrow'] },
      question: 'What type does Lean report for `Nat.succ` on its own?',
      code: `#check (3 : Nat)
#check Nat.succ
#check Nat.succ 3`,
      options: [
        {
          text: '`Nat`',
          feedback:
            "That's the type of `Nat.succ 3`, the result once the function has been given a number. `Nat.succ` by itself is the function.",
        },
        {
          text: '`Nat → Nat`',
          correct: true,
          feedback:
            'Right. `Nat.succ` takes a `Nat` and returns a `Nat`, so its type is the function type `Nat → Nat`.',
        },
        {
          text: '`4`',
          feedback:
            '`#check` reports types, not values, and 4 is a term, not a type. It never evaluates anything (`#eval` is the one that computes).',
        },
        {
          text: '`Type`',
          feedback:
            '`Type` would be the answer for `#check Nat`, the type of the *type* `Nat`. `Nat.succ` is an ordinary term.',
        },
      ],
    },
    {
      id: 'types-03',
      kind: 'proof',
      title: 'Using a function',
      english: 'Given a function f from Nat to Nat and a number n, produce a Nat.',
      intro:
        "You're given a function `f` and a number `n` above the line. Replace `sorry` with a `Nat` built from them.\n\nThe names in parentheses above the line, like `(f : Nat → Nat)`, are things you are given, each with its type.\n\nTo use a function, write it right next to its argument: `f n`. No parentheses, no commas.",
      outro:
        "The rule \"if `f : A → B` and `a : A`, then `f a : B`\" is the only way to *use* a function. Keep it in mind: Proposition Peaks turns out to be built on this exact rule.",
      unlocks: { codex: ['application'] },
      mode: 'term',
      header: 'example (f : Nat → Nat) (n : Nat) : Nat :=',
      starter: '  sorry',
      solutions: ['  f n', '  f (f n)'],
      hints: [
        { text: 'You have a function `f` that needs a `Nat`, and a `Nat` called `n`.' },
        { text: 'Apply `f` to `n` by writing them side by side.' },
        { text: 'Write `f n`.' },
      ],
    },
    {
      id: 'types-04',
      kind: 'proof',
      title: 'Building a function',
      english: 'Define the function `double` that doubles a number.',
      intro:
        "Replace `sorry` with what the function should return for the input `n`, so that `double` doubles its input.\n\n`fun n => n + 1` is the function that takes `n` and returns `n + 1`. A hidden test checks `double 3 = 6` by plain computation (`rfl`).",
      outro:
        "`fun` is how you *make* an element of a function type, and application is how you *use* one. Together they're the whole story of functions, and `def` simply gives the result a name.",
      unlocks: { codex: ['fun', 'lambda', 'def'] },
      mode: 'term',
      header: 'def double : Nat → Nat :=',
      starter: '  fun n => sorry',
      after: 'example : double 3 = 6 := rfl',
      solutions: ['  fun n => n + n', '  fun n => 2 * n'],
      hints: [
        { text: 'The variable `n` is the number being doubled. What should come out of the function?' },
        { text: 'Doubling is adding a number to itself, or multiplying by 2.' },
        { text: 'Replace `sorry` with `n + n`.' },
      ],
    },
    {
      id: 'types-05',
      kind: 'proof',
      title: 'Two arguments, one at a time',
      english: 'Define `area`, taking a width and a height and returning their product.',
      intro:
        "Replace `sorry` with a function that takes a width `w` and a height `h` and returns their product. Write it as `fun w h => …`.\n\nThe type `Nat → Nat → Nat` means a function that returns another function, which is why the tests can also write `area 3` with just one argument.",
      outro:
        "`area 3` is a function in its own right, still waiting for its second argument. A function of several arguments is really a chain of one-argument functions. Later, `P → Q → R` will read as \"given a proof of P and a proof of Q, get R.\"",
      unlocks: { codex: ['currying'] },
      mode: 'term',
      header: 'def area : Nat → Nat → Nat :=',
      starter: '  sorry',
      after: `example : area 3 4 = 12 := rfl
example : Nat → Nat := area 3`,
      solutions: ['  fun w h => w * h', '  fun w => fun h => w * h'],
      hints: [
        { text: 'The type has two arrows, so the function takes two arguments. Name each one.' },
        { text: 'Use `fun` with two names after it, then `=>` and the product.' },
        { text: 'The shape is `fun w h => …`; fill in `w * h`.' },
      ],
    },
    {
      id: 'types-06',
      kind: 'parsons',
      title: 'Composing functions',
      english: 'Given f : A → B and g : B → C, build a function A → C.',
      intro:
        "Arrange the lines into a term of type `A → C`. Two lines are traps.\n\n`A B C : Type` stand for *any* types, so you don't know anything about their elements—your only moves are applying `f` and `g`.",
      outro:
        "You never needed to know what `A`, `B`, and `C` were. The term works for any choice because it only follows the types: `a : A`, then `f a : B`, then `g (f a) : C`.",
      header: 'example (A B C : Type) (f : A → B) (g : B → C) : A → C :=',
      lines: ['  fun a =>', '    g (f a)'],
      distractors: ['    f (g a)', '    g a'],
      hints: [
        { text: 'The goal is a function, so the term has to start by building one. Which line does that?' },
        { text: 'Follow the types: `a : A` can go into `f`, and the result can go into `g`.' },
        { text: 'First `fun a =>`, then the body `g (f a)`. Writing `f (g a)` would feed a `C` to `f`, which expects an `A`.' },
      ],
    },
    {
      id: 'types-07',
      kind: 'choice',
      title: 'Types have types',
      intro:
        "Types are terms too, so they have types of their own. `Nat : Type` says `Nat` is a type—so what's the type of `Type` itself? Lean builds a tower of **universes**: `Type`, `Type 1`, `Type 2`, …\n\nMove the cursor over each `#check`, then predict the answer for `Type`. `Prop`, which you'll meet next, sits right at the bottom.",
      outro:
        "Each universe lives in the next one up: `Nat : Type`, `Type : Type 1`, and `Prop : Type`. If `Type : Type` held, you could build a Russell-style paradox, so Lean climbs a ladder instead.",
      unlocks: { codex: ['universes'] },
      question: 'Lean answers `Nat : Type`. What does it answer for `#check Type`?',
      code: `#check Nat
#check Type
#check Type 1
#check Prop`,
      options: [
        {
          text: '`Type : Type`',
          feedback:
            "Tempting, but a type that contains itself leads to paradoxes (Girard's paradox, a cousin of Russell's). Lean avoids this by climbing a level.",
        },
        {
          text: '`Type : Type 1`',
          correct: true,
          feedback: 'Yes. `Type` is itself a term, and its type is the next universe up, `Type 1`.',
        },
        {
          text: '`Type : Nat`',
          feedback:
            "`Nat` is a type whose terms are numbers. `Type` isn't a number—it's a type of types.",
        },
        {
          text: '`Type : Prop`',
          feedback:
            'It goes the other way around. `Prop` is a term of `Type`, as the last `#check` shows.',
        },
      ],
    },
    {
      id: 'types-08',
      kind: 'proof',
      title: 'Types as arguments',
      english: 'Define the polymorphic identity function: it takes a type α, then a value of type α, and returns it.',
      intro:
        "So far, a function's *output type* has never depended on its input. Here it does: `(α : Type) → α → α` says \"give me a type α, then an element of α, and I'll return an element of α.\" Because the result type mentions the argument `α`, this is a **dependent function type**.\n\nDefine `myId`. It takes two arguments: first the type, then the value. The `fun` line is started for you; fill in what it returns.",
      outro:
        "`A → B` is just the special case `(x : A) → B` where `B` doesn't mention `x`. Taking a type as an argument is what makes a function polymorphic, and in Quantifier Quay you'll see that `∀` is this exact same construct.",
      unlocks: { codex: ['pi-types'] },
      mode: 'term',
      header: 'def myId : (α : Type) → α → α :=',
      starter: '  fun α a => sorry',
      after: 'example : myId Nat 3 = 3 := rfl',
      solutions: ['  fun α a => a', '  fun α => fun a => a'],
      hints: [
        { text: 'Count the arrows in the type: two arguments, the type first.' },
        { text: 'The `fun α a =>` is written for you. What should come back?' },
        { text: 'Replace `sorry` with `a`: the full term is `fun α a => a`.' },
      ],
    },
    {
      id: 'types-08b',
      kind: 'proof',
      title: 'Ignoring an argument',
      english: 'Define a function that takes two types and one value of each, and returns the first value.',
      intro:
        "Read the type one arrow at a time: give me a type `α`, a type `β`, a value of `α`, a value of `β`, and I return an `α`. Four arrows, four names after `fun`. One of the values is never needed, and that's fine.",
      outro:
        'A function may ignore an argument. The type only promises what comes back, here an `α`, and `a` is the only thing that has that type.',
      mode: 'term',
      header: 'def myConst : (α β : Type) → α → β → α :=',
      starter: '  sorry',
      after: 'example : myConst Nat Nat 3 4 = 3 := rfl',
      solutions: ['  fun α β a b => a', '  fun _ _ a _ => a'],
      hints: [
        { text: 'Count the arrows: two types, then two values. That\'s four names.' },
        { text: 'Start `fun α β a b => …`. Which of these names has the result type `α`?' },
        { text: 'The body is `a`.' },
      ],
    },
    {
      id: 'types-09',
      kind: 'proof',
      title: 'Basecamp summit: swapping arguments',
      boss: true,
      english: 'Define `swapArgs`: given any two-argument function, return the one that takes its arguments in the other order.',
      intro:
        "Let's put everything together. `swapArgs` takes three types, then a function `α → β → γ`, and returns a function `β → α → γ`. Reading the type slowly—remembering currying—tells you how many names `fun` needs.\n\nA hidden test runs it on a concrete function, so your term has to actually compute.",
      outro:
        "You just wrote a term whose type reads like a theorem: for any types, a two-argument function can have its arguments flipped. In the next world, these same terms will become proofs.",
      mode: 'term',
      header: 'def swapArgs : (α β γ : Type) → (α → β → γ) → β → α → γ :=',
      starter: '  sorry',
      after: 'example : swapArgs Nat Nat Nat (fun a b => a * 10 + b) 1 2 = 21 := rfl',
      solutions: ['  fun α β γ f b a => f a b', '  fun _ _ _ f b a => f a b'],
      hints: [
        { text: 'Count the arguments the type promises: three types, one function, then two values.' },
        { text: 'Name them in order: `fun α β γ f b a => …`. Note `b : β` comes first.' },
        { text: 'The result has to be a `γ`, and only `f` produces one. What does `f` need, and in which order?' },
        { text: 'The body is `f a b`.' },
      ],
    },
  ],
  codex: [
    {
      id: 'terms-types',
      kind: 'concept',
      name: 'Terms and types',
      summary: 'Every term has a type, written `a : A`.',
      body: "Lean's basic judgment is `a : A`: the term `a` has type `A`. Numbers, functions, and proofs are all terms, and every term has a single type (up to computation). To *inhabit* a type means to produce a term of it.",
      example: 'example : Nat := 7',
    },
    {
      id: 'nat',
      kind: 'definition',
      name: 'Nat',
      summary: 'The natural numbers 0, 1, 2, …',
      body: "`Nat` is the type of natural numbers. It has two ways of being built: `0` (`Nat.zero`) and `Nat.succ n`, the number after `n`. Numerals like `7` are shorthand. Later you'll see that this makes `Nat` an *inductive type*.",
      example: 'example : Nat := Nat.succ 3',
    },
    {
      id: 'sorry',
      kind: 'term',
      name: 'sorry',
      summary: 'A placeholder that stands for a missing term or proof.',
      body: "`sorry` fills any gap so the rest of your code can still be checked, and Lean warns you that the result is incomplete. It's handy for leaving a gap while you work, never a finished solution.",
    },
    {
      id: 'example-cmd',
      kind: 'term',
      name: 'example',
      summary: 'Checks a term against a type without naming it.',
      body: "`example : T := e` asks Lean to check that `e` has type `T`, then forgets it. `def name : T := e` and `theorem name : T := e` do the same thing, except they keep the name for later use.",
      example: 'example : Nat := 5',
    },
    {
      id: 'check',
      kind: 'term',
      name: '#check',
      summary: 'Asks Lean for the type of an expression.',
      body: "`#check e` prints `e : T` without computing the value. Use it constantly—whenever you're unsure what something is, check it.",
      example: '#check Nat.succ',
    },
    {
      id: 'function-types',
      kind: 'concept',
      name: 'Function types',
      summary: '`A → B` is the type of functions that take an `A` and return a `B`.',
      body: "If `f : A → B` and `a : A`, then `f a : B`. The arrow associates to the right, so `A → B → C` means `A → (B → C)`. Functions are terms like any other, which means they can be passed to and returned from other functions.",
      example: 'example : Nat → Nat := Nat.succ',
    },
    {
      id: 'arrow',
      kind: 'symbol',
      name: '→',
      summary: 'The function arrow.',
      body: 'Separates argument type from result type. `->` also works.',
      input: '\\to',
    },
    {
      id: 'application',
      kind: 'term',
      name: 'f a',
      summary: 'Apply a function to an argument by writing them side by side.',
      body: "`f a` applies `f` to `a`. With several arguments, `f a b` means `(f a) b`. Use parentheses to group: `f (g a)` applies `g` first.",
      example: 'example (f : Nat → Nat) : Nat := f 2',
    },
    {
      id: 'fun',
      kind: 'term',
      name: 'fun x => e',
      summary: 'Builds a function that sends `x` to `e`.',
      body: "`fun x => e` builds a function whose body `e` can use `x`. Listing several names is shorthand for nesting: `fun a b => e` is `fun a => fun b => e`. You can add type annotations too, like `fun (x : Nat) => e`.",
      example: 'example : Nat → Nat := fun n => n + 1',
    },
    {
      id: 'lambda',
      kind: 'symbol',
      name: 'λ',
      summary: 'Another spelling of `fun`.',
      body: '`λ x => e` means the same as `fun x => e`. `↦` can replace `=>`.',
      input: '\\lam',
    },
    {
      id: 'def',
      kind: 'term',
      name: 'def',
      summary: 'Gives a name to a term.',
      body: "`def name : T := e` defines `name` as `e`. Lean can *unfold* it whenever it computes, which is why `rfl` proves `double 3 = 6`.",
      example: 'def addTwo : Nat → Nat := fun n => n + 2',
    },
    {
      id: 'currying',
      kind: 'concept',
      name: 'Currying',
      summary: 'A function of several arguments is a function returning a function.',
      body: "`A → B → C` is `A → (B → C)`. Passing only the first argument gives you a function still waiting for the second—that's partial application, and it's why `f a b` means `(f a) b`.",
      example: 'example : Nat → Nat → Nat := fun a b => a + b',
    },
    {
      id: 'universes',
      kind: 'concept',
      name: 'Universes',
      summary: 'Types have types: `Nat : Type`, `Type : Type 1`, and `Prop : Type`.',
      body: "`Type` is the type of ordinary types, `Type 1` is the type of `Type`, and so on upward. A type never lives in itself, which avoids paradoxes. `Prop` is a separate bottom universe for statements, and it's the subject of the next world.",
      example: '#check Type',
    },
    {
      id: 'pi-types',
      kind: 'concept',
      name: 'Dependent function types',
      summary: '`(x : A) → B x`: the result type may depend on the argument.',
      body: "In `(α : Type) → α → α`, the type after the first arrow mentions `α`. That kind of type is called a *Π-type*. When `B` doesn't mention `x`, we just write `A → B`. Polymorphism and (later) `∀` are both instances of it.",
      example: 'example : (α : Type) → α → α := fun α a => a',
    },
  ],
  lemmas: [],
};
