/**
 * Public contract of the mini-Lean engine.
 *
 * The UI and the content pipeline depend ONLY on this file and on `src/engine/index.ts`,
 * which must export `engine: Engine`. Everything else inside `src/engine/` is private.
 *
 * All offsets are 0-based UTF-16 code-unit offsets into the `source` string that was
 * passed to the call that produced them.
 */

export type Severity = 'error' | 'warning' | 'info';

/** Machine-readable category, used by the UI to attach beginner-friendly explanations. */
export type DiagnosticCode =
  | 'parse' //               syntax error
  | 'unknown-identifier' //  name not in scope            (data.name, data.suggestions)
  | 'unknown-tactic' //      not a tactic the engine knows (data.tactic, data.suggestions)
  | 'tactic-locked' //       real tactic, but not in `allowedTactics` for this level (data.tactic)
  | 'name-locked' //         constant listed in `forbiddenNames` (data.name)
  | 'type-mismatch' //       (data.expected, data.actual)
  | 'function-expected' //   applied a non-function
  | 'unsolved-goals' //      proof ended with goals remaining (data.goals)
  | 'no-goals' //            tactic run when nothing is left to prove
  | 'tactic-failed' //       tactic-specific failure (data.tactic); message explains
  | 'rewrite-failed' //      rw: pattern not found / motive not type-correct (data.pattern)
  | 'not-inductive' //       cases/induction/constructor on the wrong kind of thing
  | 'unification' //         could not infer an implicit argument / placeholder
  | 'sorry' //               warning: declaration uses sorry
  | 'mode' //                e.g. a tactic proof given where a term was required by the level
  | 'timeout' //             fuel exhausted
  | 'command-output' //      info: output of #check / #eval / #print / #reduce
  | 'other';

export interface Diagnostic {
  severity: Severity;
  code: DiagnosticCode;
  /** Lean-style message, plain text (may be multi-line). */
  message: string;
  from: number;
  to: number;
  data?: {
    expected?: string;
    actual?: string;
    name?: string;
    tactic?: string;
    pattern?: string;
    suggestions?: string[];
    goals?: Goal[];
  };
}

export interface Hyp {
  /** Hypotheses with identical types are grouped like Lean's infoview: `a b : Nat`. */
  names: string[];
  type: string;
  /** Present for `let`/`set`-style local definitions. */
  value?: string;
  /** True when the hypothesis is a proof (its type is a Prop), false when it is data. */
  isProof: boolean;
}

export interface Goal {
  /** Case tag, e.g. `succ`, `inl`, `left`, `mp`. */
  caseName?: string;
  hyps: Hyp[];
  /** Pretty-printed target WITHOUT the leading `⊢ `. */
  target: string;
}

/** One executed tactic. Nested tactics (inside `·`, `induction … with`, `<;>`) each get a step. */
export interface TacticStep {
  from: number;
  to: number;
  /** Canonical tactic name: 'intro', 'exact', 'rw', 'induction', … */
  tactic: string;
  /** All open goals before / after (the tactic acts on `before[0]`). */
  before: Goal[];
  after: Goal[];
  ok: boolean;
}

export type DeclKind = 'theorem' | 'def' | 'example' | 'axiom' | 'inductive' | 'structure' | 'instance';

export interface DeclInfo {
  /** Fully qualified name; '' for `example`. */
  name: string;
  kind: DeclKind;
  /** Pretty-printed type / statement. */
  type: string;
  from: number;
  to: number;
  /** Elaborated without errors. */
  ok: boolean;
  usesSorry: boolean;
  /** Pretty-printed proof term / definition body (implicit arguments hidden). */
  term?: string;
  /** Canonical names of the tactics used in this declaration. */
  usedTactics: string[];
  /** Global constants referenced by the user-written source of this declaration. */
  usedConstants: string[];
  /** True if the body is a `by` block at top level. */
  isTacticProof: boolean;
}

export interface CheckResult {
  diagnostics: Diagnostic[];
  steps: TacticStep[];
  decls: DeclInfo[];
  /** No error diagnostics. */
  ok: boolean;
  /** `ok`, at least one declaration, no `sorry`, no unsolved goals. */
  complete: boolean;
}

export interface CheckOptions {
  /** If present, any other tactic is rejected with `tactic-locked`. Canonical names. */
  allowedTactics?: string[];
  /** Constants the user source may not mention (→ `name-locked`). */
  forbiddenNames?: string[];
  /** Fuel for reduction/unification; engine picks a sane default. */
  maxSteps?: number;
}

/** Opaque, immutable environment (base library + added declarations). */
export interface Env {
  readonly __brand: 'Env';
}

export interface ConstantInfo {
  name: string;
  kind: DeclKind | 'constructor' | 'recursor';
  type: string;
  doc?: string;
}

export interface Engine {
  /** The built-in library (logic, Nat, Set, Function, parity). Cached. */
  baseEnv(): Env;

  /**
   * Elaborate trusted library source on top of `env` and return the extended environment.
   * Does not mutate `env`. Declarations with errors are skipped and reported in `result`.
   */
  extend(env: Env, source: string): { env: Env; result: CheckResult };

  /** Check learner source against `env`. Never throws; never mutates `env`. */
  check(env: Env, source: string, opts?: CheckOptions): CheckResult;

  /**
   * The proof state to display when the cursor is at `offset`, following Lean's infoview
   * convention (state before the tactic the cursor is on; state after the last tactic when
   * the cursor is past it). `null` when the cursor is not inside a tactic proof.
   */
  goalsAt(result: CheckResult, offset: number): Goal[] | null;

  /**
   * Elaborate `term` (optionally under binders such as "(α : Type) (A B : Set α)") and
   * return its pretty-printed form and type. Used for #check-style UI and formalization levels.
   */
  elab(env: Env, term: string, binders?: string): { ok: boolean; pretty?: string; type?: string; diagnostics: Diagnostic[] };

  /**
   * Are the two terms definitionally equal (after elaborating both under `binders`)?
   * Used by `formalize` levels to compare a learner's statement with accepted answers.
   * Returns false if either fails to elaborate.
   */
  defEq(env: Env, a: string, b: string, binders?: string): boolean;

  /** Look up constants (for the inventory / codex). */
  constant(env: Env, name: string): ConstantInfo | null;

  /** Canonical names of every tactic the engine implements. */
  tactics(): string[];
}
