/**
 * Glue between Lean content and engine: builds (and caches) the environment a level is played in,
 * and assembles the full source that is checked. Pure factory with no hardcoded game content.
 */
import { engine as defaultEngine } from './engine/index.ts';
import type { CheckOptions, CheckResult, Engine, Env } from './engine/types.ts';
import type { LeanLemma, LeanLevel, LeanLevelContext } from './types.ts';

export interface Assembled {
  /** The full text handed to the engine. */
  source: string;
  /** Offset in `source` where the read-only header starts. */
  headerOffset: number;
  /** Offset in `source` where the learner-editable body starts. */
  bodyOffset: number;
}

/** `setup + header + "\n" + body + "\n" + after`, with the offsets needed to map diagnostics back. */
export function assemble(
  parts: { setup?: string; header: string; after?: string },
  body: string,
): Assembled {
  const prefix = parts.setup ? parts.setup + '\n' : '';
  const head = prefix + parts.header + '\n';
  const source = head + body + (parts.after ? '\n' + parts.after : '');
  return { source, headerOffset: prefix.length, bodyOffset: head.length };
}

export interface LevelSession {
  ctx: LeanLevelContext;
  env: Env;
  options: CheckOptions;
}

const AUTOMATION = new Set([
  'simp', 'simp_all', 'dsimp', 'omega', 'decide', 'ring', 'ring_nf', 'linarith', 'nlinarith',
  'norm_num', 'aesop', 'grind', 'tauto', 'exact?', 'apply?', 'rw?', 'positivity', 'push_neg',
  'field_simp', 'norm_cast', 'gcongr', 'bound', 'itauto', 'cc', 'abel', 'group',
]);

function explainAutomation(result: CheckResult, appName: string): CheckResult {
  const isAutomation = (d: CheckResult['diagnostics'][number]) =>
    (d.code === 'tactic-locked' || d.code === 'unknown-tactic') &&
    !!d.data?.tactic &&
    AUTOMATION.has(d.data.tactic);
  if (!result.diagnostics.some(isAutomation)) return result;
  return {
    ...result,
    diagnostics: result.diagnostics.map((d) =>
      isAutomation(d)
        ? {
            ...d,
            code: 'tactic-locked' as const,
            message:
              `\`${d.data!.tactic}\` is real Lean automation, and ${appName} leaves it out on purpose: ` +
              'here you build each proof by hand so you can see how it works. ' +
              'The Graduate guide shows where automation fits once you move to real Lean.',
          }
        : d,
    ),
  };
}

function forbidAxioms(result: CheckResult, from: number, to: number): CheckResult {
  const axioms = result.decls.filter((d) => d.kind === 'axiom' && d.from >= from && d.from < to);
  if (axioms.length === 0) return result;
  return {
    ...result,
    ok: false,
    complete: false,
    diagnostics: [
      ...result.diagnostics,
      ...axioms.map((d) => ({
        severity: 'error' as const,
        code: 'name-locked' as const,
        message:
          '`axiom` is not available in a level: an axiom assumes its statement without proof. Prove it instead.',
        from: d.from,
        to: d.to,
        data: { name: 'axiom' },
      })),
    ],
  };
}

export interface LeanEnvDeps {
  engine?: Engine;
  allLemmas: readonly LeanLemma[];
  levelContext: (levelId: string) => LeanLevelContext;
  appName?: string;
}

export function createLeanEnv(deps: LeanEnvDeps) {
  const eng = deps.engine ?? defaultEngine;
  const appName = deps.appName ?? 'Inhabit';
  const envCache = new Map<string, Env>();

  /** Base library extended with the given bank lemmas (in the given order). Cached by prefix. */
  function envWithLemmas(lemmas: readonly LeanLemma[]): Env {
    let env = eng.baseEnv();
    let key = '';
    for (const lemma of lemmas) {
      key += '|' + lemma.name;
      let next = envCache.get(key);
      if (!next) {
        next = eng.extend(env, lemma.source).env;
        envCache.set(key, next);
      }
      env = next;
    }
    return env;
  }

  /** Everything unlocked (Sandbox, Workshop). */
  const fullEnv = (): Env => envWithLemmas(deps.allLemmas);

  /**
   * Environment + check options for playing a level.
   * `strictInventory = false` lifts the tactic lock (a learner setting).
   * Term-mode proof levels always lock every tactic (so `by` cannot be used).
   */
  function levelSession(levelId: string, strictInventory = true): LevelSession {
    const ctx = deps.levelContext(levelId);
    const env = envWithLemmas(ctx.lemmas);
    const level: LeanLevel = ctx.level;
    const options: CheckOptions = {};
    if (level.kind === 'proof' && level.mode === 'term') options.allowedTactics = [];
    else if (strictInventory) options.allowedTactics = ctx.allowedTactics;
    if (level.kind === 'proof' && level.forbidden?.length) options.forbiddenNames = level.forbidden;
    return { ctx, env, options };
  }

  /** Check a body against a proof/Parsons level. Diagnostics/steps are in `assembled.source` offsets. */
  function checkBody(
    session: LevelSession,
    body: string,
  ): { result: CheckResult; assembled: Assembled } {
    const level = session.ctx.level;
    if (level.kind !== 'proof' && level.kind !== 'parsons') {
      throw new Error(`checkBody: level ${level.id} has no body`);
    }
    const assembled = assemble(
      { setup: level.setup, header: level.header, after: level.kind === 'proof' ? level.after : undefined },
      body,
    );
    const result = eng.check(session.env, assembled.source, session.options);
    const checked = forbidAxioms(result, assembled.bodyOffset, assembled.bodyOffset + body.length);
    return { result: explainAutomation(checked, appName), assembled };
  }

  return { envWithLemmas, fullEnv, assemble, levelSession, checkBody };
}
