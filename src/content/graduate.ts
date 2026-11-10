import type { GraduateSection, PhrasebookRow } from './types.ts';

/** The Graduate guide: moving from this game to real Lean 4 and Mathlib. */
export const graduate: GraduateSection[] = [
  {
    id: 'real',
    title: 'What you already know is real',
    body: `The Lean in this game is a **subset of real Lean 4**, not a toy language. Every reference solution in the game was compiled by the real Lean 4 compiler, and the syntax you typed (\`theorem\`, \`intro\`, \`rw\`, \`obtain\`, \`⟨a, b⟩\`, \`fun x => …\`) is what Lean users type every day.

The game left things out on purpose, so that you could see how the core works:

- **Type classes**: the machinery that makes \`+\` work on numbers, integers, real numbers and more. In the game, \`+\` was just addition on \`Nat\`.
- **Structures and universe polymorphism**: you used \`Prop\`, \`Type\` and \`Type 1\`, but not \`Sort u\` in general.
- **Order on \`Nat\`**: \`≤\` and \`<\` were parsed but never proved with.
- **Real numbers, integers and fractions**, and the large algebra libraries around them.
- **Automation**: tactics that find proofs for you (next sections).

None of this changes what a proof is: a term whose type is the statement, checked by a small kernel.`,
  },
  {
    id: 'browser',
    title: 'Try real Lean in your browser',
    body: `The quickest step needs no installation: the Lean web editor at **https://live.lean-lang.org**.

The Sandbox and the Workshop have an **Open in real Lean** button. It sends your code to that page with \`import Mathlib\` at the top, so you can see how real Lean checks it. The first run may take a little while, because Mathlib is large.

The editor looks like the game's: your code on the left, the **infoview** on the right. Put the cursor on a line to see the hypotheses and the goal (\`⊢\`) at that point, and any error messages. Errors are underlined in the code, and the infoview shows their text, in the same three-part form you practiced reading: where, expected, got.

Things may print slightly differently from the game, or need small edits; the next sections say what to expect.`,
  },
  {
    id: 'install',
    title: 'Install it',
    body: `For projects bigger than an experiment, install Lean on your own computer. The usual route:

1. Install **Visual Studio Code**.
2. Install the official **Lean 4** extension. It has a setup guide that walks you through installing the Lean toolchain with **elan**, the Lean version manager.
3. Create a project that depends on **Mathlib**, the community library of mathematics.

Follow the official instructions rather than a recipe from memory, since details change between versions:

- https://lean-lang.org/install/
- https://leanprover-community.github.io/get_started.html

The Mathlib pages explain how to create a project and how to download Mathlib's pre-built files, which saves a long compile. Once it works, open a \`.lean\` file in VS Code and you are in the same infoview you know from the game, with your own files.`,
  },
  {
    id: 'automation',
    title: 'Automation: the tactics we withheld',
    body: `You proved \`0 + n = n\` by induction, step by step. In real Lean you would write \`simp\`. We made you do it by hand first, because automation is only trustworthy once you can tell what it did, and what to do when it fails.

- \`simp\`: rewrites with a large set of simplification lemmas. First thing to try.
- \`omega\`: linear arithmetic over \`Nat\` and \`Int\`.
- \`decide\`: settles closed, decidable statements by computation.
- \`ring\` (Mathlib): equalities in commutative rings. Replaces long \`rw\` chains.
- \`linarith\` (Mathlib): linear inequalities from hypotheses.
- \`norm_num\` (Mathlib): numeric calculations.
- \`exact?\` / \`apply?\`: search the library for a lemma that closes or advances the goal.
- \`aesop\`: general-purpose proof search.
- \`grind\`: a newer, powerful automation in Lean itself.
- \`tauto\` (Mathlib): propositional logic.
- \`push_neg\` (Mathlib): pushes \`¬\` through quantifiers, e.g. \`¬∀ x, P x\` into \`∃ x, ¬P x\`.

Automation is a tool, not a replacement: you still need to know what you want to prove.`,
  },
  {
    id: 'finding',
    title: 'Finding lemmas',
    body: `Real libraries have hundreds of thousands of theorems. You find them in three ways.

**Names follow a pattern.** You have been using it: \`Nat.add_comm\`, \`Set.inter_subset_left\`, \`Function.Injective.comp\`. Namespace first, then a description of the statement: \`inter_comm\`, \`subset_union_left\`. \`_left\` and \`_right\` say which side, \`_iff\` marks an equivalence, \`_of_\` precedes the hypothesis.

**Ask Lean.** In a proof, \`exact?\` searches for a lemma that closes the goal.

**Search engines**:

- Loogle, search by pattern or type: https://loogle.lean-lang.org
- LeanSearch, search in plain English: https://leansearch.net
- Moogle, another natural-language search: https://www.moogle.ai
- The Mathlib documentation: https://leanprover-community.github.io/mathlib4_docs/

If a statement feels like it should be in the library, it probably is, with the name you would have guessed after practice. Always search before you prove or define something.`,
  },
  {
    id: 'differences',
    title: 'Differences you will notice',
    body: `- **\`ℕ\`** is notation for \`Nat\` (type \`\\N\`). Same type.
- **General lemmas**: where the game says \`Nat.add_comm\`, Mathlib prefers \`add_comm\`, which works on every additive structure. The \`Nat\` versions still exist.
- **\`Even\` and \`Odd\`** are defined for many types, not just \`ℕ\`; for \`ℕ\` they unfold the way you know.
- **Sets** (\`Set\`, \`∈\`, \`⊆\`, \`∪\`, \`''\`, \`⁻¹'\`) and **\`use\`, \`by_contra\`, \`ext\`, \`obtain\`, \`rcases\`** work the same.
- **Type classes** hide behind \`+\` and \`*\`: you will see them in error messages and in the signatures of lemmas.
- **\`Finset\`**: Mathlib has finite sets (\`Finset\`) alongside \`Set\`, with different lemmas. Pick the one that matches your statement.
- **Printing**: real Lean may show \`n.succ\` or \`n + 1\` where the game showed the other, and prints some goals with more detail.
- **Order and the real numbers** exist, with \`≤\`, \`<\`, \`linarith\` and \`norm_num\`.

When a game proof does not compile as-is, read the error; it is usually a renamed lemma.`,
  },
  {
    id: 'next',
    title: 'Where to go next',
    body: `Pick what fits your goal.

- **Theorem Proving in Lean 4**: the official book. The best account of the type theory behind Lean (dependent types, inductive types, type classes). Read it next if you liked the "why" in this game.
- **Mathematics in Lean**: a book of exercises that teaches Mathlib through everyday mathematics: sets, functions, number theory, analysis. Read it if you want to formalize mathematics.
- **The Mechanics of Proof**: a course on how to write proofs, using Lean for exercises. Good for the proof-writing side.
- **The Natural Number Game and other games**, on the Lean Game Server: https://adam.math.hhu.de. More practice in the same spirit, with other topics.
- **The Lean Zulip chat**: https://leanprover.zulipchat.com. Where Lean users ask for help; beginners are welcome in the beginner channels. Include your code and the error message.

Search for the exact title of each book to find its current home page.`,
  },
  {
    id: 'project',
    title: 'A first project checklist',
    body: `The five steps still apply. In Mathlib:

1. **Say it.** Write the statement in careful English, marking the quantifiers.
2. **Type it.** Choose the types. Mathlib favors general statements (a type variable \`α\`, or an algebraic structure) over fixed ones such as \`ℕ\`, when the mathematics allows it.
3. **Define it, after searching.** Search Mathlib first (Loogle, LeanSearch, \`exact?\`). The notion you want has often been defined, with a rich supply of lemmas. Define your own only when nothing fits.
4. **State it.** Write the statement with \`sorry\` as the proof, and check that it compiles and reads back correctly *before* proving.
5. **Prove it in small lemmas.** Skeleton first, with \`have … := by sorry\`, then fill. Split long proofs into named lemmas. Try \`exact?\` and \`simp\` on small goals, and read every error.

Keep the project in git, and ask on Zulip when stuck. A good first goal: re-prove, in Mathlib, a theorem you proved in this game, then one you invented in the Workshop.`,
  },
];

