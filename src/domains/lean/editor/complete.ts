/**
 * Pure logic for the editor's name completion: tactics the player has unlocked, lemmas in the
 * level's inventory, and hypotheses in scope at the cursor. The `\abbrev` completion lives in
 * abbrev.ts; nothing here fires on a word that starts with a backslash.
 */
import { tryGetLeanRuntime } from '../context.ts';
import type { LeanLemma } from '../types.ts';
import type { Hyp } from '../engine/types.ts';

export type CompletionKind = 'hyp' | 'tactic' | 'lemma';

export interface CompletionItem {
  name: string;
  /** Short text shown beside the name. */
  detail: string;
  kind: CompletionKind;
}

export interface CompletionData {
  tactics?: CompletionItem[];
  lemmas?: CompletionItem[];
}

/** Letters typed before suggestions appear. */
export const MIN_CHARS = 2;
const WORD = /[\p{L}\p{N}_'.]+$/u;

export const truncate = (s: string, n: number): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…';
};

/** The identifier being typed right before the cursor (at least MIN_CHARS long), or null. */
export function wordBefore(before: string): { from: number; text: string } | null {
  const m = WORD.exec(before);
  if (!m || m[0].length < MIN_CHARS) return null;
  if (before[m.index - 1] === '\\') return null;
  if (/^[\d.]+$/.test(m[0])) return null;
  return { from: m.index, text: m[0] };
}

/** "theorem Nat.add_comm (a b : Nat) : a + b = b + a := by …" becomes "(a b : Nat) : a + b = b + a". */
export function lemmaStatement(source: string, name: string): string {
  const at = source.indexOf(name);
  let s = at >= 0 ? source.slice(at + name.length) : source;
  const end = s.indexOf(':=');
  if (end >= 0) s = s.slice(0, end);
  return truncate(s.replace(/^\s*:\s*/, ''), 48);
}

export function tacticItems(
  ids: readonly string[],
  summary: (id: string) => string | undefined = (id) => tryGetLeanRuntime()?.getCodex(id)?.summary,
): CompletionItem[] {
  return [...new Set(ids)].map((id) => ({ name: id, detail: truncate(summary(id) ?? 'tactic', 60), kind: 'tactic' as const }));
}

export function lemmaItems(lemmas: readonly Pick<LeanLemma, 'name' | 'source'>[]): CompletionItem[] {
  return lemmas.map((l) => ({ name: l.name, detail: lemmaStatement(l.source, l.name), kind: 'lemma' as const }));
}

/** Hypotheses of the goal at the cursor; inaccessible names (`h✝`) are skipped. */
export function hypItems(hyps: readonly Pick<Hyp, 'names' | 'type'>[]): CompletionItem[] {
  return hyps.flatMap((h) => h.names.filter((n) => !n.includes('✝')).map((n) => ({ name: n, detail: truncate(h.type, 60), kind: 'hyp' as const })));
}

/** What a level offers: the tactics it allows and the lemmas in its inventory. */
export function dataForContext(ctx: { allowedTactics: string[]; lemmas: readonly Pick<LeanLemma, 'name' | 'source'>[] }): CompletionData {
  return { tactics: tacticItems(ctx.allowedTactics), lemmas: lemmaItems(ctx.lemmas) };
}

/** Everything unlocked, for the Sandbox and Workshop. */
export function dataForEverything(): CompletionData {
  const rt = tryGetLeanRuntime();
  if (!rt) return { tactics: [], lemmas: [] };
  return { tactics: tacticItems(rt.allCodex.filter((c) => c.kind === 'tactic').map((c) => c.id)), lemmas: lemmaItems(rt.allLemmas) };
}

const rank = (name: string, word: string): number => {
  if (name.startsWith(word)) return 0;
  const last = name.slice(name.lastIndexOf('.') + 1);
  return last.startsWith(word) ? 1 : -1;
};

/** Items whose name (or last dotted segment) starts with `word`: hypotheses, then tactics, then lemmas. Exact matches are left out. */
export function matchItems(word: string, data: CompletionData, hyps: readonly CompletionItem[] = [], limit = 12): CompletionItem[] {
  if (word.length < MIN_CHARS) return [];
  const group = [hyps, data.tactics ?? [], data.lemmas ?? []];
  const out: CompletionItem[] = [];
  for (const items of group) {
    const hits = items
      .map((i) => ({ i, r: i.name === word ? -1 : rank(i.name, word) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || a.i.name.length - b.i.name.length || (a.i.name < b.i.name ? -1 : 1));
    out.push(...hits.map((x) => x.i));
  }
  return out.slice(0, limit);
}
