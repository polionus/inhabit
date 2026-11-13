/**
 * Ground-truth check for the Arena generator: compile generated puzzles in REAL Lean 4.
 *
 *   node scripts/verify-arena.ts [n=60]
 *
 * Generates n puzzles per proof family (prop, inhabit, quant, set) spread over each family's rating
 * range, plus n quick items, writes lean-verify/Game/Generated/arena.lean (importing only
 * Game.Core, each puzzle in its own namespace) and runs `lake env lean` on it.
 *
 * Fails on any error or `sorry` warning in a reference solution. For quick items it checks what
 * real Lean can check: the correct answer's snippet compiles (goal-state items end in
 * `all_goals sorry`, so `sorry` is allowed there), and every distractor that the engine rejected
 * (wrong tactic, ill-typed term) is rejected by real Lean too.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDetailed, generator } from '../src/arena/gen/index.ts';
import type { ProofFamily, PuzzleFamily } from '../src/arena/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const leanDir = join(root, 'lean-verify');
const genDir = join(leanDir, 'Game', 'Generated');
const n = Math.max(1, Number(process.argv[2] ?? 60) || 60);

type Kind = 'proof' | 'quick-ok' | 'quick-bad';
const lines: string[] = [];
const labels: { line: number; label: string; kind: Kind }[] = [];
let ns = 0;
const block = (label: string, kind: Kind, code: string) => {
  const name = `V${ns++}`;
  labels.push({ line: lines.length + 1, label, kind });
  lines.push(`namespace ${name}`, ...code.split('\n'), `end ${name}`, '');
};
lines.push('import Game.Core', 'set_option linter.unusedVariables false', '');

const counts: Record<string, number> = {};
const proofFamilies: ProofFamily[] = ['prop', 'inhabit', 'quant', 'set'];
for (const family of [...proofFamilies, 'quick' as PuzzleFamily]) {
  const [lo, hi] = generator.range[family];
  for (let i = 0; i < n; i++) {
    const target = Math.round(lo + ((hi - lo) * i) / Math.max(1, n - 1));
    const { puzzle, verify } = generateDetailed({ seed: `verify:${i}`, family, target });
    const label = `${puzzle.id} (rating ${puzzle.rating})`;
    if (puzzle.kind === 'proof') {
      block(label, 'proof', `${puzzle.setup ? puzzle.setup + '\n' : ''}${puzzle.header}\n${puzzle.solution}`);
      counts[family] = (counts[family] ?? 0) + 1;
    } else if (verify) {
      for (const s of verify.ok) block(`${label} [${puzzle.quick} answer]`, 'quick-ok', s);
      for (const s of verify.bad) block(`${label} [${puzzle.quick} distractor]`, 'quick-bad', s);
      counts[`quick ${puzzle.quick}`] = (counts[`quick ${puzzle.quick}`] ?? 0) + 1;
      counts['quick snippets ok'] = (counts['quick snippets ok'] ?? 0) + verify.ok.length;
      counts['quick snippets bad'] = (counts['quick snippets bad'] ?? 0) + verify.bad.length;
    }
  }
}

mkdirSync(genDir, { recursive: true });
const file = join(genDir, 'arena.lean');
writeFileSync(file, lines.join('\n'));

const build = spawnSync('lake', ['build', 'Game'], { cwd: leanDir, encoding: 'utf8' });
if (build.status !== 0) {
  console.error(build.stdout + build.stderr);
  process.exit(1);
}
const run = spawnSync('lake', ['env', 'lean', '-DmaxErrors=100000', file], { cwd: leanDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const out = (run.stdout + run.stderr).trim();

const labelAt = (line: number) => {
  let best = labels[0];
  for (const l of labels) if (l.line <= line) best = l;
  return best;
};
const errorsByBlock = new Map<number, string[]>();
const sorryByBlock = new Map<number, string[]>();
for (const l of out.split('\n')) {
  const m = l.match(/:(\d+):(\d+): (error|warning)/);
  if (!m) continue;
  const b = labelAt(Number(m[1]));
  const idx = labels.indexOf(b);
  if (m[3] === 'error') errorsByBlock.set(idx, [...(errorsByBlock.get(idx) ?? []), l]);
  else if (/declaration uses 'sorry'/.test(l)) sorryByBlock.set(idx, [...(sorryByBlock.get(idx) ?? []), l]);
}

let failures = 0;
labels.forEach((b, i) => {
  const errs = errorsByBlock.get(i) ?? [];
  const sorries = sorryByBlock.get(i) ?? [];
  if (b.kind === 'proof' && (errs.length || sorries.length)) {
    failures++;
    console.log(`✖ ${b.label}: ${errs.length} error(s), ${sorries.length} sorry warning(s)`);
    for (const e of errs) console.log('    ' + e);
  } else if (b.kind === 'quick-ok' && errs.length) {
    failures++;
    console.log(`✖ ${b.label}: the correct answer does not compile`);
    for (const e of errs) console.log('    ' + e);
  } else if (b.kind === 'quick-bad' && !errs.length) {
    failures++;
    console.log(`✖ ${b.label}: real Lean ACCEPTS a distractor the engine rejected (fidelity bug)`);
  }
});

const summary = Object.entries(counts)
  .map(([k, v]) => `${k}: ${v}`)
  .join(', ');
if (failures || (run.status !== 0 && errorsByBlock.size === 0)) {
  console.log(`✖ arena: ${failures} failing block(s) of ${labels.length}. (${summary})`);
  if (run.status !== 0 && errorsByBlock.size === 0) console.log(out.slice(0, 2000));
  process.exit(1);
}
console.log(`✔ arena: ${labels.length} blocks OK in real Lean (${summary})`);
