import type { ScreenId, ScreenIntro } from './types.ts';

/** Explanatory header copy for each screen. */
export const screens: Partial<Record<ScreenId, ScreenIntro>> = {
  map: {
    title: 'Map',
    lede: 'The ten worlds of the game and the paths between them. Each world teaches one big idea of Lean, and the map shows where you are, what is open and what you have finished.',
    about:
      'Each world has a primer that tells the story of its idea, then a run of short levels, each adding one new thing, and a boss level at the end that mixes in tools from earlier worlds. After the fifth world the map branches: numbers and induction on one side, sets and functions on the other, and both lead to the last world. You can pass a world you already know by beating its boss. Stars on each level show how cleanly you solved it, and the totals appear here.',
    tips: [
      'Open a world page first: its primer explains the idea before the levels ask you to use it.',
      'Already know a topic? Beat the boss level of that world to pass the rest.',
      'Every level has a lesson beside the task. Read it when a step does not make sense.',
    ],
  },

  review: {
    title: 'Review',
    lede: 'Short sessions that bring back levels you solved earlier. Solving something again after a gap is how it stays with you, so this is where the third star is earned.',
    about:
      'Every level you complete enters a deck with five boxes. A level you solve again moves up a box and returns after a longer gap: 1, 3, 7, 16 and then 35 days. After a solve you can rate it easy, right or hard, which adjusts the first gap. Sessions mix levels from different worlds, and proof levels start from a blank editor, so you recall the proof rather than recognize it. The third star of a level is earned by solving it again here at least once.',
    tips: [
      'Short and regular beats long and rare: ten minutes a few times a week is plenty.',
      'Rate honestly. Choosing hard brings a level back sooner, which is what you want for shaky ones.',
      'An empty queue is fine. Levels return when their gap has passed.',
    ],
  },

  codex: {
    title: 'Codex',
    lede: 'Your personal reference. Each idea, tactic and piece of notation you meet in a level is added here, with an explanation and an example you can read again at any time.',
    about:
      'Entries unlock as you play, at the level that teaches them, so the Codex grows with you and never shows what you have not met. Each entry defines a term in plain words and gives a short example. Entries cover concepts, such as what a type or an inductive definition is, and tactics, such as `intro` and `rw`. You can search them, and links between entries let you follow an idea back to what it depends on.',
    tips: [
      'Use the search box for a word you half remember, such as "unfold" or "induction".',
      'Stuck on a tactic? Its entry shows a short example and says when to use it.',
      'Entries link to each other. Follow the links to see what an idea rests on.',
    ],
  },

  sandbox: {
    title: 'Sandbox',
    lede: 'A free editor with every tactic and lemma unlocked, for experiments. Nothing here is graded and nothing is saved to your progress.',
    about:
      'Type any Lean the game understands and see the goal view and the messages at once. The command `#check` prints the type of an expression, which is the quickest way to learn what a name means. The command `#eval` runs an expression and prints its value, for example a small function applied to a number. Use the sandbox to test a guess before you try it in a level, or to explore an idea of your own. The button **Open in real Lean** sends your code to the Lean web editor at live.lean-lang.org, where the full system, including automation and Mathlib, is available.',
    tips: [
      'Try `#check Nat.add_comm` to see a statement without proving it.',
      'Copy a proof from a level and change it to see which parts matter.',
      'The game checks a subset of Lean. If something fails here, real Lean may still accept it.',
    ],
  },

  workshop: {
    title: 'Workshop',
    lede: 'Where you formalize a theorem of your own. Five steps take you from a sentence in English to a statement that Lean accepts and a proof that Lean checks.',
    about:
      'Formalizing is a craft, and the Workshop splits it into five steps. First, say it: write the claim in careful English and mark every "for all", "there exists" and "if". Second, type it: give each object a type. Third, define it: write a definition for any notion the library lacks. Fourth, state it: write the theorem with `sorry` as its proof and check that it reads back correctly. Fifth, prove it, skeleton first. If you need an idea, the Workshop suggests starting points. Your theorems are saved on this device.',
    tips: [
      'Start with a small statement you can finish. A modest theorem proved is better than an ambitious one abandoned.',
      'Read your statement back in English before you prove anything. A wrong statement can still be proved.',
      'Stuck on a proof? Write the steps as `have` lines with `sorry`, then fill them one at a time.',
    ],
  },

  graduate: {
    title: 'Graduate',
    lede: 'The step from this game to real Lean 4 and Mathlib: how to try it, install it, use the automation the game held back, and find the theorems you need.',
    about:
      'The game teaches a subset of Lean 4, with the same syntax, names and statements as the real thing, so what you learned carries over. This guide covers what changes. It shows how to open real Lean in your browser or install it, which automation tactics the game withheld and when to use each, how to search the library by name, by pattern and in plain English, and the differences you will notice in Mathlib. A phrasebook maps the names used here to Mathlib names, and a closing section lists books and communities to read and join next.',
    tips: [
      'Try Open in real Lean from the Sandbox first. It needs no install.',
      'Search the library before you prove or define anything. It is often already there.',
      'Use the phrasebook when a game proof fails in real Lean. It is usually a renamed lemma.',
    ],
  },

  profile: {
    title: 'Profile',
    lede: 'Your progress, rank, stars, daily quests, streak and badges, and the settings for the game. Everything here is stored in your browser on this device.',
    about:
      'Your player level comes from the experience you earn by solving levels, reviewing and reading, and it never goes down. Stars show how cleanly you solved each level. Each day brings three quests, such as solving two levels or reading a Guide article, and any you leave unfinished simply expire. Your streak counts active days and forgives one rest day a week. Badges mark milestones. Settings let you lift the tactic lock and mute sound. **Export save** writes your progress to a file you can import on another device, and nothing is sent to a server.',
    tips: [
      'Export your save now and then. Clearing browser data erases progress that has not been exported.',
      'Turn off the tactic lock in the settings if you want to use any tactic in any level.',
      'A missed day is not announced as a loss. Come back whenever you like.',
    ],
  },

  guide: {
    title: 'Guide',
    lede: 'Long-form reading about Lean itself: what it is and can do, the ideas underneath, how to work in it, and the community around it. You can read it in any order.',
    about:
      'The levels teach by doing, and the Guide explains. Its sixteen articles are in four sections. Lean covers what the system is, what it can do and how to read what it shows you. Theory covers types, propositions as types, dependent types, induction, equality and the kernel that makes proofs trustworthy. Practice covers how to attack a proof, how to turn English into a statement, and Lean as a programming language. Ecosystem covers Mathlib, the community and what Lean is used for. Articles link to the worlds they support, and the worlds link back.',
    tips: [
      'New to Lean? Start with the first article, then the tour of what Lean can do.',
      'Stuck on a level? Look for the article linked from its world page.',
      'Code in the articles is checked against real Lean, so you can paste it into the Sandbox.',
    ],
  },

  arena: {
    title: 'Arena',
    lede: 'Optional play on generated puzzles: a daily proof, rated puzzles, timed rushes and duels. The curriculum has no timers, and neither does anything here unless you choose a timed mode.',
    about:
      'The levels are finite, and the Arena is not. A generator makes puzzles on demand, and the same seed always gives the same puzzle, so a link can carry one to a friend. Every generated proof puzzle comes with a reference proof that the engine accepts, and samples are also compiled in real Lean. Puzzles have ratings from about 400 to 1900. Arena play earns experience and advances quests like everything else, and it needs no account or server, so results are on the honour system. Nothing leaves your browser except during a live duel.',
    tips: [
      'Start with the Daily Proof. It is the same three puzzles for everyone that day.',
      'Rated puzzles adapt to you, so a miss is information, not a punishment.',
      'The Arena is optional. Skipping it costs you nothing in the curriculum.',
    ],
  },

  'arena-daily': {
    title: 'Daily Proof',
    lede: 'Three puzzles of rising difficulty, the same for everyone each day. A clock counts up while you work, but nothing times out.',
    about:
      'Each calendar day, in UTC, has one fixed set of three puzzles with rising ratings, so you and a friend can compare notes on the same problems. The clock only measures: you can take as long as you like. When you finish you get a result you can share as text, with the date, a mark for each puzzle, your time and a link. Finishing the Daily Proof advances your daily quest and your daily streak. Because there is no server, times and results are on the honour system, so treat the comparison as friendly.',
    tips: [
      'The day changes at midnight UTC, which may not be midnight where you are.',
      'Do the easiest puzzle first to warm up. They rise in difficulty.',
      'Share your result as text. A friend can open the same puzzles from the link.',
    ],
  },

  'arena-puzzles': {
    title: 'Rated puzzles',
    lede: 'An endless run of generated puzzles, one at a time, chosen near your current rating. Solving raises your rating and a miss or a skip lowers it.',
    about:
      'Your Arena rating starts at 800 and moves in the Elo style: solving a puzzle that is hard for you raises it by more than solving an easy one, and a miss or a skip lowers it. Puzzles come from several families, covering logic, inhabiting types, quantifiers and sets, and each has a reference proof that the engine accepts. The rating is only an estimate of difficulty, so a puzzle may feel easier or harder than its number. Your rating and history are stored in your browser and are included when you export your save.',
    tips: [
      'Skipping is allowed, but it lowers your rating like a miss. Skip when you are stuck, then move on.',
      'A puzzle may allow only some tactics. The task lists which.',
      'Use the Codex if a tactic name is unfamiliar.',
    ],
  },

  'arena-rush': {
    title: 'Proof Rush',
    lede: 'Quick puzzles against the clock, or until three strikes. A way to practice speed and fluency with short proofs, with personal bests to beat.',
    about:
      'Rush has two forms. In the timed form you have 3 or 5 minutes to solve as many puzzles as you can. In Survival you keep going until you have made three strikes. Most puzzles are quick items with short proofs, mixed with a few slightly longer ones, and the rating of the puzzles rises as you go. Your best score in each form is kept. Rush is the one place besides duels where a timer matters, and it is optional. It rewards recognizing common shapes quickly, which comes from the levels and from Review.',
    tips: [
      'Read the goal aloud before typing. A wrong guess costs more time than a pause.',
      'Survival ends on three strikes, so accuracy matters more than speed there. Try it before the timed form.',
      'Practice the levels and Review first. Rush rewards patterns you already know.',
    ],
  },

  'arena-duel': {
    title: 'Duel',
    lede: 'Race another player on the same set of puzzles: a bot, a friend live, or a friend through a challenge link. Friend games are unrated, and there is no public matchmaking.',
    about:
      'A duel is a race on the same seeded puzzles. Bots form a ladder of named players with ratings, each labeled as a bot, and each finishes a puzzle at a random time drawn from its rating against the puzzle\'s. To play a friend live, one of you shares a room link and the two browsers connect directly, peer to peer. That means each side\'s IP address is visible to the other and to the signalling service that introduces you, and the game says so before connecting. If no connection forms, a challenge link works instead: it carries the seed and your result, and your friend plays whenever they like.',
    tips: [
      'Bots are always available and labeled. Pick one near your rating.',
      'Live duels need both players online at once. Use a challenge link otherwise.',
      'Only share a room link with people you trust. Connecting reveals your IP address to them.',
    ],
  },
};
