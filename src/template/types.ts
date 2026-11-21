import type { ComponentType, MutableRefObject, ReactNode } from 'react';
import type { BadgeDef, RankDef } from './state/game.ts';
import type { QuestOptions } from './state/meta.ts';
import type { LevelProgress, Progress } from './state/progress.ts';
import type { RecInput } from './state/recommend.ts';
import type { GameThemeConfig } from './theme/types.ts';

export type PillTone = 'neutral' | 'primary' | 'gold' | 'ok' | 'err' | 'warn' | 'flame';

export type TemplateIconName =
  | 'home' | 'map' | 'arena' | 'review' | 'guide' | 'codex' | 'sandbox' | 'workshop'
  | 'graduate' | 'about' | 'profile' | 'more' | 'sound' | 'mute' | 'bolt' | 'trophy'
  | 'lock' | 'check' | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'arrow-right'
  | 'clock' | 'target' | 'crown' | 'close' | 'search' | 'calendar' | 'eye' | 'list'
  | 'check-circle' | 'translate' | 'turnstile' | 'bulb' | 'bag' | 'warn' | 'external'
  | 'sparkle' | 'download' | 'upload' | 'reset' | 'play' | 'book' | 'copy' | 'sun'
  | 'quest' | 'star' | 'flame' | 'crown-fill';

export interface TemplateHint {
  text: string;
}

export interface TemplateUnlocks {
  codex?: string[];
  tactics?: string[];
  lemmas?: string[];
  items?: string[];
}

export interface TemplateLevel {
  id: string;
  title: string;
  kind: string;
  intro: string;
  outro?: string;
  unlocks?: TemplateUnlocks;
  boss?: boolean;
  review?: boolean;
  optional?: boolean;
  mode?: string;
  hints?: TemplateHint[];
}

export interface BuiltInChoiceOption {
  text: string;
  correct?: boolean;
  feedback: string;
}

export interface BuiltInChoiceLevel extends TemplateLevel {
  kind: 'choice';
  question: string;
  code?: string;
  codeLang?: string;
  options: BuiltInChoiceOption[];
}

export interface BuiltInOrderLevel extends TemplateLevel {
  kind: 'order';
  prompt: string;
  /** Correct sequence of lines/steps. */
  lines: string[];
  /** Plausible wrong items mixed into the pool. */
  distractors?: string[];
  /** Optional custom validator; defaults to exact line-by-line equality against `lines`. */
  validate?: (placed: string[]) => { ok: boolean; feedback?: string };
  /** Optional language tag for code formatting (default: plain text / disc highlighter). */
  codeLang?: string;
}

export interface BuiltInTextMistake {
  /** Exact normalized match or RegExp tested against trimmed input. */
  match: string | RegExp;
  feedback: string;
}

export interface BuiltInTextLevel extends TemplateLevel {
  kind: 'text';
  prompt: string;
  /** Optional code snippet or data shown with the prompt. */
  code?: string;
  placeholder?: string;
  starter?: string;
  /** Accepted answers. `accept[0]` is the canonical solution shown on reveal. */
  accept: string[];
  /** Optional normalizer (defaults to `.trim()`). */
  normalize?: (value: string) => string;
  /** Optional custom validator; overrides `accept` equality when supplied. */
  validate?: (value: string) => boolean;
  /** Targeted feedback for anticipated misconceptions. */
  mistakes?: BuiltInTextMistake[];
  /** Unrecognized non-empty answer feedback. */
  wrongFeedback?: string;
  multiline?: boolean;
}

export interface TemplateCodexEntry {
  id: string;
  kind: string;
  name: string;
  summary: string;
  body: string;
  example?: string;
  meta?: { label: string; value: string; code?: boolean }[];
}

export interface TemplateWorld {
  id: string;
  title: string;
  tagline: string;
  intro: string;
  requires: string[];
  bigIdea?: string;
  levels: TemplateLevel[];
  codex: TemplateCodexEntry[];
  /** Optional parallel track badge on the roadmap (e.g. "Track A: numbers"). */
  track?: string;
  /** Optional note rendered below this world on the roadmap when it forks into tracks. */
  forkNote?: string;
  /** Optional inline glyph/hue overrides (also configurable via `theme.worldVisuals`). */
  glyph?: string | null;
  hue?: number;
}

export interface TemplateLesson {
  body: string;
  pitfall?: string;
  extraCallout?: { label: string; icon?: TemplateIconName; body: string };
}

