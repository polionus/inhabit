// PLACEHOLDER — replaced by the engine implementation. Keeps the rest of the repo compiling.
import type { CheckResult, Engine, Env } from './types.ts';

export type * from './types.ts';

const empty: CheckResult = { diagnostics: [], steps: [], decls: [], ok: true, complete: false };
const env = { __brand: 'Env' } as Env;

export const engine: Engine = {
  baseEnv: () => env,
  extend: (e) => ({ env: e, result: empty }),
  check: () => empty,
  goalsAt: () => null,
  elab: () => ({ ok: false, diagnostics: [] }),
  defEq: () => false,
  constant: () => null,
  tactics: () => [],
};
