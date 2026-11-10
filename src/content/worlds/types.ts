import type { World } from '../types.ts';

export const world: World = {
  id: 'types',
  title: 'Basecamp',
  tagline: 'Terms, types and functions',
  intro:
    "Everything in Lean is a **term**, and every term has a **type**. In Basecamp you write terms by hand: numbers, functions, functions that return functions, and finally functions whose result *type* depends on their input. No tactics yet, just the raw material that all later proofs are built from. By the end you can read `(A → B) → (B → C) → A → C` and write a term that inhabits it.",
  requires: [],
  bigIdea:
    'Every expression has a type; functions are the basic building block; and types themselves can depend on values.',
  levels: [
    {
      id: 'types-01',
      kind: 'proof',
      title: 'Something of type Nat',
      english: 'Give any natural number.',
      intro:
        "Lean has two basic notions: **terms** and **types**. Every term has a type, written `a : A` and read \"a has type A\". For example `7 : Nat` says that 7 is a natural number (0, 1, 2, …).\n\nYour task: fill the gap with any term of type `Nat`. `sorry` is a placeholder meaning \"to be done\"; replace it.",
      outro:
        "You *inhabited* the type `Nat`: you produced a term of it. Keep that word in mind. The whole game is about inhabiting types, and soon the types will be statements you want to prove.",
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
        "`#check e` asks Lean for the type of `e`. It does not compute anything. `Nat.succ` is the function \"the next number\".\n\nPut your cursor on each `#check` line and read Lean's answer in the panel. Then answer the question.",
      outro:
        "`Nat → Nat` is a **function type**: \"give me a `Nat`, get a `Nat` back\". And `Nat.succ 3` has type `Nat`: applying a function to an argument gives something of the result type.",
      unlocks: { codex: ['check', 'function-types', 'arrow'] },
      question: 'What type does Lean report for `Nat.succ` on its own?',
      code: `#check (3 : Nat)
#check Nat.succ
#check Nat.succ 3`,
      options: [
        {
          text: '`Nat`',
          feedback:
            'That is the type of `Nat.succ 3`, the result once the function has been given a number. `Nat.succ` by itself is the function.',
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
            '`#check` reports types, not values, and 4 is a term, not a type. It never evaluates anything. (`#eval` computes.)',
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
        "To use a function, write it next to its argument: `f n`. No brackets, no commas. The rule is:\n\n- if `f : A → B` and `a : A`, then `f a : B`.\n\nYou are given `f` and `n` as hypotheses above the line. Build a `Nat` from them.",
      outro:
        "The rule \"`f : A → B`, `a : A`, so `f a : B`\" is the only way to *use* a function. Keep it in mind: Proposition Peaks turns out to be about this rule.",
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
        "To *build* a function, use `fun`: `fun n => n + 1` takes `n` and returns `n + 1`. Worked example: `def addTwo : Nat → Nat := fun n => n + 2`.\n\nNow define `double`. The `fun` is written for you; supply what comes out. Below the editor, a hidden test checks `double 3 = 6` by plain computation (`rfl`).",
      outro:
        "`fun` is the way to *make* an element of a function type; application is the way to *use* one. Together they are the whole story of functions, and `def` just gives the result a name.",
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
        "Lean has no functions of two arguments. `Nat → Nat → Nat` means `Nat → (Nat → Nat)`: a function that takes one number and returns *another function*. This is **currying**. So `fun w h => …` is short for `fun w => fun h => …`.\n\nDefine `area w h = w * h`. The tests also use `area 3` with only one argument.",
      outro:
        "`area 3` is a function in its own right, still waiting for its second argument. A function of several arguments is a chain of one-argument functions. Later, `P → Q → R` will read as \"given a proof of P and a proof of Q, get R\".",
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
        "Now with abstract types. `A B C : Type` stand for *any* types, so you know nothing about their elements. The only moves available are applying `f` and `g`.\n\nArrange the lines into a term of type `A → C`. Two lines are traps.",
      outro:
        "You never needed to know what `A`, `B`, `C` were. The term works for every choice, because it only follows the types: `a : A`, then `f a : B`, then `g (f a) : C`.",
      header: 'example (A B C : Type) (f : A → B) (g : B → C) : A → C :=',
      lines: ['  fun a =>', '    g (f a)'],
      distractors: ['    f (g a)', '    g a'],
      hints: [
        { text: 'The goal is a function, so the term must start by building one. Which line does that?' },
        { text: 'Follow the types: `a : A` can go into `f`, and the result can go into `g`.' },
        { text: 'First `fun a =>`, then the body `g (f a)`. `f (g a)` feeds a `C` to `f`, which expects an `A`.' },
      ],
    },
    {
      id: 'types-07',
      kind: 'choice',
      title: 'Types have types',
      intro:
        "Types are terms too, so they have types. `Nat : Type`: `Nat` is a type. What is the type of `Type` itself? Lean builds a tower of **universes**: `Type`, `Type 1`, `Type 2`, …\n\nMove the cursor over each `#check`, then predict the answer for `Type`. `Prop`, which you will meet next, sits right at the bottom.",
      outro:
        "Each universe lives in the next one: `Nat : Type`, `Type : Type 1`, and `Prop : Type`. If `Type : Type` held, you could build a Russell-style paradox, so Lean climbs a ladder instead.",
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
            'Tempting, but a type that contains itself leads to paradoxes (Girard\'s paradox, a cousin of Russell\'s). Lean avoids this by climbing a level.',
        },
        {
          text: '`Type : Type 1`',
          correct: true,
          feedback: 'Yes. `Type` is itself a term, and its type is the next universe up, `Type 1`.',
        },
        {
          text: '`Type : Nat`',
          feedback:
            '`Nat` is a type whose terms are numbers. `Type` is not a number; it is a type of types.',
        },
        {
          text: '`Type : Prop`',
          feedback:
            'It goes the other way. `Prop` is itself a term of `Type`, as the last `#check` shows.',
        },
      ],
    },
    {
      id: 'types-08',
      kind: 'proof',
      title: 'Types as arguments',
      english: 'Define the polymorphic identity function: it takes a type α, then a value of type α, and returns it.',
      intro:
        "So far the *output type* never depended on the input. Here it does: `(α : Type) → α → α` says \"give me a type α, then an element of α, and I return an element of α\". The result type mentions the argument `α`. This is a **dependent function type**.\n\nDefine `myId`. It takes two arguments: first the type, then the value.",
      outro:
        "`A → B` is just the special case `(x : A) → B` where `B` doesn't mention `x`. Taking a type as an argument is what makes a function polymorphic. In Quantifier Quay you will see that `∀` is exactly this construct.",
      unlocks: { codex: ['pi-types'] },
      mode: 'term',
      header: 'def myId : (α : Type) → α → α :=',
      starter: '  sorry',
      after: 'example : myId Nat 3 = 3 := rfl',
      solutions: ['  fun α a => a', '  fun α => fun a => a'],
      hints: [
        { text: 'Count the arrows in the type: two arguments, the type first.' },
        { text: 'Start `fun α a => …`. What should come back?' },
        { text: 'The body is just `a`; the full term is `fun α a => a`.' },
      ],
    },
    {
      id: 'types-09',
      kind: 'proof',
      title: 'Basecamp summit: swapping arguments',
      boss: true,
      english: 'Define `swapArgs`: given any two-argument function, return the one that takes its arguments in the other order.',
      intro:
        "Put everything together. `swapArgs` takes three types, then a function `α → β → γ`, and returns a function `β → α → γ`. Reading the type slowly (currying!) tells you how many names `fun` needs.\n\nA hidden test runs it on a concrete function, so the term must really compute.",
      outro:
        "You wrote a term whose type is a *theorem-shaped statement*: for all types, a function of two arguments can be flipped. In the next world, the same terms will be read as proofs.",
      mode: 'term',
      header: 'def swapArgs : (α β γ : Type) → (α → β → γ) → β → α → γ :=',
      starter: '  sorry',
      after: 'example : swapArgs Nat Nat Nat (fun a b => a * 10 + b) 1 2 = 21 := rfl',
      solutions: ['  fun α β γ f b a => f a b', '  fun _ _ _ f b a => f a b'],
      hints: [
        { text: 'Count the arguments the type promises: three types, one function, then two values.' },
        { text: 'Name them in order: `fun α β γ f b a => …`. Note `b : β` comes first.' },
        { text: 'The result must be a `γ`. Only `f` produces one. What does `f` need, and in which order?' },
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
      body: "Lean's basic judgement is `a : A`: the term `a` has type `A`. Numbers, functions and proofs are all terms. Every term has exactly one type (up to computation). To *inhabit* a type is to produce a term of it.",
      example: 'example : Nat := 7',
    },
    {
      id: 'nat',
      kind: 'definition',
      name: 'Nat',
      summary: 'The natural numbers 0, 1, 2, …',
      body: "`Nat` is the type of natural numbers. It has two ways of being built: `0` (`Nat.zero`) and `Nat.succ n`, the number after `n`. Numerals like `7` are shorthand. Later you will see that this is an *inductive type*.",
      example: 'example : Nat := Nat.succ 3',
    },
    {
      id: 'sorry',
      kind: 'term',
      name: 'sorry',
      summary: 'A placeholder that stands for a missing term or proof.',
      body: "`sorry` fills any gap so the rest of your code can be checked. Lean warns that the result is incomplete. It is how you leave a gap while you work, never a finished solution.",
    },
    {
      id: 'example-cmd',
      kind: 'term',
      name: 'example',
      summary: 'Checks a term against a type without naming it.',
      body: "`example : T := e` asks Lean to check that `e` has type `T`, and then forgets it. `def name : T := e` and `theorem name : T := e` do the same but keep the name for later use.",
      example: 'example : Nat := 5',
    },
    {
      id: 'check',
      kind: 'term',
      name: '#check',
      summary: 'Asks Lean for the type of an expression.',
      body: "`#check e` prints `e : T`. It never computes the value. Use it constantly: when you are unsure what something is, check it.",
      example: '#check Nat.succ',
    },
    {
      id: 'function-types',
      kind: 'concept',
      name: 'Function types',
      summary: '`A → B` is the type of functions that take an `A` and return a `B`.',
      body: "If `f : A → B` and `a : A` then `f a : B`. The arrow associates to the right: `A → B → C` means `A → (B → C)`. Functions are terms like any other, so they can be arguments and results of other functions.",
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
      body: "`f a` applies `f` to `a`. With several arguments, `f a b` means `(f a) b`. Parentheses group: `f (g a)` applies `g` first.",
      example: 'example (f : Nat → Nat) : Nat := f 2',
    },
    {
      id: 'fun',
      kind: 'term',
      name: 'fun x => e',
      summary: 'Builds a function that sends `x` to `e`.',
      body: "`fun x => e` is a function whose body `e` may use `x`. Several names are short for nesting: `fun a b => e` is `fun a => fun b => e`. You can annotate: `fun (x : Nat) => e`.",
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
      body: "`A → B → C` is `A → (B → C)`. Giving only the first argument yields a function still waiting for the second: partial application. This is why `f a b` is `(f a) b`.",
      example: 'example : Nat → Nat → Nat := fun a b => a + b',
    },
    {
      id: 'universes',
      kind: 'concept',
      name: 'Universes',
      summary: 'Types have types: `Nat : Type`, `Type : Type 1`, and `Prop : Type`.',
      body: "`Type` is the type of ordinary types; `Type 1` the type of `Type`; and so on upward. A type never lives in itself, which would cause paradoxes. `Prop` is a separate bottom universe for statements; it is the subject of the next world.",
      example: '#check Type',
    },
    {
      id: 'pi-types',
      kind: 'concept',
      name: 'Dependent function types',
      summary: '`(x : A) → B x`: the result type may depend on the argument.',
      body: "In `(α : Type) → α → α` the type after the first arrow mentions `α`. Such a type is a *Π-type*. When `B` does not mention `x`, it is written `A → B`. Polymorphism and (later) `∀` are both instances.",
      example: 'example : (α : Type) → α → α := fun α a => a',
    },
  ],
  lemmas: [],
};
