# Inhabit — master specification

**Inhabit** is a browser game that teaches the Lean 4 theorem prover and enough dependent type
theory (DTT) to understand *why* it works. The name is the core idea: to prove a proposition is to
*inhabit* a type.

**Outcome.** A learner who finishes can take a mathematical statement of their own choosing,
formalize it in Lean (choose types, write definitions, state the theorem) and prove it — and can
explain what a proof *is* in type-theoretic terms.

This document is the contract between everyone building the game. Read sections 1, 2 and 8, plus
the section for your part.

---

## 1. Architecture

Static single-page app (Vite + React 18 + TypeScript, hash routing, `base: './'`), deployable to
GitHub Pages. **No server.** Lean code is checked in the browser by a purpose-built *mini-Lean
engine* written in TypeScript that implements a faithful subset of Lean 4.

Fidelity is enforced by **differential testing against real Lean 4** (installed locally,
toolchain `v4.25.1`, project in `lean-verify/`): every reference solution in the game must pass
both the mini-engine and real Lean.

```
src/engine/      mini-Lean: lexer, parser, kernel, elaborator, tactics, printer   (ENGINE agent)
  types.ts         public contract (frozen; ask the orchestrator before changing)
  index.ts         exports `engine: Engine`
src/content/     pure data
  types.ts         content schema (frozen)
  index.ts         registry + levelContext() (orchestrator-owned)
  worlds/<id>.ts   one file per world: levels, codex entries, lemma bank  (CONTENT agents)
  ideas.ts, graduate.ts   capstone material                               (forge author)
  lessons/<id>.ts  long-form prose per world: primer, recap, one lesson per level (§9)
  guide.ts, screens.ts   Guide articles and per-screen explanatory copy (§9)
src/arena/       generated puzzles and competitive play (§10)
  types.ts         generator contract (frozen)
  gen/             the puzzle generator: pure, deterministic, Node-safe
  state/, net/     ratings, modes, bots, share codes, peer-to-peer transport
src/ui/arena/    Arena screens
src/ui/, src/state/, src/main.tsx   the React app                         (UI agent)
scripts/verify-lean.ts   compiles all content in real Lean
lean-verify/Game/Core.lean   real-Lean mirror of the engine's base library (reference; frozen)
docs/            this spec
```

## 2. Rules for all agents

- Stay inside the paths you own. Do not edit `types.ts` contracts, `package.json` scripts,
  `docs/SPEC.md`, or other agents' directories. If a contract blocks you, finish what you can and
  report the needed change in your final message.
- **Do not run `git commit`/`git add`** — the orchestrator commits. Do not spawn subagents.
- TypeScript: strict; `erasableSyntaxOnly` (no `enum`, no parameter properties, no namespaces);
  **relative imports must carry the `.ts`/`.tsx` extension**; use `import type` for types.
  Everything under `src/engine` and `src/content` must also run under plain Node 24
  (`node file.ts`, type-stripping) — no DOM, no Vite-only features there.
- New npm dependencies: only if clearly needed; install with `npm install <pkg>` (never hand-edit
  `package.json`).
- Real Lean is available: `cd lean-verify && lake env lean <file.lean>` (files can
  `import Game.Core`). Use it to settle any question of "what does Lean do here?".
- Final message: what you built, what is verified (with the commands and their results), what is
  not done or known-broken. Be exact; do not claim untested things work.

---

## 3. The mini-Lean engine

Implements `src/engine/types.ts`. Guiding rule: **when in doubt, do exactly what Lean 4 does**
(syntax, semantics, goal display, error wording). It is a teaching tool: error messages and goal
display matter as much as acceptance.

### 3.1 Kernel
- Terms: sorts (`Prop`, `Type`, `Type 1`, …; `Sort u` polymorphism only as far as built-ins
  need), bound/free vars, constants, application, λ, Π (dependent function types; `A → B` is the
  non-dependent case), `let`, metavariables, Nat literals.
- Impredicative `Prop`; `Type : Type 1`; proof irrelevance for `Prop`; η for functions.
- Definitional equality by βδιζη with fuel (never hang; report `timeout`).
- Inductive types handled generically: built-ins `False`, `True`, `And`, `Or`, `Iff`, `Exists`,
  `Eq`, `Nat`, `Prod` (and `Not` as a `def`). Constructors, recursors/eliminators, ι-reduction.
