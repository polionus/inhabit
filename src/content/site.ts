import type { AboutCopy, HomeCopy } from './types.ts';

/** Copy for the Home page. Field limits are documented in `types.ts` ("Site copy"). */
export const home: HomeCopy = {
  hero: {
    eyebrow: 'A free browser game that teaches Lean 4',
    headline: 'Learn to write proofs a computer can check',
    lede: '**Lean** is a theorem prover: you write a mathematical proof in its language, and it checks every step. Across 124 short levels you learn to write those proofs yourself, and you finish by stating and proving a theorem of your own.',
    startLabel: 'Start level one',
    continueLabel: 'Continue',
    aboutLabel: 'New to Lean? Read the introduction',
    reassurances: ['Runs in your browser', 'No install, no account', 'Free and open source', 'No programming needed'],
  },

  demo: {
    heading: 'A real Lean proof, one line at a time',
    intro:
      'Step through the proof below. After each line, the panel shows the facts you have (above the `⊢`) and what is still left to prove (after it).',
    english: 'For any sets A and B of natural numbers, A ∩ B is a subset of B ∩ A: anything in both A and B is in both B and A.',
    code: `theorem inter_swap (A B : Set Nat) : A ∩ B ⊆ B ∩ A := by
  intro x hx
  obtain ⟨ha, hb⟩ := hx
  constructor
  exact hb
  exact ha`,
    steps: [
      {
        line: 2,
        note: 'Take any number `x` and assume `x ∈ A ∩ B`, naming that fact `hx`. Now show `x ∈ B ∩ A`.',
      },
      {
        line: 3,
        note: 'Being in `A ∩ B` means being in `A` and in `B`. Split `hx` into those two facts, `ha` and `hb`.',
      },
      {
        line: 4,
        note: 'Being in `B ∩ A` means being in both, so the goal splits in two: `x ∈ B` and `x ∈ A`.',
      },
      {
        line: 5,
        note: 'The first goal, `x ∈ B`, is exactly the fact `hb`. One goal is left.',
      },
      {
        line: 6,
        note: 'The last goal, `x ∈ A`, is exactly the fact `ha`. Nothing is left to prove.',
      },
    ],
    closing:
      'That is a complete proof: every step was checked, and nothing was taken on trust. In the game you write lines like these yourself, starting with much smaller goals.',
  },

  whatIsLean: {
    heading: 'What is Lean?',
    body: '**Lean** is an open-source programming language and *proof assistant*. You write a mathematical statement and its proof in a precise language, and Lean checks every step mechanically. When a step does not follow, it tells you, and it always shows exactly what is still unproved. Mathematicians use it to verify proofs and to build **Mathlib**, a large library of formalized mathematics written by its community. Computer scientists use it to verify software. Writing for Lean teaches you to say exactly what you mean.',
  },

  outcomes: {
    heading: 'What you will be able to do',
    items: [
      {
        title: 'Read and write Lean',
        body: 'Follow a Lean proof line by line, and write your own with the core tactics of real Lean: `intro`, `obtain`, `constructor`, `rw`, `induction` and more.',
      },
      {
        title: 'Prove real mathematics',
        body: "Prove facts about logic, sets, functions, natural numbers and divisibility, from `0 + n = n` by induction to Cantor's theorem: no function from a set to its subsets reaches every subset.",
      },
      {
        title: 'Formalize your own theorem',
        body: 'Take a statement written in English, give its objects types, write the definitions it needs, state it precisely in Lean and prove it.',
      },
      {
        title: 'Know what a proof is',
        body: 'Explain why, in Lean, a statement is a type and a proof is a program of that type, and what exactly the machine checks.',
      },
    ],
  },

  journey: {
    heading: 'Ten worlds, from first steps to your own theorem',
    intro:
      'Each world teaches one big idea in 9 to 15 short levels. After the fifth, the map branches: numbers and induction on one side, sets and functions on the other. Both lead to the Formalization Forge, where you state and prove a theorem of your own. If you already know a world, beat its final level to pass it.',
  },

  method: {
    heading: 'How it feels to learn here',
    items: [
      {
        title: 'You predict before you see',
        body: 'Some levels stop before a step runs and ask what the goal will become. You commit to an answer, then see what really happens, with a note on why.',
      },
      {
        title: 'Help comes one step at a time',
        body: 'Ask for a hint and you get a nudge first, then the name of a tool, then the next line. You take only as much help as you need.',
      },
      {
        title: 'Mistakes are explained',
        body: "You see Lean's real error message, so you learn to read it, and underneath it a plain explanation of what it means and what to try.",
      },
      {
        title: 'Ideas come back, nothing punishes you',
        body: 'Levels you have solved come back for short reviews, first after a day or so, then at longer gaps, so they stay with you. There are no timers, no lives and no streaks to lose.',
      },
    ],
  },

  audience: {
    heading: 'Who it is for',
    body: 'Anyone curious about how a computer can check mathematics: a student meeting proofs for the first time, or someone who knows Lean by name and wants a careful way in. You need school algebra and the patience to read closely. No programming is assumed. It is not a reference manual, and if you already prove theorems in Lean every day, you will find little new here.',
  },

  closing: {
    heading: 'Start with the first goal',
    body: 'Level one asks you for a single natural number. It is short, and every proof in the game is built the same way: by giving Lean something of the right type.',
    cta: 'Start level one',
  },
};

