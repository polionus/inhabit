/**
 * Content schema for Inhabit. Worlds are plain data: no engine or UI imports here.
 * Markdown fields support: **bold**, *italic*, `inline lean`, fenced ```lean blocks,
 * lists, and [[codex-id]] links to codex entries.
 */

/** A hint ladder goes from a nudge to a near-solution. Learners reveal one rung at a time. */
export interface Hint {
  /** Markdown. Rung 1: where to look. Rung 2: which tool. Last rung: (almost) the answer. */
  text: string;
}

export interface Unlocks {
  /** Canonical tactic names added to the learner's inventory when this level is completed. */
  tactics?: string[];
  /** Names from the lemma bank (`src/content/lemmas.ts`) usable in all later levels. */
  lemmas?: string[];
  /** Codex entry ids revealed (concept cards, term-mode syntax, symbols). */
  codex?: string[];
}

interface LevelBase {
  /** Globally unique, stable: `<worldId>-<nn>` e.g. `logic-03`. Never renumber after release. */
  id: string;
  title: string;
  /**
   * Shown beside the task. ≤ 120 words. One new idea per level.
   * Lead with the idea, then the tool. No walls of text (cognitive load).
   */
  intro: string;
  /** Shown after success. ≤ 80 words. Names the insight and connects it to type theory. */
  outro?: string;
  /** What completing this level adds to the inventory. */
  unlocks?: Unlocks;
  /**
   * Lemma-bank names handed to the learner for free, usable from THIS level onward
   * (unlike `unlocks.lemmas`, which only become usable in LATER levels).
   */
  grants?: string[];
  /** Boss levels interleave earlier skills, give more XP, and show no starter scaffolding. */
  boss?: boolean;
  /** Include in the spaced-repetition review deck once completed. Default true for all kinds. */
  review?: boolean;
  /** Optional levels are side-quests: not required to finish the world. */
  optional?: boolean;
}

/**
 * Write Lean. The engine checks `setup + header + "\n" + <editor contents> + "\n" + after`.
 * Only the editor contents are editable.
 */
export interface ProofLevel extends LevelBase {
  kind: 'proof';
  /** Plain-English statement of what is to be shown/built. Always present. */
  english: string;
  /** Hidden-by-default Lean checked before the header (level-local defs/axioms). Usually omitted. */
  setup?: string;
  /**
   * Read-only header shown above the editor, ending in `:= by` (tactic levels) or `:=` (term levels).
   * e.g. "theorem and_swap (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by"
   */
  header: string;
  /**
   * Initial editor contents (the body). Indent tactic lines by 2 spaces.
   * "  sorry" for a full problem; a partial proof containing `sorry` for a faded example.
   */
  starter: string;
  /** Lean appended after the body and checked too (e.g. `example : double 3 = 6 := rfl`). */
  after?: string;
  /** 'tactic': body is a tactic block. 'term': body must be a term — `by` is locked. */
  mode: 'tactic' | 'term';
  /**
   * Reference bodies; solutions[0] is canonical and shown on "reveal". Every one MUST pass both
   * the mini-engine (with this level's inventory) and real Lean. Give 2+ when there are
   * genuinely different good proofs (e.g. tactic vs. term style).
   */
  solutions: string[];
  hints: Hint[];
  /** Extra tactics allowed in this level only (beyond the inventory), e.g. the one being introduced. */
  extraTactics?: string[];
  /** Constants that may not be used here (e.g. the library lemma being proved). */
  forbidden?: string[];
  /** After solving, reveal the proof term the tactics built (Curry–Howard made visible). */
  showTerm?: boolean;
}

/**
 * Parsons problem: arrange shuffled lines into a working proof. Low cognitive load — used
 * right after a worked example, before free writing. Checked by the engine, so any valid
 * ordering is accepted.
 */
export interface ParsonsLevel extends LevelBase {
  kind: 'parsons';
  english: string;
  setup?: string;
  header: string;
  /** Lines of a correct body, in a correct order, each with its own indentation. */
  lines: string[];
  /** Plausible wrong lines mixed into the pool (each should embody a real misconception). */
  distractors?: string[];
  hints: Hint[];
}

export interface ChoiceOption {
  /** Markdown; use `code` for Lean. */
  text: string;
  correct?: boolean;
  /** Shown when this option is picked: why it is right / what misconception it reflects. */
  feedback: string;
}

/**
 * Retrieval / concept check. With `code`, the snippet is shown (and run through the engine so
 * the learner can inspect goal states by moving the cursor).
 */
export interface ChoiceLevel extends LevelBase {
  kind: 'choice';
  question: string;
  /** Optional Lean snippet displayed read-only with a live infoview. Must check without errors. */
  code?: string;
  setup?: string;
  options: ChoiceOption[];
}

/**
 * Predict-then-observe (generation effect): the learner sees a proof paused before one tactic,
 * commits to a prediction of the resulting goal, then the engine reveals the real state.
 */
