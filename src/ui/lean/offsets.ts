/** Mapping between engine offsets (assembled source) and editor offsets (body only). */
import type { Diagnostic } from '../../engine/types.ts';

export interface MappedRange {
  from: number;
  to: number;
  /** The diagnostic starts inside the learner-editable body. */
  inBody: boolean;
}

/** Map an assembled-source range into body coordinates, clamped to the body. */
export function toBodyRange(from: number, to: number, bodyOffset: number, bodyLen: number): MappedRange {
  const end = bodyOffset + bodyLen;
  const inBody = from >= bodyOffset && from <= end;
  if (to < bodyOffset || from > end) return { from: 0, to: 0, inBody: false };
  const f = Math.max(from, bodyOffset) - bodyOffset;
  const t = Math.min(Math.max(to, from), end) - bodyOffset;
  return { from: f, to: t, inBody: inBody || (from < bodyOffset && to > bodyOffset) };
}

export interface BodyDiagnostic extends Diagnostic {
  /** Range in body coordinates (only meaningful when `inBody`). */
  bFrom: number;
  bTo: number;
  inBody: boolean;
}

export function mapDiagnostics(diags: Diagnostic[], bodyOffset: number, bodyLen: number): BodyDiagnostic[] {
  return diags.map((d) => {
    const r = toBodyRange(d.from, d.to, bodyOffset, bodyLen);
    return { ...d, bFrom: r.from, bTo: r.to, inBody: r.inBody };
  });
}

/** Offset of the first non-space character of 1-based `line` in `text` (for the predict marker). */
export function lineOffset(text: string, line: number): { start: number; indent: number; end: number } {
  let start = 0;
  for (let i = 1; i < line; i++) {
    const nl = text.indexOf('\n', start);
    if (nl < 0) {
      start = text.length;
      break;
    }
    start = nl + 1;
  }
  const nl = text.indexOf('\n', start);
  const end = nl < 0 ? text.length : nl;
  const m = /^[ \t]*/.exec(text.slice(start, end));
  return { start, indent: start + (m ? m[0].length : 0), end };
}
