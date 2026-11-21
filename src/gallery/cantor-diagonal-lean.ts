/** Engine side of the Cantor diagonal exhibit: the statement elaborated and the game's reference proof of fun-15 checked. */
import { engine } from '../engine/index.ts';
import { checkBody, levelSession } from '../game/env.ts';

export interface CantorReport {
  header: string;
  /** The statement's target as the engine prints it. */
  pretty: string | null;
  /** The type of `iff_not_self` from the engine's environment. */
  iffNotSelf: string | null;
  proof: string;
  /** The engine accepts the reference proof with no `sorry`. */
  complete: boolean;
}

let cached: CantorReport | null = null;

export function cantorReport(): CantorReport {
  if (cached) return cached;
  const s = levelSession('fun-15');
  const level = s.ctx.level;
  if (level.kind !== 'proof') throw new Error('fun-15 is not a proof level');
  const proof = level.solutions[0];
  const { result } = checkBody(s, proof);
  const stmt = engine.elab(s.env, '¬ Function.Surjective f', '(α : Type) (f : α → Set α)');
  const iff = engine.constant(s.env, 'iff_not_self');
  cached = { header: level.header, pretty: stmt.ok ? stmt.pretty ?? null : null, iffNotSelf: iff?.type ?? null, proof, complete: result.complete };
  return cached;
}
