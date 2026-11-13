/**
 * Check every piece of game content with the in-browser mini-Lean engine.
 *
 *   node scripts/verify-mini.ts            # all worlds (+ static checks, bank, ideas)
 *   node scripts/verify-mini.ts logic nat  # only these worlds
 *   node scripts/verify-mini.ts -v …       # also print passing details
 *   node scripts/verify-mini.ts --guide    # only the Guide articles (add world ids for more)
 *
 * For each level:
 *   proof      every solution is `complete` under the level's options; the starter is not
 *   parsons    the lines in order are `complete`
 *   choice     `setup + code` (if any) checks without errors
 *   predict    `setup + code` checks without errors and a tactic step starts on `line`
 *   formalize  every accepted answer and mistake elaborates as a `Prop` under `binders`, and no
 *              mistake is definitionally equal to an accepted answer
 * Plus: codex examples, lemma bank (loaded in order with `engine.extend`), theorem ideas,
 * unique level ids, unlock references and tactic names.
 * Exits non-zero on any failure.
 */
import { engine } from '../src/engine/index.ts';
import type { CheckResult, Diagnostic, Env } from '../src/engine/types.ts';
import { allLemmas, levelContext, worlds } from '../src/content/index.ts';
import type { Level, World } from '../src/content/types.ts';
import { ideas } from '../src/content/ideas.ts';
import { assemble, checkBody, envWithLemmas, fullEnv, levelSession } from '../src/game/env.ts';
import { worldLessons } from '../src/content/lessons/index.ts';
import { guide } from '../src/content/guide.ts';
import { KNOWN_LANGS, guideBlocks, lessonBlocks, nsOf, words, worldProseBlocks, type ProseBlock } from './prose-blocks.ts';

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const wanted = args.filter((a) => !a.startsWith('-'));
const guideOnlyRun = args.includes('--guide') && !wanted.length;
const targets = guideOnlyRun ? [] : wanted.length ? worlds.filter((w) => wanted.includes(w.id)) : worlds;
for (const w of wanted) if (!worlds.some((x) => x.id === w)) console.log(`(unknown world id: ${w})`);

let failures = 0;
let checks = 0;

const indent = (s: string, n = 6) =>
  s
    .split('\n')
    .map((l) => ' '.repeat(n) + l)
    .join('\n');

function lineCol(src: string, off: number): string {
  const before = src.slice(0, off).split('\n');
  return `${before.length}:${before[before.length - 1].length}`;
}

function showDiags(src: string, diags: Diagnostic[], all = false): string {
  return diags
    .filter((d) => all || d.severity !== 'info')
    .map((d) => indent(`${lineCol(src, d.from)} ${d.severity} [${d.code}] ${d.message}`))
    .join('\n');
}

function showSource(src: string): string {
  return src
    .split('\n')
    .map((l, i) => `${String(i + 1).padStart(4)} | ${l}`)
    .join('\n');
}

interface Outcome {
  ok: boolean;
  details: string[];
}

function fail(o: Outcome, msg: string): void {
  o.ok = false;
  o.details.push(msg);
}