- Axioms: `propext`, `funext`, `Classical.em` (+ `Classical.byContradiction`, `Classical.not_not`).

### 3.2 Base library
Must expose every name in `lean-verify/Game/Core.lean` with the same statement (no typeclasses
needed — hard-wire the notations), plus the core-Lean names the curriculum uses:

- Logic: `And.intro/left/right`, `Or.inl/inr/elim`, `Iff.intro/mp/mpr/rfl`, `Exists.intro`,
  `False.elim`, `absurd`, `Not`, `True.intro`/`trivial`, `Eq.refl/symm/trans/subst`, `rfl`,
  `congrArg`, `congrFun`, `Ne`, `id`, `Function.comp` (`∘`), `Function.comp_apply`, `Function.Injective`,
  `Function.Surjective`, `Function.Bijective`, `Function.LeftInverse`, `Function.RightInverse`.
- Nat: `Nat.zero`, `Nat.succ`, `Nat.add`, `Nat.mul`, and the defining equations
  `Nat.add_zero`, `Nat.add_succ`, `Nat.mul_zero`, `Nat.mul_succ`, plus `Nat.succ_ne_zero`,
  `Nat.succ.inj`, `Nat.succ_eq_add_one`, `Nat.rec`. Addition and multiplication recurse on the
  **second** argument (so `n + 0 = n` is `rfl` but `0 + n = n` needs induction — a key lesson).
  `a ∣ b` unfolds to `∃ c, b = a * c`. `Even`, `Odd` as in Core.lean.
  **Derived** Nat theorems (`Nat.zero_add`, `Nat.add_comm`, …) are *not* in the base library:
  learners prove them, then the content's lemma bank adds them via `engine.extend`.
- Sets: everything in Core.lean (`Set`, `setOf`, `∈ ∉ ⊆ ∪ ∩ \ ᶜ ∅`, `Set.univ`, `'' `, `⁻¹'`,
  `{x | p x}`, `{x : α | p x}`, `Set.ext`, the `Set.mem_*` unfolding lemmas).

Required Nat behaviours (mirror real Lean): numerals print as numerals; `induction`'s successor
goal shows `k + 1`; `rw [Nat.add_succ]` works on `a + (k + 1)`; `rw [Nat.add_comm]` works on
`n + 1`; `rfl` proves `n + 1 = Nat.succ n` and `2 + 2 = 4`; `rfl` does **not** prove `0 + n = n`.

### 3.3 Surface syntax (Lean 4)
Lexing: identifiers with dots, Greek letters, subscripts, primes; `--` and `/- -/` comments;
`/-- doc -/`. ASCII alternatives are accepted everywhere: `->`, `<->`, `/\`, `\/`, `fun`/`λ`,
`=>`/`↦`, `forall`, `exists`, `!=`, `<=`, `Not`, `.` for `·`.

Commands — MUST: `theorem`/`lemma`, `def` (`:=` form), `example`, `axiom`, `#check`, `#eval`,
`#print`, `#reduce`, `open … (in)`, `namespace … end`, `variable`, ignore `section/end`,
`set_option`, `universe`, attributes `@[…]`, `noncomputable`.
SHOULD: `def` by pattern-matching equations on Nat (`| 0 => … | n + 1 => …`, also multi-argument),
structural recursion only; `match … with` on Nat/constructors.
COULD: user `inductive` (simple, non-indexed) and `structure`, usable with `cases`/`induction`.

Terms — MUST: application, `fun x => e`, `fun (x : A) (y : B) => e`, `fun ⟨a, b⟩ => e`,
`∀ x, p`, `∀ x : A, p`, `∀ (x y : A), p`, `∀ x ∈ s, p`, `∃ x, p`, `∃ x : A, p`, `∃ x ∈ s, p`,
`(x : A) → B`, `{x : A} → B`, `A → B`, `⟨a, b, c⟩` (anonymous constructor, right-nested, sees
through definitions), `h.1`/`h.2`/`h.left`/`h.mp` (projection & generalized dot notation, e.g.
`hf.comp hg`, `h.symm`), `(e : T)`, `@f`, `_`, `?_`, `by tacs`, `have h : T := e; body` (also
newline-separated), `show T from e`, `let`, `calc`, `absurd`, `fun x ↦ e`, `·`-sections `(· + 1)`,
numerals, `Prop`, `Type`, `Type n`, `Sort n`, and the operators with Lean's precedences:
`∘ ∣ + * = ≠ ∧ ∨ ¬ ↔ → ∈ ∉ ⊆ ∪ ∩ \ ᶜ '' ⁻¹' ≤ <` (`≤`/`<` may be parse-only).
Binders: explicit `( )`, implicit `{ }`, strict-implicit `⦃ ⦄` (as in `Function.Injective` and
`⊆`: `h hx` works, `intro x hx` works), auto-bound implicit not required.
Elaboration: implicit-argument insertion, first-order unification with pattern cases where
needed, expected-type propagation, coercion-free.

