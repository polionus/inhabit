import type { GraduateSection, PhrasebookRow } from './types.ts';

/** The Graduate guide: moving from this game to real Lean 4 and Mathlib. */
export const graduate: GraduateSection[] = [
  {
    id: 'real',
    title: 'What you already know is real',
    body: `The Lean you wrote here is a **subset of real Lean 4**, not a toy language. Every reference solution in the game compiles under the real Lean 4 compiler, and the syntax you practiced (\`theorem\`, \`intro\`, \`rw\`, \`obtain\`, \`⟨a, b⟩\`, \`fun x => …\`) is what Lean programmers write every day.

We left a few big pieces out on purpose so you could see how the core machinery works first:

- **Type classes**: the system that lets \`+\` work on natural numbers, integers, reals, and matrices alike. Here, \`+\` only meant \`Nat\` addition.
- **Structures and universe polymorphism**: you saw \`Prop\`, \`Type\`, and \`Type 1\`, but not general \`Sort u\` polymorphism.
- **Order on \`Nat\`**: \`≤\` and \`<\` were parsed, not proved with.
- **Integers, rationals, real numbers**, and the broader algebra libraries built around them.
- **Automation**: tactics that close routine goals for you (covered below).

None of those change what a proof actually is—a term whose type is the theorem statement, checked by a small kernel.`,
  },
  {
    id: 'browser',
    title: 'Try real Lean in your browser',
    body: `The fastest way to try full Lean needs no install at all: open the Lean web editor at **https://live.lean-lang.org**.

Both the Sandbox and the Workshop have an **Open in real Lean** button that sends your code straight there with \`import Mathlib\` at the top. Give the first run a few seconds—Mathlib is huge, so loading it takes a moment.

The layout will feel right at home: code on the left, live **infoview** on the right. Move your cursor to any line to inspect the hypotheses, the goal (\`⊢\`), and any diagnostics. Errors underline in the editor and follow the same three-part structure you already know how to read: where, expected, got.

A few goals may print slightly differently, or a lemma name may need a small tweak; the phrasebook below explains what to expect.`,
  },
  {
    id: 'install',
    title: 'Install it locally',
    body: `Once you want to work on anything larger than a quick experiment, install Lean on your computer. The standard setup is straightforward:

1. Install **Visual Studio Code**.
2. Install the official **Lean 4** extension, which includes a guided setup for **elan** (Lean's version manager).
3. Create a project that depends on **Mathlib**, the community mathematics library.

Follow the official guides rather than an old recipe, since setup flags occasionally change between versions:

- https://lean-lang.org/install/
- https://leanprover-community.github.io/get_started.html

Make sure to grab Mathlib's pre-built cache (the Mathlib guide shows the one-line command) so you don't sit through a long compile. Open any \`.lean\` file in VS Code and you'll have the same live infoview you're already used to.`,
  },
  {
    id: 'automation',
    title: 'Automation: the tactics we held back',
    body: `You proved \`0 + n = n\` by induction, step by step. In real Lean, you'd just write \`simp\`. Doing it by hand first pays off: automation is much easier to trust—and debug when it stalls—once you know what it's building underneath.

- \`simp\`: rewrites with a large database of simplification lemmas. Usually the first thing to try.
- \`omega\`: solves linear arithmetic over \`Nat\` and \`Int\`.
- \`decide\`: closes concrete, decidable statements by computation.
- \`ring\` (Mathlib): proves equalities in commutative rings, replacing long \`rw\` chains.
- \`linarith\` (Mathlib): handles linear inequalities from your hypotheses.
- \`norm_num\` (Mathlib): evaluates concrete numerical expressions.
- \`exact?\` / \`apply?\`: searches the library for a lemma that closes or advances your goal.
- \`aesop\`: general-purpose proof search.
- \`grind\`: a newer built-in solver in recent Lean versions.
- \`tauto\` (Mathlib): closes propositional logic goals.
- \`push_neg\` (Mathlib): pushes \`¬\` inside quantifiers, turning \`¬∀ x, P x\` into \`∃ x, ¬P x\`.

Automation handles the plumbing, not the insight—you still decide the shape of the proof.`,
  },
  {
    id: 'finding',
    title: 'Finding lemmas in Mathlib',
    body: `Real libraries hold hundreds of thousands of theorems, so nobody memorizes them. You find what you need in three ways:

**Read the naming pattern.** You've already been using it: \`Nat.add_comm\`, \`Set.inter_subset_left\`, \`Function.Injective.comp\`. Namespace first, then a description of the statement (\`inter_comm\`, \`subset_union_left\`). Suffixes carry meaning too: \`_left\` and \`_right\` pick a side, \`_iff\` marks an equivalence, and \`_of_\` introduces the hypothesis.

**Ask Lean directly.** Drop \`exact?\` or \`apply?\` into a proof and Lean will search for a matching lemma.

**Use the search tools:**

- Loogle (search by type or pattern): https://loogle.lean-lang.org
- LeanSearch (search in plain English): https://leansearch.net
- Moogle (natural-language search): https://www.moogle.ai
- Mathlib docs: https://leanprover-community.github.io/mathlib4_docs/

If a lemma feels like it ought to exist in Mathlib, it almost certainly does—always search before proving or defining something from scratch.`,
  },
  {
    id: 'differences',
    title: "Differences you'll notice",
    body: `- **\`ℕ\`** is Mathlib's notation for \`Nat\` (type \`\\N\`). Same type underneath.
- **More general lemmas**: where this game uses \`Nat.add_comm\`, Mathlib usually reaches for \`add_comm\`, which works in any commutative additive structure. The \`Nat.\` versions are still there too.
- **\`Even\` and \`Odd\`** are defined generally across algebraic structures, not just \`ℕ\`; on \`ℕ\` they behave the way you're used to.
- **Sets** (\`Set\`, \`∈\`, \`⊆\`, \`∪\`, \`''\`, \`⁻¹'\`) and tactics like **\`use\`, \`by_contra\`, \`ext\`, \`obtain\`, \`rcases\`** work the same way.
- **Type classes** sit behind \`+\` and \`*\`, so you'll start seeing square brackets like \`[AddCommMonoid α]\` in lemma signatures and error messages.
- **\`Finset\`**: Mathlib has finite sets (\`Finset\`) alongside \`Set\`, with their own lemmas—pick whichever matches your theorem.
- **Goal printing**: real Lean may print \`n.succ\` or \`n + 1\` where the game showed the other, and can show a bit more detail in complex goals.
- **Order and real numbers**: \`≤\`, \`<\`, \`ℤ\`, \`ℚ\`, and \`ℝ\` are all available, paired with \`linarith\` and \`norm_num\`.

When a proof from the game doesn't compile verbatim in real Lean, read the error carefully—it's usually just a slightly different lemma name or implicit argument.`,
  },
  {
    id: 'next',
    title: 'Where to go next',
    body: `Pick whichever resource fits what you want to do next:

- **Theorem Proving in Lean 4**: the official book, and the clearest deep dive into Lean's type theory (dependent types, inductive types, type classes). Great next step if you enjoyed the "why" behind this game.
- **Mathematics in Lean**: an exercise-driven book that teaches Mathlib through standard math—sets, functions, number theory, analysis. Best choice if you want to formalize mathematics.
- **The Mechanics of Proof**: a proof-writing course using Lean for exercises. Great if you're building proof skills alongside Lean.
- **The Natural Number Game and other Lean games** at https://adam.math.hhu.de: more interactive games in the same spirit, covering other areas of math.
- **The Lean Zulip chat** at https://leanprover.zulipchat.com: the main community hub. Beginners are genuinely welcome in the new-members channels—just paste a small working snippet and the error you're seeing.

Search for any of the book titles above to find their current home pages.`,
  },
  {
    id: 'project',
    title: 'A first project checklist',
    body: `The same five steps from the Workshop carry straight into Mathlib:

1. **Say it.** Write the claim in careful English and mark every quantifier.
2. **Type it.** Pick the right types. When the math allows it, Mathlib prefers general types (a type variable \`α\` or an algebraic structure) over concrete ones like \`ℕ\`.
3. **Define it—after searching.** Check Loogle, LeanSearch, or \`exact?\` first. If Mathlib already has the definition, using it unlocks hundreds of ready-made lemmas.
4. **State it.** Write the theorem with \`sorry\` as the proof and make sure it compiles and reads back the way you meant before proving a single line.
5. **Prove it in small pieces.** Sketch a skeleton with \`have … := by sorry\`, break long steps into helper lemmas, and let \`exact?\` and \`simp\` handle the small chores.

Keep your project in git, and don't hesitate to ask on Zulip when you hit a wall. A fun first milestone: re-prove one of your favorite theorems from this game in Mathlib, then formalize one you came up with in the Workshop.`,
  },
];

