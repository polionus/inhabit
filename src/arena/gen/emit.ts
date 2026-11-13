/**
 * Turn a proof (`Pf`, from search.ts) into Lean 4 source: an indented tactic script, or a term.
 * Scripts use only idioms verified in both the mini-engine and real Lean (see verify-arena).
 */
import { show } from './logic.ts';
import type { F, Style } from './logic.ts';
import { usedNames } from './search.ts';
import type { Item, Pf } from './search.ts';

export interface Lang {
  style: Style;
  /** `cases h with | inl … | inr …` or `rcases h with a | b` + bullets. */
  cases: 'cases' | 'rcases';
  /** Type mode: pairs are `(a, b)`. */
  typeMode?: boolean;
}

const MAX_SIMPLE = 46;

/* ------------------------------------------------------------------ simple terms */

const needsParens = (s: string) => /\s/.test(s) && !/^[⟨(].*[⟩)]$/.test(s);
const arg = (s: string) => (needsParens(s) ? '(' + s + ')' : s);

/** A one-line term for `pf` without binders, or null. */
export function simpleTerm(pf: Pf, L: Lang): string | null {
  const s = simpleRaw(pf, L);
  return s !== null && s.length <= MAX_SIMPLE ? s : null;
}
function simpleItems(items: Item[], L: Lang): string[] | null {
  const out: string[] = [];
  for (const it of items) {
    if ('term' in it) out.push(it.term);
    else {
      const s = simpleRaw(it.pf, L);
      if (s === null) return null;
      out.push(arg(s));
    }
  }
  return out;
}
function tupleParts(pf: Pf, L: Lang): string[] | null {
  if (pf.k === 'and' && !L.typeMode) {
    const a = simpleRaw(pf.l, L);
    const b = tupleParts(pf.r, L);
    return a === null || b === null ? null : [a, ...b];
  }
  if (pf.k === 'exI') {
    const b = tupleParts(pf.p, L);
    return b === null ? null : [pf.w, ...b];
  }
  const s = simpleRaw(pf, L);
  return s === null ? null : [s];
}
function simpleRaw(pf: Pf, L: Lang): string | null {
  switch (pf.k) {
    case 'hyp':
      return pf.name;
    case 'trivial':
      return 'trivial';
    case 'falseE':
      return `False.elim ${pf.h}`;
    case 'app': {
      const xs = simpleItems(pf.items, L);
      return xs && [pf.h, ...xs].join(' ');
    }
    case 'and':
    case 'exI': {
      if (L.typeMode && pf.k === 'and') {
        const a = simpleRaw(pf.l, L);
        const b = simpleRaw(pf.r, L);
        return a === null || b === null ? null : `(${a}, ${b})`;
      }
      const parts = tupleParts(pf, L);
      return parts && '⟨' + parts.join(', ') + '⟩';
    }
    case 'inl':
    case 'inr': {
      const s = simpleRaw(pf.p, L);
      return s === null ? null : `Or.${pf.k} ${arg(s)}`;
    }
    case 'exfalso': {
      const p = pf.p;
      if (p.k === 'app' && p.hf.t === 'not' && p.items.length === 1 && 'pf' in p.items[0]) {
        const x = simpleRaw(p.items[0].pf, L);
        return x === null ? null : `absurd ${arg(x)} ${p.h}`;
      }
      return null;
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ tactic scripts */

const bullet = (lines: string[]): string[] => ['· ' + lines[0], ...lines.slice(1).map((l) => '  ' + l)];
const indent = (lines: string[]): string[] => lines.map((l) => '  ' + l);

/** Consecutive destructuring nodes starting at `pf`. */
function destructRun(pf: Pf): { nodes: Pf[]; rest: Pf } {
  const nodes: Pf[] = [];
  let p = pf;
  while (p.k === 'andE' || p.k === 'exE') {
    nodes.push(p);
    p = p.body;
  }
  return { nodes, rest: p };
}

/** `obtain` lines for a run of destructuring nodes (nested patterns merged). */
function obtainLines(nodes: Pf[], used: Set<string>, sourceOf: (root: string) => string): string[] {
  const parts = new Map<string, string[]>(); // name → component names
  const produced = new Set<string>();
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.k === 'andE') {
      parts.set(n.h, [n.a, n.b]);
      produced.add(n.a);
      produced.add(n.b);
    } else if (n.k === 'exE') {
      parts.set(n.h, [n.x, n.a]);
      produced.add(n.x);
      produced.add(n.a);
    }
    if (!produced.has((n as { h: string }).h)) roots.push((n as { h: string }).h);
  }
  const pat = (name: string): string => {
    const ps = parts.get(name);
    if (!ps) return used.has(name) ? name : '_';
    const [a, b] = ps;
    const pb = pat(b);
    const inner = parts.has(b) && pb.startsWith('⟨') ? pb.slice(1, -1) : pb;
    return '⟨' + pat(a) + ', ' + inner + '⟩';
  };
  return roots.map((r) => `obtain ${pat(r)} := ${sourceOf(r)}`);
}

export function script(pf: Pf, L: Lang): string[] {
  return tac(pf, L);
}

function tac(pf: Pf, L: Lang): string[] {
  const shw = (f: F) => show(f, L.style);
  switch (pf.k) {
    case 'hyp':
      return [`exact ${pf.name}`];
    case 'trivial':
      return ['exact trivial'];
    case 'falseE':
      return [`exact False.elim ${pf.h}`];
    case 'intro': {
      const names: string[] = [];
      let p: Pf = pf;
      const intros: Extract<Pf, { k: 'intro' }>[] = [];
      while (p.k === 'intro') {
        intros.push(p);
        p = p.body;
      }
      const used = usedNames(p);
      for (const i of intros) names.push(i.f === null || used.has(i.name) ? i.name : '_');
      return [`intro ${names.join(' ')}`, ...tac(p, L)];
    }
    case 'andE':
    case 'exE': {
      const { nodes, rest } = destructRun(pf);
      return [...obtainLines(nodes, usedNames(rest), (r) => r), ...tac(rest, L)];
    }
    case 'and':
    case 'iff': {
      if (pf.k === 'and') {
        const s = simpleTerm(pf, L);
        if (s) return [`exact ${s}`];
      }
      return ['constructor', ...bullet(tac(pf.l, L)), ...bullet(tac(pf.r, L))];
    }
    case 'inl':
    case 'inr':
      return [pf.k === 'inl' ? 'left' : 'right', ...tac(pf.p, L)];
    case 'exI': {
      const s = simpleTerm(pf, L);
      if (s) return [`exact ${s}`];
      return [`use ${pf.w}`, ...tac(pf.p, L)];
    }
    case 'app': {
      const s = simpleTerm(pf, L);
      if (s) return [`exact ${s}`];
      return applyLines(pf, L);
    }
    case 'exfalso': {
      const s = simpleTerm(pf, L);
      if (s) return [`exact ${s}`];
      return ['exfalso', ...tac(pf.p, L)];
    }
    case 'orE':
      return casesLines(pf.h, pf, L);
    case 'have': {
      const appPf: Pf = { k: 'app', goal: pf.f, h: pf.h, hf: pf.hf, items: pf.items };
      const s = simpleTerm(appPf, L);
      const body = pf.body;
      if (s) {
        if ((body.k === 'andE' || body.k === 'exE') && body.h === pf.name) {
          const { nodes, rest } = destructRun(body);
          return [...obtainLines(nodes, usedNames(rest), (r) => (r === pf.name ? s : r)), ...tac(rest, L)];
        }
        if (body.k === 'orE' && body.h === pf.name) return casesLines(s, body, L);
        return [`have ${pf.name} : ${shw(pf.f)} := ${s}`, ...tac(body, L)];
      }
      return [`have ${pf.name} : ${shw(pf.f)} := by`, ...indent(applyLines(appPf as Extract<Pf, { k: 'app' }>, L)), ...tac(body, L)];
    }
    case 'byCases':
      return [`by_cases ${pf.a} : ${shw(pf.v)}`, ...bullet(tac(pf.l, L)), ...bullet(tac(pf.r, L))];
    case 'byContra':
      return [`by_contra ${pf.name}`, ...tac(pf.body, L)];
  }
}

function casesLines(src: string, pf: Extract<Pf, { k: 'orE' }>, L: Lang): string[] {
  const na = usedNames(pf.l).has(pf.a) ? pf.a : '_';
  const nb = usedNames(pf.r).has(pf.b) ? pf.b : '_';
  const l = tac(pf.l, L);
  const r = tac(pf.r, L);
  // The mini-engine cannot end a nested `cases … with` before an outer `| inr` (real Lean can,
  // by column), so a left branch containing one uses the bullet form.
  if (L.cases === 'rcases' || l.some((x) => /^\s*cases .* with$/.test(x))) {
    return [`rcases ${src} with ${na} | ${nb}`, ...bullet(l), ...bullet(r)];
  }
  const branch = (tag: string, n: string, lines: string[]) =>
    lines.length === 1 ? [`| ${tag} ${n} => ${lines[0]}`] : [`| ${tag} ${n} =>`, ...indent(lines)];
  return [`cases ${src} with`, ...branch('inl', na, l), ...branch('inr', nb, r)];
}

/** `apply h …` with the easy arguments given inline and the rest as goals. */
function applyLines(pf: Extract<Pf, { k: 'app' }>, L: Lang): string[] {
  const items = pf.items;
  // Inline the longest prefix of terms / simple proofs, keeping at least one goal.
  let n = 0;
  const inline: string[] = [];
  while (n < items.length) {
    const it = items[n];
    const s = 'term' in it ? it.term : simpleTerm(it.pf, L);
    if (s === null) break;
    inline.push(arg(s));
    n++;
  }
  if (n === items.length) {
    // all simple but too long for one line: give the last one as a goal
    n--;
    inline.pop();
  }
  const rest = items.slice(n);
  if (rest.some((it) => 'term' in it)) {
    // a term argument after a proof argument: give everything inline with `?_` holes
    const parts = items.map((it) => ('term' in it ? it.term : '?_'));
    const goals = items.filter((it): it is { pf: Pf } => 'pf' in it).map((it) => it.pf);
    const head = `refine ${pf.h} ${parts.join(' ')}`;
    if (goals.length === 1) return [head, ...tac(goals[0], L)];
    return [head, ...goals.flatMap((g) => bullet(tac(g, L)))];
  }
  const head = ['apply', pf.h, ...inline].join(' ');
  const goals = rest.map((it) => (it as { pf: Pf }).pf);
  if (goals.length === 1) return [head, ...tac(goals[0], L)];
  return [head, ...goals.flatMap((g) => bullet(tac(g, L)))];
}

/* ------------------------------------------------------------------ terms */

type T =
  | { k: 'a'; s: string }
  | { k: 'app'; f: T; args: T[] }
  | { k: 'fun'; ps: string[]; body: T }
  | { k: 'tup'; xs: T[]; paren: boolean }
  | { k: 'proj'; e: T; p: string };

const A = (s: string): T => ({ k: 'a', s });
const App = (f: string | T, args: T[]): T => ({ k: 'app', f: typeof f === 'string' ? A(f) : f, args });

function flat(t: T): string {
  switch (t.k) {
    case 'a':
      return t.s;
    case 'app':
      return [flat(t.f), ...t.args.map(atomic)].join(' ');
    case 'fun':
      return `fun ${t.ps.join(' ')} => ${flat(t.body)}`;
    case 'tup':
      return (t.paren ? '(' : '⟨') + t.xs.map(flat).join(', ') + (t.paren ? ')' : '⟩');
    case 'proj':
      return (t.e.k === 'a' || t.e.k === 'proj' || t.e.k === 'tup' ? flat(t.e) : '(' + flat(t.e) + ')') + '.' + t.p;
  }
}
const atomic = (t: T): string => (t.k === 'app' || t.k === 'fun' ? '(' + flat(t) + ')' : flat(t));

const WIDTH = 72;
/** Render with line breaks when a term does not fit. `col` is the current column. */
function layout(t: T, col: number, ind: number): string {
  const f = flat(t);
  if (col + f.length <= WIDTH) return f;
  const nl = (i: number) => '\n' + ' '.repeat(i);
  switch (t.k) {
    case 'fun': {
      const head = `fun ${t.ps.join(' ')} =>`;
      return head + nl(ind + 2) + layout(t.body, ind + 2, ind + 2);
    }
    case 'app': {
      let head = flat(t.f);
      let args = t.args;
      while (args.length > 1 && args[0].k === 'a' && col + head.length + 1 + flat(args[0]).length <= WIDTH) {
        head += ' ' + flat(args[0]);
        args = args.slice(1);
      }
      return (
        head +
        args
          .map((a) => {
            const inner = layout(a, ind + 3, ind + 3);
            return nl(ind + 2) + (a.k === 'app' || a.k === 'fun' ? '(' + inner + ')' : inner);
          })
          .join('')
      );
    }
    case 'tup': {
      const [o, c] = t.paren ? ['(', ')'] : ['⟨', '⟩'];
      return o + t.xs.map((x, i) => (i ? ',' + nl(ind + 1) : '') + layout(x, ind + 1, ind + 1)).join('') + c;
    }
    default:
      return f;
  }
}

/** Term-mode proof (or program, in Type mode), laid out for a body indented by 2. */
export function termOf(pf: Pf, L: Lang): string {
  const t = term(pf, L, new Map());
  return '  ' + layout(t, 2, 2);
}

/** Flat one-line term (for quick items). */
export function flatTerm(pf: Pf, L: Lang): string {
  return flat(term(pf, L, new Map()));
}

function term(pf: Pf, L: Lang, env: Map<string, T>): T {
  const ref = (n: string): T => env.get(n) ?? A(n);
  const items = (its: Item[]) => its.map((it) => ('term' in it ? A(it.term) : term(it.pf, L, env)));
  const projName = (iff: boolean, i: 0 | 1) => (iff ? (i ? 'mpr' : 'mp') : i ? '2' : '1');
  switch (pf.k) {
    case 'hyp':
      return ref(pf.name);
    case 'trivial':
      return A('trivial');
    case 'falseE':
      return App('False.elim', [ref(pf.h)]);
    case 'intro': {
      const names: string[] = [];
      let p: Pf = pf;
      while (p.k === 'intro') {
        names.push(p.name);
        p = p.body;
      }
      const used = usedNames(p);
      // destructuring of just-bound names becomes a pattern
      const { nodes, rest } = destructRun(p);
      const parts = new Map<string, string[]>();
      const local = new Set(names);
      const env2 = new Map(env);
      for (const n of nodes) {
        if (n.k === 'andE' && local.has(n.h)) {
          parts.set(n.h, [n.a, n.b]);
          local.add(n.a);
          local.add(n.b);
        } else if (n.k === 'exE' && local.has(n.h)) {
          parts.set(n.h, [n.x, n.a]);
          local.add(n.x);
          local.add(n.a);
        } else if (n.k === 'andE') {
          env2.set(n.a, { k: 'proj', e: ref(n.h), p: projName(n.iff, 0) });
          env2.set(n.b, { k: 'proj', e: ref(n.h), p: projName(n.iff, 1) });
        } else {
          // ∃ on a non-local hypothesis: fall back to Exists.elim below
          return App('fun', []); // unreachable in practice (term mode has no quantifiers)
        }
      }
      const pat = (name: string): string => {
        const ps = parts.get(name);
        if (!ps) return used.has(name) ? name : '_';
        const [a, b] = ps;
        const pb = pat(b);
        const inner = parts.has(b) && pb.startsWith('⟨') ? pb.slice(1, -1) : pb;
        return '⟨' + pat(a) + ', ' + inner + '⟩';
      };
      return { k: 'fun', ps: names.map(pat), body: term(rest, L, env2) };
    }
    case 'andE': {
      const env2 = new Map(env);
      env2.set(pf.a, { k: 'proj', e: ref(pf.h), p: projName(pf.iff, 0) });
      env2.set(pf.b, { k: 'proj', e: ref(pf.h), p: projName(pf.iff, 1) });
      return term(pf.body, L, env2);
    }
    case 'exE':
      return App('Exists.elim', [ref(pf.h), { k: 'fun', ps: [pf.x, pf.a], body: term(pf.body, L, env) }]);
    case 'and':
    case 'iff':
      return { k: 'tup', xs: [term(pf.l, L, env), term(pf.r, L, env)], paren: !!L.typeMode && pf.k === 'and' };
    case 'exI':
      return { k: 'tup', xs: [A(pf.w), term(pf.p, L, env)], paren: false };
    case 'inl':
    case 'inr':
      return App(`Or.${pf.k}`, [term(pf.p, L, env)]);
    case 'orE': {
      const na = usedNames(pf.l).has(pf.a) ? pf.a : '_';
      const nb = usedNames(pf.r).has(pf.b) ? pf.b : '_';
      return App('Or.elim', [
        ref(pf.h),
        { k: 'fun', ps: [na], body: term(pf.l, L, env) },
        { k: 'fun', ps: [nb], body: term(pf.r, L, env) },
      ]);
    }
    case 'app': {
      const xs = items(pf.items);
      return xs.length ? App(ref(pf.h), xs) : ref(pf.h);
    }
    case 'exfalso': {
      const p = pf.p;
      if (p.k === 'app' && p.hf.t === 'not' && p.items.length === 1 && 'pf' in p.items[0]) {
        return App('absurd', [term(p.items[0].pf, L, env), ref(p.h)]);
      }
      return App('False.elim', [term(p, L, env)]);
    }
    case 'have': {
      const env2 = new Map(env);
      const xs = items(pf.items);
      env2.set(pf.name, xs.length ? App(ref(pf.h), xs) : ref(pf.h));
      return term(pf.body, L, env2);
    }
    case 'byCases':
      return App('Or.elim', [
        App('Classical.em', [A(show(pf.v, L.style, 'not'))]),
        { k: 'fun', ps: [pf.a], body: term(pf.l, L, env) },
        { k: 'fun', ps: [pf.b], body: term(pf.r, L, env) },
      ]);
    case 'byContra':
      return App('Classical.byContradiction', [{ k: 'fun', ps: [pf.name], body: term(pf.body, L, env) }]);
  }
}
