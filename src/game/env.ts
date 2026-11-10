/**
 * Glue between content and engine: builds (and caches) the environment a level is played in,
 * and assembles the full source that is checked. Used by the UI and by scripts/verify-mini.ts.
 * Runs under Node and in the browser.
 */
import { engine } from '../engine/index.ts';
import type { CheckOptions, CheckResult, Env } from '../engine/types.ts';
import { allLemmas, levelContext } from '../content/index.ts';
import type { LevelContext } from '../content/index.ts';
import type { Lemma, Level } from '../content/types.ts';

const envCache = new Map<string, Env>();

/** Base library extended with the given bank lemmas (in the given order). Cached by prefix. */
export function envWithLemmas(lemmas: Lemma[]): Env {
  let env = engine.baseEnv();
  let key = '';
  for (const lemma of lemmas) {
    key += '|' + lemma.name;
    let next = envCache.get(key);
    if (!next) {
      next = engine.extend(env, lemma.source).env;
      envCache.set(key, next);
    }
    env = next;
  }
  return env;
}

/** Everything unlocked (Sandbox, Workshop). */
export const fullEnv = (): Env => envWithLemmas(allLemmas);

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
  ctx: LevelContext;
  env: Env;
  options: CheckOptions;
}

/**
 * Environment + check options for playing a level.
 * `strictInventory = false` lifts the tactic lock (a learner setting).
 * Term-mode proof levels always lock every tactic (so `by` cannot be used).
 */
export function levelSession(levelId: string, strictInventory = true): LevelSession {
  const ctx = levelContext(levelId);
  const env = envWithLemmas(ctx.lemmas);
  const level: Level = ctx.level;
  const options: CheckOptions = {};
  if (level.kind === 'proof' && level.mode === 'term') options.allowedTactics = [];
  else if (strictInventory) options.allowedTactics = ctx.allowedTactics;
  if (level.kind === 'proof' && level.forbidden?.length) options.forbiddenNames = level.forbidden;
  return { ctx, env, options };
}

/** Check a body against a proof/Parsons level. Diagnostics/steps are in `assembled.source` offsets. */
export function checkBody(
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
  return { result: engine.check(session.env, assembled.source, session.options), assembled };
}
