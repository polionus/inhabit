/**
 * Unicode abbreviation logic, modelled on the Lean 4 VS Code extension:
 * type `\` + abbreviation, then a space, tab or any other non-identifier character to replace it.
 * Pure functions only; the editor wires them to CodeMirror.
 */
export type AbbrevTable = Record<string, string>;

const IDENT = /[\p{L}\p{N}_'!?]/u;
export const isIdentChar = (c: string): boolean => IDENT.test(c);

export interface Pending {
  /** Index of the backslash in the text that was searched. */
  start: number;
  /** Characters typed after the backslash. */
  query: string;
}

/** The abbreviation being typed right before the cursor, if any. `before` is the text before the cursor. */
export function findPending(before: string): Pending | null {
  const m = /\\([^\s\\]*)$/.exec(before);
  if (!m) return null;
  return { start: m.index, query: m[1] };
}

const hasPrefix = (query: string, table: AbbrevTable): boolean => {
  for (const k of Object.keys(table)) if (k.startsWith(query)) return true;
  return false;
};

/** Would `ch` end the abbreviation (rather than continue it)? */
export function terminates(query: string, ch: string, table: AbbrevTable): boolean {
  if (ch.length === 0) return true;
  if (isIdentChar(ch)) return false;
  return !hasPrefix(query + ch, table);
}

export interface Resolved {
  text: string;
  /** Offset inside `text` where the cursor should land (defaults to the end). */
  cursor: number;
}

const CURSOR = '$CURSOR';

/** Exact match, otherwise the shortest abbreviation that has `query` as a prefix (as the extension does). */
export function resolve(query: string, table: AbbrevTable): Resolved | null {
  if (!query) return null;
  let value = table[query];
  if (value === undefined) {
    const keys = Object.keys(table)
      .filter((k) => k.startsWith(query))
      .sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
    if (!keys.length) return null;
    value = table[keys[0]];
  }
  const i = value.indexOf(CURSOR);
  if (i < 0) return { text: value, cursor: value.length };
  return { text: value.replace(CURSOR, ''), cursor: i };
}

export interface Replacement {
  from: number;
  to: number;
  insert: string;
  /** Position of the cursor after the change, relative to the start of the document. */
  cursor: number;
}

/**
 * Handle typing `typed` (one character, or '' for Tab/Enter) at position `pos` in `doc`.
 * Returns the edit to apply instead of the default insertion, or null to let the editor insert normally.
 */
export function onType(doc: string, pos: number, typed: string, table: AbbrevTable): Replacement | null {
  const lineStart = doc.lastIndexOf('\n', pos - 1) + 1;
  const p = findPending(doc.slice(lineStart, pos));
  if (!p) return null;
  if (!terminates(p.query, typed, table)) return null;
  const r = resolve(p.query, table);
  if (!r) return null;
  const from = lineStart + p.start;
  const keep = typed === '' ? '' : typed;
  return { from, to: pos, insert: r.text + keep, cursor: from + (keep ? r.text.length + keep.length : r.cursor) };
}

/** Abbreviation completions for the popup: keys that start with the query. */
export function completionsFor(query: string, table: AbbrevTable, limit = 40): { key: string; symbol: string }[] {
  return Object.keys(table)
    .filter((k) => k.startsWith(query))
    .sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
    .slice(0, limit)
    .map((key) => ({ key, symbol: table[key].replace(CURSOR, '') }));
}