### 3.4 Tactics
Blocks are indentation-sensitive like Lean; also `;` separators, `·` focus bullets,
`case tag x y => …`, `next x => …`, `t <;> t'`, `(tacs)`.

MUST (canonical names): `intro` (multiple names, `_`, anonymous → inaccessible `a✝`), `intros`,
`exact`, `apply` (new goals for missing explicit args), `refine` (with `?_`), `have`
(`have h : T := e`, `have h : T := by …`, `have := e`, `have ⟨a, b⟩ := e`), `show`, `change`,
`constructor`, `left`, `right`, `cases … with | inl h => … | inr h => …` (and unstructured
`cases h`), `rcases … with ⟨a, b⟩ | c` patterns, `obtain ⟨a, b⟩ := e`, `rintro` patterns,
`exfalso`, `contradiction`, `assumption`, `by_cases h : p`, `by_contra h`, `use` (multiple
witnesses; then tries `rfl`), `exists`, `specialize`, `rfl` (also closes `Iff`), `rw [a, ← b, c x y] `
(`at h`, `at h ⊢`, `at *`; equations and iffs; tries `rfl` afterwards; error when the pattern is
not found, quoting the pattern), `symm`, `calc`, `induction n with | zero => … | succ k ih => …`
(and unstructured; `generalizing`), `ext x` (sets and functions), `funext x`, `unfold f` (`at h`),
`subst`, `revert`, `clear`, `trivial`, `sorry`, `all_goals`, `any_goals`, `repeat`, `try`,
`first | a | b`, `rwa`, `exact absurd …`, `injection` (SHOULD).
COULD: `simp only [lemmas]` (`at`), a modest `simp` (logic + given lemmas + rfl), `decide` (closed
Nat (in)equalities), `nth_rewrite`, `rename_i`, `omega` is out of scope.

Transparency (mirror Lean): `intro`, `constructor`, `left/right`, `cases/rcases/obtain`, `exact`,
`apply`, `use`, anonymous constructors and `rfl` see through definitions (so `intro x hx` works on
`A ⊆ B`, `constructor` on `x ∈ A ∩ B`, `obtain ⟨a, ha⟩ := h` on `m ∣ n`). `rw` matches
syntactically up to instances/β (so `rw` does **not** see through `∈`/`⊆`; learners use
`rw [Set.mem_inter_iff]` or `show`).

`allowedTactics`/`forbiddenNames` (see `CheckOptions`) must be enforced with the dedicated
diagnostic codes. `sorry` is always allowed (warning, `complete = false`).

### 3.5 Output quality
- Goals print like the Lean infoview (hypothesis grouping, `⊢`, case tags, `∀ (x : α), …` style
  binders, implicit args hidden, numerals, set-builder, `¬`, minimal parentheses).
- Diagnostics mirror Lean's wording (`type mismatch … has type … but is expected to have type …`,
  `unknown identifier`, `unsolved goals` + the goals, rw's `did not find instance of the pattern`),
  carry accurate ranges and a `DiagnosticCode`, and fill `data` for the UI's explainer.
  `unknown-identifier`/`unknown-tactic` carry near-miss `suggestions`.
