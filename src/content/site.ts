import type { AboutCopy, HomeCopy } from './types.ts';

/** Copy for the Home page. Field limits are documented in `types.ts` ("Site copy"). */
export const home: HomeCopy = {
  hero: {
    eyebrow: 'A free browser game for learning Lean 4',
    headline: 'Learn to write proofs a computer can check',
    lede: '**Lean** is a theorem prover: you write a proof, and it checks every step. Across 137 short levels—each with a lesson right beside it—you learn to read Lean, write proofs of your own, and formalize a theorem from scratch. There is also a long-form Guide and an optional Arena when you want more practice.',
    startLabel: 'Start level one',
    continueLabel: 'Continue',
    aboutLabel: 'New to Lean? Read the introduction',
    reassurances: ['Runs in your browser', 'No install, no account', 'Free and open source', 'No programming needed'],
  },

  demo: {
    heading: 'A real Lean proof, one line at a time',
    intro:
      'Step through the proof below. After each line, the panel shows what you know (above the `⊢`) and what you still have to prove (after it).',
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
        note: 'Pick an arbitrary number `x` and assume `x ∈ A ∩ B`, calling that fact `hx`. Now you need to show `x ∈ B ∩ A`.',
      },
      {
        line: 3,
        note: 'Being in `A ∩ B` means being in `A` and in `B`. Split `hx` into those two separate facts, `ha` and `hb`.',
      },
      {
        line: 4,
        note: 'To prove `x ∈ B ∩ A`, you have to prove both halves, so the goal splits into `x ∈ B` and `x ∈ A`.',
      },
      {
        line: 5,
        note: 'The first goal, `x ∈ B`, matches `hb` directly. One goal left.',
      },
      {
        line: 6,
        note: 'The second goal, `x ∈ A`, matches `ha`. Nothing left to prove.',
      },
    ],
    closing:
      "That's a complete proof: every step was checked, and nothing was taken on trust. You'll write proofs like this yourself, starting from much smaller pieces.",
  },

  whatIsLean: {
    heading: 'What is Lean?',
    body: "**Lean** is an open-source programming language and *proof assistant*. You write a mathematical claim and its proof in a precise language, and Lean checks every step mechanically. Whenever a step doesn't follow, Lean tells you right away and shows exactly what's still unproved. Mathematicians use it to verify proofs and build **Mathlib**, a shared library of formalized mathematics. Computer scientists use it to verify software. Even if you just try it out of curiosity, writing for Lean has a way of clarifying your own thinking.",
  },

  outcomes: {
    heading: 'What you will be able to do',
    items: [
      {
        title: 'Read and write Lean',
        body: 'Follow a Lean proof line by line, and write your own with core Lean tactics like `intro`, `obtain`, `constructor`, `rw`, and `induction`.',
      },
      {
        title: 'Prove real mathematics',
        body: "Prove results in logic, sets, functions, natural numbers, and divisibility—from `0 + n = n` by induction all the way to Cantor's theorem.",
      },
      {
        title: 'Formalize your own theorem',
        body: 'Take a claim written in English, choose types for its objects, write any definitions it needs, state it cleanly in Lean, and prove it.',
      },
      {
        title: 'Understand what a proof actually is',
        body: 'Explain why a statement in Lean is a type, why a proof is a program of that type, and what the kernel actually checks.',
      },
    ],
  },

  journey: {
    heading: 'Ten worlds, from first steps to your own theorem',
    intro:
      'Each world focuses on one big idea across 9 to 18 short levels, with a chapter explainer and a short primer to set the scene. After the fifth world the path splits into two tracks—numbers and induction on one side, sets and functions on the other—before meeting at the Formalization Forge, where you state and prove a theorem of your own. If you already know a topic, beat its boss level to skip ahead.',
  },

  method: {
    heading: 'How it feels to learn here',
    items: [
      {
        title: 'Predict before you see',
        body: "Some levels pause right before a tactic runs and ask what the goal will look like next. Guessing first—even if you're wrong—makes the mechanics stick.",
      },
      {
        title: 'Help that meets you where you are',
        body: 'Every level has a lesson beside the editor, plus a coach that reads your live goal and asks what it needs before pointing to a tool.',
      },
      {
        title: 'Errors you can actually read',
        body: "You always see Lean's real error message, so you get used to reading it, with a plain-English translation and a few things to try right underneath.",
      },
      {
        title: 'No timers or penalties in the curriculum',
        body: 'Solved levels come back in short spaced reviews so the ideas stay fresh. Stars, daily quests, and a streak (with one free rest day a week) track progress without punishing you.',
      },
    ],
  },

  audience: {
    heading: 'Who this is for',
    body: "Anyone curious about how a computer can check mathematics—whether you're meeting formal proofs for the first time or you've heard of Lean and want a gentle, hands-on way in. High-school algebra and a willingness to read closely are plenty; no programming experience is expected. If you already write Lean proofs every day, you probably won't find much new here.",
  },

  closing: {
    heading: 'Start with the first goal',
    body: "Level one asks for a single natural number. It takes ten seconds, and every proof in the game follows the exact same idea: give Lean something of the right type.",
    cta: 'Start level one',
  },
};

