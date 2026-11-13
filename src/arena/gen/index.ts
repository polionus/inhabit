/**
 * The Arena puzzle generator (contract: src/arena/types.ts). Pure and deterministic: the same
 * (seed, family, target) gives the same puzzle in every JavaScript engine. No Math.random, no Date.
 *
 * For each family we draw candidates from the seed's stream (forked per attempt), rate each from
 * its reference proof, and take the first within tolerance of the target (else the closest); the
 * chosen reference solution is re-checked by the engine under the puzzle's own `allowedTactics`
 * before it is returned. On any internal failure we fall back, deterministically, to an easier
 * puzzle for the same seed.
 */
import type { Generator, ProofFamily, ProofPuzzle, Puzzle, PuzzleFamily, PuzzleSpec, QuickKind, QuickPuzzle, Rng } from '../types.ts';
import type { CheckResult } from '../../engine/types.ts';
import { engine } from '../../engine/index.ts';
import { makeRng } from './rng.ts';
import { CLASSICAL_TACTICS, PROP_TACTICS, propAttempt } from './prop.ts';
import type { Built } from './prop.ts';
import { inhabitAttempt } from './inhabit.ts';
import { QUANT_TACTICS, quantAttempt } from './quant.ts';
import { SET_TACTICS, setAttempt } from './set.ts';
import { QUICK_KINDS, quickAttempt } from './quick.ts';
import type { QuickItem } from './quick.ts';
import { proofPar, quickPar } from './common.ts';

export const GEN_VERSION = 1;

/** Measured by src/arena/gen/gen.test.ts (see the report in the test output). */
export const RANGE: Record<PuzzleFamily, [number, number]> = {
  prop: [400, 2200],
  inhabit: [400, 2000],
  quant: [450, 1600],
  set: [450, 1700],
  quick: [400, 1100],
};

const TOL = 90;

function allowedFor(family: ProofFamily, b: Built): string[] {
  switch (family) {
    case 'prop':
      return b.classical ? [...PROP_TACTICS, ...CLASSICAL_TACTICS] : [...PROP_TACTICS];
    case 'inhabit':
      return [];
    case 'quant':
      return b.classical ? [...QUANT_TACTICS, ...CLASSICAL_TACTICS] : [...QUANT_TACTICS];
    case 'set':
      return [...SET_TACTICS];
  }
}

const ATTEMPT: Record<ProofFamily, (rng: Rng, target: number) => Built | null> = {
  prop: (rng, t) => propAttempt(rng, t, 'tactic', 'prop'),
  inhabit: inhabitAttempt,
  quant: quantAttempt,
  set: setAttempt,
};

function verifies(b: Built, allowed: string[]): boolean {
  const r = engine.check(engine.baseEnv(), b.header + '\n' + b.solution, { allowedTactics: allowed });
  return r.complete;
}

/** Candidates from the stream; returns the first verified one within tolerance, else the closest verified. */
function pick<T extends { rating: number }>(
  rng: Rng,
  target: number,
  attempt: (r: Rng) => T | null,
  ok: (x: T) => boolean,
  maxAttempts: number,
): T | null {
  const near: T[] = [];
  for (let i = 0; i < maxAttempts; i++) {
    const b = attempt(rng.fork('attempt' + i));
    if (!b) continue;
    if (Math.abs(b.rating - target) <= TOL && ok(b)) return b;
    near.push(b);
  }
  near.sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
  for (const b of near.slice(0, 6)) if (ok(b)) return b;
  return null;
}

function proofPuzzle(id: string, family: ProofFamily, b: Built): ProofPuzzle {
  return {
    kind: 'proof',
    id,
    family,
    rating: b.rating,
    par: proofPar(b.rating),
    mode: family === 'inhabit' ? 'term' : 'tactic',
    english: b.english,
    setup: '',
    header: b.header,
    starter: '  sorry',
    solution: b.solution,
    allowedTactics: allowedFor(family, b),
    hints: b.hints,
    themes: b.themes,
  };
}

function quickPuzzle(id: string, q: QuickItem): QuickPuzzle {
  const p: QuickPuzzle = {
    kind: 'quick',
    id,
    family: 'quick',
    rating: Math.max(400, Math.min(2400, q.rating)),
    par: quickPar(q.rating),
    quick: q.quick,
    prompt: q.prompt,
    options: q.options,
    themes: q.themes,
  };
  if (q.code !== undefined) p.code = q.code;
  return p;
}

const clampT = (f: PuzzleFamily, t: number) => {
  const [lo, hi] = RANGE[f];
  return Math.max(lo, Math.min(hi, Math.round(Number.isFinite(t) ? t : lo)));
};

