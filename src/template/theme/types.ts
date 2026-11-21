import type { ReactNode } from 'react';

export interface PaletteColors {
  bg: string;
  side: string;
  surface1: string;
  surface2: string;
  surface3: string;
  line: string;
  lineStrong: string;
  ink: string;
  ink2: string;
  muted: string;
  primary: string;
  primaryHi: string;
  primaryEdge: string;
  primaryInk: string;
  primarySoft: string;
  primaryText: string;
  gold: string;
  goldEdge: string;
  goldInk: string;
  goldSoft: string;
  goldText: string;
  ok: string;
  okEdge: string;
  okInk: string;
  okSoft: string;
  okText: string;
  err: string;
  errSoft: string;
  errText: string;
  warn: string;
  warnSoft: string;
  warnText: string;
  flame: string;
  info: string;
  shadow1: string;
  shadow2: string;
  shadow3: string;
  edge: string;
  glow: string;
  scrim: string;
  activeLine: string;
  selection: string;
  hlKw: string;
  hlTac: string;
  hlTy: string;
  hlCom: string;
  hlStr: string;
  hlNum: string;
  hlOp: string;
}

export interface ThemeTypography {
  ui?: string;
  read?: string;
  mono?: string;
}

export interface ThemeRadii {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  pill?: string;
}

export interface ThemeLayout {
  sideW?: string;
  railW?: string;
  measure?: string;
}

export interface ThemeOverrides {
  light?: Partial<PaletteColors>;
  dark?: Partial<PaletteColors>;
  typography?: ThemeTypography;
  radii?: ThemeRadii;
  layout?: ThemeLayout;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** Three preview colors for the swatch UI: [primary, gold/accent, dark bg]. */
  swatches: [string, string, string];
  light: PaletteColors;
  dark: PaletteColors;
  typography?: ThemeTypography;
  radii?: ThemeRadii;
  layout?: ThemeLayout;
}

export type BuiltInPresetId = 'indigo' | 'botanical' | 'terracotta' | 'ocean' | 'rose' | 'editorial';

export interface WorldVisual {
  /** Short glyph shown on world tokens (1-2 chars), or `null` when `renderEmblem` draws a custom mark. */
  glyph?: string | null;
  /** Hue in 0..360 for world token gradient. */
  hue?: number;
  /** Optional custom emblem renderer (used instead of text glyph). */
  renderEmblem?: (props: { className?: string }) => ReactNode;
}

export interface GameThemeConfig {
  /** Default preset id for this disc. Defaults to `'indigo'`. */
  preset?: BuiltInPresetId | (string & {});
  /** Color mode when user preference is `'system'`. Absent follows OS `prefers-color-scheme`. */
  defaultMode?: 'system' | 'dark' | 'light';
  /** Per-disc token overrides applied on top of the selected preset. */
  overrides?: ThemeOverrides;
  /** Allow players to switch color palettes in Profile -> Settings. Defaults to `true`. */
  allowPalettePicker?: boolean;
  /** Additional custom presets provided by this disc. */
  presets?: ThemePreset[];
  /** Per-world emblem glyph, hue, and custom SVG renderer. */
  worldVisuals?: Record<string, WorldVisual>;
  /** Fallback hue seed offset when a world has no explicit hue. */
  defaultWorldHue?: number;
}
