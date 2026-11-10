/**
 * Universe levels: `Prop = Sort 0`, `Type = Sort 1`, `Type u = Sort (u+1)`.
 *
 * Levels are immutable trees. Comparison works on a normal form
 * (a `max` of `param/mvar/zero + offset` atoms), which is complete for the
 * fragment that the game needs (no deep `imax` reasoning).
 */

export type Level =
  | { readonly k: 'zero' }
  | { readonly k: 'succ'; readonly l: Level }
  | { readonly k: 'max'; readonly a: Level; readonly b: Level }
  | { readonly k: 'imax'; readonly a: Level; readonly b: Level }
  | { readonly k: 'param'; readonly name: string }
  | { readonly k: 'mvar'; readonly id: number };

export const lzero: Level = { k: 'zero' };
export const lone: Level = { k: 'succ', l: lzero };
export const lsucc = (l: Level): Level => ({ k: 'succ', l });
export const lparam = (name: string): Level => ({ k: 'param', name });
export const lmvar = (id: number): Level => ({ k: 'mvar', id });

export function lmax(a: Level, b: Level): Level {
  if (a.k === 'zero') return b;
  if (b.k === 'zero') return a;
  if (levelEqStruct(a, b)) return a;
  const na = toNat(a);
  const nb = toNat(b);
  if (na !== null && nb !== null) return na >= nb ? a : b;
  return { k: 'max', a, b };
}

export function limax(a: Level, b: Level): Level {
  if (b.k === 'zero') return lzero;
  if (isNeverZero(b)) return lmax(a, b);
  if (a.k === 'zero') return b;
  if (levelEqStruct(a, b)) return a;
  return { k: 'imax', a, b };
}

export function isNeverZero(l: Level): boolean {
  switch (l.k) {
    case 'zero':
    case 'param':
    case 'mvar':
      return false;
    case 'succ':
      return true;
    case 'max':
      return isNeverZero(l.a) || isNeverZero(l.b);
    case 'imax':
      return isNeverZero(l.b);
  }
}

export function toNat(l: Level): number | null {
  let n = 0;
  while (l.k === 'succ') {
    n++;
    l = l.l;
  }
  return l.k === 'zero' ? n : null;
}

export function levelEqStruct(a: Level, b: Level): boolean {
  if (a === b) return true;
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'zero':
      return true;
    case 'succ':
      return levelEqStruct(a.l, (b as typeof a).l);
    case 'max':
    case 'imax':
      return levelEqStruct(a.a, (b as typeof a).a) && levelEqStruct(a.b, (b as typeof a).b);
    case 'param':
      return a.name === (b as typeof a).name;
    case 'mvar':
      return a.id === (b as typeof a).id;
  }
}

export function hasLevelMVar(l: Level): boolean {
  switch (l.k) {
    case 'zero':
    case 'param':
      return false;
    case 'mvar':
      return true;
    case 'succ':
      return hasLevelMVar(l.l);
    default:
      return hasLevelMVar(l.a) || hasLevelMVar(l.b);
  }
}

export function hasLevelParam(l: Level): boolean {
  switch (l.k) {
    case 'zero':
    case 'mvar':
      return false;
    case 'param':
      return true;
    case 'succ':
      return hasLevelParam(l.l);
    default:
      return hasLevelParam(l.a) || hasLevelParam(l.b);
  }
}

export function instantiateLevelParams(l: Level, names: string[], vals: Level[]): Level {
  switch (l.k) {
    case 'zero':
    case 'mvar':
      return l;
    case 'param': {
      const i = names.indexOf(l.name);
      return i >= 0 ? vals[i] : l;
    }
    case 'succ':
      return lsucc(instantiateLevelParams(l.l, names, vals));
    case 'max':
      return lmax(instantiateLevelParams(l.a, names, vals), instantiateLevelParams(l.b, names, vals));
    case 'imax':
      return limax(instantiateLevelParams(l.a, names, vals), instantiateLevelParams(l.b, names, vals));
  }
}