function checkLevel(world: World, level: Level): Outcome {
  const o: Outcome = { ok: true, details: [] };
  const timed = <T>(f: () => T): T => f();
  switch (level.kind) {
    case 'proof': {
      const session = levelSession(level.id);
      level.solutions.forEach((sol, i) => {
        checks++;
        const { result, assembled } = timed(() => checkBody(session, sol));
        if (!result.complete) {
          fail(
            o,
            `solution ${i + 1} is not complete (allowed tactics: ${session.options.allowedTactics?.join(', ') ?? 'all'})\n${indent(showSource(assembled.source))}\n${showDiags(assembled.source, result.diagnostics)}`,
          );
        }
      });
      checks++;
      const { result: st, assembled } = checkBody(session, level.starter);
      if (st.complete) fail(o, `starter is already a complete proof:\n${indent(showSource(assembled.source))}`);
      if (level.mode === 'term' && level.solutions.some((s) => /\bby\b/.test(s))) {
        o.details.push('note: a term-mode solution contains `by`');
      }
      break;
    }
    case 'parsons': {
      checks++;
      const session = levelSession(level.id);
      const { result, assembled } = checkBody(session, level.lines.join('\n'));
      if (!result.complete) fail(o, `the lines in order are not a complete proof\n${indent(showSource(assembled.source))}\n${showDiags(assembled.source, result.diagnostics)}`);
      break;
    }
    case 'choice':
    case 'predict': {
      if (level.kind === 'choice' && !level.code) break;
      checks++;
      const session = levelSession(level.id);
      const code = level.code!;
      const prefix = level.setup ? level.setup + '\n' : '';
      const src = prefix + code;
      const result = engine.check(session.env, src);
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      if (errors.length) fail(o, `code has errors\n${indent(showSource(src))}\n${showDiags(src, result.diagnostics)}`);
      if (level.kind === 'predict') {
        const lines = code.split('\n');
        if (level.line < 1 || level.line > lines.length) fail(o, `predict line ${level.line} is out of range`);
        else {
          const start = prefix.length + lines.slice(0, level.line - 1).reduce((n, l) => n + l.length + 1, 0);
          const end = start + lines[level.line - 1].length;
          const step = result.steps.find((s) => s.from >= start && s.from < end);
          if (!step) fail(o, `no tactic step starts on line ${level.line}: \`${lines[level.line - 1].trim()}\``);
          else if (verbose) o.details.push(`predict step: ${step.tactic}; goals after: ${step.after.map((g) => g.target).join(' | ') || 'none'}`);
        }
      }
      break;
    }
    case 'formalize': {
      const session = levelSession(level.id);
      let env: Env = session.env;
      if (level.setup) {
        const ext = engine.extend(env, level.setup);
        if (!ext.result.ok) fail(o, `setup has errors\n${showDiags(level.setup, ext.result.diagnostics)}`);
        env = ext.env;
      }
      const elabProp = (stmt: string, what: string) => {
        checks++;
        const r = engine.elab(env, stmt, level.binders);
        if (!r.ok) fail(o, `${what} does not elaborate: ${stmt}\n${showDiags(stmt, r.diagnostics)}`);
        else if (r.type !== 'Prop') fail(o, `${what} is not a Prop (has type ${r.type}): ${stmt}`);
      };
      level.accept.forEach((a, i) => elabProp(a, `accept[${i}]`));
      (level.mistakes ?? []).forEach((m, i) => {
        elabProp(m.statement, `mistakes[${i}]`);
        for (const a of level.accept) {
          checks++;
          if (engine.defEq(env, m.statement, a, level.binders)) fail(o, `mistakes[${i}] is definitionally equal to an accepted answer:\n      ${m.statement}\n      ≡ ${a}`);
        }
      });
      break;
    }
  }
  void world;
  return o;
}

function report(label: string, o: Outcome): void {
  if (o.ok) {
    console.log(`  ✔ ${label}`);
    if (verbose) for (const d of o.details) console.log(indent(d, 4));
  } else {
    failures++;
    console.log(`  ✖ ${label}`);
    for (const d of o.details) console.log(indent(d, 4));
  }
}

/* ---------------- static checks ---------------- */