/** Copy for the About page. */
export const about: AboutCopy = {
  title: 'About Inhabit',
  lede: 'Inhabit is a free game that teaches you to write mathematical proofs in Lean 4, a language in which a computer checks every step. This page explains what Lean is, what you will do in the game, and how the game is built. No programming background is assumed.',
  sections: [
    {
      id: 'what-is-lean',
      title: 'What Lean is',
      body: `**Lean** is an open-source programming language and *proof assistant*. A proof assistant is a program that checks proofs. You write a statement and its proof in a precise language, and it checks each step against the rules of logic. It accepts the proof only if every step follows.

Here is a small Lean theorem:

\`\`\`lean
theorem my_add_zero (n : Nat) : n + 0 = n := by
  rfl
\`\`\`

The first line is the statement: for every natural number \`n\`, \`n + 0 = n\`. Everything after \`by\` is the proof. Here it is one word, \`rfl\`, which says "both sides work out to the same thing", and Lean checks that they do.

While you write a proof, Lean shows you what is still left to prove, so you are never guessing where you stand.`,
    },
    {
      id: 'why-formalize',
      title: 'Why check proofs by machine',
      body: `A proof on paper is checked by people, and people miss things: a case nobody considered, a step called "obvious" that is not. When Lean accepts a proof, every step has been checked, down to the basic rules of logic.

That has practical uses. You can build on a result without re-reading its whole proof, which lets many people work on one large body of mathematics, as the community does in **Mathlib**, Lean's shared library. The same methods are used to verify that software does what it is meant to.

It also changes how you think. Lean will not accept "clearly" or "similarly", so you find out exactly which steps you understood.

The honest cost: it takes effort. You must spell out steps a human reader would skip, and a short proof on paper can become a much longer one in Lean.`,
    },
    {
      id: 'what-you-do',
      title: 'What you do in the game',
      body: `The game has 10 worlds and 124 levels, arranged on a map. You start with types and functions, then learn that statements are types and proofs are programs. From there you work through logic, "for all" and "there exists", and equality. Then the map branches: natural numbers, induction and divisibility on one side; sets, and functions ending with Cantor's theorem, on the other. Both meet in a last world where you formalize a theorem of your own.

Levels come in five kinds:

- **Write a proof**, as a sequence of steps or as a single expression.
- **Arrange shuffled lines** of a proof in the right order.
- **Predict** the goal a step will produce, before you see it.
- **Concept checks**: short questions with explained answers.
- **Translate** an English sentence into a Lean statement.

Each world ends with a harder *boss* level that mixes in tools from earlier worlds.`,
    },
    {
      id: 'the-name',
      title: 'Why it is called Inhabit',
      body: `In Lean, every expression has a *type*. \`7\` has type \`Nat\`, the natural numbers. A statement is a type too, and a proof of the statement is something of that type.

For example, a proof of "if P then Q" is a function that turns any proof of P into a proof of Q. Proving a statement therefore means building something that has its type. Type theorists call this *inhabiting* the type.

The game starts right there. Level one asks for anything of type \`Nat\`, and \`7\` will do. A few worlds later the types are mathematical statements, and the things you build are proofs.`,
    },
    {
      id: 'how-a-level-works',
      title: 'How a level works',
      body: `A level screen has three parts.

**The task** states what to prove, in English and in Lean, with a short explanation of the new idea.

**The editor** holds the proof. The statement is fixed; you write below it, starting from \`sorry\`, Lean's placeholder for "not done yet". Your proof is checked as you type.

**The goal view** shows where you stand at the cursor. Facts you may use sit above the \`⊢\`; what you must prove sits after it:

\`\`\`lean
A B : Set Nat
x : Nat
hx : x ∈ A ∩ B
⊢ x ∈ B ∩ A
\`\`\`

When no goals remain, the level is solved. Errors appear here too, with a plain explanation underneath.

The **Inventory** lists what you have unlocked so far: tactics (proof steps), lemmas (facts already proved) and Codex entries. Clicking a name puts it into your proof. **Hints** come one at a time if you ask, and you can reveal a full solution if you need to.`,
    },
    {
      id: 'typing-symbols',
      title: 'Typing the symbols',
      body: `Lean uses mathematical symbols, and you type them with short abbreviations. Type a backslash, a name, then a space: \`\\to\` followed by a space becomes \`→\`. Some you will use often:

- \`\\to\` gives \`→\`, \`\\and\` gives \`∧\`, \`\\or\` gives \`∨\`, \`\\not\` gives \`¬\`
- \`\\forall\` gives \`∀\`, \`\\ex\` gives \`∃\`
- \`\\in\` gives \`∈\`, \`\\sub\` gives \`⊆\`, \`\\inter\` gives \`∩\`
- \`\\<\` and \`\\>\` give the angle brackets \`⟨\` and \`⟩\`

If you forget one, the symbol bar above the editor has the common symbols: click one to insert it, or hover to see its abbreviation. Plain-text spellings also work for some, such as \`->\` for \`→\`.

These are the same abbreviations as in the Lean extension for the VS Code editor, so the habit carries over to real Lean.`,
    },
    {
      id: 'how-it-teaches',
      title: 'How the game teaches, and why',
      body: `Each level adds exactly one new thing: a tactic, an idea or a piece of notation. You always know what a level is about, and nothing new competes for your attention.

Each new skill comes in a fixed order. First you step through a complete example. Then you predict what a step will do, finish a proof that is mostly written, put shuffled lines in order, and finally write proofs on your own. By the time you face a blank page, you have already seen the skill used and tried it with support.

Hints start vague and get more specific, so you do as much of the thinking as you can. Wrong answers get feedback about the particular mistake, not just "incorrect". Solved levels come back after a few days, then after longer gaps, because recalling something after a gap makes it last longer than rereading it does.

There are no timers, lives or streak penalties. Using hints never blocks your progress.`,
    },
    {
      id: 'is-this-real-lean',
      title: 'Is this real Lean?',
      body: `The language is; the checker is not. The game checks your code inside your browser, with an engine written for this game that implements a part of Lean 4.

What is left out: *type classes* (the machinery that lets \`+\` work on many kinds of number), automation such as \`simp\` that finds proofs for you, and every kind of number except the natural numbers. Occasionally the game rejects something real Lean would accept.

What is kept: the syntax, and names and statements that follow Lean and its library. Every reference solution in the game is also compiled by real Lean 4, so what you learn to type here is real Lean and transfers directly.

When you are ready for the real thing, the **Graduate** guide explains the differences, and **Open in real Lean** in the Sandbox and Workshop sends your code to the Lean web editor at https://live.lean-lang.org.`,
    },
    {
      id: 'where-it-leads',
      title: 'Where it leads',
      body: `The **Workshop** is where you formalize a theorem of your own in five steps: *say it* in careful English, *type it* by choosing a type for each object, *define it* by writing any definitions it needs, *state it* in Lean, and *prove it*. If you want a starting point, it suggests 17 theorems. Your theorems are saved.

The **Sandbox** is a free editor with every tactic unlocked, for experiments.

The **Graduate** guide takes you to real Lean and **Mathlib**: how to try it in your browser, how to install it, the automation tactics the game withheld, how to search the library, and a phrasebook from the names you learned here to the names Mathlib uses.

The **Codex** collects every idea and tactic you meet, as a reference you build while you play.`,
    },
  ],
  faq: [
    {
      q: 'Do I need to install anything?',
      a: 'No. The game runs entirely in your browser. There is nothing to download and no account to create.',
    },
    {
      q: 'Do I need to know how to program?',
      a: 'No. The game teaches all the Lean you need, starting from the very first symbol. If you have programmed before, some of the early ideas about functions will feel familiar.',
    },
    {
      q: 'How much mathematics do I need?',
      a: 'School algebra and a willingness to read carefully. You do not need to have written proofs before; the logic is taught as you go. Sets, functions and induction are each introduced from the start in their own world.',
    },
    {
      q: 'Is my progress saved?',
      a: 'Yes, in your browser on this device. Nothing is sent to a server. To move your progress to another device or keep a backup, use **Export save** on the Profile page, then **Import save** on the other device. Clearing your browser data erases progress that has not been exported.',
    },
    {
      q: 'Can I skip ahead?',
      a: 'Yes. Any world you can reach on the map can be passed by beating its final boss level, which counts the rest of that world as done. After the fifth world you can also choose which branch to take first.',
    },
    {
      q: 'What if I am stuck?',
      a: 'Ask for a hint: each level has a few, from a gentle nudge to almost the answer. Read the goal view and the error explanation, and open the Inventory to see the tools you have. If you still need it, you can reveal a full solution; the level then comes back later for you to solve on your own.',
    },
    {
      q: 'Why does it reject something that looks right?',
      a: 'Lean is exact. `x ∈ A ∩ B` is not the same goal as `x ∈ B ∩ A`, and a misspelled name is an unknown name. Compare your line with the goal view and read the message. The game also accepts only tactics you have already unlocked, unless you turn that off in Profile. And because the game checks a part of Lean, it occasionally rejects something real Lean accepts.',
    },
    {
      q: 'Is it free?',
      a: 'Yes, completely. There are no ads, no payments and no account. The source code is open under the MIT license.',
    },
    {
      q: 'Can I play on a phone?',
      a: 'Yes. The pages work on a phone, and the symbol bar helps you type the symbols. A real keyboard is much more comfortable, though, since most levels involve typing.',
    },
    {
      q: 'Where do I report a problem?',
      a: 'Open an issue on the GitHub repository: https://github.com/polionus/inhabit/issues. Please include the level and the code you typed.',
    },
  ],
  credits: `Inhabit is open source under the MIT license. The source code is at https://github.com/polionus/inhabit.

It is inspired by the Natural Number Game and the other teaching games of the Lean community. The Unicode abbreviations come from the Lean 4 extension for VS Code. Built with Claude (Anthropic).

Lean is the work of its developers and its community. Inhabit is an independent project and is not affiliated with or endorsed by them.`,
};
