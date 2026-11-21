/**
 * The initial goal of a level, read from its statement header (`theorem t (P : Prop) (h : P) : P := by`).
 * Used when the engine has no proof state to show (term-mode levels, an empty editor).
 */
import type { Goal, Hyp } from '../engine/types.ts';
import { norm } from './parse.ts';

const OPEN = '([{⟨';
const CLOSE = ')]}⟩';

/** Is a binder of this type a piece of data (a number, a set, a type, a function …) rather than a proof? */
export function looksLikeData(type: string): boolean {
  let t = norm(type);
  // peel arrows: `α → β → Prop` is data if its final codomain is
  for (let guard = 0; guard < 8; guard++) {
    let depth = 0;
    let at = -1;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (OPEN.includes(c)) depth++;
      else if (CLOSE.includes(c)) depth--;
      else if (c === '→' && depth === 0) {
        at = i;
        break;
      }
    }
    if (at < 0) break;
    t = norm(t.slice(at + 1));
  }
  if (/^(Prop|Type|Sort|Nat|Int|Bool|Real|Rat|String|Unit|Set\b|List\b|Fin\b|Option\b|Finset\b)/.test(t)) return true;
  if (/^\p{L}[\p{L}\p{N}₀-₉']*$/u.test(t) && /^[α-ωΑ-Ω]/u.test(t)) return true; // `α`, `β`
  return false;
}

/** Split `(a b : T) {c : U} [inst] : target := by` into binder groups and the target. */
export function goalFromHeader(header: string): Goal | null {
  try {
    let s = header.trim();
    s = s.replace(/^(?:private\s+|protected\s+)?(?:theorem|lemma|example)\b\s*/u, '');
    // skip the declaration name (up to the first binder or the colon)
    s = s.replace(/^[^\s(){}\[\]:]+/u, '').trimStart();
    const hyps: Hyp[] = [];
    let i = 0;
    let target = '';
    while (i < s.length) {
      const c = s[i];
      if (c === '(' || c === '{' || c === '[') {
        let depth = 0;
        let j = i;
        for (; j < s.length; j++) {
          if (OPEN.includes(s[j])) depth++;
          else if (CLOSE.includes(s[j])) {
            depth--;
            if (depth === 0) break;
          }
        }
        const inner = s.slice(i + 1, j);
        i = j + 1;
        if (c === '[') continue;
        const colon = inner.indexOf(':');
        if (colon < 0) continue;
        const names = inner.slice(0, colon).trim().split(/\s+/).filter(Boolean);
        const type = norm(inner.slice(colon + 1));
        hyps.push({ names, type, isProof: !looksLikeData(type) });
      } else if (c === ':') {
        target = s.slice(i + 1);
        break;
      } else i++;
    }
    target = norm(target.replace(/:=\s*(?:by)?\s*$/u, ''));
    if (!target) return null;
    return { hyps, target };
  } catch {
    return null;
  }
}