export interface TemplateWorldLessons {
  worldId: string;
  primer?: string;
  recap?: string;
  levels: Record<string, TemplateLesson>;
}

export interface TemplateChapterMeta {
  worldId: string;
  title: string;
  minutes: number;
}

export interface TemplateChapter {
  worldId: string;
  title: string;
  dek: string;
  body: string;
  guide?: string[];
}

export interface TemplateGuideSection {
  id: string;
  title: string;
  blurb: string;
}

export interface TemplateGuideMeta {
  id: string;
  section: string;
  title: string;
  summary: string;
  minutes: number;
}

export interface TemplateGuideArticle extends TemplateGuideMeta {
  body: string;
  worlds?: string[];
  next?: string[];
}

export interface TemplateExhibitGroup {
  id: string;
  title: string;
  blurb: string;
}

export interface TemplateExhibitMeta {
  id: string;
  title: string;
  tagline: string;
  worlds: string[];
  levels?: string[];
  glyph: string;
  group: string;
  minutes: number;
}

export interface TemplateScreenIntro {
  title: string;
  lede: string;
  about: string;
  tips?: string[];
}

export interface TemplateBlurb {
  title: string;
  body: string;
}

export interface TemplateHomeCopy {
  hero: {
    eyebrow: string;
    headline: string;
    lede: string;
    startLabel: string;
    continueLabel: string;
    aboutLabel: string;
    reassurances: string[];
  };
  whatIs: { heading: string; body: string };
  outcomes: { heading: string; items: TemplateBlurb[] };
  galleryStrip?: { heading: string; intro: string };
  journey: { heading: string; intro: string };
  method: { heading: string; items: TemplateBlurb[] };
  audience: { heading: string; body: string };
  closing: { heading: string; body: string; cta: string };
  entryCards?: { title: string; body: string; cta: string; href: string; icon: TemplateIconName; tone?: 'primary' | 'gold' | 'default' }[];
  aboutSummary?: string;
}

export interface TemplateAboutSection {
  id: string;
  title: string;
  body: string;
}

export interface TemplateAboutCopy {
  title: string;
  lede: string;
  glanceTiles?: { n: string; label: string }[];
  sections: TemplateAboutSection[];
  faq: { q: string; a: string }[];
  credits: string;
  sectionInserts?: Record<string, { before?: ComponentType; after?: ComponentType }>;
}

export interface EditorApi {
  insert?: (text: string) => void;
  setBody?: (text: string) => void;
}

export interface RunCompletion {
  body?: string;
  selfAssessed?: boolean;
  studied?: boolean;
  term?: string;
  extra?: unknown;
}

export interface LevelRenderProps {
  level: TemplateLevel;
  world: TemplateWorld;
  index: number;
  mode: 'play' | 'review';
  fontSize: number;
  strictInventory: boolean;
  solved: boolean;
  initialBody: string;
  attempt: () => void;
  complete: (c?: RunCompletion) => void;
  saveDraft: (text: string) => void;
  reportLive: (live: unknown) => void;
  api: MutableRefObject<EditorApi>;
}

export interface LevelKindDef {
  label: string;
  icon: TemplateIconName;
  baseXp?: number;
  tags?: (level: TemplateLevel) => { label: string; tone?: PillTone; icon?: TemplateIconName }[];
  solutionText?: (level: TemplateLevel) => string | null;
  renderSolution?: (solution: string, level: TemplateLevel, api: MutableRefObject<EditorApi>) => ReactNode;
  initialBody?: (level: TemplateLevel, mode: 'play' | 'review', draft?: string, progress?: LevelProgress) => string;
  render: ComponentType<LevelRenderProps>;
}

export interface ExtraScreenDef {
  /** Top-level hash segment `#/<name>/...`. */
  name: string;
  title?: (sub?: string, arg?: string) => string;
  load: () => Promise<{ default: ComponentType<{ sub?: string; arg?: string }> }>;
  nav?: {
    label: string;
    icon: TemplateIconName;
    group: 'learn' | 'play' | 'reference' | string;
    to?: string;
    tabPrimary?: boolean;
    activeRoutes?: string[];
  };
}

export interface StuckHelpSlotProps {
  level: TemplateLevel;
  levelId: string;
  world: TemplateWorld;
  index: number;
  strict: boolean;
  hints: TemplateHint[];
  live: unknown;
  revealed: number;
  onRevealHint: () => void;
  toolUsed: boolean;
  onUseTool: () => void;
  failedChecks: number;
  canShowSolution: boolean;
  onShowSolution: () => void;
  finished: boolean;
  leading?: ReactNode;
}

