/**
 * Differential test: run the corpus (src/engine/test/corpus.ts) through REAL Lean and through the
 * mini-engine, and report every snippet where they disagree on accept/reject — or where either
 * disagrees with the verdict recorded in the corpus.
 *
 *   node scripts/diff-corpus.ts            # both engines
 *   node scripts/diff-corpus.ts --mini     # mini-engine only (no Lean needed)
 *
 * "accept" = no errors and no `sorry` warning. The derived Nat lemmas in
 * src/engine/test/lemmas.ts are also compiled in real Lean (under `namespace Bank`) to make sure
 * the proofs the tests rely on are genuine.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engine } from '../src/engine/index.ts';
import { corpus } from '../src/engine/test/corpus.ts';
import { NAT_LEMMAS } from '../src/engine/test/lemmas.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const leanDir = join(root, 'lean-verify');
const miniOnly = process.argv.includes('--mini');

type Verdict = 'accept' | 'reject';

function miniVerdicts(): Verdict[] {
  const ext = engine.extend(engine.baseEnv(), NAT_LEMMAS);
  if (!ext.result.ok) {
    console.log('✖ mini-engine: test lemmas failed to load');
    for (const d of ext.result.diagnostics) console.log('   ', d.message);
    process.exit(1);
  }
  return corpus.map((c) => {
    const r = engine.check(ext.env, c.src);
    return r.ok && !r.diagnostics.some((d) => d.code === 'sorry') ? 'accept' : 'reject';
  });
}

function leanVerdicts(): { verdicts: Verdict[]; lemmaErrors: string[]; raw: string[][] } {
  const lines: string[] = ['import Game.Core', 'set_option linter.unusedVariables false', ''];
  const lemmaStart = lines.length + 1;
  lines.push('namespace Bank', ...NAT_LEMMAS.split('\n'), 'end Bank', '');
  const lemmaEnd = lines.length;
  const ranges: { from: number; to: number }[] = [];
  corpus.forEach((c, i) => {
    const from = lines.length + 1;
    lines.push(`namespace D${i}`, ...c.src.split('\n'), `end D${i}`, '');
    ranges.push({ from, to: lines.length });
  });
  const dir = mkdtempSync(join(tmpdir(), 'inhabit-diff-'));
  const file = join(dir, 'Corpus.lean');
  writeFileSync(file, lines.join('\n'));
  const run = spawnSync('lake', ['env', 'lean', file], { cwd: leanDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (run.stdout + run.stderr).split('\n');
  const bad = new Set<number>();
  const raw: string[][] = corpus.map(() => []);
  const lemmaErrors: string[] = [];
  for (const l of out) {
    const m = l.match(/:(\d+):(\d+): (error|warning)/);
    if (!m) continue;
    const line = Number(m[1]);
    const isErr = m[3] === 'error' || /declaration uses 'sorry'/.test(l);
    if (line >= lemmaStart && line <= lemmaEnd) {
      if (isErr) lemmaErrors.push(l);
      continue;
    }
    const idx = ranges.findIndex((r) => line >= r.from && line <= r.to);
    if (idx >= 0) {
      raw[idx].push(l);
      if (isErr) bad.add(idx);
    }
  }
  return { verdicts: corpus.map((_, i) => (bad.has(i) ? 'reject' : 'accept')), lemmaErrors, raw };
}

const mini = miniVerdicts();
let failures = 0;
if (miniOnly) {
  corpus.forEach((c, i) => {
    if (mini[i] !== c.expect) {
      failures++;
      console.log(`✖ ${c.name}: corpus says ${c.expect}, mini-engine says ${mini[i]}`);
    }
  });
} else {
  const lean = leanVerdicts();
  if (lean.lemmaErrors.length) {
    failures++;
    console.log('✖ test lemmas (src/engine/test/lemmas.ts) do not compile in real Lean:');
    for (const l of lean.lemmaErrors) console.log('   ', l);
  }
  corpus.forEach((c, i) => {
    const ok = mini[i] === lean.verdicts[i] && lean.verdicts[i] === c.expect;
    if (!ok) {
      failures++;
      console.log(`✖ ${c.name}: corpus=${c.expect} lean=${lean.verdicts[i]} mini=${mini[i]}`);
      for (const l of lean.raw[i]) console.log('    lean:', l.replace(/^.*?:(\d+):(\d+):/, '$1:$2:'));
    }
  });
}
const agree = corpus.length - failures;
console.log(`${failures === 0 ? '✔' : '✖'} ${agree}/${corpus.length} corpus entries agree${miniOnly ? ' (mini-engine vs recorded verdicts)' : ' (real Lean, mini-engine, recorded verdict)'}`);
process.exit(failures ? 1 : 0);