- Errors are recoverable: a failing tactic reports its error, and later declarations still check.
- `DeclInfo.term`: readable proof term for tactic proofs (this powers the "see the term your
  tactics built" feature). `goalsAt` follows the infoview convention.
- Speed: `check` on a typical level in a few ms; `baseEnv()` cached; `Env` persistent/immutable.

### 3.6 Tests
Vitest suite in `src/engine/**/*.test.ts` covering every tactic and syntax form above, error
cases, and a **differential corpus**: a list of Lean snippets (accept *and* reject cases) kept in
one data file, each checked by the mini-engine in vitest and — via a small script — by real Lean
(`import Game.Core`), asserting both agree on accept/reject. `lean-verify/Game/Smoke.lean` is a
starting corpus; all of it must pass.

---

## 4. Curriculum

Ten worlds. Dependency graph (also in `src/content/worlds/*.ts` stubs — keep ids/titles/requires):

```
types → props → logic → quant → eq ─┬→ nat ──→ num ─┐
                                    └→ sets ─→ fun ─┴→ forge
```

Each world: 8–12 levels, ordered by the *world arc* (§5.2). Tactic unlock schedule (a tactic may
only be *used* in a world at or after the one that introduces it; the introducing level lists it
in `unlocks.tactics`):

| World | Big idea | Introduces (tactics) | Must cover |
|---|---|---|---|
| `types` Basecamp | Every expression has a type; functions are the basic building block; types can depend on values | — (term mode only) | `#check`, `Nat`, `fun`, application, currying, `def`, `Type : Type 1`, polymorphism `(α : Type) → α → α` as a *dependent* function type, inhabiting types such as `(A → B) → (B → C) → A → C` |
| `props` Proposition Peaks | Curry–Howard: propositions are types, proofs are terms, `→` is the function arrow | `exact`, `intro`, `apply`, `have`, `assumption` | `Prop`, re-solving Basecamp puzzles as logic, term proofs first, then tactics as "a term builder", `showTerm` reveals, modus ponens = application |
| `logic` Connective Canyon | Connectives are inductive types: constructors say how to prove, eliminators how to use | `constructor`, `obtain`, `left`, `right`, `cases`, `rcases`, `exfalso`, `contradiction`, `by_cases`, `by_contra`, `show` | `∧`, `∨`, `False`, `¬P := P → False`, `↔`, `⟨_, _⟩`, `.1/.2`, De Morgan, constructive vs classical (`Classical.em`) |
| `quant` Quantifier Quay | `∀` is a dependent function; `∃` is a dependent pair | `use`, `specialize`, `exists` | predicates `α → Prop`, `intro x`, applying `h a`, witnesses, `¬∃ ↔ ∀¬`, quantifier order, first `formalize` levels |
| `eq` Equality Estuary | Two kinds of sameness: definitional (computation, `rfl`) and propositional (`=`, needs proof) | `rfl`, `rw`, `symm`, `calc`, `subst`, `rwa` | `rfl` by computation, `rw` both directions and `at`, `congrArg`, `Eq.symm/trans`, `≠`, Leibniz (`a = b → P a → P b`) |
| `nat` Induction Isles | Inductive types give recursion (data) and induction (proofs) — the same principle | `induction` | `Nat` as inductive type, `def` by recursion, `n + 0 = n` by `rfl` vs `0 + n = n` by induction, `succ_add`, `add_comm`, `add_assoc`, `zero_mul`, `mul_one/one_mul`, `succ_mul`, `mul_add`, `mul_comm` (boss), `Nat.rec` |
| `sets` Set Savanna | A set is a predicate; set algebra *is* logic | `ext`, `rintro`, `change` | `∈` as application, `⊆` as `∀ →`, `∩`/`∧`, `∪`/`∨`, `ᶜ`/`¬`, `Set.ext`, comm/assoc/distrib, De Morgan, `∅`/`univ`, set-builder |
| `fun` Function Fjord | Properties of functions are quantified statements; definitions unfold | `funext`, `unfold` | `∘`, `Injective`, `Surjective`, composition theorems, cancel theorems, image/preimage, left inverse ⇒ injective, **boss: Cantor's theorem** |
| `num` Divisor Dunes | Existential definitions: divisibility and parity | `refine` | `∣`, `dvd_refl`, `dvd_trans`, `dvd_add`, `dvd_mul_right`, `Even`/`Odd`, sums of evens/odds, **boss: `∀ n, Even n ∨ Odd n`** |
| `forge` Formalization Forge | Formalizing = choosing types, writing definitions, stating precisely, then proving | (`sorry` as a planning tool), `all_goals`, `repeat`, `try` | the 5-step workflow (§5.5), `formalize` levels across all areas, writing own `def`s, proof skeletons with `have … := by sorry`, debugging broken proofs, a final multi-step project |

Lemma naming: use the real Lean core / Mathlib name for every bank lemma (`Nat.zero_add`,
`Set.inter_subset_left`, `Function.Injective.comp`, `Nat.dvd_trans`, …). Check existence in core
with `#check` in real Lean and set `origin` accordingly. In the level where the learner proves
it, the header uses the un-namespaced name (`theorem zero_add …`); the outro says "this is
`Nat.zero_add` in Lean's library — it's now in your inventory".

---

## 5. Pedagogy — binding rules for content and UI

The design applies specific findings from learning science. Each rule names the principle.

### 5.1 Per-level rules
1. **One new element per level** (cognitive load: intrinsic load management). A level introduces
   one tactic *or* one concept *or* one piece of syntax. Never two.
2. **Intro ≤ 120 words, outro ≤ 80** (coherence principle: no seductive details, no history
   lessons, no jokes that cost attention). Lead with the idea in plain words, then the Lean.
   The intro stays short because it is the *task*. The full explanation lives in the level's
   **lesson** (§9), which the learner can read at their own pace beside the task.
3. **Signal the type-theory insight in the outro**, not the intro (the learner has just produced
   the evidence — explanation after generation sticks better).
4. **Hint ladder of 2–4 rungs** (scaffolding + desirable difficulty): (1) redirect attention
   ("look at the shape of the goal"), (2) name the tool, (3) show the next step, (4) near-solution.
   Never put the solution in rung 1.
5. **Every choice option has feedback that addresses the misconception behind it**
   (misconception-targeted feedback beats right/wrong).
6. **English and Lean side by side** for every statement (dual representation; builds the
   translation skill needed for the capstone).
7. **Use concrete names and small cases before abstraction** (concreteness fading): e.g. a
   concrete `Nat` example before `(α : Type)`.
8. Vocabulary is introduced *before* it is used in a task (pre-training principle), via codex
   entries unlocked by the level.

### 5.2 World arc (applies inside every world)
`worked example → predict → completion → Parsons → independent problems → interleaved boss`
- **Worked example effect / fading**: open each new skill with a `predict` or `choice`-with-code
  level where the learner steps through a complete proof; then a *completion* problem (`proof`
  with a mostly-written `starter` containing one `sorry`); then a `parsons`; then full problems
  with `starter: "  sorry"`.
- **Generation / prediction**: `predict` levels make the learner commit before seeing the answer.
- **Interleaving + retrieval**: the last level is a `boss` that needs tools from *earlier worlds*
  as well; at least two other levels per world must reuse an earlier world's tactic.
- **Variation**: when a skill gets several problems, vary surface features (names, order,
  nesting) so the learner abstracts the schema, not the instance.
- Kind mix per world: roughly 55–65% `proof`, 10–15% `parsons`, 10–15% `predict`, 10–15%
  `choice`, and `formalize` from `quant` onward (≥ 1 per world, many in `forge`).
- **Dual-mode fluency**: tactic proofs and term proofs are both taught. From `props` on, at least
  one level per world is `mode: 'term'`, and several levels set `showTerm: true`.

### 5.3 Type theory thread (what "the necessary DTT" means)
By the end the learner should be able to explain, in order of introduction:
terms and types; function types and λ; currying; universes (`Type`, `Prop`); dependent function
types (Π) and that `∀` and `→` are the same construct; Curry–Howard; inductive types with
constructors/eliminators (`And`, `Or`, `False`, `Exists`, `Eq`, `Nat`); dependent pairs (`∃`);
definitional vs propositional equality; recursion and induction as one principle (`Nat.rec`);
predicates and sets as functions into `Prop`; proof irrelevance (briefly); what the kernel checks
(a proof term against a type) and what tactics are (programs that build terms); classical axioms
vs constructive core. Each is a `concept` codex entry, unlocked at the level that earns it.

### 5.4 Game layer (motivation without manipulation — self-determination theory)
- **Competence**: visible mastery (world progress, clean solves, review strength), immediate
  goal-state feedback, XP tied to learning events only.
- **Autonomy**: branching map (`nat`/`sets` in either order), optional side-quests, hints on
  request, "test out" of a world by beating its boss, a toggle to lift the tactic inventory lock.
- **Purpose**: the Codex fills up as a personal reference; the Workshop turns skills into the
  learner's *own* theorem.
- No dark patterns: no streak-loss punishment, no lives, no guilt messaging, nothing that blocks
  learning. **The curriculum (map, levels, review) has no timers.** Timers exist only in the
  Arena (§10), which is opt-in play on generated puzzles. Using hints never blocks progress;
  revealing the full solution marks the level "studied" and schedules it for re-solving.
- The game layer was extended in v2 (stars, player level, daily quests, celebrations, sound,
  the Arena): see §11.
- **Spaced retrieval**: completed levels enter a Leitner deck (boxes 1–5; intervals 1, 3, 7, 16,
  35 days). Review sessions interleave items across worlds; proof levels are re-solved from a
  blank starter (successive relearning). A post-solve self-rating (easy / right / hard) tunes the
  first interval (metacognitive monitoring).

### 5.5 Capstone: the formalization workflow
Taught explicitly in `forge` and embodied in the Workshop UI:
1. **Say it** — write the statement in careful English; mark every "for all", "there exists",
   "if … then".
2. **Type it** — what are the objects? Give each a type (`n : Nat`, `A : Set α`, `f : α → β`).
3. **Define it** — any notion not in the library becomes a `def` (usually a predicate).
4. **State it** — hypotheses as arguments, conclusion as the type; check it reads back correctly.
5. **Prove it** — skeleton first (`have`s with `sorry`), then fill; read every error.
Then: **Graduate** — move to real Lean + Mathlib (web editor, local install, library search,
automation tactics), with a phrasebook from game names to Mathlib names.

---

## 6. Content pipeline

- A world file exports `world: World` (schema in `src/content/types.ts`; follow the field docs
  there to the letter). Lean code goes in template strings; escape backslashes/backticks.
- Environment for a level = engine base library + lemma-bank entries selected by
  `levelContext(levelId)` (earlier `unlocks.lemmas`, plus `grants`). Base-library names
  (`Nat.add_succ`, `Set.mem_inter_iff`, `And.intro`, …) are always available; mention them in
  intros/codex when first needed.
- **Verification (mandatory before you report done):**
  `node scripts/verify-lean.ts <worldId>…` must print `✔` for each of your worlds: it compiles
  every solution, Parsons order, code snippet, accepted/mistake statement, codex example and bank
  lemma in real Lean. (The mini-engine pass is run at integration time by the orchestrator.)
- Write only Lean that §3 says the mini-engine supports. Prefer the idioms in
  `lean-verify/Game/Smoke.lean`. No `simp`, `omega`, `decide`, `exact?`, `aesop`, `grind` in
  solutions (they are discussed in the Graduate material only).
- `starter` must NOT already be a complete proof. Parsons `distractors` must make the proof fail.
- Style: second person, warm, precise, brief. No exclamation-mark hype. British/American
  spelling: American. Symbols typed as Unicode in content (`→ ∧ ∀ ∈`); the UI teaches input.

## 7. UI

Screens (hash routes): Home `#/`, Map `#/map`, World `#/world/:id`, Level `#/level/:id`,
Review `#/review`, Codex `#/codex`, Sandbox `#/sandbox`, Workshop `#/workshop`, Graduate
`#/graduate`, Profile/Settings `#/profile`, About `#/about`, Guide `#/guide` and
`#/guide/:id` (§9), Arena `#/arena`, `#/arena/:sub`, `#/arena/:sub/:arg` (§10), shared proof
card `#/share/:code` (§10.5).

- **Level screen** (the core loop; avoid split attention — task, editor and goal state visible
  together without scrolling on a laptop): task panel (title, English statement, intro markdown);
  read-only header + CodeMirror editor for the body; **live infoview** (goals at cursor via
  `engine.goalsAt`, diagnostics); inventory drawer (unlocked tactics / lemmas / codex with
  one-click docs); hint ladder; on success: outro, optional proof-term reveal, self-rating, next.
  Each level kind in `src/content/types.ts` has its own interaction (see field docs).
- **Editor**: Lean syntax highlighting; Unicode abbreviations (`\to` → `→`, etc., replaced on
  space/tab/non-identifier char) and a clickable symbol bar; debounced checking; error squiggles;
  clicking a hypothesis or inventory item inserts its name.
- **Friendly errors**: every `DiagnosticCode` maps to a short "what this means / what to try"
  explainer shown under Lean's raw message (raw message always visible — learners must learn to
  read real Lean errors).
