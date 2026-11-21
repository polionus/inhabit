/**
 * The Lean side of the Venn exhibit: the statement for a pair of expressions, checked by the
 * engine in the sets environment, and (when the arena prover can find one) a checked proof.
 */
import { engine } from '../../../domains/lean/engine/index.ts';
import type { Env } from '../../../domains/lean/engine/types.ts';
import { levelSession } from '../env.ts';
import { Prover, prune } from '../arena/gen/search.ts';
import { script } from '../arena/gen/emit.ts';
import { setNaming, setStyle, mem } from '../arena/gen/set.ts';
import type { SE as ArenaSE } from '../arena/gen/set.ts';
import { iff, imp } from '../arena/gen/logic.ts';
import { showSet } from './venn.ts';
import type { Relation, SE } from './venn.ts';

const BINDERS = '(α : Type) (A B C : Set α)';
let env: Env | null = null;
/** A late sets level's environment (distributivity boss): everything the sets world offers. */
const setsEnv = (): Env => (env ??= levelSession('sets-13').env);

export const statementOf = (l: SE, r: SE, rel: Relation): string => `${showSet(l)} ${rel === 'eq' ? '=' : '⊆'} ${showSet(r)}`;

export interface LeanInfo {
  statement: string;
  /** Did the engine elaborate the statement? */
  elaborates: boolean;
  pretty?: string;
  /** An engine-checked proof (tactic lines), when the prover found one and the engine accepted it. */
  proof?: string;
  /** Why there is no proof (for the UI), when the statement is true but the prover found none. */
  noProof?: boolean;
}

// our SE and the arena's are structurally identical
const arena = (e: SE): ArenaSE => e as ArenaSE;

export function leanInfo(l: SE, r: SE, rel: Relation, holds: boolean): LeanInfo {
  const statement = statementOf(l, r, rel);
  const e = setsEnv();
  const el = engine.elab(e, statement, BINDERS);
  const info: LeanInfo = { statement, elaborates: el.ok, pretty: el.pretty };
  if (!el.ok || !holds) return info;
  const L0 = mem(arena(l));
  const R0 = mem(arena(r));
  const prover = new Prover({ naming: setNaming, maxCost: 45, nodeLimit: 300000 });
  const lang = { style: setStyle, cases: 'cases' } as const;
  let lines: string[] | null = null;
  try {
    if (rel === 'eq') {
      const res = prover.prove([], ['x'], iff(L0, R0), ['α', 'x', 'A', 'B', 'C']);
      if (res) lines = ['ext x', ...script(prune(res.pf), lang)];
    } else {
      const res = prover.prove([{ name: 'hx', f: L0 }], ['x'], R0, ['α', 'x', 'A', 'B', 'C', 'hx']);
      if (res) lines = ['intro x hx', ...script(prune(res.pf), lang)];
    }
  } catch {
    lines = null;
  }
  if (!lines) return { ...info, noProof: true };
  const body = lines.map((s) => '  ' + s).join('\n');
  const source = `theorem demo ${BINDERS} : ${statement} := by\n${body}`;
  const res = engine.check(e, source);
  if (res.complete) return { ...info, proof: source };
  return { ...info, noProof: true };
}
