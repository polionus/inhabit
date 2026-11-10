/**
 * Unicode input abbreviations: typing `\` + key (then space/tab) inserts the symbol.
 * Mirrors the Lean 4 VS Code extension so the habit transfers.
 * STUB — replaced with the full curated table.
 */
export const abbreviations: Record<string, string> = {
  to: '→',
  and: '∧',
  or: '∨',
  not: '¬',
  iff: '↔',
  forall: '∀',
  exists: '∃',
  in: '∈',
  fun: 'λ',
};

/** Symbols offered on the clickable symbol bar, in display order, with their primary abbreviation. */
export const symbolBar: { symbol: string; abbr: string; name: string }[] = [
  { symbol: '→', abbr: 'to', name: 'implies / function arrow' },
];
