/**
 * Plain-English readings of generated statements. Short formulas read naturally ("If P implies Q
 * and Q is false, then P is false."); nested ones fall back to a careful literal reading with
 * "both … and …", "either … or …" and brackets where English would be ambiguous.
 */
import type { Atom, F } from './logic.ts';

export interface EnglishOpts {
  /** How an atom reads, e.g. `P`, `p x`. */
  atom?(a: Atom): string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const atomText = (a: Atom, o: EnglishOpts) => (o.atom ? o.atom(a) : a.args.length ? `${a.p} ${a.args.join(' ')}` : a.p);

const isLit = (f: F) => f.t === 'atom' || f.t === 'bot' || f.t === 'top' || (f.t === 'not' && f.a.t === 'atom');

/** Compact phrase, used inside other phrases. */
function phrase(f: F, o: EnglishOpts, nested: boolean): string {
  const sub = (g: F) => (isLit(g) ? phrase(g, o, true) : g.t === 'and' || g.t === 'or' ? phrase(g, o, true) : '(' + phrase(g, o, false) + ')');
  switch (f.t) {
    case 'atom':
      return atomText(f, o);
    case 'bot':
      return 'False';
    case 'top':
      return 'True';
    case 'not':
      if (f.a.t === 'atom') return 'not ' + atomText(f.a, o);
      if (f.a.t === 'or') return 'neither ' + sub(f.a.a) + ' nor ' + sub(f.a.b);
      return 'not ' + sub(f.a);
    case 'and':
      return (nested ? 'both ' : '') + sub(f.a) + ' and ' + sub(f.b);
    case 'or':
      return (nested ? 'either ' : '') + sub(f.a) + ' or ' + sub(f.b);
    case 'imp':
      return sub(f.a) + ' implies ' + sub(f.b);
    case 'iff':
      return sub(f.a) + ' if and only if ' + sub(f.b);
    case 'all':
      return 'for every ' + f.x + ', ' + phrase(f.a, o, false);
    case 'ex':
      return 'there is an ' + f.x + ' with ' + phrase(f.a, o, false);
  }
}

/** A clause that stands on its own as a hypothesis or conclusion. */
export function clause(f: F, o: EnglishOpts = {}): string {
  const lit = (g: F) => isLit(g);
  switch (f.t) {
    case 'atom':
      return atomText(f, o);
    case 'bot':
      return 'False holds';
    case 'top':
      return 'True holds';
    case 'not': {
      const a = f.a;
      if (a.t === 'atom') return atomText(a, o) + ' is false';
      if (a.t === 'not' && a.a.t === 'atom') return atomText(a.a, o) + ' is not false';
      if (a.t === 'and' && lit(a.a) && lit(a.b)) return phrase(a.a, o, true) + ' and ' + phrase(a.b, o, true) + ' are not both true';
      if (a.t === 'or') return 'neither ' + phrase(a.a, o, true) + ' nor ' + phrase(a.b, o, true) + ' holds';
      if (a.t === 'imp' && lit(a.a) && lit(a.b)) return phrase(a.a, o, true) + ' does not imply ' + phrase(a.b, o, true);
      if (a.t === 'iff') return phrase(a.a, o, true) + ' and ' + phrase(a.b, o, true) + ' are not equivalent';
      if (a.t === 'ex') return 'there is no ' + a.x + ' with ' + phrase(a.a, o, false);
      if (a.t === 'all') return 'not every ' + a.x + ' has ' + phrase(a.a, o, false);
      return 'it is not the case that ' + phrase(a, o, true);
    }
    case 'imp':
      if (lit(f.a) && lit(f.b)) return phrase(f.a, o, true) + ' implies ' + phrase(f.b, o, true);
      return phrase(f, o, false);
    case 'all':
      if (f.a.t === 'imp') return 'every ' + f.x + ' with ' + phrase(f.a.a, o, false) + ' has ' + phrase(f.a.b, o, false);
      if (f.a.t === 'not' && f.a.a.t !== 'all' && f.a.a.t !== 'ex') return 'no ' + f.x + ' has ' + phrase(f.a.a, o, false);
      return phrase(f, o, false);
    case 'ex':
      return 'some ' + f.x + ' has ' + phrase(f.a, o, false);
    default:
      return phrase(f, o, false);
  }
}

/** "If H₁ and H₂, then G." */
export function sentence(hyps: F[], goal: F, o: EnglishOpts = {}): string {
  const g = goal.t === 'bot' ? 'we reach a contradiction' : clause(goal, o);
  if (hyps.length === 0) return cap(g) + '.';
  const hs = hyps.map((h) => clause(h, o));
  if (hs.length === 1) return `If ${hs[0]}, then ${g}.`;
  const tricky = hs.some((h) => / and | or /.test(h));
  if (!tricky) return `If ${hs.slice(0, -1).join(', ')} and ${hs[hs.length - 1]}, then ${g}.`;
  return `Suppose that ${hs.slice(0, -1).join('; that ')}; and that ${hs[hs.length - 1]}. Then ${g}.`;
}

/* ------------------------------------------------------------------ types (A B C : Type) */

const article = (s: string) => (/^[AEIOU]/.test(s) ? 'an ' : 'a ') + s;

export function noun(f: F): string {
  switch (f.t) {
    case 'atom':
      return article(f.p);
    case 'imp':
      if (f.a.t === 'atom' && f.b.t === 'atom') return `a function from ${f.a.p} to ${f.b.p}`;
      return `a function turning ${noun(f.a)} into ${noun(f.b)}`;
    case 'and':
      if (f.a.t === 'atom' && f.b.t === 'atom') return `a pair of ${article(f.a.p)} and ${article(f.b.p)}`;
      return `a pair of ${noun(f.a)} and ${noun(f.b)}`;
    default:
      return 'something';
  }
}

/** "Given a function from A to B and an A, produce a B." */
export function typeSentence(hyps: F[], goal: F): string {
  const g = noun(goal);
  if (hyps.length === 0) return `Build ${g}.`;
  const hs = hyps.map(noun);
  const list = hs.length === 1 ? hs[0] : hs.slice(0, -1).join(', ') + ' and ' + hs[hs.length - 1];
  return `Given ${list}, produce ${g}.`;
}
