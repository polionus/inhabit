/**
 * Inhabit's mini-Lean engine: public entry point implementing `Engine` from `types.ts`.
 *
 * Pipeline: lexer → parser → elaborator (with unifier and tactic framework) → kernel check.
 * Everything here is pure TypeScript and runs in the browser and under Node.
 */
import type {
  CheckOptions,
  CheckResult,
  ConstantInfo,
  DeclInfo,
  Diagnostic,
  Engine,
  Env,
  Goal,
} from './types.ts';
import { Environment } from './kernel/env.ts';
import { Fuel, TimeoutError } from './kernel/reduce.ts';
import { KernelError } from './kernel/typecheck.ts';
import { mkSort } from './kernel/expr.ts';
import { lzero } from './kernel/level.ts';
import { parse, parseBindersOnly, parseTermOnly, PARSER_TACTICS } from './syntax/parser.ts';
import { CommandElab, DEFAULT_FUEL, printConstant } from './elab/command.ts';
import type { TacticBlockInfo } from './elab/term.ts';
import { Elab, setMatchElaborator, setTacticRunner } from './elab/term.ts';
import { ElabError } from './elab/errors.ts';
import { elabMatch } from './elab/match.ts';
import { Printer } from './pp/print.ts';
import { implementedTactics, runTacticBlock } from './tactic/core.ts';
import './tactic/basic.ts';
import './tactic/cases.ts';
import './tactic/rewrite.ts';
import { PRELUDE } from './prelude/prelude.ts';

export type * from './types.ts';

setTacticRunner(runTacticBlock);
setMatchElaborator(elabMatch);

/** Extra data attached to results (for `goalsAt`). */
const blockInfo = new WeakMap<CheckResult, TacticBlockInfo[]>();

let cachedBase: Environment | null = null;

function asEnv(e: Env): Environment {
  if (!(e instanceof Environment)) throw new Error('engine: not an environment created by this engine');
  return e;
}

/** Fix-ups that the surface syntax of the prelude cannot express. */
function patchPrelude(env: Environment): Environment {
  // `Eq.refl (a : α) : a = a` takes `a` explicitly although it is a parameter.
  const refl = env.get('Eq.refl');
  if (refl && refl.type.k === 'pi' && refl.type.body.k === 'pi') {
    const t = refl.type;
    const body = t.body as typeof t;
    const newType = { ...t, body: { ...body, bi: 'default' as const } };
    env = env.add({ ...refl, type: newType });
  }
  return env;
}

export function loadPrelude(): Environment {
  const { commands, diagnostics } = parse(PRELUDE);
  const ce = new CommandElab(Environment.empty(), PRELUDE, { trusted: true }, 2_000_000);
  // Eq.refl must be patched before anything uses it explicitly: run commands one by one
  const errors: Diagnostic[] = diagnostics.map((d) => ({ severity: 'error', code: d.code, message: d.message, from: d.from, to: d.to }));
  for (const cmd of commands) {
    ce.run([cmd]);
    if (cmd.k === 'inductive' && cmd.name === 'Eq') ce.env = patchPrelude(ce.env);
  }
  errors.push(...ce.diagnostics.filter((d) => d.severity === 'error'));
  if (errors.length > 0) {
    const lines = errors.map((e) => {
      const line = PRELUDE.slice(0, e.from).split('\n').length;
      return `line ${line} (${PRELUDE.split('\n')[line - 1].trim()}): ${e.message}`;
    });
    throw new Error(`engine prelude failed to load:\n${lines.join('\n')}`);
  }
  return ce.env;
}

function baseEnv(): Env {
  if (!cachedBase) cachedBase = loadPrelude();
  return cachedBase;
}

function emptyResult(diags: Diagnostic[]): CheckResult {
  return { diagnostics: diags, steps: [], decls: [], ok: !diags.some((d) => d.severity === 'error'), complete: false };
}

function internalError(e: unknown, source: string): Diagnostic {
  if (e instanceof TimeoutError) return { severity: 'error', code: 'timeout', message: e.message, from: 0, to: source.length };
  if (e instanceof ElabError) return e.toDiagnostic();
  if (e instanceof KernelError) return { severity: 'error', code: 'other', message: `(kernel) ${e.message}`, from: 0, to: source.length };
  const msg = e instanceof Error ? e.message : String(e);
  return { severity: 'error', code: 'other', message: `internal error: ${msg}`, from: 0, to: source.length };
}