- **Map**: the world graph with progress; locked/unlocked/complete states; "test out" entry.
- **Review**: spaced-repetition session per §5.4. **Codex**: collection of unlocked entries,
  searchable. **Sandbox**: free editor with everything unlocked, `#check/#eval`, and "Open in
  real Lean" (live.lean-lang.org with the code). **Workshop**: the §5.5 wizard; saves the
  learner's theorems. **Graduate**: the real-Lean guide from `src/content/graduate.ts`.
- Persistence: `localStorage`, versioned key, export/import save as JSON, reset.
- Quality bar: keyboard accessible, responsive down to phone width (symbol bar matters there),
  light + dark themes, reduced-motion respected, no layout shift on check, fast.
- Visual direction (v2, replaces the earlier "cartographer's notebook"): see §11. A monospaced
  font with solid math-symbol coverage for Lean is still required (verify glyphs like
  `⊢ ∀ ∃ ⟨ ⟩ ᶜ ⁻¹ ⦃ ⦄ ∣ ✝` render).

## 8. Definition of done (whole project)

1. `npm run build`, `npm test`, `npm run typecheck` pass.
2. Every level's reference solutions pass the mini-engine under that level's inventory, and real
   Lean; every starter fails; every Parsons distractor-only ordering fails.
3. A new learner can play from first level to the Workshop with no dead ends.
4. Published: public GitHub repo + GitHub Pages.