export interface InventorySlotProps {
  levelId: string;
  level: TemplateLevel;
  onInsert?: (s: string) => void;
  onClose: () => void;
}

export interface SuccessExtraProps {
  levelId: string;
  level: TemplateLevel;
  world: TemplateWorld;
  mode: 'play' | 'review';
  outcome: RunCompletion & { xp: number; studied: boolean };
}

export interface GameBrand {
  id: string;
  name: string;
  homeTitle: string;
  description: string;
  logo?: ComponentType<{ compact?: boolean }>;
  footerLinks?: { label: string; href: string; external?: boolean }[];
  footerNote?: string;
  storageKey?: string;
  mapViewKey?: string;
  saveAppId?: string;
  storageErrorText?: string;
}

export interface GameDisc {
  brand: GameBrand;
  theme?: GameThemeConfig;
  worlds: TemplateWorld[];
  allCodex: TemplateCodexEntry[];
  codexKinds?: { id: string; label: string }[];
  findLevel: (id: string) => { world: TemplateWorld; level: TemplateLevel; index: number } | undefined;

  lessons?: {
    load?: () => Promise<void>;
    forLevel: (id: string) => TemplateLesson | undefined;
    forWorld: (id: string) => { primer?: string; recap?: string } | undefined;
  };
  chapters?: {
    meta: TemplateChapterMeta[];
    loadAll: () => Promise<TemplateChapter[]>;
  };
  guide?: {
    sections: TemplateGuideSection[];
    meta: TemplateGuideMeta[];
    loadArticles: () => Promise<TemplateGuideArticle[]>;
  };
  gallery?: {
    groups: TemplateExhibitGroup[];
    exhibits: TemplateExhibitMeta[];
    loadExhibit: (id: string) => Promise<{ default: ComponentType }>;
    renderThumb?: (id: string) => ReactNode;
    verifiedLabel?: string;
  };

  home: TemplateHomeCopy;
  heroWidget?: ComponentType<{ cta: ReactNode }>;
  about: TemplateAboutCopy;
  screenIntro: (id: string) => TemplateScreenIntro | undefined;

  /** Custom or domain-specific level kinds (merged on top of built-in choice / order / text). */
  levelKinds?: Record<string, LevelKindDef>;
  /** Extra screens mounted at `#/<name>` and optionally added to navigation. */
  extraScreens?: ExtraScreenDef[];
  navGroups?: { id: string; label: string }[];

  code?: {
    highlightHtml?: (code: string, lang?: string) => string;
    fenceLabels?: Record<string, { className: string; label: string }>;
  };

  progression?: {
    ranks?: readonly RankDef[];
    badges?: BadgeDef[];
    badgeGroups?: { id: string; title: string; icon: TemplateIconName }[];
    questOptions?: QuestOptions;
    lessonDefault?: {
      firstWorldId?: string;
      openingCount?: number;
      isIntroducing?: (world: TemplateWorld, level: TemplateLevel, index: number) => boolean;
    };
    afterAllWorlds?: {
      href: string;
      title: string;
      reason: string;
      cta: string;
      icon: TemplateIconName;
    };
  };

  hooks?: {
    renderStuckHelp?: ComponentType<StuckHelpSlotProps>;
    renderInventory?: ComponentType<InventorySlotProps>;
    renderSuccessExtras?: ComponentType<SuccessExtraProps>;
    renderAfterSuccess?: ComponentType<{ levelId: string; hints: number; studied: boolean }>;
    renderCodexExtras?: (entry: TemplateCodexEntry) => ReactNode;
    introducedChips?: (level: TemplateLevel) => string[];
    unlockedCodexIds?: (levels: Progress) => Set<string>;
    whereCodexUnlocked?: (id: string) => string | null;
    filterHints?: (hints: TemplateHint[], level: TemplateLevel) => TemplateHint[];
    extraBanners?: ComponentType;
    dashboardCards?: ComponentType[];
    playerCardStats?: ComponentType;
    profileStats?: ComponentType;
    extraSettings?: ComponentType;
    useRecommendExtras?: () => Partial<Pick<RecInput, 'dailyDone' | 'practiceable'>> & {
      practiceLink?: (id: string) => string;
      dailyLink?: string;
      workshopLink?: string;
    };
    defaultSandbox?: string;
  };

  firstSteps?: {
    levelId: string;
    steps: { target: string; anchor?: string; title: string; text: ReactNode }[];
  };
}
