/** Errors raised during elaboration, carrying a source range and a diagnostic code. */
import type { Diagnostic, DiagnosticCode, Goal } from '../types.ts';

export class ElabError extends Error {
  code: DiagnosticCode;
  from: number;
  to: number;
  data?: Diagnostic['data'];
  constructor(code: DiagnosticCode, message: string, from: number, to: number, data?: Diagnostic['data']) {
    super(message);
    this.code = code;
    this.from = from;
    this.to = to;
    this.data = data;
  }
  toDiagnostic(severity: Diagnostic['severity'] = 'error'): Diagnostic {
    const d: Diagnostic = { severity, code: this.code, message: this.message, from: this.from, to: this.to };
    if (this.data) d.data = this.data;
    return d;
  }
}

/** Thrown when a nested failure has already been reported; unwinds without a new message. */
export class AbortError extends Error {
  constructor() {
    super('aborted');
  }
}

export interface Ranged {
  from: number;
  to: number;
}

export function goalsData(goals: Goal[]): Diagnostic['data'] {
  return { goals };
}

/** Levenshtein distance for near-miss suggestions. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[] = [];
  for (let j = 0; j <= n; j++) d[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[n];
}

export function suggest(name: string, candidates: Iterable<string>, max = 3): string[] {
  const scored: { c: string; s: number }[] = [];
  const lower = name.toLowerCase();
  const short = (c: string) => c.slice(c.lastIndexOf('.') + 1);
  for (const c of candidates) {
    if (c === name) continue;
    const s1 = editDistance(lower, c.toLowerCase());
    const s2 = editDistance(lower, short(c).toLowerCase());
    const s = Math.min(s1, s2 + 0.5);
    const limit = Math.max(1, Math.floor(name.length / 3));
    if (s <= limit) scored.push({ c, s });
  }
  scored.sort((x, y) => x.s - y.s || x.c.length - y.c.length);
  return [...new Set(scored.map((x) => x.c))].slice(0, max);
}
