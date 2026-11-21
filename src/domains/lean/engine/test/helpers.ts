/** Shared helpers for engine tests. */
import { engine } from '../index.ts';
import type { CheckOptions, CheckResult, Env } from '../types.ts';
import { NAT_LEMMAS } from './lemmas.ts';

let natEnv: Env | null = null;

/** Base library plus the derived Nat lemmas (as the content's lemma bank would add them). */
export function envWithNat(): Env {
  if (!natEnv) {
    const r = engine.extend(engine.baseEnv(), NAT_LEMMAS);
    if (!r.result.ok) throw new Error('test lemmas failed: ' + r.result.diagnostics.map((d) => d.message).join('\n'));
    natEnv = r.env;
  }
  return natEnv;
}

export function check(src: string, opts?: CheckOptions): CheckResult {
  return engine.check(envWithNat(), src, opts);
}

export function errors(r: CheckResult): string[] {
  return r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message);
}

/** Goals (as text) after the tactic that starts with `marker` in `src`. */
export function goalsAfter(src: string, marker: string): string[] {
  const r = check(src);
  const at = src.indexOf(marker);
  const step = r.steps.find((s) => s.from === at);
  if (!step) throw new Error(`no step at ${marker}`);
  return step.after.map(goalText);
}

export function goalText(g: { caseName?: string; hyps: { names: string[]; type: string }[]; target: string }): string {
  const lines: string[] = [];
  if (g.caseName) lines.push(`case ${g.caseName}`);
  for (const h of g.hyps) lines.push(`${h.names.join(' ')} : ${h.type}`);
  lines.push(`⊢ ${g.target}`);
  return lines.join('\n');
}
