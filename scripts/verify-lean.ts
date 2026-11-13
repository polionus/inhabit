/**
 * Ground-truth check: compile every reference solution in REAL Lean 4.
 *
 *   node scripts/verify-lean.ts            # all worlds
 *   node scripts/verify-lean.ts logic nat  # only these worlds
 *   node scripts/verify-lean.ts --guide    # only the Guide articles
 *
 * For each world it writes one self-contained file lean-verify/Game/Generated/<id>.lean
 * (importing only Game.Core) and runs `lake env lean` on it. Safe to run in parallel
 * for different worlds.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { worlds, prerequisiteWorlds } from '../src/content/index.ts';
import type { World } from '../src/content/types.ts';
import { ideas } from '../src/content/ideas.ts';
import { worldLessons } from '../src/content/lessons/index.ts';
import { guide } from '../src/content/guide.ts';
import { guideBlocks, lessonBlocks, nsOf, worldProseBlocks } from './prose-blocks.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const leanDir = join(root, 'lean-verify');
const genDir = join(leanDir, 'Game', 'Generated');

const ident = (s: string) => s.replace(/[^A-Za-z0-9]/g, '_');

function generate(world: World): { text: string; labels: { line: number; label: string }[] } {
  const lines: string[] = [];
  const labels: { line: number; label: string }[] = [];
  const emit = (label: string, code: string) => {
    labels.push({ line: lines.length + 1, label });
    lines.push(...code.split('\n'));
    lines.push('');
  };
  const block = (label: string, ns: string, code: string) =>
    emit(label, `namespace ${ns}\n${code}\nend ${ns}`);

  emit('preamble', 'import Game.Core\nset_option linter.unusedVariables false\nopen Function');

  const bank = [...prerequisiteWorlds(world.id), world].flatMap((w) => w.lemmas);
  for (const l of bank.filter((l) => l.origin === 'game')) emit(`lemma ${l.name}`, l.source);
  for (const l of bank.filter((l) => l.origin === 'core')) {
    // Re-prove under Bank.* (checks the proof) and check the statement matches core's.
    block(`lemma ${l.name}`, 'Bank', l.source);
    emit(
      `lemma ${l.name} (statement must match Lean core)`,
      `example : type_of% @Bank.${l.name} := @_root_.${l.name}`,
    );
  }

  for (const c of world.codex) {
    if (c.example) block(`codex ${c.id} example`, `C_${ident(c.id)}`, c.example);
  }

  for (const level of world.levels) {
    const ns = `L_${ident(level.id)}`;
    const setup = level.setup ? level.setup + '\n' : '';
    switch (level.kind) {
      case 'proof':
        level.solutions.forEach((sol, i) =>
          block(
            `${level.id} solution ${i + 1}`,
            `${ns}_s${i}`,
            `${setup}${level.header}\n${sol}\n${level.after ?? ''}`,
          ),
        );
        break;
      case 'parsons':
        block(`${level.id} parsons`, ns, `${setup}${level.header}\n${level.lines.join('\n')}`);
        break;
      case 'choice':
        if (level.code) block(`${level.id} code`, ns, `${setup}${level.code}`);
        break;
      case 'predict':
        block(`${level.id} code`, ns, `${setup}${level.code}`);
        break;
      case 'formalize': {
        const all = [...level.accept, ...(level.mistakes ?? []).map((m) => m.statement)];
        const body = all
          .map((s) => `example ${level.binders ?? ''} : Prop := ${s}`)
          .join('\n');
        block(`${level.id} statements`, ns, `${setup}${body}`);
        break;
      }
    }
  }
  const lessons = worldLessons(world.id);
  for (const b of worldProseBlocks(lessons)) if (b.lang === 'lean') block(b.label, nsOf(b.label), b.code);
  for (const level of world.levels) {
    const setup = level.setup ? level.setup + '\n' : '';
    for (const b of lessonBlocks(lessons, level.id)) if (b.lang === 'lean') block(b.label, nsOf(b.label), setup + b.code);
  }
  if (world.id === 'forge') {
    for (const idea of ideas) {
      block(
        `idea ${idea.id}`,
        `I_${ident(idea.id)}`,
        `${idea.definitions ?? ''}\n${idea.statement}\n${idea.proof}`,
      );
    }
  }
  return { text: lines.join('\n'), labels };
}

/** Guide ```lean blocks: against the whole game library. */
function generateGuide(): { text: string; labels: { line: number; label: string }[] } {
  const lines: string[] = [];
  const labels: { line: number; label: string }[] = [];
  const emit = (label: string, code: string) => {
    labels.push({ line: lines.length + 1, label });
    lines.push(...code.split('\n'), '');
  };
  emit('preamble', 'import Game.Core\nset_option linter.unusedVariables false\nopen Function');
  for (const l of worlds.flatMap((w) => w.lemmas).filter((l) => l.origin === 'game')) emit(`lemma ${l.name}`, l.source);
  for (const b of guideBlocks(guide)) if (b.lang === 'lean') emit(b.label, `namespace ${nsOf(b.label)}\n${b.code}\nend ${nsOf(b.label)}`);
  return { text: lines.join('\n'), labels };
}

