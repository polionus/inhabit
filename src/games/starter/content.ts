import type {
  BuiltInChoiceLevel,
  BuiltInOrderLevel,
  BuiltInTextLevel,
  TemplateAboutCopy,
  TemplateChapter,
  TemplateChapterMeta,
  TemplateCodexEntry,
  TemplateGuideArticle,
  TemplateGuideMeta,
  TemplateGuideSection,
  TemplateHomeCopy,
  TemplateLesson,
  TemplateScreenIntro,
  TemplateWorld,
  TemplateWorldLessons,
} from '../../template/types.ts';
import type { PatternLevel } from './PatternLevel.tsx';

export type StarterLevel =
  | BuiltInChoiceLevel
  | BuiltInOrderLevel
  | BuiltInTextLevel
  | PatternLevel;

export interface StarterWorld extends TemplateWorld {
  levels: StarterLevel[];
}

export const starterWorlds: StarterWorld[] = [
  {
    id: 'literals',
    title: 'Literals & Anchors',
    tagline: 'Match exact text, boundaries, and case sensitivity.',
    intro:
      'Every regular expression begins with plain characters. Learn how patterns search anywhere in a line until you pin them with anchors.',
    requires: [],
    bigIdea: 'Most characters in a regex stand for themselves; special anchors pin where a match can begin or end.',
    glyph: '^$',
    hue: 18,
    codex: [
      {
        id: 'literal',
        kind: 'concept',
        name: 'Literal characters',
        summary: 'Ordinary letters and digits match themselves character for character.',
        body: 'Unless a character has special regex meaning (`^`, `$`, `.`, `*`, etc.), typing it matches that exact glyph. Case matters by default.',
        example: 'cat',
      },
      {
        id: 'anchor-caret',
        kind: 'metachar',
        name: '^  Start anchor',
        summary: 'Pins the match to the very start of the string (or line with `m`).',
        body: 'Placing `^` at the beginning forces a pattern to start at index 0 rather than sliding rightward inside the text.',
        example: '^GET ',
      },
      {
        id: 'anchor-dollar',
        kind: 'metachar',
        name: '$  End anchor',
        summary: 'Pins the match to the very end of the string.',
        body: 'Combine `^` and `$` around a pattern when you want the *entire* input string to conform to the shape.',
        example: '^ok$',
      },
    ],
    levels: [
      {
        id: 'lit-01',
        kind: 'choice',
        title: 'First literal match',
        intro: 'Decide which candidate string matches the simple pattern `cat` (with substring matching, no flags).',
        outro: 'Substring search finds `cat` wherever those three letters appear consecutively—even inside a longer word.',
        unlocks: { codex: ['literal'] },
        question: 'Which string **matches** the pattern `/cat/`?',
        code: '/cat/',
        codeLang: 'regex',
        options: [
          { text: '`scatter`', correct: true, feedback: 'Yes! `cat` appears starting at index 1 inside `scatter`.' },
          { text: '`CAT`', feedback: 'Without the `i` (case-insensitive) flag, lowercase `c` does not match uppercase `C`.' },
          { text: '`c a t`', feedback: 'Spaces count as characters too, so `c`, ` `, `a` does not match `cat`.' },
          { text: '`act`', feedback: 'Regex matches letters in the exact sequence given: `c`, then `a`, then `t`.' },
        ],
      },
      {
        id: 'lit-02',
        kind: 'text',
        title: 'Pin to the start',
        intro: 'Use the start-of-string anchor so the match cannot appear in the middle of a line.',
        outro: '`^` does not consume a character—it checks a *position* right before the first character.',
        unlocks: { codex: ['anchor-caret'] },
        prompt: 'Write a pattern that matches strings **starting with** `ERR` (and would reject `NO_ERR`).',
        placeholder: '^...',
        starter: '',
        accept: ['^ERR'],
        mistakes: [
          { match: 'ERR', feedback: 'Unanchored `ERR` also matches `NO_ERR` in substring mode. Pin the start!' },
          { match: '/^ERR/', feedback: 'Enter only the pattern body without surrounding `/` slashes.' },
        ],
        wrongFeedback: 'Start with `^` followed by the literal uppercase letters `ERR`.',
        hints: [{ text: 'The start-of-string anchor is the caret `^`.' }, { text: 'Write `^ERR`.' }],
      },
      {
        id: 'lit-03',
        kind: 'order',
        title: 'Assemble an anchored line',
        intro: 'Arrange the tokens from pool into a complete pattern that matches **only** the exact string `status: ok`.',
        outro: 'Anchoring both ends turns a substring finder into an exact whole-string validator.',
        unlocks: { codex: ['anchor-dollar'] },
        prompt: 'Build the regex that matches `"status: ok"` cleanly from start to end.',
        lines: ['^', 'status:', ' ', 'ok', '$'],
        distractors: ['.*', 'status'],
        codeLang: 'regex',
        hints: [
          { text: 'Every anchored whole-string pattern begins with `^` and ends with `$`.' },
          { text: 'Include the single space between `status:` and `ok`.' },
        ],
      },
      {
        id: 'lit-04',
        kind: 'pattern',
        title: 'Boss: Strict log prefix',
        boss: true,
        intro: 'Put anchors together in the live matcher: accept only lines ending with `_DONE` after a single uppercase tag `TASK`.',
        outro: 'With `^` and `$`, stray prefixes and trailing junk both fail automatically.',
        prompt: 'Match strings that begin with `WARN:` or match the exact tag `WARN:0`? Keep it focused: match ONLY strings starting with `WARN:` and ending with `;` (e.g. for 1 char or exact literal? Let us match exact `"PING"` anchored or `"WARN: " + "OK"`). Match strings that are **literally** `OK:done` (or test your own anchored literal ending with `:ok` — actually match ONLY strings starting with `ID:` and ending nowhere? Wait: keep positive/negative clear: match strings starting with `TAG:` and... let learners solve cleanly with literals & anchors: accept `"HEAD"`? Better: use `[`? Not yet taught!). Match `"v1.0"` escaped? Let us match exact `"http://"` prefix -> `^http://` matches all `http://...` URLs and rejects `not-http://` and `https://`!',
        positive: ['http://example.com', 'http://localhost'],
        negative: ['not-http://bad', 'https://secure.test', 'ftp://files'],
        starter: '',
        solutions: ['^http://'],
        hints: [
          { text: 'Rejecting `not-http://bad` means you must anchor the start.' },
          { text: 'In JavaScript regex `/` does not need escaping when passed to `new RegExp`.' },
        ],
      },
    ],
  },
  {
    id: 'classes',
    title: 'Classes & Quantifiers',
    tagline: 'Sets of characters and how many times they repeat.',
    intro:
      'Literals match one fixed character at a time. Character classes let a single slot accept a range of symbols, and quantifiers let patterns stretch.',
    requires: ['literals'],
    bigIdea: 'Square brackets `[...]` choose one character from a set; quantifiers (`+`, `*`, `{n}`) repeat the piece just before them.',
    glyph: '[+]',
    hue: 38,
    codex: [
      {
        id: 'char-class',
        kind: 'syntax',
        name: '[...]  Character class',
        summary: 'Matches a single character belonging to the listed set or range.',
        body: 'Inside brackets, `[0-9]` matches any ASCII digit and `[a-z]` matches any lowercase ASCII letter. One bracket group still matches only **one** character.',
        example: '[a-z][0-9]',
      },
      {
        id: 'shorthand-digit',
        kind: 'metachar',
        name: '\\d  Digit shorthand',
        summary: 'Matches any single decimal digit (equivalent to `[0-9]` in ASCII).',
        body: 'Pairs nicely with quantifiers: `\\d+` matches integers of one or more digits, while `\\d{4}` matches exactly four digits.',
        example: '\\d{4}',
      },
      {
        id: 'quantifier-plus',
        kind: 'syntax',
        name: '+  One or more',
        summary: 'Requires the preceding atom to appear at least once.',
        body: 'Unlike `*` (zero or more), `+` guarantees the character or group cannot be omitted.',
        example: '[a-z]+',
      },
    ],
    levels: [
      {
        id: 'cls-01',
        kind: 'choice',
        title: 'How wide is a class?',
        intro: 'Check how many characters a single bracket expression consumes.',
        outro: 'No matter how many options sit inside `[abcxyz]`, the bracket itself always matches just one character.',
        unlocks: { codex: ['char-class'] },
        question: 'Which string is **fully** matched by `^[0-9][a-z]$`?',
        code: '^[0-9][a-z]$',
        codeLang: 'regex',
        options: [
          { text: '`7k`', correct: true, feedback: 'Exactly one digit followed by one lowercase letter.' },
          { text: '`12a`', feedback: 'Two digits before `a`, so one `[0-9]` cannot cover `12` from `^` to `$`.' },
          { text: '`a7`', feedback: 'Order matters: `[0-9]` must come before `[a-z]`.' },
          { text: '`7K`', feedback: 'Uppercase `K` is outside the range `[a-z]`.' },
        ],
      },
      {
        id: 'cls-02',
        kind: 'text',
        title: 'Digits with \\d',
        intro: 'Replace `[0-9]` with its shorter shorthand and a quantifier.',
        outro: '`\\d+` is one of the workhorses of text parsing.',
        unlocks: { codex: ['shorthand-digit', 'quantifier-plus'] },
        prompt: 'Write an anchored whole-string pattern that matches **one or more digits** (e.g. `5`, `42`, `007`).',
        starter: '',
        accept: ['^\\d+$', '^[0-9]+$'],
        mistakes: [
          { match: '\\d+', feedback: 'Add `^` and `$` so non-digit surroundings cannot slip past.' },
          { match: '^\\d*$', feedback: 'Careful: `*` allows the empty string `""`! Use `+` for one or more.' },
        ],
        hints: [{ text: 'Wrap `\\d+` in start and end anchors.' }],
      },
      {
        id: 'cls-03',
        kind: 'order',
        title: 'Hex color pieces',
        intro: 'Put together a six-character lowercase hex color tag.',
        outro: '`{n}` repeats its preceding atom cleanly without writing the bracket six times.',
        prompt: 'Order the pieces to match `#ffffff` or `#09a4f1` from start to end.',
        lines: ['^', '#', '[0-9a-f]', '{6}', '$'],
        distractors: ['[a-z]', '+'],
        codeLang: 'regex',
        hints: [
          { text: 'Start with `^` and `#`, then the allowed hex class `[0-9a-f]`, then its repetition count `{6}`.' },
        ],
      },
      {
        id: 'cls-04',
        kind: 'pattern',
        title: 'Boss: Course codes',
        boss: true,
        intro: 'Combine everything so far: write an anchored whole-string pattern for course IDs like `CS-101` or `MATH-240`.',
        outro: 'You just built a multi-part validator from anchors, character classes, and repetition counts.',
        prompt: 'Match 2 to 4 uppercase ASCII letters, a hyphen `-`, and 3 digits (whole string).',
        anchorFull: true,
        positive: ['CS-101', 'MATH-240', 'BIO-115'],
        negative: ['C-101', 'CS101', 'cs-101', 'MATHS-240', 'CS-99'],
        starter: '',
        solutions: ['[A-Z]{2,4}-\\d{3}', '[A-Z]{2,4}-[0-9]{3}'],
        hints: [
          { text: 'Uppercase range with quantifier: `[A-Z]{2,4}`.' },
          { text: 'Follow `-` with `\\d{3}`.' },
        ],
      },
    ],
  },
];