export interface PredictLevel extends LevelBase {
  kind: 'predict';
  setup?: string;
  /** A complete, correct declaration. Must check without errors. */
  code: string;
  /** 1-based line number (within `code`) of the tactic whose effect is to be predicted. */
  line: number;
  /** Defaults to "What will the goal be after this line runs?" */
  question?: string;
  options: ChoiceOption[];
}

/**
 * Translate English mathematics into a Lean proposition (the core capstone skill).
 * The learner types a term of type Prop, elaborated under `binders`.
 */
export interface FormalizeLevel extends LevelBase {
  kind: 'formalize';
  /** The English statement to formalize. */
  english: string;
  setup?: string;
  /** Variables in scope, e.g. "(α : Type) (A B : Set α)". Shown to the learner. */
  binders?: string;
  /** Optional initial editor contents (e.g. a partial statement with `_` gaps). */
  starter?: string;
  /** Accepted answers. A submission passes if definitionally equal to any of these. accept[0] is the model answer. */
  accept: string[];
  /** Common wrong formalizations, matched by definitional equality, with targeted feedback. */
  mistakes?: { statement: string; feedback: string }[];
  hints: Hint[];
}

export type Level = ProofLevel | ParsonsLevel | ChoiceLevel | PredictLevel | FormalizeLevel;

export interface World {
  /** Short stable id: 'types', 'props', 'logic', 'quant', 'eq', 'nat', 'sets', 'fun', 'num', 'forge'. */
  id: string;
  title: string;
  /** One line shown on the map. */
  tagline: string;
  /** Markdown shown on the world's landing page: what you will be able to do afterwards. ≤ 80 words. */
  intro: string;
  /** World ids that must be completed first. */
  requires: string[];
  /** The mathematical / type-theoretic big idea of this world, one sentence. */
  bigIdea: string;
  levels: Level[];
  /** Codex entries introduced by this world. */
  codex: CodexEntry[];
  /** Lemma-bank entries introduced by this world, in dependency order. */
  lemmas: Lemma[];
}

/** An entry in the learner's reference collection ("Codex"). Unlocked by levels. */
export interface CodexEntry {
  /** Stable id. For tactics use the canonical tactic name (e.g. 'intro', 'rw'). */
  id: string;
  kind: 'tactic' | 'term' | 'concept' | 'symbol' | 'definition';
  /** Display name, e.g. `intro`, `fun x => e`, "Propositions as types". */
  name: string;
  /** One sentence. Shown in tooltips and inventory lists. */
  summary: string;
  /** Markdown, ≤ 150 words. For tactics: what it does to the goal, when to reach for it. */
  body: string;
  /** Minimal Lean example (must check in both engines when it is a complete declaration). */
  example?: string;
  /** For tactics: the term-mode equivalent ("what the tactic builds"). e.g. `fun x => _`. */
  term?: string;
  /** For symbols: how to type it, e.g. `\\and`. */
  input?: string;
  /** The real-Lean / Mathlib name or note when it differs from the game. */
  mathlib?: string;
}

/**
 * A library lemma in the lemma bank. Lemmas become usable in a level once a prerequisite
 * level lists them in `unlocks.lemmas`. Usually the learner has just proved it themselves.
 */
export interface Lemma {
  /** Full name as used in proofs, e.g. `Nat.zero_add`, `Set.inter_subset_left`. */
  name: string;
  /** Complete Lean declaration, e.g. "theorem Nat.zero_add (n : Nat) : 0 + n = n := by …". */
  source: string;
  /**
   * 'core'  — real Lean 4 core already has this exact name with a compatible statement
   *           (verified by `example : <statement> := @<name>`); only the mini-engine loads `source`.
   * 'game'  — not in core; `source` is compiled in real Lean too (as part of the generated library).
   */
  origin: 'core' | 'game';
  /** One-line plain-English reading, shown in the inventory. */
  doc: string;
}

/** A theorem suggestion for the Workshop ("I don't know what to prove"). */
export interface TheoremIdea {
  id: string;
  area: 'logic' | 'numbers' | 'sets' | 'functions' | 'mixed';
  /** 1 = a few lines, 2 = needs a plan, 3 = a real project. */
  difficulty: 1 | 2 | 3;
  title: string;
  /** The statement in careful English. */
  english: string;
  /** Hidden until asked for: one good way to state it (binders + statement), checkable by the mini-engine. */
  statement: string;
  /** Hidden until asked for: a nudge on proof strategy (not a proof). */
  strategy: string;
  /** Any `def`s the statement needs that are not in the library. */
  definitions?: string;
  /** A full reference proof (verified in both engines). Never shown unless the learner asks to reveal. */
  proof: string;
}

/** One section of the Graduate guide (moving to real Lean + Mathlib). */
export interface GraduateSection {
  id: string;
  title: string;
  /** Markdown. */
  body: string;
}

/** One row of the game → Mathlib phrasebook. */
export interface PhrasebookRow {
  game: string;
  mathlib: string;
  note?: string;
}