/** "How a level works" as three parts, shown as numbered steps on the About page. */
export const aboutLevelParts: { name: string; text: string }[] = [
  { name: 'The task', text: "Says what you're proving, in English and in Lean, with a short introduction to the new idea." },
  { name: 'The editor', text: 'Where you write the proof. The statement at the top is fixed; you write below it, replacing `sorry` (Lean\'s "to be filled in" placeholder). Lean checks your code as you type.' },
  { name: 'The goal view', text: 'Shows where your proof stands at the cursor. Facts you can use sit above the `⊢`; what you still need to prove sits after it. When no goals are left, you\'ve solved the level. Errors show up here too, with a plain explanation underneath.' },
];

/** The goal view example for the annotated figure. Display only. */
export const aboutGoalExample = {
  facts: ['A B : Set Nat', 'x : Nat', 'hx : x ∈ A ∩ B'],
  goal: '⊢ x ∈ B ∩ A',
  factsNote: 'Facts you can use',
  goalNote: 'What you need to prove',
};

/** Rows of the typing table on the About page: what you type, what you get, what it means. */
export const aboutSymbols: { typed: string; symbol: string; meaning: string }[] = [
  { typed: '\\to', symbol: '→', meaning: 'implies, function arrow' },
  { typed: '\\and', symbol: '∧', meaning: 'and' },
  { typed: '\\or', symbol: '∨', meaning: 'or' },
  { typed: '\\not', symbol: '¬', meaning: 'not' },
  { typed: '\\forall', symbol: '∀', meaning: 'for all' },
  { typed: '\\ex', symbol: '∃', meaning: 'there exists' },
  { typed: '\\in', symbol: '∈', meaning: 'is an element of' },
  { typed: '\\sub', symbol: '⊆', meaning: 'is a subset of' },
  { typed: '\\inter', symbol: '∩', meaning: 'intersection' },
  { typed: '\\<  \\>', symbol: '⟨ ⟩', meaning: 'angle brackets' },
];

/** Shown under the typing table. Markdown. */
export const aboutSymbolsNote = `If you forget an abbreviation, the symbol bar above the editor has all the common ones—click a symbol to insert it, or hover to see how to type it. Plain-text fallbacks also work for a few symbols, like \`->\` for \`→\`.

These are the same shortcuts used by the Lean 4 extension in VS Code, so the muscle memory transfers straight to real Lean.`;