// Clean up prompt of lit-04 so learners see crisp instruction
starterWorlds[0].levels[3] = {
  id: 'lit-04',
  kind: 'pattern',
  title: 'Boss: Protocol prefix',
  boss: true,
  intro: 'Combine anchors with literal characters inside the live test harness.',
  outro: 'With `^`, unencrypted prefixes or mid-string matches are rejected cleanly.',
  prompt: 'Match every `http://` URL (and reject `https://`, `ftp://`, or mid-string `not-http://`).',
  positive: ['http://example.com', 'http://localhost'],
  negative: ['not-http://bad', 'https://secure.test', 'ftp://files'],
  starter: '',
  solutions: ['^http://'],
  hints: [
    { text: 'Rejecting `not-http://bad` means the pattern must be anchored at the start with `^`.' },
    { text: 'Type `^http://` directly—slashes do not need escaping here.' },
  ],
};

export const starterChaptersMeta: TemplateChapterMeta[] = [
  { worldId: 'literals', title: 'Matching what you type: literals and anchors', minutes: 2 },
  { worldId: 'classes', title: 'Character sets and counting matches cleanly', minutes: 3 },
];

export const starterChapters: TemplateChapter[] = [
  {
    worldId: 'literals',
    title: 'Matching what you type: literals and anchors',
    dek: 'How regex scans left to right, and why anchors stop a pattern from wandering.',
    guide: ['reading-regex'],
    body: `## Scanning across the line

By default, a regular expression tries to match starting at index 0; if that fails, it tries index 1, index 2, and so on. That is why \`/cat/\` matches inside \`"scatter"\`.

## Pinning boundaries

Placing \`^\` before a pattern requires the match to begin at index 0. Adding \`$\` at the end requires it to finish at the end of the string. Notice they match *zero characters*—they check position rather than text.`,
  },
  {
    worldId: 'classes',
    title: 'Character sets and counting matches cleanly',
    dek: 'Express families of valid strings with brackets and repetition operators.',
    guide: ['classes-quantifiers'],
    body: `## One character from a menu

A bracket expression like \`[0-9a-f]\` matches a **single character** belonging to any listed character or range.

## Counting repetitions

Attach \`+\` (one or more), \`*\` (zero or more), or \`{min,max}\` right after an atom to repeat it without duplicating text.`,
  },
];

