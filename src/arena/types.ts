/**
 * Arena contract: algorithmically generated puzzles and the generator that makes them.
 * FROZEN — the generator (src/arena/gen), the arena logic (src/arena/state, src/arena/net)
 * and the arena UI (src/ui/arena) all depend on this file. Ask the orchestrator before changing.
 *
 * Everything under src/arena except the UI-free `net` transports must run under plain Node 24
 * as well as in the browser: no DOM, no Date.now(), no Math.random() inside the generator.
 */

/** Bump whenever the same (seed, spec) could produce a different puzzle. Embedded in share links. */
export type GenVersion = number;

/**
 * Puzzle families.
 *  prop     prove a propositional theorem with tactics            (P Q R : Prop, → ∧ ∨ ¬ ↔ False True)
 *  inhabit  write a term of the given type, no tactics            (Curry–Howard: types over A B C : Type, and Props)
 *  quant    prove a first-order statement with ∀ / ∃ over predicates
 *  set      prove a set-algebra fact (⊆ ∩ ∪ ᶜ \ ∅ univ)
 *  quick    multiple choice, answerable in seconds; correctness is computed by the engine
 */
export type ProofFamily = 'prop' | 'inhabit' | 'quant' | 'set';
export type PuzzleFamily = ProofFamily | 'quick';

/** Kinds of quick item. Each has an engine-computed correct answer. */
export type QuickKind =
  | 'goal-after' //   "what is the goal after this tactic runs?"
  | 'next-tactic' //  "which of these tactics makes progress on this goal?"
  | 'provable' //     "is this provable?" (true / false / only with classical logic)
  | 'type-of' //      "what is the type of this term?"
  | 'inhabitant'; //  "which term has this type?"

interface PuzzleBase {
  /** Deterministic id: `${family}.${genVersion}.${seed}.${target}` — same id ⇒ same puzzle everywhere. */
  id: string;
  family: PuzzleFamily;
  /**
   * Difficulty on a chess-like scale, 400 (trivial) … 2400 (hard). Estimated from the reference
   * proof (length, case splits, negations, depth). Used for player rating updates.
   */
  rating: number;
  /** Seconds an on-rating player needs. Used for timers, bots and score bonuses. */
  par: number;
}

export interface ProofPuzzle extends PuzzleBase {
  kind: 'proof';
  family: ProofFamily;
  mode: 'tactic' | 'term';
  /** Plain-English reading of the statement. Always present. */
  english: string;
  /** Lean checked before the header, or ''. */
  setup: string;
  /** Read-only header ending in `:= by` (tactic) or `:=` (term). Theorem is always named `puzzle`. */
  header: string;
  /** Initial editor body: `  sorry`. */
  starter: string;
  /**
   * A reference body. MUST be `complete` when checked as `setup + header + "\n" + solution` with
   * `engine.check(engine.baseEnv(), src, { allowedTactics })`, and MUST compile in real Lean 4
   * (with `import Game.Core`).
   */
  solution: string;
  /** Tactics the solver may use (canonical names). `[]` for term mode. */
  allowedTactics: string[];
  /** 2–3 hints, from nudge to near-solution, generated from the reference proof. */
  hints: string[];
  /** Short tags for the UI and for stats, e.g. ['implication', 'case split', 'negation']. */
  themes: string[];
}

export interface QuickOption {
  /** Markdown; use `code` for Lean. */
  text: string;
  correct: boolean;
  /** One sentence shown after answering: why this is right or wrong. */
  why: string;
}

export interface QuickPuzzle extends PuzzleBase {
  kind: 'quick';
  family: 'quick';
  quick: QuickKind;
  /** Markdown question. */
  prompt: string;
  /** Optional Lean shown above the options (a goal state, a term, a partial proof). */
  code?: string;
  /** 2–4 options, already in display order (shuffled by the generator's RNG). Exactly one correct. */
  options: QuickOption[];
  themes: string[];
}

export type Puzzle = ProofPuzzle | QuickPuzzle;

export interface PuzzleSpec {
  /** Any string. Same seed + same spec ⇒ same puzzle. */
  seed: string;
  family: PuzzleFamily;
  /** Target rating; the result is within about ±150 of it (clamped to what the family can produce). */
  target: number;
  /** Only for family 'quick': restrict to these kinds. */
  quick?: QuickKind[];
}

export interface Generator {
  readonly version: GenVersion;
  /** Rating range each family can produce: [min, max]. */
  readonly range: Record<PuzzleFamily, [number, number]>;
  /** Deterministic and pure. Typically < 30 ms; never throws (falls back to an easier puzzle). */
  generate(spec: PuzzleSpec): Puzzle;
  /**
   * Check a solver's body against a proof puzzle exactly as the Arena does: base library only,
   * the puzzle's `allowedTactics`, `axiom` and `sorry` rejected.
   */
  check(puzzle: ProofPuzzle, body: string): { complete: boolean; result: import('../engine/types.ts').CheckResult; bodyOffset: number };
}

/** Deterministic PRNG handed around by seed. Implemented in src/arena/gen/rng.ts. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
  /** Independent child stream. */
  fork(label: string): Rng;
}