---

## 9. Prose layers (v2)

The game explains itself in four layers, from shortest to longest. Schema and the fence
convention for code blocks are in `src/content/types.ts` ("Prose layers").

| Layer | Where | Length | Job |
|---|---|---|---|
| Level `intro` / `outro` | task panel | ≤ 120 / ≤ 80 words | the task; the insight just earned |
| **Lesson** (`LevelLesson`) | task panel, under the intro, collapsible, open by default on an unsolved level | 130–280 words (+ optional pitfall, real-Lean note) | explain the idea properly, with a worked example that is not the task |
| **Primer** / recap (`WorldLessons`) | world page | 400–700 / 80–160 words | the chapter: the question this world answers, its notions in order |
| **Guide** (`GuideArticle`) | `#/guide` | 500–1000 words each | Lean itself: what it is, what it can do, how it works, its ecosystem |

Plus `ScreenIntro` copy (`src/content/screens.ts`): every screen says what it is for and how to
use it.

Rules for all prose:
- Written for a curious adult with school mathematics and no Lean. Define every term at first
  use. Prefer a concrete example to an abstract description. Say *why* Lean does it this way.
- Second person, warm, precise, plain. No hype, no exclamation marks, no filler openings, no
  rhetorical questions as headings. American spelling. Unicode symbols in Lean (`→ ∧ ∀ ∈`).