/** Game names and idioms mapped to their Mathlib counterparts. */
export const phrasebook: PhrasebookRow[] = [
  { game: 'Nat', mathlib: 'ℕ', note: '`ℕ` is notation for `Nat`; type it as `\\N`.' },
  {
    game: 'Nat.add_comm, Nat.mul_comm, Nat.add_assoc',
    mathlib: 'add_comm, mul_comm, add_assoc',
    note: 'The general versions work in any commutative or associative structure. The `Nat.` versions also still exist.',
  },
  { game: 'Nat.zero_add', mathlib: 'zero_add', note: 'Also `Nat.zero_add`.' },
  { game: 'Nat.two_mul', mathlib: 'two_mul', note: '`2 * a = a + a`.' },
  { game: 'Nat.add_left_comm', mathlib: 'add_left_comm', note: '`a + (b + c) = b + (a + c)`.' },
  {
    game: 'Nat.dvd_trans',
    mathlib: 'dvd_trans',
    note: 'The `Nat.` version exists too; there is also dot notation, `h1.trans h2`.',
  },
  { game: 'Nat.dvd_add', mathlib: 'dvd_add', note: 'Also `Nat.dvd_add`.' },
  { game: 'Nat.dvd_mul_right a b : a ∣ a * b', mathlib: 'dvd_mul_right a b', note: 'Also `Nat.dvd_mul_right`.' },
  { game: 'Nat.dvd_refl', mathlib: 'dvd_refl', note: '`dvd_rfl` is the version with an implicit argument.' },
  {
    game: 'Even n (unfolds to ∃ r, n = r + r)',
    mathlib: 'Even n',
    note: 'The same definition, for any additive structure. For `ℕ`, search for lemmas such as `Nat.even_iff` that connect it to `n % 2 = 0`.',
  },
  {
    game: 'Even.add, Even.mul_right, Nat.even_or_odd',
    mathlib: 'Even.add, Even.mul_right, Nat.even_or_odd',
    note: 'Mathlib has lemmas with these names. Check the exact form with `#check` or Loogle.',
  },
  { game: 'Set.Subset.trans', mathlib: 'Set.Subset.trans', note: 'Also `subset_trans`, or `h1.trans h2`.' },
  { game: 'Set.inter_comm, Set.union_comm', mathlib: 'Set.inter_comm, Set.union_comm', note: 'Same names.' },
  {
    game: 'Set.inter_subset_left, Set.inter_subset_right, Set.subset_union_left',
    mathlib: 'Set.inter_subset_left, Set.inter_subset_right, Set.subset_union_left',
    note: 'Same names; check with `#check` whether the sets are implicit arguments.',
  },
  { game: 'Set.compl_union', mathlib: 'Set.compl_union', note: 'De Morgan for sets.' },
  {
    game: 'Set.inter_union_distrib_left',
    mathlib: 'Set.inter_union_distrib_left',
    note: 'Search for it with `exact?` or Loogle to confirm the exact form.',
  },
  {
    game: 'Set.mem_inter_iff, Set.mem_union, Set.mem_diff, Set.mem_compl_iff',
    mathlib: 'Set.mem_inter_iff, Set.mem_union, Set.mem_diff, Set.mem_compl_iff',
    note: 'Same names. `simp` uses them automatically.',
  },
  { game: "f '' A,  f ⁻¹' B", mathlib: "f '' A,  f ⁻¹' B", note: 'Same notation. `Set.mem_image` and `Set.mem_preimage` unfold membership.' },
  { game: "Set.preimage_inter, Set.subset_preimage_image", mathlib: 'Set.preimage_inter, Set.subset_preimage_image', note: 'Mathlib has both; check the form with `#check`.' },
  { game: 'Function.Injective.comp, Function.Surjective.comp', mathlib: 'Function.Injective.comp, Function.Surjective.comp', note: 'Same names; they are also used as `hg.comp hf`.' },
  {
    game: 'Function.LeftInverse.injective',
    mathlib: 'Function.LeftInverse.injective',
    note: 'Same name. For the converse and relatives, search for `Function.LeftInverse`.',
  },
  {
    game: 'Function.Surjective.of_comp, Function.Injective.of_comp',
    mathlib: 'search with `exact?` or Loogle',
    note: 'Mathlib has cancellation lemmas for composites. Search for them by their statement; do not rely on the exact names.',
  },
  { game: 'Function.cantor_surjective', mathlib: 'Function.cantor_surjective', note: "Cantor's theorem is in Mathlib under this name." },
  { game: 'iff_not_self', mathlib: 'iff_not_self', note: '`¬(a ↔ ¬a)`.' },
  { game: 'Classical.em', mathlib: 'Classical.em, em, by_cases', note: '`by_cases` and `by_contra` work as in the game; `em p` gives `p ∨ ¬p`.' },
  {
    game: 'use w   /   exists w',
    mathlib: 'use w',
    note: '`exists w` is core Lean; `use` is Mathlib and tries `rfl` afterwards. `refine ⟨w, ?_⟩` is the common ancestor.',
  },
  {
    game: 'by_contra h, then work with h : ¬P',
    mathlib: 'by_contra h, by_contra!, push_neg',
    note: '`by_contra!` also pushes the negation inwards, so `¬∀ x, P x` becomes `∃ x, ¬P x`.',
  },
  {
    game: '¬∀ x, P x ↔ ∃ x, ¬P x  (needs by_contra)',
    mathlib: 'not_forall, not_exists, push_neg',
    note: 'One-line versions of what you proved by hand.',
  },
  {
    game: 'obtain ⟨x, hx⟩ := h,  rcases,  rintro,  ext x',
    mathlib: 'obtain ⟨x, hx⟩ := h,  rcases,  rintro,  ext x',
    note: 'Identical. `ext` also reaches function and set equality.',
  },
  {
    game: 'a long chain of rw [Nat.add_assoc, Nat.add_comm, …]',
    mathlib: 'ring, omega, simp',
    note: '`ring` proves equalities in commutative rings; `omega` handles linear arithmetic on `ℕ` and `ℤ`.',
  },
  {
    game: 'repeat, all_goals, try',
    mathlib: 'repeat, all_goals, try',
    note: 'Identical; real Lean also has `any_goals`, `first | t1 | t2` and `<;>`.',
  },
  {
    game: 'induction n with | zero => … | succ k ih => …',
    mathlib: 'induction n with | zero => … | succ k ih => …',
    note: 'Identical. In Mathlib the goal may print `k + 1` or `k.succ`; they are equal by `rfl`.',
  },
];
