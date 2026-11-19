/** The CodeMirror mode for Lean (editor only; the static highlighter lives in ./highlightCore.ts). */
import { StreamLanguage, type StringStream } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { classifyWord, isOpChar, IDSTART, IDENT_RE } from './highlightCore.ts';
export * from './highlightCore.ts';

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