- A lesson never contains its level's solution, and uses only what has been taught by then
  (the checker enforces this for ```lean blocks: they run under the level's inventory).
- Every ```lean block is a complete declaration and is compiled by both engines; fragments and
  goal states go in ```text. Run `node scripts/verify-mini.ts <world>` and
  `node scripts/verify-lean.ts <world>` (`--guide` for the Guide); both enforce word limits.
- Claims about real Lean, Mathlib and their ecosystem must be true as of writing and hedged
  where they date quickly (version numbers, sizes, URLs). No invented names, quotes or numbers.

## 10. Arena (v2): generated puzzles, ratings, and play with other people

The curriculum is finite; the Arena is not. It gives a reason to come back every day and
something to send to a friend. Everything runs on static hosting.

### 10.1 Generator (`src/arena/gen`, contract `src/arena/types.ts`)
Pure and deterministic: the same `(seed, family, target)` yields the same puzzle in every
browser, so a seed in a URL *is* a shared puzzle. No `Math.random`, no `Date`. Every generated
proof puzzle carries a reference solution that the mini-engine accepts under the puzzle's
`allowedTactics`; `scripts/verify-arena.ts` samples the generator and compiles the samples in
real Lean. Families: `prop`, `inhabit`, `quant`, `set`, `quick` (see the contract). Puzzles are
rated 400–2400 by an estimate of proof difficulty. `src/arena/plan.ts` (frozen) turns seeds
and dates into the sets each mode plays: `dailySet`, `rushSlot`, `duelSet`, `sequence`, `nth`.

### 10.2 Modes
- **Daily Proof** — one fixed set per calendar day (UTC), the same for everyone: three puzzles
  of rising rating. A clock counts up; nothing times out. Result is shareable as text
  (date, per-puzzle marks, time, link). A daily streak is counted.
- **Rated puzzles** — endless, one at a time, near the player's rating. Solving raises the
  player's Arena rating, failing or skipping lowers it (Elo-style, starting at 800).
- **Proof Rush** — timed (3 or 5 minutes) or Survival (three strikes): `quick` items only,
  rating rising as you go. Personal bests.
- **Duel** — two players race the same seeded set.
  - *Bot*: an always-available ladder of named bots with ratings; a bot finishes each puzzle at
    a random time drawn from its rating versus the puzzle's. Always labelled as a bot.
  - *Friend, live*: peer-to-peer over WebRTC. The host shares a room link; signalling goes
    through a public broker; game data flows directly between the two browsers. If no
    connection forms, the UI offers the challenge link instead.
  - *Friend, challenge link*: the link carries the seed and the sender's result; the receiver
    plays the same set whenever they like and can send a link back.
- Friend games are unrated. There is no public matchmaking (it would need a server).

### 10.3 State
Arena state (rating, history, bests, daily results, display name) lives in its own store under
its own `localStorage` key and is included in the save export. The Arena reports to the main
game store through `game().recordEvent(e)` (`src/state/events.ts`), which awards XP and advances
daily quests and badges.

### 10.4 Fair play and honesty
No accounts and no server means results are on the honour system; say so where it matters.
The live duel connects two browsers directly, so each side's IP address is visible to the
other and to the signalling broker; the UI says this before connecting. No analytics, no
tracking, no third-party requests outside a live duel.

### 10.5 Proof cards
`#/share/<code>` renders a shared theorem and proof (from a level, the Workshop, the Sandbox or
an Arena puzzle). The recipient's own browser re-checks the proof with the engine and shows the
verdict; the proof is hidden until they choose to see it, with an invitation to try first.