export const starterGuideSections: TemplateGuideSection[] = [
  { id: 'basics', title: 'Core Mental Model', blurb: 'How regex engines inspect strings and positions.' },
];

export const starterGuideMeta: TemplateGuideMeta[] = [
  {
    id: 'reading-regex',
    section: 'basics',
    title: 'How a regex reads a string',
    summary: 'Atoms vs position assertions, and why anchors matter.',
    minutes: 2,
  },
  {
    id: 'classes-quantifiers',
    section: 'basics',
    title: 'Sets and quantifiers',
    summary: 'Choosing single characters cleanly and repeating them safely.',
    minutes: 3,
  },
];

export const starterGuideArticles: TemplateGuideArticle[] = [
  {
    ...starterGuideMeta[0],
    worlds: ['literals'],
    next: ['classes-quantifiers'],
    body: `## Left to right, character by character

Think of a regular expression as a tiny state cursor stepping across your input string. Ordinary characters advance both the cursor in the pattern and the cursor in the input string.

## Zero-width anchors

Assertions like \`^\` and \`$\` do not consume any letters—they check *where* the cursor stands.`,
  },
  {
    ...starterGuideMeta[1],
    worlds: ['classes'],
    body: `## Brackets are a single slot

A common beginner bug is reading \`[abc]\` as matching the word \`"abc"\`. In reality, brackets form a choice over *one* character: \`"a"\`, \`"b"\`, or \`"c"\`.

## Repetition binds tightly

\`ab+\` repeats **only** \`b\`. Wrap sub-patterns in parentheses \`(ab)+\` if you want to repeat the pair.`,
  },
];

