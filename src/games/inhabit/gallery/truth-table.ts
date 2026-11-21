/**
 * Truth-table exhibit logic: parse a propositional formula, tabulate it, classify it, and ask the
 * arena's provers (G4ip for provability, the readable proof search for a script) whether Lean can
 * prove it constructively. Lean text built here is checked by the engine in the exhibit and in tests.
 */
import { atomNames, classify, countermodel, evalF, g4ip, key, parse, show } from '../arena/gen/logic.ts';
import type { F } from '../arena/gen/logic.ts';
import { Prover, prune } from '../arena/gen/search.ts';
import { script } from '../arena/gen/emit.ts';
import { propNaming } from '../arena/gen/common.ts';
import { atom } from '../arena/gen/logic.ts';
import { CLASSICAL_TACTICS, PROP_TACTICS } from '../arena/gen/prop.ts';

export const MAX_ATOMS = 4;

export type ParseResult = { ok: true; f: F; atoms: string[] } | { ok: false; error: string };

/** Accept ASCII spellings too (`->`, `<->`, `/\`, `\/`, `~`, `!`). */
export function normalize(src: string): string {
  return src
    .replace(/<->/g, '↔')
    .replace(/->/g, '→')
    .replace(/\/\\/g, '∧')
    .replace(/\\\//g, '∨')
    .replace(/[~!]/g, '¬');
}

export function parseFormula(src: string): ParseResult {
  const s = normalize(src).trim();
  if (!s) return { ok: false, error: 'Type a formula, for example P → Q.' };
  const bad = s.match(/[^A-Za-z0-9_'¬∧∨→↔(),\s]/);
  if (bad) return { ok: false, error: `I don't know the symbol "${bad[0]}". Use ¬ ∧ ∨ → ↔, True, False and letters like P Q R.` };
  let f: F;
  try {
    f = parse(s);
  } catch {
    return { ok: false, error: 'That is not a well-formed formula. Check the parentheses and that every connective has two sides.' };
  }
  const ok = checkProp(f);
  if (ok) return { ok: false, error: ok };
  const atoms = atomNames(f).filter((a) => a !== 'True' && a !== 'False');
  if (atoms.length > MAX_ATOMS) return { ok: false, error: `Use at most ${MAX_ATOMS} different letters.` };
  return { ok: true, f, atoms: atoms.sort() };
}

function checkProp(f: F): string | null {
  switch (f.t) {
    case 'atom':
      if (f.args.length || !/^[A-Z]$/.test(f.p)) return `"${f.p}${f.args.length ? ' …' : ''}" is not a proposition letter. Use single capital letters such as P, Q, R.`;
      return null;
    case 'bot':
    case 'top':
      return null;
    case 'not':
      return checkProp(f.a);
    case 'all':
    case 'ex':
      return 'Quantifiers are not allowed here; this exhibit is propositional.';
    default:
      return checkProp(f.a) ?? checkProp(f.b);
  }
}

export interface Row {
  values: Record<string, boolean>;
  /** Value of each column formula (same order as `columns`). */
  cells: boolean[];
  result: boolean;
}

export interface Table {
  atoms: string[];
  /** Proper compound subformulas in evaluation order, ending with the whole formula. */
  columns: { f: F; text: string }[];
  rows: Row[];
}

function subformulas(f: F, out: F[] = [], seen: Set<string> = new Set()): F[] {
  switch (f.t) {
    case 'atom':
    case 'bot':
    case 'top':
      return out;
    case 'not':
      subformulas(f.a, out, seen);
      break;
    case 'all':
    case 'ex':
      return out;
    default:
      subformulas(f.a, out, seen);
      subformulas(f.b, out, seen);
  }
  const k = key(f);
  if (!seen.has(k)) {
    seen.add(k);
    out.push(f);
  }
  return out;
}

export function truthTable(f: F, atoms: string[]): Table {
  const columns = subformulas(f).map((g) => ({ f: g, text: show(g) }));
  if (!columns.length) columns.push({ f, text: show(f) });
  const rows: Row[] = [];
  const n = atoms.length;
  for (let m = 0; m < 1 << n; m++) {
    const values: Record<string, boolean> = {};
    // first atom varies slowest, true before false (the usual textbook order)
    atoms.forEach((a, i) => (values[a] = !(m & (1 << (n - 1 - i)))));
    const cells = columns.map((c) => evalF(c.f, values));
    rows.push({ values, cells, result: evalF(f, values) });
  }
  return { atoms, columns, rows };
}

export type Kind = 'tautology' | 'contradiction' | 'contingent';

export function classifyTable(t: Table): { kind: Kind; trueRows: number; total: number; satisfiable: boolean } {
  const trueRows = t.rows.filter((r) => r.result).length;
  const total = t.rows.length;
  const kind: Kind = trueRows === total ? 'tautology' : trueRows === 0 ? 'contradiction' : 'contingent';
  return { kind, trueRows, total, satisfiable: trueRows > 0 };
}

export type Verdict = 'constructive' | 'classical' | 'invalid';

/** Constructive provability (G4ip), or classical-only, or not a tautology at all. */
export function verdict(f: F): Verdict {
  if (countermodel(f)) return 'invalid';
  return g4ip([], f) ? 'constructive' : 'classical';
}

export interface LeanProof {
  /** `example (P Q : Prop) : … := by` */
  header: string;
  lines: string[];
  /** header + indented lines */
  source: string;
  /** Tactics the proof may use (for the engine's allow-list). */
  allowed: string[];
  usesClassical: boolean;
}

export const leanStatement = (f: F, atoms: string[]): string =>
  `example${atoms.length ? ` (${atoms.join(' ')} : Prop)` : ''} : ${show(f)}`;

/**
 * A readable tactic proof. `classical: false` searches the constructive fragment only; `classical: true`
 * lets the search use `by_cases` / `by_contra`. Returns null when the search gives up.
 */
export function leanProof(f: F, atoms: string[], classical: boolean): LeanProof | null {
  const prover = new Prover({
    naming: propNaming,
    classical,
    caseAtoms: atoms.map((a) => atom(a)),
    maxCost: 24,
    nodeLimit: 60000,
  });
  const res = prover.prove([], [], f, [...atoms]);
  if (!res) return null;
  const lines = script(prune(res.pf), { style: {}, cases: 'cases' }).map((l) => '  ' + l);
  const header = leanStatement(f, atoms) + ' := by';
  const usesClassical = lines.some((l) => /\b(by_cases|by_contra)\b/.test(l));
  return {
    header,
    lines,
    source: [header, ...lines].join('\n'),
    allowed: classical ? [...PROP_TACTICS, ...CLASSICAL_TACTICS] : [...PROP_TACTICS],
    usesClassical,
  };
}

export interface Preset {
  label: string;
  formula: string;
  note: string;
}

export const PRESETS: Preset[] = [
  { label: 'Excluded middle', formula: 'P ∨ ¬P', note: 'Always true, yet Lean needs a classical step to prove it.' },
  { label: 'Double negation out', formula: '¬¬P → P', note: 'Classical only: removing a double negation is not constructive.' },
  { label: 'Double negation in', formula: 'P → ¬¬P', note: 'Constructive: given a proof of P you can refute any refutation of P.' },
  { label: 'Contrapositive', formula: '(P → Q) → (¬Q → ¬P)', note: 'Constructive.' },
  { label: 'Converse contrapositive', formula: '(¬Q → ¬P) → (P → Q)', note: 'Classical only, though it looks like the one above.' },
  { label: 'Not a tautology', formula: 'P → Q', note: 'False when P is true and Q is false.' },
];
