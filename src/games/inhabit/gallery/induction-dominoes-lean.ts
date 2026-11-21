/** Engine side of the Induction dominoes exhibit: real goals and checked proofs, read off the nat world's environment. */
import { engine } from '../../../domains/lean/engine/index.ts';
import type { Goal } from '../../../domains/lean/engine/types.ts';
import { levelSession } from '../env.ts';
import { proofSource, skeletonSource } from './induction-dominoes.ts';
import type { DominoPreset } from './induction-dominoes.ts';

export interface Goals {
  base: Goal | null;
  step: Goal | null;
}

export interface Checked {
  goals: Goals;
  /** Engine accepts the base-case proof (the other case left as `sorry`). Null if there's no proof to check. */
  baseOk: boolean | null;
  stepOk: boolean | null;
  /** Engine accepts the whole proof, no `sorry`. */
  complete: boolean;
}

const env = () => levelSession('nat-14').env;
const cache = new Map<string, Checked>();

const errors = (r: { diagnostics: { severity: string }[] }) => r.diagnostics.some((d) => d.severity === 'error');

export function goalsOf(stmt: string): Goals {
  const r = engine.check(env(), skeletonSource(stmt));
  const sorries = r.steps.filter((s) => s.tactic === 'sorry');
  return { base: sorries[0]?.before[0] ?? null, step: sorries[1]?.before[0] ?? null };
}

export function checkPreset(p: DominoPreset): Checked {
  const hit = cache.get(p.id);
  if (hit) return hit;
  const e = env();
  const baseOk = p.base ? !errors(engine.check(e, proofSource(p.stmt, p.base, null))) : null;
  const stepOk = p.step ? !errors(engine.check(e, proofSource(p.stmt, null, p.step))) : null;
  const complete = !!p.base && !!p.step && engine.check(e, proofSource(p.stmt, p.base, p.step)).complete;
  const res: Checked = { goals: goalsOf(p.stmt), baseOk, stepOk, complete };
  cache.set(p.id, res);
  return res;
}
