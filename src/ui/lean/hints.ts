/** Heuristic: does a hint text effectively give away the solution? */
import type { Level } from '../../content/types.ts';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function significantLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l !== 'sorry' && !l.startsWith('--'));
}

export function solutionFragments(level: Level): string[] {
  switch (level.kind) {
    case 'proof':
      return significantLines(level.solutions[0] ?? '');
    case 'parsons':
      return significantLines(level.lines.join('\n'));
    case 'formalize':
      return level.accept[0] ? [norm(level.accept[0])] : [];
    default:
      return [];
  }
}

/** True when the hint text contains at least 60% of the solution's meaningful lines. */
export function hintRevealsSolution(hintText: string, level: Level): boolean {
  const frags = solutionFragments(level);
  if (!frags.length) return false;
  const hay = norm(hintText);
  const hit = frags.filter((f) => hay.includes(norm(f))).length;
  return hit / frags.length >= 0.6;
}
