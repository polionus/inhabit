/**
 * Pure logic for the Venn exhibit: a parser for set expressions in Lean notation over A, B, C and
 * their evaluation to the set of Venn regions they cover. A region is a 3-bit mask: bit 0 = in A,
 * bit 1 = in B, bit 2 = in C (mask 0 is "outside all three circles", still inside the universe).
 */
export type SE =
  | { t: 'set'; n: 'A' | 'B' | 'C' }
  | { t: 'inter' | 'union' | 'diff'; a: SE; b: SE }
  | { t: 'compl'; a: SE }
  | { t: 'empty' }
  | { t: 'univ' };

export type ParseResult = { ok: true; e: SE } | { ok: false; error: string };

export const SET_NAMES = ['A', 'B', 'C'] as const;
/** All eight regions as a bit set (bit r set = region r covered). */
export const ALL_REGIONS = 0xff;

type Tok = { k: 'name'; v: string } | { k: 'op'; v: string } | { k: 'lp' } | { k: 'rp' };

function tokenize(src: string): Tok[] | string {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) i++;
    else if (c === '(') (out.push({ k: 'lp' }), i++);
    else if (c === ')') (out.push({ k: 'rp' }), i++);
    else if (c === '∩' || c === '∪' || c === '\\' || c === 'ᶜ') (out.push({ k: 'op', v: c }), i++);
    else if (c === '∅') (out.push({ k: 'name', v: '∅' }), i++);
    else {
      const m = /^[A-Za-z_][A-Za-z_.0-9]*/.exec(src.slice(i));
      if (!m) return `Unexpected character '${c}'.`;
      out.push({ k: 'name', v: m[0] });
      i += m[0].length;
    }
  }
  return out;
}

/**
 * Grammar (Lean precedence): `∪` binds loosest (65), then `∩` and `\` (70, left-associative),
 * then postfix `ᶜ`, then atoms: A B C ∅ Set.univ ( e ).
 */
