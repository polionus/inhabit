import { BUILT_IN_PRESETS, getPreset } from './presets.ts';
import type { GameThemeConfig, PaletteColors, ThemeLayout, ThemePreset, ThemeRadii, ThemeTypography } from './types.ts';

export interface ResolvedTheme {
  presetId: string;
  light: PaletteColors;
  dark: PaletteColors;
  typography: ThemeTypography;
  radii: ThemeRadii;
  layout: ThemeLayout;
  availablePresets: ThemePreset[];
}

const COLOR_CSS_VARS: [keyof PaletteColors, string][] = [
  ['bg', '--bg'],
  ['side', '--side'],
  ['surface1', '--surface-1'],
  ['surface2', '--surface-2'],
  ['surface3', '--surface-3'],
  ['line', '--line'],
  ['lineStrong', '--line-strong'],
  ['ink', '--ink'],
  ['ink2', '--ink-2'],
  ['muted', '--muted'],
  ['primary', '--primary'],
  ['primaryHi', '--primary-hi'],
  ['primaryEdge', '--primary-edge'],
  ['primaryInk', '--primary-ink'],
  ['primarySoft', '--primary-soft'],
  ['primaryText', '--primary-text'],
  ['gold', '--gold'],
  ['goldEdge', '--gold-edge'],
  ['goldInk', '--gold-ink'],
  ['goldSoft', '--gold-soft'],
  ['goldText', '--gold-text'],
  ['ok', '--ok'],
  ['okEdge', '--ok-edge'],
  ['okInk', '--ok-ink'],
  ['okSoft', '--ok-soft'],
  ['okText', '--ok-text'],
  ['err', '--err'],
  ['errSoft', '--err-soft'],
  ['errText', '--err-text'],
  ['warn', '--warn'],
  ['warnSoft', '--warn-soft'],
  ['warnText', '--warn-text'],
  ['flame', '--flame'],
  ['info', '--info'],
  ['shadow1', '--shadow-1'],
  ['shadow2', '--shadow-2'],
  ['shadow3', '--shadow-3'],
  ['edge', '--edge'],
  ['glow', '--glow'],
  ['scrim', '--scrim'],
  ['activeLine', '--active-line'],
  ['selection', '--selection'],
  ['hlKw', '--hl-kw'],
  ['hlTac', '--hl-tac'],
  ['hlTy', '--hl-ty'],
  ['hlCom', '--hl-com'],
  ['hlStr', '--hl-str'],
  ['hlNum', '--hl-num'],
  ['hlOp', '--hl-op'],
];

/** Merge presets (disc custom presets override/extend built-ins by id). */
export function availablePresetsFor(config?: GameThemeConfig): ThemePreset[] {
  const map = new Map<string, ThemePreset>();
  for (const p of BUILT_IN_PRESETS) map.set(p.id, p);
  for (const p of config?.presets ?? []) map.set(p.id, p);
  return [...map.values()];
}

export function resolveTheme(config?: GameThemeConfig, playerPaletteId?: string): ResolvedTheme {
  const extra = config?.presets ?? [];
  const availablePresets = availablePresetsFor(config);
  const discDefaultId = config?.preset ?? 'indigo';
  const pickerAllowed = config?.allowPalettePicker !== false;
  const usingPlayerOverride =
    pickerAllowed &&
    !!playerPaletteId &&
    availablePresets.some((p) => p.id === playerPaletteId);

  const preset = getPreset(usingPlayerOverride ? playerPaletteId : discDefaultId, extra);
  const applyColorOverrides = !usingPlayerOverride || playerPaletteId === discDefaultId;

  const light: PaletteColors = applyColorOverrides && config?.overrides?.light
    ? { ...preset.light, ...config.overrides.light }
    : { ...preset.light };
  const dark: PaletteColors = applyColorOverrides && config?.overrides?.dark
    ? { ...preset.dark, ...config.overrides.dark }
    : { ...preset.dark };

  const typography: ThemeTypography = { ...preset.typography, ...config?.overrides?.typography };
  const radii: ThemeRadii = { ...preset.radii, ...config?.overrides?.radii };
  const layout: ThemeLayout = { ...preset.layout, ...config?.overrides?.layout };

  return { presetId: preset.id, light, dark, typography, radii, layout, availablePresets };
}

