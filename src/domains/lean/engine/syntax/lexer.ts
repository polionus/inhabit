/**
 * Lexer for the Lean 4 subset. Produces tokens with source ranges and line/column
 * information (needed for Lean's indentation-sensitive tactic blocks).
 */

export type TokKind = 'ident' | 'num' | 'str' | 'sym' | 'kw' | 'doc' | 'field' | 'eof' | 'error';

export interface Token {
  kind: TokKind;
  /** identifier name, symbol text, keyword text, number text, doc text, field index */
  text: string;
  from: number;
  to: number;
  line: number;
  col: number;
  /** first token on its line */
  bol: boolean;
  /** whitespace (or comment) precedes this token */
  ws: boolean;
}

export const COMMAND_KEYWORDS = new Set([
  'theorem',
  'lemma',
  'def',
  'example',
  'axiom',
  'abbrev',
  'instance',
  'inductive',
  'structure',
  'class',
  'open',
  'namespace',
  'section',
  'end',
  'variable',
  'universe',
  'set_option',
  'noncomputable',
  'protected',
  'private',
  'attribute',
  '#check',
  '#eval',
  '#print',
  '#reduce',
  '#check_failure',
  'mutual',
  'opaque',
  'macro',
  'syntax',
  'notation',
  'infix',
  'infixl',
  'infixr',
  'prefix',
  'postfix',
  'import',
  '@[',
]);

const KEYWORDS = new Set([
  ...COMMAND_KEYWORDS,
  'fun',
  'by',
  'have',
  'show',
  'from',
  'let',
  'in',
  'calc',
  'match',
  'with',
  'at',
  'if',
  'then',
  'else',
  'forall',
  'exists',
  'Type',
  'Prop',
  'Sort',
  'where',
  'deriving',
  'do',
  'sorry',
  'suffices',
  'using',
  'generalizing',
]);

// Longest first.
const SYMBOLS = [
  '⁻¹\'',
  '<;>',
  '<->',
  '...',
  ':=',
  '=>',
  '->',
  '<-',
  '<=',
  '>=',
  '!=',
  '/\\',
  '\\/',
  '<|',
  '|>',
  '?_',
  "''",
  '++',
  '@[',
  '..',
  '×',
  '→',
  '←',
  '↔',
  '↦',
  '∀',
  '∃',
  'λ',
  '⟨',
  '⟩',
  '⦃',
  '⦄',
  '≠',
  '≤',
  '≥',
  '∘',
  '∣',
  '∧',
  '∨',
  '¬',
  '∈',
  '∉',
  '⊆',
  '⊂',
  '∪',
  '∩',
  'ᶜ',
  '∅',
  '▸',
  '·',
  '•',
  '⊢',
  '∑',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  ',',
  ':',
  ';',
  '|',
  '.',
  '@',
  '=',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '\\',
  '$',
  '!',
  '?',
  '#',
  '_',
  '&',
];

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉ₐₑₒₓₔₕₖₗₘₙₚₛₜᵢᵣᵤᵥⱼ';

function isLetterlike(c: string): boolean {
  const cp = c.codePointAt(0)!;
  // Greek (except λ Π Σ), Coptic, letterlike symbols, script letters
  if (cp >= 0x3b1 && cp <= 0x3c9 && cp !== 0x3bb) return true; // α-ω except λ
  if (cp >= 0x391 && cp <= 0x3a9 && cp !== 0x3a0 && cp !== 0x3a3) return true; // Α-Ω except Π Σ
  if (cp >= 0x3ca && cp <= 0x3fb) return true;
  if (cp >= 0x1f00 && cp <= 0x1ffe) return true;
  if (cp >= 0x2100 && cp <= 0x214f) return true; // letterlike block (ℕ ℝ …)
  if (cp >= 0x1d49c && cp <= 0x1d59f) return true; // script/double-struck
  return false;
}

export function isIdStart(c: string): boolean {
  return /[A-Za-z_]/.test(c) || isLetterlike(c);
}

