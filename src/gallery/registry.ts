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
}

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
  { id: 'proof-replay', title: 'Proof replay', tagline: 'Watch the goal shrink while the proof term grows.', worlds: ['props', 'logic', 'quant'], glyph: '⊢' },
  { id: 'truth-table', title: 'Truth tables and constructive proof', tagline: 'True in every row, but can Lean prove it without classical logic?', worlds: ['logic'], glyph: '¬¬' },
  { id: 'quantifier-game', title: 'The quantifier game', tagline: 'For all and there exists, played as a game against the computer.', worlds: ['quant'], glyph: '∀∃' },
  { id: 'rewrite-compute', title: 'Rewrite and compute', tagline: 'See rw find its target, and watch definitions unfold to a value.', worlds: ['eq', 'nat'], glyph: '=' },
  { id: 'induction-dominoes', title: 'Induction dominoes', tagline: 'A base case and a step knock down every natural number.', worlds: ['nat'], glyph: 'ℕ' },
  { id: 'venn', title: 'Venn playground', tagline: 'Type set expressions, see them shaded, and test equalities.', worlds: ['sets'], glyph: '∩' },
  { id: 'function-arrows', title: 'Function arrows', tagline: 'Draw a function and watch injective and surjective light up.', worlds: ['fun'], glyph: '↦' },
  { id: 'cantor-diagonal', title: "Cantor's diagonal", tagline: 'Why no function from a set onto its subsets can exist.', worlds: ['fun'], glyph: '∉' },
];

export const exhibitById = (id: string): ExhibitMeta | undefined => exhibits.find((e) => e.id === id);
export const exhibitsForWorld = (worldId: string): ExhibitMeta[] => exhibits.filter((e) => e.worlds.includes(worldId));
export const exhibitsForLevel = (levelId: string): ExhibitMeta[] => exhibits.filter((e) => e.levels?.includes(levelId));
