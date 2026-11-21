/**
 * "Open in real Lean". Kept in one tiny module: the exact URL format may be adjusted later.
 */
export const LEAN_WEB_EDITOR = 'https://live.lean-lang.org/';
export const PRELUDE = 'import Mathlib\n\nnamespace Inhabit\n\n';
export const POSTLUDE = '\n\nend Inhabit\n';

/** Wrap one or more declarations the way the game expects them to appear in real Lean. */
export function wrapForRealLean(decls: string | string[]): string {
  const body = (Array.isArray(decls) ? decls : [decls]).map((d) => d.trim()).filter(Boolean).join('\n\n');
  return PRELUDE + body + POSTLUDE;
}

export function openInLeanUrl(code: string): string {
  return `${LEAN_WEB_EDITOR}#code=${encodeURIComponent(code)}`;
}

export function openInRealLean(decls: string | string[]): void {
  const url = openInLeanUrl(wrapForRealLean(decls));
  window.open(url, '_blank', 'noopener,noreferrer');
}