function process(env: Environment, source: string, opts: CheckOptions, trusted: boolean): { env: Environment; result: CheckResult } {
  const { commands, diagnostics: parseDiags } = parse(source);
  const elabOpts = trusted
    ? { trusted: true }
    : {
        allowedTactics: opts.allowedTactics ? new Set(opts.allowedTactics) : undefined,
        forbidden: opts.forbiddenNames ? new Set(opts.forbiddenNames) : undefined,
      };
  const ce = new CommandElab(env, source, elabOpts, opts.maxSteps ?? DEFAULT_FUEL);
  ce.run(commands);
  const diagnostics: Diagnostic[] = [];
  for (const d of parseDiags) {
    const diag: Diagnostic = { severity: 'error', code: d.code, message: d.message, from: d.from, to: d.to };
    if (d.code === 'unknown-tactic' && d.tactic) {
      diag.data = { tactic: d.tactic, suggestions: suggestTactics(d.tactic) };
      diag.message = 'unknown tactic';
    }
    diagnostics.push(diag);
  }
  diagnostics.push(...ce.diagnostics);
  diagnostics.sort((a, b) => a.from - b.from || (a.severity === 'error' ? -1 : 1));
  const ok = !diagnostics.some((d) => d.severity === 'error');
  const decls: DeclInfo[] = ce.decls;
  const complete =
    ok &&
    decls.length > 0 &&
    decls.every((d) => d.ok && !d.usesSorry) &&
    !diagnostics.some((d) => d.code === 'sorry' || d.code === 'unsolved-goals');
  const result: CheckResult = { diagnostics, steps: ce.steps, decls, ok, complete };
  blockInfo.set(result, ce.tacticBlocks);
  return { env: ce.env, result };
}

function suggestTactics(name: string): string[] {
  const all = new Set([...implementedTactics(), ...PARSER_TACTICS]);
  const scored: { t: string; d: number }[] = [];
  for (const t of all) {
    const d = levenshtein(name, t);
    if (d <= Math.max(1, Math.floor(name.length / 3))) scored.push({ t, d });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, 3).map((x) => x.t);
}

function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function check(env: Env, source: string, opts: CheckOptions = {}): CheckResult {
  try {
    return process(asEnv(env), source, opts, false).result;
  } catch (e) {
    return emptyResult([internalError(e, source)]);
  }
}

function extend(env: Env, source: string): { env: Env; result: CheckResult } {
  try {
    return process(asEnv(env), source, {}, true);
  } catch (e) {
    return { env, result: emptyResult([internalError(e, source)]) };
  }
}

/**
 * Infoview convention: inside a tactic block, show the state before the tactic under the
 * cursor; between tactics (or after the last one), the state after the last completed tactic.
 */
function goalsAt(result: CheckResult, offset: number): Goal[] | null {
  const blocks = blockInfo.get(result) ?? [];
  // innermost block containing the offset
  let block: TacticBlockInfo | null = null;
  for (const b of blocks) {
    if (b.from <= offset && offset <= b.to && (!block || b.to - b.from < block.to - block.from)) block = b;
  }
  if (!block) {
    // after the end of a block on trailing whitespace: attach to the closest preceding block
    let best: TacticBlockInfo | null = null;
    for (const b of blocks) if (b.to <= offset && (!best || b.to > best.to)) best = b;
    if (!best) return null;
    const between = result.steps.some((s) => s.from >= best!.to && s.from < offset);
    const otherBlock = blocks.some((b) => b.from > best!.to && b.from <= offset);
    if (between || otherBlock) return null;
    // only if nothing but whitespace/comments follows on the way
    block = best;
  }
  const inBlock = result.steps.filter((s) => s.from >= block!.from && s.to <= Math.max(block!.to, s.to) && s.from <= block!.to + 1);
  // innermost step strictly containing the offset
  let containing: (typeof inBlock)[number] | null = null;
  for (const s of inBlock) {
    if (s.from <= offset && offset < s.to && (!containing || s.to - s.from <= containing.to - containing.from)) containing = s;
  }
  // last completed step before the offset, within the containing step (if any)
  let last: (typeof inBlock)[number] | null = null;
  for (const s of inBlock) {
    if (s.to <= offset && (!containing || (s.from >= containing.from && s.to <= containing.to))) {
      if (!last || s.to > last.to || (s.to === last.to && s.to - s.from < last.to - last.from)) last = s;
    }
  }
  if (containing && (!last || last.to <= containing.from)) return containing.before;
  if (last) return last.after;
  if (containing) return containing.before;
  return block.initial;
}