export const starterLessons: Record<string, TemplateLesson> = {
  'lit-01': {
    body: 'A plain sequence like `cat` walks the string left to right looking for `c`, then `a`, then `t`. Unless anchored, any matching substring makes the test pass.',
    pitfall: 'Uppercase and lowercase letters have different character codes (`c` ≠ `C`).',
  },
  'lit-02': {
    body: 'Prefixing `^` anchors a pattern to index `0`, so `ERR_DISK` passes while `NO_ERR` fails.',
    extraCallout: {
      label: 'Multiline note',
      icon: 'bulb',
      body: 'Without the `m` flag, `^` checks only the very start of the whole string.',
    },
  },
  'lit-03': {
    body: 'Pair `^` and `$` whenever you want an exact format validator rather than a substring search.',
  },
  'lit-04': {
    body: 'URL schemes sit at the front of the string. Use `^` so fake substrings later in the string cannot satisfy the pattern.',
  },
  'cls-01': {
    body: 'Two adjacent classes `[0-9][a-z]` match two characters in sequence: first one digit, then one lowercase letter.',
  },
  'cls-02': {
    body: '`\\d` stands for `[0-9]` and `+` means one or more copies—never matching the empty string.',
    pitfall: '`*` means zero or more, which unexpectedly accepts empty strings.',
  },
  'cls-03': {
    body: 'Curly braces `{6}` repeat the exact atom right before them six times.',
  },
  'cls-04': {
    body: 'Combine ranges and counted quantifiers `{min,max}` and `{n}` with fixed literal punctuation `-` between sections.',
  },
};

export const starterWorldLessons: Record<string, TemplateWorldLessons> = {
  literals: {
    worldId: 'literals',
    primer: 'A regex works like a tiny cursor sweeping through text. Start with exact characters, then pin down where matches may land.',
    recap: 'You now control substring matching versus exact anchored shapes with `^` and `$`.',
    levels: {
      'lit-01': starterLessons['lit-01'],
      'lit-02': starterLessons['lit-02'],
      'lit-03': starterLessons['lit-03'],
      'lit-04': starterLessons['lit-04'],
    },
  },
  classes: {
    worldId: 'classes',
    primer: 'Once positions are anchored, character classes (`[...]`) and quantifiers (`+`, `{n}`) let one short pattern cover infinitely many strings.',
    recap: 'With ranges, shorthands, and counted repetition, you can validate identifiers, codes, and hex colors cleanly.',
    levels: {
      'cls-01': starterLessons['cls-01'],
      'cls-02': starterLessons['cls-02'],
      'cls-03': starterLessons['cls-03'],
      'cls-04': starterLessons['cls-04'],
    },
  },
};