export function parseSet(src: string): ParseResult {
  const toks = tokenize(src);
  if (typeof toks === 'string') return { ok: false, error: toks };
  if (toks.length === 0) return { ok: false, error: 'Type a set expression, like A ∩ B.' };
  let p = 0;
  const fail = (m: string): never => {
    throw new Error(m);
  };
  const isOp = (v: string) => toks[p]?.k === 'op' && (toks[p] as { v: string }).v === v;
  const union = (): SE => {
    let l = mid();
    while (isOp('∪')) {
      p++;
      l = { t: 'union', a: l, b: mid() };
    }
    return l;
  };
  const mid = (): SE => {
    let l = post();
    while (isOp('∩') || isOp('\\')) {
      const t = (toks[p] as { v: string }).v === '∩' ? 'inter' : 'diff';
      p++;
      l = { t, a: l, b: post() };
    }
    return l;
  };
  const post = (): SE => {
    let l = atom();
    while (isOp('ᶜ')) {
      p++;
      l = { t: 'compl', a: l };
    }
    return l;
  };
  const atom = (): SE => {
    const t = toks[p];
    if (!t) return fail('The expression ends too early.');
    if (t.k === 'lp') {
      p++;
      const e = union();
      if (toks[p]?.k !== 'rp') fail("Missing a closing ')'.");
      p++;
      return e;
    }
    if (t.k === 'name') {
      p++;
      if (t.v === 'A' || t.v === 'B' || t.v === 'C') return { t: 'set', n: t.v };
      if (t.v === '∅') return { t: 'empty' };
      if (t.v === 'Set.univ' || t.v === 'univ') return { t: 'univ' };
      return fail(`'${t.v}' is not a set here. Use A, B, C, ∅ or Set.univ.`);
    }
    if (t.k === 'rp') return fail("Unexpected ')'.");
    return fail(`'${t.v}' needs a set on its left.`);
  };
  try {
    const e = union();
    if (p < toks.length) {
      const t = toks[p];
      return { ok: false, error: t.k === 'rp' ? "Unexpected ')'." : 'Something is missing before the next symbol.' };
    }
    return { ok: true, e };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** The regions (bit set over masks 0..7) that the expression covers. */
export function regionsOf(e: SE): number {
  switch (e.t) {
    case 'set': {
      const bit = 1 << SET_NAMES.indexOf(e.n);
      let m = 0;
      for (let r = 0; r < 8; r++) if (r & bit) m |= 1 << r;
      return m;
    }
    case 'inter':
      return regionsOf(e.a) & regionsOf(e.b);
    case 'union':
      return regionsOf(e.a) | regionsOf(e.b);
    case 'diff':
      return regionsOf(e.a) & ~regionsOf(e.b) & ALL_REGIONS;
    case 'compl':
      return ~regionsOf(e.a) & ALL_REGIONS;
    case 'empty':
      return 0;
    case 'univ':
      return ALL_REGIONS;
  }
}

export const hasRegion = (set: number, r: number): boolean => (set & (1 << r)) !== 0;
export const regionList = (set: number): number[] => [0, 1, 2, 3, 4, 5, 6, 7].filter((r) => hasRegion(set, r));

/** "in A and B but not C", "in none of A, B, C". */
export function regionPhrase(r: number): string {
  const ins = SET_NAMES.filter((_, i) => r & (1 << i));
  const outs = SET_NAMES.filter((_, i) => !(r & (1 << i)));
  const list = (xs: readonly string[]) => (xs.length === 1 ? xs[0] : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
  if (ins.length === 0) return 'in none of A, B, C';
  if (outs.length === 0) return 'in all of A, B and C';
  return `in ${list(ins)} but not ${outs.length === 1 ? outs[0] : 'in ' + list(outs).replace(' and ', ' or ')}`;
}

/** First-person version for the membership view. */
export const memberPhrase = (r: number): string => 'x is ' + regionPhrase(r);

export type Relation = 'eq' | 'subset';

export interface Verdict {
  holds: boolean;
  /** Regions that break it (equal: symmetric difference; subset: in left but not right). */
  witnesses: number[];
  text: string;
}

export function verdict(left: number, right: number, rel: Relation): Verdict {
  if (rel === 'eq') {
    const w = regionList(left ^ right);
    if (w.length === 0) return { holds: true, witnesses: [], text: 'Equal: same regions' };
    return { holds: false, witnesses: w, text: 'Not equal: they differ in the region ' + w.map((r) => `"${regionPhrase(r)}"`).join(' and the region ') };
  }
  const w = regionList(left & ~right & ALL_REGIONS);
  if (w.length === 0) return { holds: true, witnesses: [], text: 'Subset: every region of the left is in the right' };
  return { holds: false, witnesses: w, text: 'Not a subset: the left covers the region ' + w.map((r) => `"${regionPhrase(r)}"`).join(' and the region ') + ', which the right misses' };
}

/** Lean source for an expression (the parser's reading, fully bracketed where needed). */
export function showSet(e: SE, parent: SE['t'] | 'top' = 'top', right = false): string {
  switch (e.t) {
    case 'set':
      return e.n;
    case 'empty':
      return '∅';
    case 'univ':
      return 'Set.univ';
    case 'compl':
      return (e.a.t === 'set' || e.a.t === 'compl' || e.a.t === 'empty' || e.a.t === 'univ' ? showSet(e.a) : '(' + showSet(e.a) + ')') + 'ᶜ';
    default: {
      const op = e.t === 'inter' ? ' ∩ ' : e.t === 'union' ? ' ∪ ' : ' \\ ';
      const s = showSet(e.a, e.t, false) + op + showSet(e.b, e.t, true);
      const bare = parent === 'top' || (parent === e.t && !right && e.t !== 'diff');
      return bare ? s : '(' + s + ')';
    }
  }
}