function colorDecls(colors: PaletteColors): string {
  return COLOR_CSS_VARS.map(([k, cssVar]) => `${cssVar}: ${colors[k]};`).join(' ');
}

function extraDecls(r: ResolvedTheme): string {
  const out: string[] = [];
  if (r.typography.ui) out.push(`--font-ui: ${r.typography.ui};`);
  if (r.typography.read) out.push(`--font-read: ${r.typography.read};`);
  if (r.typography.mono) out.push(`--mono: ${r.typography.mono};`);
  if (r.radii.xs) out.push(`--r-xs: ${r.radii.xs};`);
  if (r.radii.sm) out.push(`--r-sm: ${r.radii.sm};`);
  if (r.radii.md) out.push(`--r-md: ${r.radii.md};`);
  if (r.radii.lg) out.push(`--r-lg: ${r.radii.lg};`);
  if (r.radii.xl) out.push(`--r-xl: ${r.radii.xl};`);
  if (r.radii.pill) out.push(`--r-pill: ${r.radii.pill};`);
  if (r.layout.sideW) out.push(`--side-w: ${r.layout.sideW};`);
  if (r.layout.railW) out.push(`--rail-w: ${r.layout.railW};`);
  if (r.layout.measure) out.push(`--measure: ${r.layout.measure};`);
  return out.join(' ');
}

export function themeCss(r: ResolvedTheme): string {
  const extras = extraDecls(r);
  const aliases = '--surface: var(--surface-1); --accent: var(--primary-text); --accent-ink: var(--primary-ink); --accent-soft: var(--primary-soft);';
  const lightBlock = `:root { ${extras ? extras + ' ' : ''}${colorDecls(r.light)} color-scheme: light; ${aliases} }`;
  const darkVars = `${colorDecls(r.dark)} color-scheme: dark; ${aliases}`;
  const darkMedia = `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${darkVars} } }`;
  const darkAttr = `:root[data-theme='dark'] { ${darkVars} }`;
  return `${lightBlock}\n${darkMedia}\n${darkAttr}`;
}

const STYLE_ID = 'game-theme-vars';

export function applyTheme(
  config: GameThemeConfig | undefined,
  mode: 'system' | 'light' | 'dark',
  playerPaletteId?: string,
  storageKey?: string,
): ResolvedTheme {
  const resolved = resolveTheme(config, playerPaletteId);
  if (typeof document === 'undefined') return resolved;

  const el = document.documentElement;
  const effectiveMode = mode === 'system' ? (config?.defaultMode ?? 'system') : mode;
  if (effectiveMode === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', effectiveMode);

  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  } else if (styleEl !== document.head.lastElementChild) {
    // Keep injected theme CSS after bundled stylesheets so overrides always win cleanly.
    document.head.appendChild(styleEl);
  }
  const css = themeCss(resolved);
  if (styleEl.textContent !== css) styleEl.textContent = css;
  // The pre-paint script in index.html colors <html> inline from the cached splash; once the real theme CSS
  // is in, drop those inline colors, or a later light/dark switch would leave the old one showing on <html>.
  document.documentElement.style.removeProperty('background');
  document.documentElement.style.removeProperty('color');

  const metaLight = document.querySelector('meta[name="theme-color"][media*="light"]');
  const metaDark = document.querySelector('meta[name="theme-color"][media*="dark"]');
  if (metaLight) metaLight.setAttribute('content', resolved.light.bg);
  if (metaDark) metaDark.setAttribute('content', resolved.dark.bg);

  if (storageKey) {
    try {
      localStorage.setItem(
        `${storageKey}.splash`,
        JSON.stringify({
          lightBg: resolved.light.bg,
          lightInk: resolved.light.ink,
          darkBg: resolved.dark.bg,
          darkInk: resolved.dark.ink,
          defaultMode: config?.defaultMode ?? 'system',
        }),
      );
    } catch {
      /* ignore */
    }
  }

  return resolved;
}