export const starterHome: TemplateHomeCopy = {
  hero: {
    eyebrow: 'An interactive starter game built on the template',
    headline: 'Master regular expressions one pattern at a time',
    lede: 'Build intuition for anchors, character classes, and quantifiers using built-in concept checks, ordering tasks, and a live test-case matcher—zero backend required.',
    startLabel: 'Start level one',
    continueLabel: 'Continue',
    aboutLabel: 'How Patterncraft works',
    reassurances: ['Runs in your browser', 'Instant match highlighting', 'No accounts or setup'],
  },
  whatIs: {
    heading: 'What is Patterncraft?',
    body: '**Patterncraft** demonstrates a completely non-mathematical disc running on the exact same reusable template: chapter maps, spaced review, a searchable codex, themes, and a custom interactive level type (`pattern`).',
  },
  outcomes: {
    heading: 'What you will practice',
    items: [
      { title: 'Exact shapes with anchors', body: 'Stop accidental substring matches by pinning patterns with `^` and `$`.' },
      { title: 'Readable character classes', body: 'Express digits, letters, and hex digits with `[...]` and shorthands.' },
      { title: 'Counted repetition', body: 'Use `+` and `{min,max}` accurately instead of over-permissive wildcards.' },
    ],
  },
  galleryStrip: {
    heading: 'Interactive Sandbox Exhibits',
    intro: 'Try live patterns against real sample strings.',
  },
  journey: {
    heading: 'Two focused chapters',
    intro: 'Start with literals and boundaries, then unlock character classes and quantifiers.',
  },
  method: {
    heading: 'How it teaches',
    items: [
      { title: 'Multiple level kinds', body: 'Built-in `choice`, `order`, and `text` tasks plus a custom live regex matcher.' },
      { title: 'Spaced review', body: 'Finished levels enter your Leitner review deck automatically.' },
      { title: 'Palette variety', body: 'Switch between 6 built-in themes and light/dark modes in Profile.' },
    ],
  },
  audience: {
    heading: 'Who this disc is for',
    body: 'Developers, students, and anyone curious to see how a new subject disc plugs into the game template cleanly without touching the reusable core.',
  },
  closing: {
    heading: 'Ready to craft your first pattern?',
    body: 'Eight quick levels take you from literal strings to validated course codes.',
    cta: 'Start level one',
  },
  aboutSummary: 'Patterncraft',
};

export const starterAbout: TemplateAboutCopy = {
  title: 'About Patterncraft',
  lede: 'A second non-Lean starter game disc demonstrating that the template separates game mechanics, progression, and theming from subject matter.',
  sections: [
    {
      id: 'template-architecture',
      title: 'Zero domain coupling',
      body: 'Patterncraft uses the core built-in level types (`choice`, `order`, `text`) together with a lightweight custom `pattern` level powered by native `RegExp`—without importing any theorem prover or code editor dependencies.',
    },
    {
      id: 'theming',
      title: 'Customizable themes',
      body: 'By default Patterncraft selects the **Terracotta** palette preset, while still allowing players to try Indigo, Botanical, Ocean, Rose, or Editorial in Profile.',
    },
  ],
  faq: [
    {
      q: 'Does Patterncraft bundle the Lean engine?',
      a: 'No. Build-time disc selection ensures unused domain engines are not included in the output bundle.',
    },
    {
      q: 'How is progress stored?',
      a: 'Under its own `patterncraft.save` browser storage key, isolated from Inhabit.',
    },
  ],
  credits: 'Patterncraft is a starter demonstration disc included in this repository.',
};

export const starterScreens: Record<string, TemplateScreenIntro> = {
  map: {
    title: 'Roadmap',
    lede: 'Two compact chapters covering regular expression fundamentals.',
    about: 'Complete levels in order or defeat the chapter boss to advance.',
  },
  review: {
    title: 'Spaced Review',
    lede: 'Short practice sessions bring back patterns right before they fade.',
    about: 'Finished levels join your deck and return after 1, 3, 7, 16, and 35 days.',
  },
  codex: {
    title: 'Regex Codex',
    lede: 'A quick reference sheet for every metacharacter and concept you unlock.',
    about: 'Entries unlock automatically as you play through chapters.',
  },
  profile: {
    title: 'Profile & Settings',
    lede: 'Track streaks, stars, badges, and customize your color palette.',
    about: 'Export your progress as JSON anytime or try another theme palette.',
  },
  guide: {
    title: 'Field Guide',
    lede: 'Short essays on how regular expressions evaluate strings.',
    about: 'Read alongside chapters for deeper intuition.',
  },
  gallery: {
    title: 'Interactive Lab',
    lede: 'Play directly with live regular expressions.',
    about: 'Pick a preset or type your own pattern.',
  },
};