/** Guide ```lean-real blocks: plain Lean 4 core, no imports at all. */
function generateGuideReal(): { text: string; labels: { line: number; label: string }[] } {
  const lines: string[] = [];
  const labels: { line: number; label: string }[] = [];
  for (const b of guideBlocks(guide)) {
    if (b.lang !== 'lean-real') continue;
    labels.push({ line: lines.length + 1, label: b.label });
    lines.push(...`namespace ${nsOf(b.label)}\n${b.code}\nend ${nsOf(b.label)}`.split('\n'), '');
  }
  return { text: lines.join('\n'), labels };
}

const argv = process.argv.slice(2);
const wanted = argv.filter((a) => !a.startsWith('-'));
const guideOnlyRun = argv.includes('--guide') && !wanted.length;
const targets = guideOnlyRun ? [] : wanted.length ? worlds.filter((w) => wanted.includes(w.id)) : worlds;
mkdirSync(genDir, { recursive: true });

const build = spawnSync('lake', ['build', 'Game'], { cwd: leanDir, encoding: 'utf8' });
if (build.status !== 0) {
  console.error(build.stdout + build.stderr);
  process.exit(1);
}

let failed = 0;
const jobs: { name: string; ok: string; gen: () => { text: string; labels: { line: number; label: string }[] } }[] = targets.map((world) => ({
  name: world.id,
  ok: `${world.levels.length} levels, ${world.lemmas.length} lemmas OK in real Lean`,
  gen: () => generate(world),
}));
if (!wanted.length || argv.includes('--guide')) {
  jobs.push({ name: 'guide', ok: 'checked blocks OK in real Lean (with the game library)', gen: generateGuide });
  jobs.push({ name: 'guide_real', ok: 'lean-real blocks OK in plain Lean 4', gen: generateGuideReal });
}
for (const job of jobs) {
  const { text, labels } = job.gen();
  const file = join(genDir, `${job.name}.lean`);
  writeFileSync(file, text);
  const run = spawnSync('lake', ['env', 'lean', file], { cwd: leanDir, encoding: 'utf8' });
  const out = (run.stdout + run.stderr).trim();
  const errors = out.split('\n').filter((l) => /: error/.test(l));
  const warnsSorry = out.split('\n').filter((l) => /declaration uses 'sorry'/.test(l));
  const labelFor = (line: number) => {
    let best = 'preamble';
    for (const l of labels) if (l.line <= line) best = l.label;
    return best;
  };
  const report = (l: string) => {
    const m = l.match(/:(\d+):(\d+): /);
    return m ? `  [${labelFor(Number(m[1]))}] ${l}` : `  ${l}`;
  };
  if (run.status !== 0 || errors.length || warnsSorry.length) {
    failed++;
    console.log(`✖ ${job.name}: ${errors.length} error(s), ${warnsSorry.length} sorry warning(s)`);
    // Print full output with labels so multi-line messages stay readable.
    for (const l of out.split('\n')) console.log(/:(\d+):(\d+): (error|warning)/.test(l) ? report(l) : `      ${l}`);
  } else {
    console.log(`✔ ${job.name}: ${job.ok}`);
  }
}
process.exit(failed ? 1 : 0);