function staticChecks(): void {
  console.log('static checks');
  const o: Outcome = { ok: true, details: [] };
  const ids = new Map<string, number>();
  for (const w of worlds) for (const l of w.levels) ids.set(l.id, (ids.get(l.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) fail(o, `duplicate level id: ${id}`);
  const bank = new Set(allLemmas.map((l) => l.name));
  const tactics = new Set(engine.tactics());
  for (const w of worlds) {
    for (const l of w.levels) {
      for (const n of [...(l.unlocks?.lemmas ?? []), ...(l.grants ?? [])]) if (!bank.has(n)) fail(o, `${l.id}: lemma '${n}' is not in the lemma bank`);
      const ts = [...(l.unlocks?.tactics ?? []), ...(l.kind === 'proof' ? (l.extraTactics ?? []) : [])];
      for (const t of ts) if (!tactics.has(t)) fail(o, `${l.id}: tactic '${t}' is not implemented by the engine`);
    }
  }
  checks++;
  report('unique ids, lemma references, tactic names', o);
}

/* ---------------- lemma bank ---------------- */

function bankChecks(): void {
  console.log('lemma bank');
  let env = engine.baseEnv();
  for (const lemma of allLemmas) {
    checks++;
    const ext = engine.extend(env, lemma.source);
    const o: Outcome = { ok: true, details: [] };
    const errs = ext.result.diagnostics.filter((d) => d.severity === 'error' || d.code === 'sorry');
    if (errs.length) fail(o, `${showSource(lemma.source)}\n${showDiags(lemma.source, ext.result.diagnostics)}`);
    if (!engine.constant(ext.env, lemma.name)) fail(o, `after loading, '${lemma.name}' is not in the environment`);
    if (!o.ok || verbose) report(lemma.name, o);
    env = ext.env;
  }
  console.log(`  ${allLemmas.length} lemmas loaded`);
}

/* ---------------- codex & ideas ---------------- */

function codexChecks(world: World): void {
  const lemmas = allLemmas.filter((l) => {
    const owner = worlds.find((w) => w.lemmas.includes(l));
    const idx = worlds.findIndex((w) => w.id === world.id);
    return owner !== undefined && worlds.indexOf(owner) <= idx;
  });
  const env = envWithLemmas(lemmas);
  for (const c of world.codex) {
    if (!c.example) continue;
    checks++;
    const ns = `C_${c.id.replace(/[^A-Za-z0-9]/g, '_')}`;
    const src = `namespace ${ns}\n${c.example}\nend ${ns}`;
    const r = engine.check(env, src);
    const o: Outcome = { ok: true, details: [] };
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    if (errs.length) fail(o, `${showSource(src)}\n${showDiags(src, r.diagnostics)}`);
    if (!o.ok || verbose) report(`codex ${c.id}`, o);
  }
}

function ideaChecks(): void {
  console.log('theorem ideas');
  const env = fullEnv();
  for (const idea of ideas) {
    checks++;
    const ns = `I_${idea.id.replace(/[^A-Za-z0-9]/g, '_')}`;
    const src = `namespace ${ns}\n${idea.definitions ?? ''}\n${idea.statement}\n${idea.proof}\nend ${ns}`;
    const r: CheckResult = engine.check(env, src);
    const o: Outcome = { ok: true, details: [] };
    if (!r.complete) fail(o, `${showSource(src)}\n${showDiags(src, r.diagnostics)}`);
    report(`idea ${idea.id}`, o);
  }
}

/* ---------------- prose: lessons, primers, guide ---------------- */

/** Check one fenced block. Only ```lean blocks are run here; other known fences are skipped. */
function proseBlock(b: ProseBlock, env: Env, allowedTactics: string[] | undefined, guideOnly: boolean): void {
  const o: Outcome = { ok: true, details: [] };
  checks++;
  if (!KNOWN_LANGS.has(b.lang)) fail(o, `unknown fence \`\`\`${b.lang || '(none)'}: use lean, lean-real, lean-mathlib or text`);
  else if (!guideOnly && (b.lang === 'lean-real' || b.lang === 'lean-mathlib')) fail(o, `\`\`\`${b.lang} is only allowed in Guide articles`);
  else if (b.lang === 'lean') {
    const src = `namespace ${nsOf(b.label)}\n${b.code}\nend ${nsOf(b.label)}`;
    const r = engine.check(env, src, allowedTactics ? { allowedTactics } : undefined);
    const bad = r.diagnostics.filter((d) => d.severity === 'error' || d.code === 'sorry');
    if (bad.length || r.decls.length === 0) {
      fail(o, `${showSource(src)}\n${showDiags(src, bad)}${r.decls.length === 0 ? '\n      (no declaration: use ```text for fragments)' : ''}${allowedTactics ? `\n      allowed tactics: ${allowedTactics.join(', ') || '(none: term mode only)'}` : ''}`);
    }
  }
  if (!o.ok || verbose) report(b.label, o);
}

const limit = (o: Outcome, what: string, text: string | undefined, min: number, max: number) => {
  const n = words(text);
  if (n > max || n < min) fail(o, `${what}: ${n} words (allowed ${min}–${max})`);
};

function proseChecks(world: World): void {
  const lessons = worldLessons(world.id);
  if (!lessons) return;
  const lemmas = allLemmas.filter((l) => {
    const owner = worlds.find((w) => w.lemmas.includes(l));
    return owner !== undefined && worlds.indexOf(owner) <= worlds.findIndex((w) => w.id === world.id);
  });
  const worldEnv = envWithLemmas(lemmas);
  for (const b of worldProseBlocks(lessons)) proseBlock(b, worldEnv, undefined, false);
  const o: Outcome = { ok: true, details: [] };
  checks++;
  if (lessons.primer) limit(o, 'primer', lessons.primer, 400, 700);
  if (lessons.recap) limit(o, 'recap', lessons.recap, 80, 160);
  const ids = new Set(world.levels.map((l) => l.id));
  for (const id of Object.keys(lessons.levels)) if (!ids.has(id)) fail(o, `lesson for unknown level id '${id}'`);
  let have = 0;
  for (const level of world.levels) {
    const l = lessons.levels[level.id];
    if (!l) continue;
    have++;
    limit(o, `${level.id} lesson body`, l.body, 130, 280);
    if (l.pitfall) limit(o, `${level.id} pitfall`, l.pitfall, 1, 60);
    if (l.realLean) limit(o, `${level.id} realLean`, l.realLean, 1, 70);
    const session = levelSession(level.id);
    let env = session.env;
    if (level.setup) env = engine.extend(env, level.setup).env;
    for (const b of lessonBlocks(lessons, level.id)) proseBlock(b, env, session.ctx.allowedTactics, false);
  }
  if (!lessons.primer) o.details.push('note: no primer yet');
  if (have < world.levels.length) o.details.push(`note: ${have} of ${world.levels.length} levels have a lesson`);
  if (!o.ok) report(`prose ${world.id} (word limits, ids)`, o);
  else console.log(`  ${o.details.length ? '·' : '✔'} prose ${world.id}: ${have}/${world.levels.length} lessons${lessons.primer ? ', primer' : ''}${lessons.recap ? ', recap' : ''}`);
}

function guideChecks(): void {
  console.log(`guide (${guide.length} articles)`);
  const env = fullEnv();
  for (const b of guideBlocks(guide)) proseBlock(b, env, undefined, true);
  const o: Outcome = { ok: true, details: [] };
  checks++;
  const ids = new Set<string>();
  for (const a of guide) {
    if (ids.has(a.id)) fail(o, `duplicate article id ${a.id}`);
    ids.add(a.id);
    limit(o, `guide ${a.id}`, a.body, 500, 1000);
  }
  for (const a of guide) {
    for (const n of a.next ?? []) if (!ids.has(n)) fail(o, `guide ${a.id}: next '${n}' is not an article`);
    for (const w of a.worlds ?? []) if (!worlds.some((x) => x.id === w)) fail(o, `guide ${a.id}: unknown world '${w}'`);
  }
  report('guide word limits and references', o);
}

/* ---------------- main ---------------- */

const t0 = Date.now();
if (!wanted.length && !guideOnlyRun) {
  staticChecks();
  bankChecks();
}
for (const world of targets) {
  console.log(`world ${world.id} (${world.levels.length} levels)`);
  for (const level of world.levels) {
    let o: Outcome;
    const ts = Date.now();
    try {
      o = checkLevel(world, level);
    } catch (e) {
      o = { ok: false, details: [`exception: ${e instanceof Error ? e.stack : String(e)}`] };
    }
    const ms = Date.now() - ts;
    report(`${level.id} [${level.kind}]${ms > 500 ? ` (${ms} ms)` : ''}`, o);
  }
  codexChecks(world);
  proseChecks(world);
}
if ((!wanted.length && !guideOnlyRun) || wanted.includes('forge')) ideaChecks();
if (!wanted.length || args.includes('--guide')) guideChecks();
void assemble;
void levelContext;
console.log(`\n${failures === 0 ? '✔' : '✖'} ${checks} checks, ${failures} failure(s) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failures ? 1 : 0);
