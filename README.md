# Inhabit

A browser game that teaches the Lean 4 theorem prover and the dependent type theory beneath it.

**Play it at https://polionus.github.io/inhabit/.** It runs entirely in your browser, with no install, no account and no server. Progress is saved in the browser's local storage and can be exported and imported as JSON.

The name is the core idea: to prove a proposition is to inhabit a type.

## What you will learn

By the end, you can take a mathematical statement of your own, formalize it in Lean by choosing types, writing definitions and stating the theorem, and prove it. You can also explain what a proof is in type-theoretic terms.

## What is in it

- **10 worlds and 137 levels** on a branching map. The main path runs from Basecamp (terms, types, functions) through Proposition Peaks (propositions as types), Connective Canyon (and, or, not, iff), Quantifier Quay (for all, exists) and Equality Estuary (rfl, rewriting). It then splits. One branch covers Induction Isles (natural numbers, induction) and Divisor Dunes (divisibility, parity). The other covers Set Savanna (sets as predicates) and Function Fjord (injective, surjective, images), which ends with Cantor's theorem. Both meet at Formalization Forge, where you state and prove a theorem of your own.
- **Five kinds of exercise:** writing a proof, arranging shuffled proof lines, predicting the goal after a tactic, concept checks, and translating English into a Lean statement.
- **A live goal view** like Lean's infoview, with Lean's real error messages and a plain-language explanation underneath. Unicode input uses the Lean VS Code extension's abbreviations, so `\to` produces `→`.
- **Lessons and reading:** a lesson beside every level (137 of them), a primer and a recap for each world, a blog-style explainer for each of the ten chapters (`#/chapter/<world>`, linked from the roadmap), and a Guide of 16 long-form articles about Lean. All Lean code in this prose is compiled by both engines.
- **Gallery:** eight interactive exhibits that make the ideas visible: proof replay (goals before and after each line while the proof term grows), truth tables with a constructive-provability verdict, the quantifier game, rewrite and compute, induction dominoes, a Venn playground, function arrows, and Cantor's diagonal. Anything shown as Lean comes from the game's checker or prover.
- **Roadmap:** the map page opens on a readable list of chapters, each with its big idea, your progress, its explainer, and the contents (every level, with the tactics it introduces). The node map is one click away.
- **Progress that reflects your own work:** a level solved unaided earns stars (one with hints, two without, three once re-solved in Review); a level whose solution you looked at stays open but earns nothing until you solve it yourself. Also a player level, three daily quests that fit where you are, a streak that forgives one rest day a week, and 41 achievements.
- **Help that reads your goal:** when you are stuck, the game describes your current goal in plain words and asks what it needs, then (as a hint) names a tactic you have unlocked that fits. Errors are shown one at a time, calmly, with Lean's real message.
- **Practice:** after a level, a short set of generated problems on the same tactic, limited to what you have unlocked; a smaller version when you are stuck; and Translate, which drills turning English sentences into Lean statements (equivalent phrasings are accepted).
- **Editor:** line numbers, `\` abbreviations for symbols, and completion for the tactics you have unlocked, the lemmas in your inventory and the hypotheses in scope.
- **The Arena:** generated puzzles in five families (propositional proofs, writing terms, quantifiers, sets, and quick multiple-choice questions), each with a reference proof that the engine accepts. A Daily Proof is the same three puzzles for everyone on each UTC day. Rated puzzles carry an Elo-style rating. Proof Rush is a timed or survival run through quick questions. Duels are against rated bots, against a friend live, or by challenge link.
- **Proof cards:** a link that carries a theorem and its proof. The recipient's browser re-checks the proof before showing the verdict.
- **Supporting material:** a Codex that fills in as you play, a short daily review (at most five levels), a Sandbox, and a Workshop with 17 suggested theorems.

## How it works

Lean code is checked in the browser by a purpose-built "mini-Lean" engine in TypeScript (`src/engine`): a parser for a subset of Lean 4 syntax, a small dependent-type-theory kernel, an elaborator, and about 40 tactics. Tactics build real proof terms, which the kernel re-checks, and the game can show you the term they built.

The engine is a faithful subset, not real Lean. It has no type classes and no automation such as `simp` or `omega`, and it handles natural numbers only. Names and statements mirror Lean core and Mathlib so that what you learn transfers.

Fidelity is tested against the real thing. Every reference solution is compiled by Lean 4 (v4.25.1) in CI, using `lean-verify/`, a small Lean project that mirrors the game's library. A differential corpus checks that the engine and real Lean agree on which snippets are accepted, and a soundness suite of adversarial inputs guards the kernel.

The Arena's puzzles come from a generator in `src/arena/gen`. It is seeded and deterministic: the same seed and family give the same puzzle in every browser. An intuitionistic propositional prover produces the reference proofs. Every generated puzzle is checked by the engine when it is made, so a puzzle that the engine cannot solve is never offered. `npm run verify:arena` compiles a sample of each family in real Lean, and CI runs it too.

## How the teaching is designed

Each level introduces one new idea. Within a world, a skill moves from a worked example, to predicting what a tactic will do, to finishing a partly written proof, to arranging shuffled lines, to solving on your own. Each world ends with a boss level that mixes earlier skills, and solved levels come back later for spaced review. Hints form a ladder from a nudge to a near-solution, and wrong answers get feedback aimed at the specific misconception.

The curriculum (map, levels and review) has no timers, lives or penalties. The Arena is optional and is the only place with timed play. Its Daily Proof clock counts up and nothing times out. The full rationale is in `docs/SPEC.md`, section 5.

## Multiplayer without a server

The site is static, so there's no matchmaking, and results are on the honor system. Because the generator is deterministic, a seed in a link is a shared puzzle set: two players with the same seed solve the same puzzles. A live duel connects the two browsers directly over WebRTC, using the PeerJS public broker only for signaling. Each player's IP address is therefore visible to the other player and to that broker, and the game says so before it connects. Nothing else leaves the browser.

## Development

Requires Node 24 or newer. Lean 4 via elan is optional and needed only for `npm run verify:lean`.

```sh
npm install
npm run dev          # local dev server (Inhabit)
npm run dev:starter  # local dev server for the non-Lean starter disc (Patterncraft)
npm test             # unit tests
npm run verify:mini  # reference solutions, in-browser engine
npm run verify:lean  # reference solutions, real Lean 4
npm run verify:arena # sample of generated Arena puzzles, real Lean 4
npm run build        # typecheck and build into dist/ (or VITE_GAME=starter npm run build:starter)
```

Layout (reusable template vs. pluggable discs):

- `src/template`: subject-agnostic game engine/shell, state/persistence, spaced review, quests, theme system, and built-in level kinds (`choice`, `order`, `text`)
- `src/domains/lean`: optional Lean domain pack (mini-Lean engine, CodeMirror editor, coach, Lean level kinds)
- `src/games/inhabit`: the Inhabit disc (worlds, lessons, Arena, Gallery, Practice)
- `src/games/starter`: Patterncraft — a small non-Lean regex learning disc proving reusability and custom theming (`TERRACOTTA_PRESET`)
- `src/games/registry.ts`: build-time disc selection via `VITE_GAME`
- `scripts`, `lean-verify`: verification, the screenshot helper (`scripts/shot.ts`, for visual checks), and the real-Lean mirror
- `docs/SPEC.md` & `docs/TEMPLATE.md`: architecture, the Lean subset, pedagogy rules, and how to author new game discs & custom themes

Fenced code in prose follows a convention documented in `src/games/inhabit/content/types.ts`. Code marked `lean` is a complete declaration and is compiled by both engines. Other blocks are not compiled. The verify scripts check the convention.

To add or change an Inhabit level, edit the world file in `src/games/inhabit/content/worlds/`, then run both verify commands. Every solution must pass both engines.

## Limitations

- The engine implements a subset of Lean 4, so some valid Lean is rejected.
- Solutions are verified against core Lean 4. The "Open in real Lean" hand-off to Mathlib, via https://live.lean-lang.org, has not been tested against Mathlib itself, so a name may occasionally need adjusting there.
- Live duels need both players online at the same time, and they depend on the PeerJS broker. If no connection forms, the Arena offers a challenge link instead.

## Acknowledgements

Inspired by the Natural Number Game and the Lean community's teaching games. The Unicode abbreviation table is a curated subset of the Lean 4 VS Code extension's table (Apache-2.0). Built with Claude (Anthropic).

## License

MIT. See [LICENSE](LICENSE).
