import type { ScreenId, ScreenIntro } from './types.ts';

/** Explanatory header copy for each screen. */
export const screens: Partial<Record<ScreenId, ScreenIntro>> = {
  map: {
    title: 'Map',
    lede: "Your roadmap through all ten worlds. Each chapter builds one core idea of Lean, and you can see what's open, what's ahead, and what you've mastered.",
    about: `Each world starts with a chapter explainer and a short primer, then walks through 9 to 18 focused levels before a boss level pulls earlier skills back in.

After Equality Estuary, the path splits into two tracks—numbers and induction on one side, sets and functions on the other—and both meet at the Formalization Forge. Already know a topic? Beat its boss level to test out of the world.`,
    tips: [
      'Read the chapter explainer or world primer first if you like seeing the big picture before diving in.',
      'Already comfortable with a topic? Beat the boss level of that world to skip the rest.',
      "Stuck on a step? Open the lesson beside the editor or ask the Stuck panel to read your goal.",
    ],
  },

  review: {
    title: 'Review',
    lede: 'Up to five quick cards a day from levels you finished earlier. Solving a proof again after a gap is how it sticks—and how you earn the third star.',
    about: `Finished levels enter a five-box spaced review deck with growing intervals (1, 3, 7, 16, and 35 days). After solving a card, rating it easy, right, or hard tunes when it comes back.

- Sessions are capped at five cards (most overdue first), with an option to do five more.
- Proof levels open from a blank editor so you practice recall, not just recognition.
- Levels where you revealed the solution come back sooner so you can solve them unaided.`,
    tips: [
      'Short, steady sessions beat cramming—ten minutes a few times a week is plenty.',
      "Rate honestly. Marking a shaky level as hard brings it back sooner, which is what you want.",
      "Nothing due today? That's normal—cards return when their gap is up, and nothing piles up against you.",
    ],
  },

  codex: {
    title: 'Codex',
    lede: 'Your personal Lean reference. Every concept, tactic, and symbol you meet gets added here with a plain explanation and a short example.',
    about: `Entries unlock as you reach the levels that introduce them, so the Codex grows alongside your skills without spoiling what's ahead.

Use search to look up any tactic or idea, and follow the links between entries to see what a concept rests on.`,
    tips: [
      'Search for any half-remembered word, like "unfold" or "induction".',
      'Not sure how a tactic works? Its entry has a minimal example and explains when to reach for it.',
      'Follow the cross-links between entries to trace an idea back to its foundations.',
    ],
  },

  sandbox: {
    title: 'Sandbox',
    lede: 'An open editor with every tactic and lemma unlocked. Try out ideas freely—nothing here is graded or saved to your progress.',
    about: `Write any Lean the game's engine understands and watch the live goal view update as you type.

- \`#check expr\` prints an expression's type—the fastest way to see what a lemma or function expects.
- \`#eval expr\` computes a value, like running a function on a number.
- **Open in real Lean** sends your code to live.lean-lang.org with full Lean 4, automation, and Mathlib.`,
    tips: [
      'Try `#check Nat.add_comm` to inspect a lemma statement without proving anything.',
      'Paste a proof from a level and tweak it to see which lines are actually doing the work.',
      "The browser engine covers a subset of Lean—if something doesn't check here, real Lean may still accept it.",
    ],
  },

  workshop: {
    title: 'Workshop',
    lede: 'Formalize a theorem of your own in five steps—from a careful English sentence to a Lean proof checked in your browser.',
    about: `The Workshop breaks formalizing into five concrete steps:

1. **Say it** in careful English, marking every "for all", "there exists", and "if".
2. **Type it** by giving every object a Lean type.
3. **Define it** with a \`def\` for any concept not already in the library.
4. **State it** as a Lean proposition and read it back to make sure it matches your English.
5. **Prove it**, sketching a skeleton first with \`sorry\` if it's long.

Need a starting point? Browse the 17 suggested theorem ideas. Everything you save stays on this device.`,
    tips: [
      'Start small. A modest theorem you finish beats an ambitious one you abandon.',
      "Always read your Lean statement back in English before proving it—Lean will gladly let you prove the wrong claim.",
      'Stuck in the middle? Sketch the plan with `have … := by sorry`, then fill in one hole at a time.',
    ],
  },

  graduate: {
    title: 'Graduate',
    lede: 'Ready for real Lean 4 and Mathlib? Everything you need to make the jump: browser editor, local setup, automation tactics, and library search.',
    about: `Because this game teaches real Lean 4 syntax and follows Lean's naming conventions, almost everything you've practiced carries straight over.

This guide covers what's new outside the game: how to try real Lean with zero install or set up VS Code, the automation tactics we withheld (\`simp\`, \`omega\`, \`ring\`, and friends), how to search Mathlib, and a phrasebook mapping game names to their Mathlib counterparts.`,
    tips: [
      'Try **Open in real Lean** from the Sandbox first—it needs no setup at all.',
      "Search Mathlib before proving or defining anything; there's a good chance it already exists.",
      'If a game proof fails in real Lean, check the phrasebook—it is usually just a slightly different lemma name.',
    ],
  },

  profile: {
    title: 'Profile',
    lede: 'Your rank, stars, quests, streak, badges, and settings. Everything is stored locally in your browser.',
    about: `Here's how progress works:

- **Stars**: 1 for solving with hints, 2 for solving cleanly on your own, and 3 once you re-solve the level in Review. Revealing a solution leaves the level open as *studied* with no star until you solve it yourself.
- **Player level & quests**: XP comes from solving levels, reviews, and practice. Three daily quests refresh each day, and unfinished ones simply expire.
- **Streak**: Counts active days and forgives one rest day a week.
- **Settings & saves**: Lift the tactic lock, mute sound, or export your save as a JSON file to back it up or move devices.`,
    tips: [
      'Export your save occasionally—clearing browser data erases unbacked-up progress.',
      'Want full freedom? Turn off the tactic lock in Settings to use any tactic on any level.',
      "Missed a day? Nothing scolds you—just pick back up whenever you're ready.",
    ],
  },

  guide: {
    title: 'Guide',
    lede: 'Sixteen short articles on Lean itself: what it can do, the type theory underneath, how to plan proofs, and the ecosystem around it.',
    about: `The Guide is organized into four sections—read them in any order:

- **Lean**: what Lean is, a tour of its capabilities, and how to read theorems and goal views.
- **Theory**: types, propositions as types, dependent types, induction, equality, and the trusted kernel.
- **Practice**: how to attack a proof, translating English into Lean, and programming in Lean.
- **Ecosystem**: Mathlib, the community, and real-world uses of Lean.

Every code snippet is compiled by Lean, and each world links directly to the articles that back it up.`,
    tips: [
      'Brand new to Lean? Start with "What Lean is", then skim the capability tour.',
      'Want deeper context on a world? Check the Guide articles linked from its chapter page.',
      'All Lean snippets here are real checked code—feel free to paste them into the Sandbox and tinker.',
    ],
  },

  arena: {
    title: 'Arena',
    lede: 'Optional generated puzzles for extra play: a Daily Proof, rated puzzles, timed Proof Rush, and duels. Nothing here is timed unless you choose a timed mode.',
    about: `The main campaign is finite; the Arena keeps going. A deterministic generator creates fresh puzzles from seeds, so sharing a link gives a friend the exact same set.

Every generated proof puzzle is verified by the browser engine (with samples also checked in real Lean) and carries an estimated rating from 400 to 1900. Arena play earns XP and counts toward quests, with no account or server—results are on the honor system, and nothing leaves your browser except during a live friend duel.`,
    tips: [
      'Try the Daily Proof first—everyone gets the same three puzzles each day.',
      'Rated puzzles adapt to your level, so a miss just helps calibrate your rating.',
      'The Arena is completely optional; skipping it never holds you back on the roadmap.',
    ],
  },

  'arena-daily': {
    title: 'Daily Proof',
    lede: 'Three puzzles of rising difficulty—the same set for everyone each UTC day. The timer counts up, and nothing ever times out.',
    about: `Every UTC calendar day generates one shared set of three puzzles so you and a friend can compare solutions on the exact same problems.

Take as long as you like—the clock just records your time. When you finish, you get a shareable text summary with the date, your marks, your time, and a link. Because there's no server, results are on the honor system.`,
    tips: [
      'The daily set rolls over at midnight UTC, which may not line up with your local midnight.',
      'Work through them in order—puzzle one is a warm-up and puzzle three is the stretch.',
      'Share your result text so a friend can open the same set from the link.',
    ],
  },

  'arena-puzzles': {
    title: 'Rated puzzles',
    lede: 'An endless stream of generated puzzles near your current rating. Solving pushes your rating up; a miss or skip nudges it down.',
    about: `Your rating starts at 800 and updates Elo-style: solving a tough puzzle moves it more than an easy one, while skipping or revealing a solution lowers it.

Puzzles span logic, term writing, quantifiers, and sets, each verified with a reference proof. Ratings are automated difficulty estimates, so an occasional puzzle may feel harder or easier than its number. Your rating and history live in your browser and export with your save.`,
    tips: [
      'Skipping counts the same as a miss—if a puzzle has you completely stuck, skip it and keep moving.',
      'Each puzzle lists the tactics it allows right in the task panel.',
      "If an unfamiliar tactic name pops up, check it in the Codex.",
    ],
  },

  'arena-rush': {
    title: 'Proof Rush',
    lede: 'Fast multiple-choice questions on a 3- or 5-minute clock, or Survival until three strikes. Built for sharpening your eye for goals and tactics.',
    about: `Pick a 3-minute sprint, a 5-minute run, or Survival (no clock, three strikes and you're out). Each question asks you to spot the right tactic, read a goal state, or judge a short statement as difficulty climbs.

In timed modes, a wrong guess costs ten seconds. Your personal bests are saved locally. Rush is optional and works best once the core tactics already feel familiar from the campaign.`,
    tips: [
      'Pause half a second to read the goal carefully—a wrong guess costs way more than a glance.',
      'Try Survival first if you want to focus on accuracy without watching a clock.',
      "Rush rewards pattern recognition you build in the main worlds and Review.",
    ],
  },

  'arena-duel': {
    title: 'Duel',
    lede: 'Race the same seeded set of puzzles against a bot, a friend live, or a friend by challenge link. Friend matches are unrated.',
    about: `In a duel, two players race through the same puzzles:

- **Bots**: an always-ready ladder of rated bots (always clearly labeled), whose solve times scale with their rating.
- **Live friend duel**: one player shares a room link and the two browsers connect directly peer to peer. Because it's peer to peer, both players and the signaling broker can see each other's IP address—the game reminds you before connecting.
- **Challenge link**: play first, send the link, and your friend races your time whenever they're free.`,
    tips: [
      'Bots are always online—pick one close to your Arena rating for a tight race.',
      "Live duels require both players online at the same time; use a challenge link if your schedules don't overlap.",
      'Only share a live room link with people you trust, since peer-to-peer connections expose your IP address.',
    ],
  },
};
