import { describe, expect, it } from 'vitest';
import { BUILT_IN_PRESETS, INDIGO_PRESET, applyTheme, getPreset, resolveTheme, themeCss } from './index.ts';

describe('theme presets', () => {
  it('provides 6 complete presets with light and dark palettes', () => {
    expect(BUILT_IN_PRESETS).toHaveLength(6);
    const expectedKeys = Object.keys(INDIGO_PRESET.light).sort();
    for (const p of BUILT_IN_PRESETS) {
      expect(Object.keys(p.light).sort()).toEqual(expectedKeys);
      expect(Object.keys(p.dark).sort()).toEqual(expectedKeys);
      expect(p.swatches).toHaveLength(3);
    }
  });

  it('falls back to indigo for unknown preset ids', () => {
    expect(getPreset('nonexistent').id).toBe('indigo');
    expect(getPreset(undefined).id).toBe('indigo');
  });

  it('supports custom disc presets and partial overrides', () => {
    const customPreset = {
      ...INDIGO_PRESET,
      id: 'amber-lab',
      name: 'Amber Lab',
      swatches: ['#ff9900', '#00bcd4', '#141414'] as [string, string, string],
    };
    const r = resolveTheme({
      preset: 'amber-lab',
      presets: [customPreset],
      overrides: {
        dark: { primary: '#ff9900' },
        radii: { md: '8px' },
      },
    });
    expect(r.presetId).toBe('amber-lab');
    expect(r.dark.primary).toBe('#ff9900');
    expect(r.radii.md).toBe('8px');
    expect(r.availablePresets.some((p) => p.id === 'amber-lab')).toBe(true);
  });

  it('respects player palette override when picker is allowed, ignores when disallowed', () => {
    const allowed = resolveTheme({ preset: 'indigo', allowPalettePicker: true }, 'botanical');
    expect(allowed.presetId).toBe('botanical');
    expect(allowed.dark.primary).not.toBe(INDIGO_PRESET.dark.primary);

    const locked = resolveTheme({ preset: 'indigo', allowPalettePicker: false }, 'botanical');
    expect(locked.presetId).toBe('indigo');
  });

  it('emits valid CSS for both light and dark modes', () => {
    const css = themeCss(resolveTheme({ preset: 'terracotta', overrides: { typography: { ui: 'Inter, sans-serif' } } }));
    expect(css).toContain('--font-ui: Inter, sans-serif;');
    expect(css).toContain(':root {');
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(":root[data-theme='dark']");
    expect(css).toContain('color-scheme: light;');
    expect(css).toContain('color-scheme: dark;');
  });

  it('is a safe no-op without document in Node', () => {
    const resolved = applyTheme({ preset: 'ocean' }, 'dark');
    expect(resolved.presetId).toBe('ocean');
  });
});
