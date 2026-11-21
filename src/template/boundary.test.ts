import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(p);
  }
  return out;
}

function importsIn(src: string): string[] {
  const specs: string[] = [];
  for (const m of src.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) specs.push(m[1]);
  for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1]);
  return specs;
}

describe('architectural boundaries', () => {
  const root = resolve('.');

  it('src/template never imports domains/, games/, or CodeMirror', () => {
    const files = walk(join(root, 'src/template'));
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const spec of importsIn(src)) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/(?:domains|games)\//);
        expect(spec, `${file} imports ${spec}`).not.toMatch(/^@(?:codemirror|lezer)\//);
      }
    }
  });

  it('src/template runtime UI/theme files contain no hardcoded Inhabit/Lean/Mathlib references', () => {
    const files = walk(join(root, 'src/template')).filter(
      (f) => !f.includes('.test.') && !f.includes('/state/'),
    );
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/inhabit/i);
      expect(src, file).not.toMatch(/mathlib/i);
      expect(src, file).not.toMatch(/\bLean\b/);
    }
  });

  it('src/domains/lean runtime files never import from src/games/', () => {
    const files = walk(join(root, 'src/domains/lean')).filter((f) => !f.includes('.test.'));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const spec of importsIn(src)) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/games\//);
      }
    }
  });

  it('src/games/starter never imports from domains/, inhabit/, or CodeMirror', () => {
    const files = walk(join(root, 'src/games/starter'));
    expect(files.length).toBeGreaterThan(4);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const spec of importsIn(src)) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/domains\/|inhabit\//);
        expect(spec, `${file} imports ${spec}`).not.toMatch(/^@(?:codemirror|lezer)\//);
      }
    }
  });
});