/** Game names and idioms mapped to their Mathlib counterparts. */
export const phrasebook: PhrasebookRow[] = [
  { game: 'Nat', mathlib: 'ℕ', note: '`ℕ` is notation for `Nat`; type it as `\\N`.' },
  {
    game: 'Nat.add_comm, Nat.mul_comm, Nat.add_assoc',
    mathlib: 'add_comm, mul_comm, add_assoc',
    note: 'The general versions work in any commutative or associative structure, and the `Nat.` versions still exist too.',
  },
  { game: 'Nat.zero_add', mathlib: 'zero_add', note: '`Nat.zero_add` also exists.' },
  { game: 'Nat.two_mul', mathlib: 'two_mul', note: '`2 * a = a + a`.' },
  { game: 'Nat.add_left_comm', mathlib: 'add_left_comm', note: '`a + (b + c) = b + (a + c)`.' },
  {
    game: 'Nat.dvd_trans',
    mathlib: 'dvd_trans',
    note: '`Nat.dvd_trans` exists too, or use dot notation: `h1.trans h2`.',
  },
  { game: 'Nat.dvd_add', mathlib: 'dvd_add', note: '`Nat.dvd_add` also exists.' },
  { game: 'Nat.dvd_mul_right a b : a ∣ a * b', mathlib: 'dvd_mul_right a b', note: '`Nat.dvd_mul_right` also exists.' },
  { game: 'Nat.dvd_refl', mathlib: 'dvd_refl', note: '`dvd_rfl` is the version with an implicit argument.' },
  {
    game: 'Even n (unfolds to ∃ r, n = r + r)',
    mathlib: 'Even n',
    note: 'Same definition, generalized to any additive structure. On `ℕ`, lemmas like `Nat.even_iff` connect it to `n % 2 = 0`.',
  },
  {
    game: 'Even.add, Even.mul_right, Nat.even_or_odd',
    mathlib: 'Even.add, Even.mul_right, Nat.even_or_odd',
    note: 'Mathlib has lemmas under these names—check exact signatures with `#check` or Loogle.',
  },
  { game: 'Set.Subset.trans', mathlib: 'Set.Subset.trans', note: 'Also `subset_trans`, or dot notation `h1.trans h2`.' },
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
    note: 'Check the exact signature with `exact?` or Loogle.',
  },
  {
    game: 'Set.mem_inter_iff, Set.mem_union, Set.mem_diff, Set.mem_compl_iff',
    mathlib: 'Set.mem_inter_iff, Set.mem_union, Set.mem_diff, Set.mem_compl_iff',
    note: 'Same names, and `simp` applies them automatically.',
  },
  { game: "f '' A,  f ⁻¹' B", mathlib: "f '' A,  f ⁻¹' B", note: 'Same notation. `Set.mem_image` and `Set.mem_preimage` unfold membership.' },
  { game: 'Set.preimage_inter, Set.subset_preimage_image', mathlib: 'Set.preimage_inter, Set.subset_preimage_image', note: 'Both exist in Mathlib; check the exact form with `#check`.' },
  { game: 'Function.Injective.comp, Function.Surjective.comp', mathlib: 'Function.Injective.comp, Function.Surjective.comp', note: 'Same names, and dot notation `hg.comp hf` works too.' },
  {
    game: 'Function.LeftInverse.injective',
    mathlib: 'Function.LeftInverse.injective',
    note: 'Same name. Search for `Function.LeftInverse` to see related lemmas.',
  },
  {
    game: 'Function.Surjective.of_comp, Function.Injective.of_comp',
    mathlib: 'search with `exact?` or Loogle',
    note: "Mathlib has cancellation lemmas for compositions—search by statement rather than relying on exact names.",
  },
  { game: 'Function.cantor_surjective', mathlib: 'Function.cantor_surjective', note: "Cantor's theorem has the same name in Mathlib." },
  { game: 'iff_not_self', mathlib: 'iff_not_self', note: '`¬(a ↔ ¬a)`.' },
  { game: 'Classical.em', mathlib: 'Classical.em, em, by_cases', note: '`by_cases` and `by_contra` work the same way; `em p` gives `p ∨ ¬p`.' },
  {
    game: 'use w   /   exists w',
    mathlib: 'use w',
    note: '`exists w` is in core Lean; `use` comes from Mathlib and tries `rfl` afterwards. Both build on `refine ⟨w, ?_⟩`.',
  },
  {
    game: 'by_contra h, then work with h : ¬P',
    mathlib: 'by_contra h, by_contra!, push_neg',
    note: '`by_contra!` also pushes the negation inward, turning `¬∀ x, P x` straight into `∃ x, ¬P x`.',
  },
  {
    game: '¬∀ x, P x ↔ ∃ x, ¬P x  (needs by_contra)',
    mathlib: 'not_forall, not_exists, push_neg',
    note: 'One-line versions of what you proved by hand.',
  },
  {
    game: 'obtain ⟨x, hx⟩ := h,  rcases,  rintro,  ext x',
    mathlib: 'obtain ⟨x, hx⟩ := h,  rcases,  rintro,  ext x',
    note: 'Identical. `ext` also handles function and set equality.',
  },
  {
    game: 'a long chain of rw [Nat.add_assoc, Nat.add_comm, …]',
    mathlib: 'ring, omega, simp',
    note: '`ring` proves equalities in commutative rings; `omega` settles linear arithmetic on `ℕ` and `ℤ`.',
  },
  {
    game: 'repeat, all_goals, try',
    mathlib: 'repeat, all_goals, try',
    note: 'Identical; real Lean also has `any_goals`, `first | t1 | t2`, and `<;>`.',
  },
  {
    game: 'induction n with | zero => … | succ k ih => …',
    mathlib: 'induction n with | zero => … | succ k ih => …',
    note: 'Identical. Mathlib may print `k + 1` or `k.succ`; they are equal by `rfl`.',
  },
];
