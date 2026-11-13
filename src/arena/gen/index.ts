/** Stub: replaced by the generator agent. Exports `generator: Generator`. */
import type { Generator, ProofPuzzle, Puzzle, PuzzleSpec } from '../types.ts';
import { engine } from '../../engine/index.ts';

const stub = (spec: PuzzleSpec): Puzzle => ({
  kind: 'proof',
  id: `prop.0.${spec.seed}.${spec.target}`,
  family: 'prop',
  rating: 600,
  par: 30,
  mode: 'tactic',
  english: 'If P holds, then P holds.',
  setup: '',
  header: 'theorem puzzle (P : Prop) : P → P := by',
  starter: '  sorry',
  solution: '  intro h\n  exact h',
  allowedTactics: ['intro', 'exact', 'apply', 'assumption'],
  hints: ['The goal is an implication.', 'Start with `intro h`.'],
  themes: ['implication'],
});

export const generator: Generator = {
  version: 0,
  range: { prop: [400, 800], inhabit: [400, 800], quant: [400, 800], set: [400, 800], quick: [400, 800] },
  generate: stub,
  check(puzzle: ProofPuzzle, body: string) {
    const head = (puzzle.setup ? puzzle.setup + '\n' : '') + puzzle.header + '\n';
    const result = engine.check(engine.baseEnv(), head + body, { allowedTactics: puzzle.allowedTactics });
    return { complete: result.complete, result, bodyOffset: head.length };
  },
};