function elab(env: Env, term: string, binders?: string): { ok: boolean; pretty?: string; type?: string; diagnostics: Diagnostic[] } {
  try {
    const e = asEnv(env);
    const diags: Diagnostic[] = [];
    const bs = binders ? parseBindersOnly(binders) : { binders: [], diagnostics: [] };
    const t = parseTermOnly(term);
    for (const d of [...bs.diagnostics, ...t.diagnostics]) diags.push({ severity: 'error', code: d.code, message: d.message, from: d.from, to: d.to });
    if (diags.length || !t.term) return { ok: false, diagnostics: diags };
    const el = new Elab(e, { namespace: '', opens: ['Function'], universes: [], variables: [] }, term, { trusted: false });
    el.m.fuel.n = DEFAULT_FUEL;
    return el.elabBinders(bs.binders, () => {
      try {
        const v = el.elabTerm(t.term!, null);
        el.synthesize();
        const vi = el.instantiate(v);
        const ty = el.instantiate(el.inferType(vi));
        if (el.hadError || vi.mv) return { ok: false, diagnostics: [...el.diags, ...(vi.mv ? [mvarDiag(term)] : [])] };
        return { ok: true, pretty: el.pp(vi), type: el.pp(ty), diagnostics: el.diags };
      } catch (err) {
        if (err instanceof ElabError) return { ok: false, diagnostics: [err.toDiagnostic()] };
        return { ok: false, diagnostics: [internalError(err, term)] };
      }
    });
  } catch (err) {
    return { ok: false, diagnostics: [internalError(err, term)] };
  }
}

function mvarDiag(term: string): Diagnostic {
  return { severity: 'error', code: 'unification', message: "don't know how to synthesize placeholder", from: 0, to: term.length };
}

function defEq(env: Env, a: string, b: string, binders?: string): boolean {
  try {
    const e = asEnv(env);
    const bs = binders ? parseBindersOnly(binders) : { binders: [], diagnostics: [] };
    const ta = parseTermOnly(a);
    const tb = parseTermOnly(b);
    if (bs.diagnostics.length || !ta.term || !tb.term) return false;
    const el = new Elab(e, { namespace: '', opens: ['Function'], universes: [], variables: [] }, a, { trusted: false });
    el.m.fuel.n = DEFAULT_FUEL;
    return el.elabBinders(bs.binders, () => {
      try {
        const va = el.instantiate(el.elabTerm(ta.term!, null));
        el.synthesize();
        const elb = el;
        const vb = elb.instantiate(elb.elabTerm(tb.term!, null));
        el.synthesize();
        if (el.hadError) return false;
        const ia = el.instantiate(va);
        const ib = el.instantiate(vb);
        if (ia.mv || ib.mv) return false;
        return el.isDefEq(ia, ib);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function constant(env: Env, name: string): ConstantInfo | null {
  try {
    const e = asEnv(env);
    const d = e.get(name);
    if (!d || name.startsWith('__')) return null;
    const el = new Elab(e, { namespace: '', opens: [], universes: [], variables: [] }, '', { trusted: true });
    const kind: ConstantInfo['kind'] =
      d.kind === 'ctor'
        ? 'constructor'
        : d.kind === 'rec'
          ? 'recursor'
          : d.userKind === 'structure'
            ? 'structure'
            : d.kind === 'inductive'
              ? 'inductive'
              : d.kind === 'theorem'
                ? 'theorem'
                : d.kind === 'axiom'
                  ? 'axiom'
                  : 'def';
    const info: ConstantInfo = { name, kind, type: new Printer(el.m).pp(d.type) };
    if (d.doc) info.doc = d.doc;
    void printConstant;
    void mkSort(lzero);
    void Fuel;
    return info;
  } catch {
    return null;
  }
}

function tactics(): string[] {
  return implementedTactics();
}

export const engine: Engine = {
  baseEnv,
  extend,
  check,
  goalsAt,
  elab,
  defEq,
  constant,
  tactics,
};
