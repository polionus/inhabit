/** Engine side of the Function arrows exhibit: checks the generated Lean claims about the drawn function. */
import { engine } from '../../../domains/lean/engine/index.ts';
import { levelSession } from '../env.ts';
import { leanClaims, leanDecls } from './function-arrows.ts';
import type { Fn } from './function-arrows.ts';

export interface Checked {
  label: string;
  source: string;
  /** The engine accepted the proof. */
  ok: boolean;
}
export interface LeanReport {
  decls: string;
  injective: Checked;
  surjective: Checked;
  /** False if the declarations themselves did not elaborate. */
  declsOk: boolean;
}

const cache = new Map<string, LeanReport>();

export function checkFn(f: Fn): LeanReport {
  const key = f.nA + ':' + f.nB + ':' + f.map.join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  // a late `fun` level's environment: Function.Injective, Surjective and the tactics are all there
  const env0 = levelSession('fun-09').env;
  const decls = leanDecls(f);
  const ext = engine.extend(env0, decls);
  const claims = leanClaims(f);
  const run = (c: { label: string; source: string }): Checked => ({ ...c, ok: ext.result.ok && engine.check(ext.env, c.source).complete });
  const rep: LeanReport = { decls, declsOk: ext.result.ok, injective: run(claims.injective), surjective: run(claims.surjective) };
  if (cache.size > 200) cache.clear();
  cache.set(key, rep);
  return rep;
}

/** Does the engine agree that the displayed unfolded definitions are the definitions? */
let defs: { injective: boolean; surjective: boolean } | null = null;
export function definitionsAgree(): { injective: boolean; surjective: boolean } {
  if (defs) return defs;
  const env = levelSession('fun-09').env;
  const b = '(α β : Type) (f : α → β)';
  defs = {
    injective: engine.defEq(env, 'Function.Injective f', '∀ a b, f a = f b → a = b', b),
    surjective: engine.defEq(env, 'Function.Surjective f', '∀ b, ∃ a, f a = b', b),
  };
  return defs;
}