## 11. Game layer and visual design (v2)

### 11.1 Direction
Energetic, tactile, dark-first: the feeling of a well-made game site for a strategy game —
bold type, deep background, one vivid primary colour used for the action you want next, chunky
buttons with a pressed state, clear ranks and numbers, motion that rewards. It must remain
Inhabit's own: do not reproduce another product's palette values, logo, piece art or typeface.
Inhabit's motifs are the turnstile `⊢`, `λ`, and the connective glyphs (`→ ∧ ∨ ¬ ∀ ∃ = ∈`),
which serve as world emblems the way pieces do on a chess site.

- Layout: persistent left sidebar on desktop (brand, primary nav with icons, player card with
  level, XP bar, streak, Arena rating); icon rail at medium widths; bottom tab bar on phones.
- Tokens on `:root` for both themes; dark is the designed default, light stays first-class.
- The level screen keeps §7's rule: task, editor and goal state visible together.
- Reading surfaces (lessons, primers, Guide) are set for long reading: comfortable measure,
  larger line-height, clear heading hierarchy.
- Accessibility bar unchanged: keyboard, focus rings, contrast AA, reduced motion respected,
  phone width without horizontal scroll. Sound is on by default, quiet, synthesised (no audio
  files), with an obvious mute toggle that is remembered.

### 11.2 Mechanics
- **Stars** (0–3 per level): 1 = passed; 2 = solved cleanly (no hints, solution not shown);
  3 = clean and later re-solved in Review at least once (retention). World pages and the map
  total them. Stars are derived from existing save data.
- **Player level** from total XP (a smooth curve), shown with a progress bar; rank titles stay.
- **Daily quests**: three per day, chosen deterministically from the date and the player's
  state (e.g. solve 2 levels, clear your review queue, finish the Daily Proof, read a Guide
  article). Completing gives XP. Unfinished quests simply expire; nothing is lost.
- **Streak**: consecutive active days, with one automatic rest day per week forgiven. Shown
  with a flame; a broken streak is never announced as a loss.
- **Achievements**: the badge list grows to cover stars, quests, the Arena and reading.
- **Celebration** proportional to the event: a tick and a sound for a level, a burst for a
  boss, a full celebration with the world recap for a world.
- XP is still tied to learning or play events only; nothing can be bought or lost.