/** Same as `generate`, plus the real-Lean verification snippets of quick items. */
export function generateDetailed(spec: PuzzleSpec): { puzzle: Puzzle; verify?: { ok: string[]; bad: string[] } } {
  const family = spec.family;
  const id = `${family}.${GEN_VERSION}.${spec.seed}.${spec.target}`;
  try {
    const target = clampT(family, spec.target);
    if (family === 'quick') {
      const kinds = (spec.quick?.length ? spec.quick : QUICK_KINDS).filter((k) => QUICK_KINDS.includes(k));
      const ks: QuickKind[] = kinds.length ? kinds : QUICK_KINDS;
      const rng = makeRng(`quick|${spec.seed}|${target}|${ks.join(',')}`);
      // choose the kind first, so every kind that can reach the target gets its turn
      let best: QuickItem | null = null;
      for (const k of rng.shuffle(ks)) {
        const q = pick(rng.fork(k), target, (r) => quickAttempt(r, target, [k]), () => true, 8);
        if (q && Math.abs(q.rating - target) <= TOL) {
          best = q;
          break;
        }
        if (q && (!best || Math.abs(q.rating - target) < Math.abs(best.rating - target))) best = q;
      }
      if (best) return { puzzle: quickPuzzle(id, best), verify: best.verify };
      return fallbackQuick(id, spec.seed, ks);
    }
    const rng = makeRng(`${family}|${spec.seed}|${target}`);
    const b = pick(rng, target, (r) => ATTEMPT[family](r, target), (x) => verifies(x, allowedFor(family, x)), 70);
    if (b) return { puzzle: proofPuzzle(id, family, b) };
  } catch {
    // fall through to the fallback
  }
  return { puzzle: fallbackProof(id, family, spec.seed) };
}

function fallbackProof(id: string, family: PuzzleFamily, seed: string): Puzzle {
  const fam: ProofFamily = family === 'quick' ? 'prop' : family;
  try {
    const rng = makeRng(`fallback|${fam}|${seed}`);
    const b = pick(rng, 500, (r) => ATTEMPT[fam](r, 500), (x) => verifies(x, allowedFor(fam, x)), 30);
    if (b) return proofPuzzle(id, fam, b);
  } catch {
    // last resort below
  }
  return {
    kind: 'proof',
    id,
    family: 'prop',
    rating: 450,
    par: proofPar(450),
    mode: 'tactic',
    english: 'If P and Q, then Q and P.',
    setup: '',
    header: 'theorem puzzle (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by',
    starter: '  sorry',
    solution: '  obtain ⟨hp, hq⟩ := h\n  exact ⟨hq, hp⟩',
    allowedTactics: [...PROP_TACTICS],
    hints: ['A hypothesis is a conjunction: take it apart.', 'Start with `obtain ⟨hp, hq⟩ := h`.'],
    themes: ['conjunction', 'commutativity'],
  };
}

function fallbackQuick(id: string, seed: string, kinds: QuickKind[]): { puzzle: Puzzle; verify?: { ok: string[]; bad: string[] } } {
  try {
    const rng = makeRng(`fallback|quick|${seed}`);
    for (const k of [...kinds, 'provable' as QuickKind]) {
      const q = pick(rng.fork(k), 500, (r) => quickAttempt(r, 500, [k]), () => true, 12);
      if (q) return { puzzle: quickPuzzle(id, q), verify: q.verify };
    }
  } catch {
    // last resort below
  }
  return {
    puzzle: {
      kind: 'quick',
      id,
      family: 'quick',
      rating: 450,
      par: quickPar(450),
      quick: 'provable',
      prompt: 'For all propositions P, Q: can this be proved in Lean?',
      code: 'P ∧ Q → Q ∧ P',
      options: [
        { text: 'Provable', correct: true, why: 'It is provable: for example `fun ⟨hp, hq⟩ => ⟨hq, hp⟩`.' },
        { text: 'Not provable', correct: false, why: 'It is true under every assignment and has a direct proof.' },
      ],
      themes: ['provability', 'constructive'],
    },
  };
}

/** Check a solver's body exactly as the Arena does. */
function check(puzzle: ProofPuzzle, body: string): { complete: boolean; result: CheckResult; bodyOffset: number } {
  const head = (puzzle.setup ? puzzle.setup + '\n' : '') + puzzle.header + '\n';
  const bodyOffset = head.length;
  let result = engine.check(engine.baseEnv(), head + body, { allowedTactics: puzzle.allowedTactics });
  const axioms = result.decls.filter((d) => d.kind === 'axiom' && d.from >= bodyOffset);
  if (axioms.length) {
    result = {
      ...result,
      ok: false,
      complete: false,
      diagnostics: [
        ...result.diagnostics,
        ...axioms.map((d) => ({
          severity: 'error' as const,
          code: 'name-locked' as const,
          message: '`axiom` is not available in the Arena: an axiom assumes its statement without proof. Prove it instead.',
          from: d.from,
          to: d.to,
          data: { name: 'axiom' },
        })),
      ],
    };
  }
  const main = result.decls.find((d) => d.name === 'puzzle');
  const complete = result.complete && !!main && main.ok && !main.usesSorry && !result.decls.some((d) => d.usesSorry);
  return { complete, result, bodyOffset };
}

export const generator: Generator = {
  version: GEN_VERSION,
  range: RANGE,
  generate: (spec: PuzzleSpec): Puzzle => generateDetailed(spec).puzzle,
  check,
};
