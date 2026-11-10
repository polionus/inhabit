/** Lean token classification, shared by the CodeMirror mode and the static (HTML) highlighter. */
import { StreamLanguage, type StringStream } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export type TokClass = 'kw' | 'tac' | 'sorry' | 'ty' | 'com' | 'str' | 'num' | 'op' | 'id' | 'ws';

const KEYWORDS = new Set(
  `theorem lemma def example axiom inductive structure instance namespace end open section variable universe import set_option by fun have show from at with then else if match let in calc using where deriving noncomputable private protected abbrev opaque class extends mutual do return suffices λ forall exists Type Prop Sort`.split(/\s+/),
);
const TACTICS = new Set(
  `intro intros exact apply refine change constructor left right cases rcases obtain rintro exfalso contradiction assumption by_cases by_contra use exists specialize rfl rw rwa symm induction ext funext unfold subst revert clear trivial all_goals any_goals repeat try first injection simp simp_all decide omega nth_rewrite rename_i next case generalizing norm_num ring linarith tauto aesop`.split(/\s+/),
);
const TYPES = new Set(
  `Nat Int Bool Set Prop Type String List Option Fin Even Odd True False And Or Not Iff Eq Ne Exists Function ℕ ℤ ℚ ℝ ℂ α β γ`.split(/\s+/),
);

export function classifyWord(w: string): TokClass {
  if (w === 'sorry') return 'sorry';
  if (w.startsWith('#')) return 'kw';
  if (KEYWORDS.has(w)) return 'kw';
  if (TACTICS.has(w)) return 'tac';
  if (TYPES.has(w)) return 'ty';
  return 'id';
}

const OP_RE = /[←-⋿⟨⟩⦃⦄·∘=<>+\-*/|^&@%:]/u;
export const isOpChar = (c: string): boolean => OP_RE.test(c);

const IDSTART = /[\p{L}_]/u;
const IDREST = /[\p{L}\p{N}_'!?₀-ₜᵢ-ᵪ]/u;
const IDENT_RE = new RegExp(
  String.raw`(?:[\p{L}_][\p{L}\p{N}_'!?₀-ₜᵢ-ᵪ]*)(?:\.[\p{L}\p{N}_][\p{L}\p{N}_'!?₀-ₜᵢ-ᵪ]*)*`,
  'uy',
);

export interface Tok {
  text: string;
  cls: TokClass;
}

/** Tokenize a whole text (handles nested block comments). */
export function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const push = (s: string, cls: TokClass) => {
    if (s) out.push({ text: s, cls });
  };
  while (i < text.length) {
    const c = text[i];
    if (c === '-' && text[i + 1] === '-') {
      let j = text.indexOf('\n', i);
      if (j < 0) j = text.length;
      push(text.slice(i, j), 'com');
      i = j;
    } else if (c === '/' && text[i + 1] === '-') {
      let depth = 1;
      let j = i + 2;
      while (j < text.length && depth > 0) {
        if (text[j] === '/' && text[j + 1] === '-') (depth++, (j += 2));
        else if (text[j] === '-' && text[j + 1] === '/') (depth--, (j += 2));
        else j++;
      }
      push(text.slice(i, j), 'com');
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"' && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
      if (text[j] === '"') j++;
      push(text.slice(i, j), 'str');
      i = j;
    } else if (/\d/.test(c)) {
      let j = i;
      while (j < text.length && /[\d.]/.test(text[j]) && !(text[j] === '.' && !/\d/.test(text[j + 1] ?? ''))) j++;
      push(text.slice(i, j), 'num');
      i = j;
    } else if (c === '#' && /[a-z]/.test(text[i + 1] ?? '')) {
      let j = i + 1;
      while (j < text.length && /[a-z_]/.test(text[j])) j++;
      push(text.slice(i, j), 'kw');
      i = j;
    } else if (c === 'λ') {
      push(c, 'kw');
      i++;
    } else if (IDSTART.test(c)) {
      IDENT_RE.lastIndex = i;
      const m = IDENT_RE.exec(text);
      const w = m ? m[0] : c;
      push(w, classifyWord(w));
      i += w.length;
    } else if (/\s/.test(c)) {
      let j = i;
      while (j < text.length && /\s/.test(text[j])) j++;
      push(text.slice(i, j), 'ws');
      i = j;
    } else {
      push(c, isOpChar(c) ? 'op' : 'id');
      i++;
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Highlighted HTML (spans with `hl-*` classes). */
export function highlightHtml(text: string): string {
  return tokenize(text)
    .map((k) => (k.cls === 'ws' || k.cls === 'id' ? esc(k.text) : `<span class="hl-${k.cls}">${esc(k.text)}</span>`))
    .join('');
}

/* ---- CodeMirror mode ---- */

interface LState {
  depth: number;
}

function streamToken(stream: StringStream, state: LState): string | null {
  if (state.depth > 0) {
    while (!stream.eol()) {
      if (stream.match('/-')) state.depth++;
      else if (stream.match('-/')) {
        state.depth--;
        if (state.depth === 0) break;
      } else stream.next();
    }
    return 'comment';
  }
  if (stream.eatSpace()) return null;
  if (stream.match('--')) {
    stream.skipToEnd();
    return 'comment';
  }
  if (stream.match('/-')) {
    state.depth = 1;
    return streamToken(stream, state) ?? 'comment';
  }
  if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
  if (stream.match(/^\d+(?:\.\d+)?/)) return 'number';
  if (stream.match(/^#[a-z_]+/)) return 'keyword';
  const rest = stream.string.slice(stream.pos);
  const ch = rest[0] ?? '';
  if (ch === 'λ') {
    stream.next();
    return 'keyword';
  }
  if (IDSTART.test(ch)) {
    IDENT_RE.lastIndex = stream.pos;
    const m = IDENT_RE.exec(stream.string);
    const w = m ? m[0] : ch;
    stream.pos += w.length;
    switch (classifyWord(w)) {
      case 'kw':
        return 'keyword';
      case 'tac':
        return 'tactic';
      case 'sorry':
        return 'sorry';
      case 'ty':
        return 'typeName';
      default:
        return null;
    }
  }
  stream.next();
  return isOpChar(ch) ? 'operator' : null;
}

export const leanLanguage = StreamLanguage.define<LState>({
  name: 'lean',
  startState: () => ({ depth: 0 }),
  copyState: (s) => ({ depth: s.depth }),
  token: streamToken,
  languageData: { commentTokens: { line: '--', block: { open: '/-', close: '-/' } } },
  tokenTable: {
    tactic: t.operatorKeyword,
    sorry: t.invalid,
  },
});

export { IDREST };