/** Copy for the About page. */
export const about: AboutCopy = {
  title: 'About Inhabit',
  lede: 'Inhabit is a free browser game that teaches you to write mathematical proofs in Lean 4, a language where a computer checks every single step. No installation and no programming background required.',
  sections: [
    {
      id: 'what-is-lean',
      title: 'What Lean is',
      body: `**Lean** is an open-source programming language and *proof assistant*—a program that checks mathematical proofs. You write a statement and its proof in a precise syntax, and Lean verifies every step against the rules of logic. If even one step has a gap, Lean rejects it and tells you where.

Here's a tiny Lean theorem:

\`\`\`lean
theorem my_add_zero (n : Nat) : n + 0 = n := by
  rfl
\`\`\`

The first line is the claim: for any natural number \`n\`, \`n + 0 = n\`. Everything after \`by\` is the proof. Here it's a single word, \`rfl\`, which tells Lean "both sides simplify to the same thing"—and Lean checks that they really do.

As you write a proof, Lean updates a live view of what's still left to prove, so you're never guessing where you stand.`,
    },
    {
      id: 'why-formalize',
      title: 'Why check proofs by machine',
      body: `Paper proofs are checked by human readers, and humans miss things: a forgotten edge case, or a step brushed off as "obvious" that quietly isn't. When Lean accepts a proof, every step has been verified all the way down to basic logical rules.

That opens up practical possibilities. You can build on someone else's theorem without having to re-check its proof by hand, which is how thousands of contributors collaborate on **Mathlib**, Lean's shared mathematics library. Software engineers use the same machinery to verify critical code.

It also changes how you think. Lean won't accept "clearly" or "similarly", so you find out quickly which parts of an argument you actually understand.

The trade-off is effort: you have to spell out small steps a human reader would glide past, so a three-line paper proof can easily become fifteen lines in Lean.`,
    },
    {
      id: 'what-you-do',
      title: 'What you do in the game',
      body: `Inhabit has 10 worlds and 137 levels. You start with types and functions, then see how statements are types and proofs are programs. From there you work through logic, quantifiers, and equality. Halfway through, the roadmap splits into two tracks—natural numbers, induction, and divisibility on one side; sets and functions, leading up to Cantor's theorem, on the other—before reuniting at the Formalization Forge, where you state and prove a theorem of your own.

The levels come in five flavors:

- **Write a proof**, either step by step with tactics or as a single expression.
- **Arrange shuffled lines** of a proof into working order.
- **Predict** what the goal will look like after a tactic runs.
- **Concept checks**: quick multiple-choice questions with tailored explanations for each wrong answer.
- **Formalize**: turn a plain-English sentence into a Lean statement.

Each world has a chapter explainer, a short primer, and a boss level at the end. You can earn up to three stars per level—the third comes from solving it again later in Review.`,
    },
    {
      id: 'the-name',
      title: 'Why it is called Inhabit',
      body: `In Lean, every expression has a *type*. The number \`7\` has type \`Nat\`, the natural numbers. Mathematical statements are types too, and a proof of a statement is simply a value of that type.

For instance, a proof of "if P then Q" is a function that turns any proof of P into a proof of Q. So proving a statement means building something that lives inside its type. Type theorists call that *inhabiting* the type.

Level one starts right there: it asks for anything of type \`Nat\`, and \`7\` works. A few worlds later the types are mathematical theorems, and the values you build are proofs.`,
    },
    {
      id: 'how-a-level-works',
      title: 'How a level works',
      body: `The **Inventory** shows everything you've unlocked so far: tactics (proof moves), lemmas (already-proved facts), and Codex entries. Clicking any name inserts it into your proof, and the editor also autocompletes unlocked names as you type. Beside the task sits a collapsible **lesson** explaining the idea on a different example. If you get stuck, you can ask the coach to read your live goal for free, reveal hints one at a time, or look at a full solution whenever you want.`,
    },
    {
      id: 'typing-symbols',
      title: 'Typing the symbols',
      body: `Lean uses standard math symbols, and you type them with backslash shortcuts. Type a backslash, a short name, and a space: \`\\to\` plus space turns into \`→\`. Here are the ones you'll use most:`,
    },
    {
      id: 'how-it-teaches',
      title: 'How the game teaches, and why',
      body: `Each level introduces one new thing—a tactic, a concept, or a piece of notation—so you're not juggling three unfamiliar ideas at once.

New skills follow a gradual ramp: first you see a worked example, then you predict what a step does, finish a partially written proof, sort shuffled lines, and finally write proofs from a blank editor. By the time you face a blank page, the move already feels familiar.

Hints start broad and narrow down step by step, and wrong answers explain the specific mix-up behind them. Finished levels come back in spaced review after growing gaps, because retrieving an idea from memory sticks far better than rereading it.

The main curriculum has no timers, no lives, and no streak punishments. Timed play lives only in the optional Arena. Stars, daily quests, and a forgiving streak (one rest day a week doesn't break it) keep track of your progress without nagging.`,
    },
    {
      id: 'is-this-real-lean',
      title: 'Is this real Lean?',
      body: `You're writing real Lean 4 syntax, checked inside your browser by a custom TypeScript engine that implements a faithful subset of Lean.

A few big parts of full Lean are left out on purpose: *type classes* (the machinery that lets \`+\` work on integers, reals, and matrices alike), automation tactics like \`simp\` and \`omega\`, and number types beyond \`Nat\`. Occasionally this engine will reject valid Lean that the full compiler accepts.

What stays faithful is the syntax, the goal view, and the library naming. Every reference solution in the game is also compiled by real Lean 4, so what you learn transfers directly.

When you're ready for the full system, the **Graduate** page walks you through the differences, and **Open in real Lean** in the Sandbox and Workshop opens your code directly at https://live.lean-lang.org.`,
    },
    {
      id: 'the-guide',
      title: 'The Guide',
      body: `Alongside the levels, the **Guide** offers sixteen short articles (around five minutes each) on Lean itself: what it can do, how the type theory and kernel work, practical proof strategies, and how Mathlib and the Lean community fit together. Every code block in the Guide is checked by Lean, and each world links to the articles that go with it.`,
    },
    {
      id: 'the-arena',
      title: 'The Arena',
      body: `The **Arena** is completely optional—and the only part of the site with timers. A deterministic generator builds fresh puzzles on demand:

- **Daily Proof**: the same three puzzles for everyone each UTC day, with a count-up timer and shareable results.
- **Rated puzzles**: endless problems tuned to your Elo-style rating.
- **Proof Rush**: rapid multiple-choice questions on a 3- or 5-minute clock, or Survival (three strikes).
- **Duels**: race a rated bot, connect live to a friend, or send an async challenge link.

Friend games are unrated, and there's no public matchmaking because the site runs without a server. Everything is on the honor system, and every generated proof puzzle is verified by the engine before you see it.`,
    },
    {
      id: 'where-it-leads',
      title: 'Where it leads',
      body: `The **Workshop** walks you through formalizing a theorem of your own in five steps—say it, type it, define it, state it, prove it—with 17 suggested theorems if you want a spark.

The **Sandbox** gives you an open editor with every tactic and lemma unlocked for quick experiments.

The **Graduate** guide helps you move to real Lean 4 and **Mathlib**: browser editor, local install, the automation tactics we held back, library search tools, and a name phrasebook.

Meanwhile, the **Codex** grows into a searchable reference as you unlock ideas, **Review** keeps older skills sharp, and **Profile** tracks your stars, quests, and streak.`,
    },
  ],
  faq: [
    {
      q: 'Do I need to install anything?',
      a: "No. Everything runs right in your browser—nothing to download and no account to make.",
    },
    {
      q: 'Do I need to know how to program?',
      a: "No. The game teaches Lean from the very first symbol. If you've programmed before, some of the early ideas about functions will feel familiar, but you don't need that background.",
    },
    {
      q: 'How much mathematics do I need?',
      a: "High-school algebra and a willingness to read carefully. You don't need prior proof experience—logic, sets, functions, and induction are all built from the ground up in their own worlds.",
    },
    {
      q: 'Is the Arena multiplayer real?',
      a: 'Yes, for playing with friends. In a live duel, the two browsers connect directly peer to peer and race the same puzzles, using a public broker only to introduce them. You can also race a bot or send a friend a challenge link to play on their own time.',
    },
    {
      q: 'Why is there no public matchmaking?',
      a: "Matching strangers requires a server with accounts and ratings, and Inhabit is a static site with no server. Friend duels are unrated, and ratings stay on the honor system.",
    },
    {
      q: 'Are the generated puzzles checked?',
      a: "Yes. Every generated proof puzzle carries a reference proof verified by the browser engine, and samples from every family are compiled by real Lean 4. Difficulty ratings are estimates, so an occasional puzzle may feel easier or harder than its number.",
    },
    {
      q: 'Does anything leave my browser?',
      a: "Almost nothing. There are no accounts, no analytics, and no tracking. Data only leaves your browser during a live friend duel (which connects peer to peer, so your IP address is visible to the other player and the signaling broker—the game warns you first) or when you click **Open in real Lean** to send one snippet to the Lean web editor.",
    },
    {
      q: 'Is my progress saved?',
      a: "Yes, in your browser's local storage on this device. To back it up or move to another device, use **Export save** and **Import save** on the Profile page. Clearing your browser data will wipe progress you haven't exported.",
    },
    {
      q: 'Can I skip ahead?',
      a: "Yes. On any unlocked world, beating its final boss level clears the rest of that world too. After world five, you can also play the numbers track and the sets track in whichever order you prefer.",
    },
    {
      q: "What if I'm stuck?",
      a: "Open the Stuck panel: **Read the goal** explains your current proof state in plain English for free, **Which tool?** points to an unlocked tactic that fits, and there are step-by-step hints underneath. If you'd rather see how it's done, you can always reveal a full solution—the level stays open as studied and comes back later so you can solve it on your own.",
    },
    {
      q: 'Why does Lean reject something that looks right?',
      a: "Lean is literal. `x ∈ A ∩ B` isn't the exact same goal as `x ∈ B ∩ A`, and a typo in a name makes it unknown. Check the goal view and read the error explanation underneath. Also, levels restrict tactics to the ones you've unlocked so far (you can lift that lock in Profile), and because the browser engine covers a subset of Lean, it occasionally rejects valid Lean that the full compiler would accept.",
    },
    {
      q: 'Is it free?',
      a: 'Completely free—no ads, no paywalls, no accounts. The source code is open under the MIT license.',
    },
    {
      q: 'Can I play on a phone?',
      a: 'Yes. Every screen works on mobile, and the symbol bar makes typing symbols doable without shortcuts. Still, a physical keyboard is much more comfortable once you start writing longer proofs.',
    },
    {
      q: 'Where do I report a problem?',
      a: 'Open an issue on GitHub at https://github.com/polionus/inhabit/issues, and include the level name and the code you typed.',
    },
  ],
  credits: `Inhabit is open source under the MIT license: https://github.com/polionus/inhabit.

It's inspired by the Natural Number Game and the Lean community's teaching games. The Unicode abbreviation table comes from the Lean 4 VS Code extension. Built with Claude (Anthropic).

Lean is created by its developers and community. Inhabit is an independent project and isn't affiliated with or endorsed by them.`,
};