export function mapLevelMVars(l: Level, f: (id: number) => Level | undefined): Level {
  switch (l.k) {
    case 'zero':
    case 'param':
      return l;
    case 'mvar': {
      const v = f(l.id);
      return v ? mapLevelMVars(v, f) : l;
    }
    case 'succ':
      return lsucc(mapLevelMVars(l.l, f));
    case 'max':
      return lmax(mapLevelMVars(l.a, f), mapLevelMVars(l.b, f));
    case 'imax':
      return limax(mapLevelMVars(l.a, f), mapLevelMVars(l.b, f));
  }
}

/* ---------- normal form: max of (atom + offset) ---------- */

interface Atom {
  /** '' = zero, 'p:name' = param, 'm:id' = mvar, 'i:...' = opaque imax */
  key: string;
  off: number;
  level: Level | null;
}

function normalize(l: Level, off = 0, out: Atom[] = []): Atom[] {
  switch (l.k) {
    case 'zero':
      out.push({ key: '', off, level: null });
      break;
    case 'succ':
      normalize(l.l, off + 1, out);
      break;
    case 'max':
      normalize(l.a, off, out);
      normalize(l.b, off, out);
      break;
    case 'imax': {
      const s = limax(l.a, l.b);
      if (s.k === 'imax') out.push({ key: 'i:' + showLevel(s), off, level: s });
      else normalize(s, off, out);
      break;
    }
    case 'param':
      out.push({ key: 'p:' + l.name, off, level: l });
      break;
    case 'mvar':
      out.push({ key: 'm:' + l.id, off, level: l });
      break;
  }
  return out;
}

function canon(l: Level): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of normalize(l)) m.set(a.key, Math.max(m.get(a.key) ?? -1, a.off));
  // the constant part is subsumed by any atom with offset >= it
  const z = m.get('');
  if (z !== undefined) {
    for (const [k, v] of m) if (k !== '' && v >= z) { m.delete(''); break; }
  }
  if (m.size === 0) m.set('', 0);
  return m;
}

/** Semantic equality of levels without metavariables (params are universally quantified). */
export function levelEquiv(a: Level, b: Level): boolean {
  if (levelEqStruct(a, b)) return true;
  const ca = canon(a);
  const cb = canon(b);
  if (ca.size !== cb.size) return false;
  for (const [k, v] of ca) if (cb.get(k) !== v) return false;
  return true;
}

/** `a ≤ b` for every assignment of params (sound approximation). */
export function levelLeq(a: Level, b: Level): boolean {
  const ca = canon(a);
  const cb = canon(b);
  for (const [k, v] of ca) {
    if (k === '') {
      // constant v: need some atom in b with offset >= v (atoms are >= 0)
      let ok = false;
      for (const [, w] of cb) if (w >= v) ok = true;
      if (!ok) return false;
    } else {
      const w = cb.get(k);
      if (w === undefined || w < v) return false;
    }
  }
  return true;
}

export function showLevel(l: Level): string {
  const n = toNat(l);
  if (n !== null) return String(n);
  switch (l.k) {
    case 'param':
      return l.name;
    case 'mvar':
      return '?u_' + l.id;
    case 'succ': {
      let k = 0;
      let x: Level = l;
      while (x.k === 'succ') {
        k++;
        x = x.l;
      }
      return `${showLevelArg(x)} + ${k}`;
    }
    case 'max':
      return `max ${showLevelArg(l.a)} ${showLevelArg(l.b)}`;
    case 'imax':
      return `imax ${showLevelArg(l.a)} ${showLevelArg(l.b)}`;
    default:
      return '0';
  }
}

function showLevelArg(l: Level): string {
  const s = showLevel(l);
  return /\s/.test(s) ? `(${s})` : s;
}

export function collectLevelParams(l: Level, out: Set<string>): void {
  switch (l.k) {
    case 'param':
      out.add(l.name);
      return;
    case 'succ':
      collectLevelParams(l.l, out);
      return;
    case 'max':
    case 'imax':
      collectLevelParams(l.a, out);
      collectLevelParams(l.b, out);
      return;
    default:
      return;
  }
}
