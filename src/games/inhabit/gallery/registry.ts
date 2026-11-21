/**
 * The Gallery: interactive exhibits that make Lean's ideas visible. Pure metadata (eager, tiny);
 * each exhibit's component lives in src/ui/gallery/exhibits/<Name>.tsx and is loaded on demand.
 * Exhibits are linked from the chapters, worlds and levels listed here ("See it in the Gallery").
 */
export interface ExhibitMeta {
  /** Stable kebab-case id, used in the URL `#/gallery/<id>`. */
  id: ExhibitId;
  title: string;
  /** One line under the title on the gallery card (≤ 14 words). */
  tagline: string;
  /** The world ids whose ideas this exhibit shows (chapter pages and world pages link here). */
  worlds: string[];
  /** Level ids where a "See it" link is most useful (shown in the lesson / success card). Optional. */
  levels?: string[];
  /** A short glyph for the card (one or two characters, e.g. "∀∃"). */
  glyph: string;
  /** Index section. */
  group: ExhibitGroup;
  /** Honest minutes for a first look. */
  minutes: number;
}

export type ExhibitGroup = 'logic' | 'numbers' | 'sets';
export const exhibitGroups: { id: ExhibitGroup; title: string; blurb: string }[] = [
  { id: 'logic', title: 'Logic and proof', blurb: 'What a proof builds, and what ∀, ∃ and ¬ really say.' },
  { id: 'numbers', title: 'Numbers', blurb: 'Rewriting, computing, and proofs that go on forever.' },
  { id: 'sets', title: 'Sets and functions', blurb: 'Pictures you can shade, draw and argue about.' },
];

export type ExhibitId =
  | 'proof-replay'
  | 'venn'
  | 'function-arrows'
  | 'quantifier-game'
  | 'truth-table'
  | 'rewrite-compute'
  | 'induction-dominoes'
  | 'cantor-diagonal';

export const exhibits: ExhibitMeta[] = [
  { id: 'proof-replay', title: 'Proof replay', tagline: 'Watch the goal shrink while the proof term grows.', worlds: ['props', 'logic', 'quant'], glyph: '⊢', group: 'logic', minutes: 3 },
  { id: 'truth-table', title: 'Truth tables and constructive proof', tagline: 'True in every row, but can Lean prove it without classical logic?', worlds: ['logic'], glyph: '¬¬', group: 'logic', minutes: 3 },
  { id: 'quantifier-game', title: 'The quantifier game', tagline: 'For all and there exists, played as a game against the computer.', worlds: ['quant'], glyph: '∀∃', group: 'logic', minutes: 4 },
  { id: 'rewrite-compute', title: 'Rewrite and compute', tagline: 'See rw find its target, and watch definitions unfold to a value.', worlds: ['eq', 'nat'], glyph: '=', group: 'numbers', minutes: 4 },
  { id: 'induction-dominoes', title: 'Induction dominoes', tagline: 'A base case and a step knock down every natural number.', worlds: ['nat'], glyph: 'ℕ', group: 'numbers', minutes: 3 },
  { id: 'venn', title: 'Venn playground', tagline: 'Type set expressions, see them shaded, and test equalities.', worlds: ['sets'], glyph: '∩', group: 'sets', minutes: 3 },
  { id: 'function-arrows', title: 'Function arrows', tagline: 'Draw a function and watch injective and surjective light up.', worlds: ['fun'], glyph: '↦', group: 'sets', minutes: 4 },
  { id: 'cantor-diagonal', title: "Cantor's diagonal", tagline: 'Why no function from a set onto its subsets can exist.', worlds: ['fun'], glyph: '∉', group: 'sets', minutes: 4 },
];

export const exhibitById = (id: string): ExhibitMeta | undefined => exhibits.find((e) => e.id === id);
export const exhibitsForWorld = (worldId: string): ExhibitMeta[] => exhibits.filter((e) => e.worlds.includes(worldId));
export const exhibitsForLevel = (levelId: string): ExhibitMeta[] => exhibits.filter((e) => e.levels?.includes(levelId));