export function isIdRest(c: string): boolean {
  return /[A-Za-z0-9_'!?]/.test(c) || isLetterlike(c) || SUBSCRIPTS.includes(c);
}

export interface LexResult {
  tokens: Token[];
  errors: { from: number; to: number; message: string }[];
}

export function lex(src: string): LexResult {
  const tokens: Token[] = [];
  const errors: LexResult['errors'] = [];
  let i = 0;
  let line = 0;
  let lineStart = 0;
  let bol = true;
  let ws = true;
  const n = src.length;

  const push = (kind: TokKind, text: string, from: number, to: number) => {
    tokens.push({ kind, text, from, to, line, col: from - lineStart, bol, ws });
    bol = false;
    ws = false;
  };

  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      i++;
      line++;
      lineStart = i;
      bol = true;
      ws = true;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      ws = true;
      continue;
    }
    // comments
    if (c === '-' && src[i + 1] === '-') {
      while (i < n && src[i] !== '\n') i++;
      ws = true;
      continue;
    }
    if (c === '/' && src[i + 1] === '-') {
      const isDoc = src[i + 2] === '-' && src[i + 3] !== '/';
      const isModDoc = src[i + 2] === '!';
      const start = i;
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (src[i] === '/' && src[i + 1] === '-') {
          depth++;
          i += 2;
        } else if (src[i] === '-' && src[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          if (src[i] === '\n') {
            line++;
            lineStart = i + 1;
          }
          i++;
        }
      }
      if (depth > 0) errors.push({ from: start, to: n, message: 'unterminated comment' });
      if (isDoc && !isModDoc) {
        const text = src.slice(start + 3, Math.max(start + 3, i - 2)).trim();
        const save = bol;
        tokens.push({ kind: 'doc', text, from: start, to: i, line, col: start - lineStart, bol: save, ws: true });
      }
      ws = true;
      continue;
    }
    const start = i;
    // numbers
    if (/[0-9]/.test(c)) {
      while (i < n && /[0-9_]/.test(src[i])) i++;
      push('num', src.slice(start, i).replace(/_/g, ''), start, i);
      continue;
    }
    // strings
    if (c === '"') {
      i++;
      let s = '';
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < n) {
          const e = src[i + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
          i += 2;
        } else {
          if (src[i] === '\n') {
            line++;
            lineStart = i + 1;
          }
          s += src[i++];
        }
      }
      if (i >= n) errors.push({ from: start, to: n, message: 'unterminated string literal' });
      else i++;
      push('str', s, start, i);
      continue;
    }
    // field index `.1` directly after an identifier/closing bracket
    if (c === '.' && /[0-9]/.test(src[i + 1] ?? '') && !ws && tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      if (prev.kind === 'ident' || prev.kind === 'field' || (prev.kind === 'sym' && [')', '⟩', '}'].includes(prev.text))) {
        i++;
        while (i < n && /[0-9]/.test(src[i])) i++;
        push('field', src.slice(start + 1, i), start, i);
        continue;
      }
    }
    // field name `.foo` directly after `)` or `⟩`
    if (c === '.' && isIdStart(src[i + 1] ?? '') && !ws && tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      if ((prev.kind === 'sym' && [')', '⟩', '}'].includes(prev.text)) || prev.kind === 'field') {
        i++;
        while (i < n && isIdRest(src[i])) i++;
        push('field', src.slice(start + 1, i), start, i);
        continue;
      }
    }
    // identifiers (with dots), «quoted» parts
    if (isIdStart(c) || c === '«') {
      const readPart = (): boolean => {
        if (src[i] === '«') {
          const j = src.indexOf('»', i);
          if (j < 0) return false;
          i = j + 1;
          return true;
        }
        if (!isIdStart(src[i] ?? '')) return false;
        i++;
        while (i < n && isIdRest(src[i])) i++;
        return true;
      };
      readPart();
      while (src[i] === '.' && (isIdStart(src[i + 1] ?? '') || src[i + 1] === '«')) {
        const save = i;
        i++;
        if (!readPart()) {
          i = save;
          break;
        }
      }
      const text = src.slice(start, i).replace(/[«»]/g, '');
      if (text === '_') {
        push('sym', '_', start, i);
        continue;
      }
      if (KEYWORDS.has(text)) push('kw', text, start, i);
      else push('ident', text, start, i);
      continue;
    }
    if (c === '#') {
      let j = i + 1;
      while (j < n && /[a-z_]/.test(src[j])) j++;
      const w = src.slice(i, j);
      if (COMMAND_KEYWORDS.has(w)) {
        i = j;
        push('kw', w, start, i);
        continue;
      }
    }
    let matched = '';
    for (const s of SYMBOLS) {
      if (src.startsWith(s, i)) {
        matched = s;
        break;
      }
    }
    if (matched === "''" && tokens.length > 0 && !ws) {
      // `h''` is an identifier with primes, handled above; here it's the image operator only with spacing
    }
    if (matched) {
      i += matched.length;
      push(matched === '@[' ? 'kw' : 'sym', matched, start, i);
      continue;
    }
    // unknown character
    const cp = src.codePointAt(i)!;
    const len = cp > 0xffff ? 2 : 1;
    i += len;
    errors.push({ from: start, to: i, message: `unexpected token '${src.slice(start, i)}'` });
    push('error', src.slice(start, i), start, i);
  }
  tokens.push({ kind: 'eof', text: '', from: n, to: n, line, col: n - lineStart, bol: true, ws: true });
  return { tokens, errors };
}
