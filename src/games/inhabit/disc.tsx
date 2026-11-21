import { lazy, Suspense, type ComponentType, type ReactElement } from 'react';
import '../../domains/lean/styles/coach.css';
import { registerLeanRuntime } from '../../domains/lean/context.ts';
import { highlightHtml } from '../../domains/lean/editor/highlightCore.ts';
import { hintRevealsSolution } from '../../domains/lean/editor/hints.ts';
import { createLeanLevelKinds } from '../../domains/lean/levels/kinds.tsx';
import type { LiveState } from '../../domains/lean/levels/run.ts';
import type { LeanLevel } from '../../domains/lean/types.ts';
import { FirstTimeTip } from '../../domains/lean/components/FirstTime.tsx';
import { LiveDemo } from '../../domains/lean/components/LiveDemo.tsx';
import {
  Card,
  Icon,
  Markdown,
  Pill,
  StatTile,
  Toggle,
  game,
  useGame,
  usePlayer,
  type GameDisc,
  type IconName,
  type TemplateWorld,
} from '../../template/index.ts';
import { INHABIT_BADGE_GROUPS, INHABIT_BADGES, INHABIT_QUEST_OPTIONS, INHABIT_RANKS } from './badges.ts';
import { practiceLevels } from './arena/practiceLevels.ts';
import { useArenaSummary } from './arena/state/summary.ts';
import { chapterMeta } from './content/chapters/meta.ts';
import { guideMeta, guideSections } from './content/guideMeta.ts';
import {
  about as siteAbout,
  aboutGoalExample,
  aboutLevelParts,
  aboutSymbols,
  aboutSymbolsNote,
  home as siteHome,
} from './content/site.ts';
import type { CodexEntry, ScreenId } from './content/types.ts';
import { data, engine, getCodex, loadLessons } from './data.ts';
import { exhibits, exhibitGroups, type ExhibitId } from './gallery/registry.ts';
import { exhibitLoaders } from './gallery-ui/loaders.ts';
import { thumbs } from './gallery-ui/thumbs.tsx';
import { AfterHint } from './AfterHint.tsx';
import { meta } from './meta.ts';
import { href as inhabitHref } from './routes.ts';

/**
 * Level-screen pieces load with the level screen, not with the app shell (they pull in the stuck coach,
 * the practice generator and the share codec). `fallback={null}`: each is a secondary control.
 */
function lazyPart<P extends object>(load: () => Promise<ComponentType<P>>): (props: P) => ReactElement {
  const L = lazy(() => load().then((c) => ({ default: c }))) as unknown as ComponentType<P>;
  return function LazyPart(props: P) {
    return <Suspense fallback={null}><L {...props} /></Suspense>;
  };
}
const StuckHelp = lazyPart(() => import('../../domains/lean/levels/StuckHelp.tsx').then((m) => m.StuckHelp));
const Inventory = lazyPart(() => import('../../domains/lean/components/Inventory.tsx').then((m) => m.Inventory));
const OpenInLean = lazyPart(() => import('../../domains/lean/components/OpenInLean.tsx').then((m) => m.OpenInLean));
const ShareButton = lazyPart(() => import('./arena-ui/ShareButton.tsx').then((m) => m.ShareButton));
const PracticeOffer = lazyPart(() => import('./practice-ui/PracticeOffer.tsx').then((m) => m.PracticeOffer));

const DEFAULT_INHABIT_SANDBOX = `#check Nat.add_comm
#eval 2 + 3

theorem and_swap (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by
  sorry
`;

let lazyModule: typeof import('./lazyData.ts') | undefined;
async function ensureLazy() {
  if (!lazyModule) lazyModule = await import('./lazyData.ts');
  return lazyModule;
}

registerLeanRuntime({
  engine,
  allLemmas: data.allLemmas,
  allCodex: data.allCodex,
  getCodex,
  levelContext: data.levelContext,
  sessionFor: (id, strict = true) => data.levelSession(id, strict),
  fullEnv: data.fullEnv,
  checkBody: data.checkBody,
  getIdeas: () => lazyModule?.lazyData.ideas ?? [],
  getGraduate: () =>
    lazyModule
      ? { sections: lazyModule.lazyData.graduate, phrasebook: lazyModule.lazyData.phrasebook }
      : { sections: [], phrasebook: [] },
  ShareButton,
  PracticeOffer,
});

function ForgeAnvil({ className = '' }: { className?: string }) {
  return (
    <svg className={`emblem-glyph emblem-svg ${className}`} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M2.5 8.2h12.8c.4 2.4 2.4 3.6 6.2 3.6v1.4c-2.4.1-3.9 1-4.5 2.6v1.4h1.7v2.6H5.6v-2.6h1.9v-1.6c0-2-1.6-3.6-5-4.3z" />
      <path fill="currentColor" d="M18.6 2.2l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" opacity=".85" />
    </svg>
  );
}

function LevelFigure() {
  return (
    <>
      <ol className="about-steps">
        {aboutLevelParts.map((p, i) => (
          <li key={p.name}>
            <span className="about-step-n" aria-hidden="true">{i + 1}</span>
            <div><strong>{p.name}</strong><Markdown text={p.text} /></div>
          </li>
        ))}
      </ol>
      <figure className="about-goal">
        <div className="about-goal-box">
          <div className="about-goal-facts">
            {aboutGoalExample.facts.map((f) => <code key={f}>{f}</code>)}
          </div>
          <code className="about-goal-target">{aboutGoalExample.goal}</code>
        </div>
        <figcaption>
          <span><b>Above the line:</b> {aboutGoalExample.factsNote.toLowerCase()}.</span>
          <span><b>After the turnstile:</b> {aboutGoalExample.goalNote.toLowerCase()}.</span>
        </figcaption>
      </figure>
    </>
  );
}

function SymbolTable() {
  return (
    <>
      <div className="about-table-wrap">
        <table className="about-table">
          <caption className="sr-only">Abbreviations for common symbols</caption>
          <thead><tr><th scope="col">Type</th><th scope="col">You get</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            {aboutSymbols.map((r) => (
              <tr key={r.typed}><td><code>{r.typed}</code></td><td className="sym">{r.symbol}</td><td>{r.meaning}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <Markdown text={aboutSymbolsNote} />
    </>
  );
}

function DailyCard() {
  const a = useArenaSummary();
  return (
    <Card className="dash-daily" as="section" aria-labelledby="daily-h">
      <div className="card-head">
        <h2 id="daily-h"><Icon name="calendar" size={18} /> Daily Proof</h2>
        {a.dailyStreak > 0 && <Pill tone="flame" icon="flame">{a.dailyStreak}</Pill>}
      </div>
      {a.dailyDone ? (
        <>
          <p className="dash-big"><Icon name="check-circle" size={22} className="okc" /> Done for today</p>
          <p className="muted small">A new set appears tomorrow. Same three puzzles for everyone.</p>
          <a className="btn outline block" href={inhabitHref.arena('daily')}>See your result</a>
        </>
      ) : (
        <>
          <p className="muted small">Three puzzles of rising difficulty, the same for everyone today. A clock counts up; nothing times out.</p>
          <a className="btn gold block" href={inhabitHref.arena('daily')}><Icon name="play" size={16} /> Play today’s set</a>
        </>
      )}
    </Card>
  );
}

function ArenaPlayerCardStat() {
  const arena = useArenaSummary();
  if (arena.rating === null) return null;
  return (
    <span className="pc-stat arena" title="Arena rating">
      <Icon name="arena" size={16} />
      <span className="tnum">{arena.rating}</span>
      <span className="sr-only"> Arena rating</span>
    </span>
  );
}

function ArenaProfileStat() {
  const arena = useArenaSummary();
  return (
    <StatTile
      icon="arena"
      value={arena.rating ?? '—'}
      label="Arena rating"
      href={inhabitHref.arena()}
      sub={arena.rating === null ? 'Play a rated puzzle to get one' : `${arena.solved} rated puzzles solved`}
    />
  );
}

function StrictInventorySetting() {
  const strict = useGame((s) => s.save.settings.strictInventory);
  return (
    <Toggle
      label="Tactic inventory lock"
      desc="Only allow tactics you have unlocked."
      checked={strict}
      onChange={(v) => game().setSettings({ strictInventory: v })}
    />
  );
}

function FixtureBanner() {
  if (!data.fixtures) return null;
  return (
    <div className="fixture-banner">
      Fixture mode: fake engine and sample levels. <a href="?fixtures=0#/">Switch to real content</a>
    </div>
  );
}

const TRACK_LABELS: Record<string, string> = {
  nat: 'Track A: numbers',
  num: 'Track A: numbers',
  sets: 'Track B: sets and functions',
  fun: 'Track B: sets and functions',
};

const inhabitWorlds: TemplateWorld[] = data.worlds.map((w) => ({
  ...(w as unknown as TemplateWorld),
  track: TRACK_LABELS[w.id],
  forkNote: w.id === 'eq' ? 'Choose either track next — both rejoin at Formalization Forge.' : undefined,
}));

const levelCount = data.worlds.reduce((n, w) => n + w.levels.length, 0);

function codexEntryMeta(entry: CodexEntry): { label: string; value: string; code?: boolean }[] | undefined {
  const out: { label: string; value: string; code?: boolean }[] = [];
  if (entry.input) out.push({ label: 'Type it', value: entry.input.replace(/\\\\/g, '\\'), code: true });
  if (entry.mathlib) out.push({ label: 'In real Lean / Mathlib', value: entry.mathlib });
  return out.length ? out : undefined;
}

const enrichedCodex: CodexEntry[] = data.allCodex.map((c) => ({
  ...c,
  meta: codexEntryMeta(c),
}));

export const inhabitDisc: GameDisc = {
  brand: {
    id: meta.id,
    name: meta.name,
    homeTitle: meta.homeTitle,
    description: meta.description,
    storageKey: data.storageKey,
    mapViewKey: 'inhabit.mapView',
    saveAppId: 'inhabit',
    footerLinks: [{ label: 'Open source (MIT)', href: 'https://github.com/polionus/inhabit', external: true }],
    footerNote: 'Independent project, not affiliated with the Lean developers.',
    // The turnstile-like mark Inhabit has always used.
    mark: (
      <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <path d="M10.5 7.5v17M10.5 16h12" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" fill="none" />
        <circle cx="23.2" cy="16" r="2.3" fill="var(--gold)" />
      </svg>
    ),
  },
  navOrder: ['home', 'map', 'gallery', 'review', 'arena', 'workshop', 'sandbox', 'guide', 'codex', 'graduate', 'about'],
  theme: {
    preset: 'indigo',
    defaultMode: 'dark',
    allowPalettePicker: true,
    worldVisuals: {
      types: { glyph: 'λ', hue: 258 },
      props: { glyph: '⊢', hue: 222 },
      logic: { glyph: '∧', hue: 192 },
      quant: { glyph: '∀', hue: 168 },
      eq: { glyph: '=', hue: 140 },
      nat: { glyph: 'ℕ', hue: 42 },
      sets: { glyph: '∈', hue: 328 },
      fun: { glyph: '∘', hue: 292 },
      num: { glyph: '∣', hue: 22 },
      forge: { glyph: null, hue: 4, renderEmblem: ForgeAnvil },
      basics: { glyph: 'λ', hue: 258 },
      empty: { glyph: '∅', hue: 210 },
    },
  },
  worlds: inhabitWorlds,
  allCodex: enrichedCodex,
  codexKinds: [
    { id: 'concept', label: 'Concepts' },
    { id: 'tactic', label: 'Tactics' },
    { id: 'term', label: 'Terms' },
    { id: 'symbol', label: 'Symbols' },
    { id: 'definition', label: 'Definitions' },
  ],
  findLevel: (id) => data.findLevel(id) as { world: TemplateWorld; level: LeanLevel; index: number } | undefined,

  lessons: {
    load: loadLessons,
    forLevel: (id) => {
      const l = data.levelLesson(id);
      if (!l) return undefined;
      return {
        body: l.body,
        pitfall: l.pitfall,
        extraCallout: l.realLean ? { label: 'In real Lean', icon: 'graduate', body: l.realLean } : undefined,
      };
    },
    forWorld: (id) => data.worldLessons(id),
  },
  chapters: {
    meta: chapterMeta,
    loadAll: () => import('./content/chapters/full.ts').then((m) => m.chapters),
  },
  guide: {
    sections: guideSections,
    meta: guideMeta,
    loadArticles: () => ensureLazy().then((m) => m.lazyData.guide),
  },
  gallery: {
    groups: exhibitGroups,
    exhibits,
    loadExhibit: (id) => exhibitLoaders[id as ExhibitId]() as unknown as Promise<{ default: React.ComponentType }>,
    renderThumb: (id) => {
      const Thumb = thumbs[id as ExhibitId];
      return Thumb ? <Thumb /> : null;
    },
    verifiedLabel: 'Lean here is engine-checked',
  },

  home: {
    hero: siteHome.hero,
    whatIs: siteHome.whatIsLean,
    outcomes: siteHome.outcomes,
    journey: siteHome.journey,
    method: siteHome.method,
    audience: siteHome.audience,
    closing: siteHome.closing,
    aboutSummary: 'Inhabit',
    entryCards: [
      {
        title: 'Play from level one',
        body: 'Ten worlds of short levels, from your first proof to a theorem of your own.',
        cta: 'Start',
        href: '#/level/types-01',
        icon: 'map',
        tone: 'primary',
      },
      {
        title: 'Read the Guide',
        body: 'What Lean is, how proof checking works, and where it is used. Read first or alongside.',
        cta: 'Open the Guide',
        href: '#/guide',
        icon: 'guide',
      },
      {
        title: 'Try the Arena',
        body: 'A Daily Proof, rated puzzles and timed runs. Generated fresh, so it never runs out.',
        cta: 'Enter the Arena',
        href: inhabitHref.arena(),
        icon: 'arena',
        tone: 'gold',
      },
    ],
  },
  heroWidget: ({ cta }) => <LiveDemo demo={siteHome.demo} cta={cta} />,
  about: {
    ...siteAbout,
    glanceTiles: [
      { n: String(data.worlds.length), label: 'chapters, from types to a full formal proof' },
      { n: String(levelCount), label: 'levels in five kinds, from reading to writing' },
      { n: 'Lean', label: 'every reference solution is compiled by real Lean 4' },
      { n: 'Free', label: 'runs in your browser: no install, no account' },
    ],
    sectionInserts: {
      'how-a-level-works': { after: LevelFigure },
      'typing-symbols': { after: SymbolTable },
    },
  },
  screenIntro: (id) => data.screen(id as ScreenId),

  levelKinds: createLeanLevelKinds(),
  extraScreens: [
    {
      name: 'arena',
      title: () => 'Arena',
      load: () => import('./arena-ui/ArenaScreen.tsx').then((m) => ({ default: m.ArenaScreen })),
      nav: { label: 'Arena', icon: 'arena', group: 'play', tabPrimary: true },
    },
    {
      name: 'sandbox',
      title: () => 'Sandbox',
      load: () => import('../../domains/lean/screens/SandboxScreen.tsx').then((m) => ({ default: m.SandboxScreen })),
      nav: { label: 'Sandbox', icon: 'sandbox', group: 'play' },
    },
    {
      name: 'workshop',
      title: () => 'Workshop',
      load: async () => {
        await ensureLazy();
        const m = await import('../../domains/lean/screens/WorkshopScreen.tsx');
        return { default: m.WorkshopScreen };
      },
      nav: { label: 'Workshop', icon: 'workshop', group: 'play' },
    },
    {
      name: 'graduate',
      title: () => 'Graduate',
      load: async () => {
        await ensureLazy();
        const m = await import('../../domains/lean/screens/GraduateScreen.tsx');
        return { default: m.GraduateScreen };
      },
      nav: { label: 'Graduate', icon: 'graduate', group: 'reference' },
    },
    {
      name: 'share',
      title: () => 'Shared proof',
      load: () =>
        import('./arena-ui/ShareScreen.tsx').then((m) => ({
          default: ({ sub }: { sub?: string }) => <m.ShareScreen code={sub ?? ''} />,
        })),
    },
    {
      name: 'practice',
      title: () => 'Practice',
      load: () =>
        import('./practice-ui/PracticeScreen.tsx').then((m) => ({
          default: ({ sub }: { sub?: string }) => <m.PracticeScreen id={sub ?? ''} />,
        })),
    },
  ],

  code: {
    highlightHtml: (code) => highlightHtml(code),
    fenceLabels: {
      lean: { className: 'lean', label: 'Lean 4' },
      'lean-real': { className: 'real', label: 'Real Lean 4' },
      'lean-mathlib': { className: 'mathlib', label: 'Mathlib' },
    },
  },

  progression: {
    ranks: INHABIT_RANKS,
    badges: INHABIT_BADGES,
    badgeGroups: INHABIT_BADGE_GROUPS,
    questOptions: INHABIT_QUEST_OPTIONS,
    lessonDefault: {
      firstWorldId: 'types',
      openingCount: 4,
      isIntroducing: (_w, l, index) =>
        index === 0 || (l.unlocks?.codex?.length ?? 0) > 0 || (l.unlocks?.tactics?.length ?? 0) > 0,
    },
    afterAllWorlds: {
      href: inhabitHref.workshop(),
      title: 'Prove a theorem of your own',
      reason: 'You have finished every world on the map. Take an idea into the Workshop.',
      cta: 'Open the Workshop',
      icon: 'workshop',
    },
  },

  hooks: {
    renderStuckHelp: (p) => {
      const ctx = data.levelContext(p.levelId);
      return (
        <StuckHelp
          level={p.level as LeanLevel}
          levelId={p.levelId}
          ctx={ctx}
          strict={p.strict}
          hints={p.hints}
          live={(p.live as LiveState | null) ?? null}
          revealed={p.revealed}
          onRevealHint={p.onRevealHint}
          toolUsed={p.toolUsed}
          onUseTool={p.onUseTool}
          failedChecks={p.failedChecks}
          canShowSolution={p.canShowSolution}
          onShowSolution={p.onShowSolution}
          finished={p.finished}
          leading={p.leading}
        />
      );
    },
    renderInventory: (p) => {
      const ctx = data.levelContext(p.levelId);
      return <Inventory ctx={ctx} onInsert={p.onInsert} onClose={p.onClose} />;
    },
    renderCodexExtras: (entry) => {
      const c = entry as unknown as CodexEntry;
      if (!c.term) return null;
      return (
        <>
          <div className="label">The term it builds</div>
          <pre className="code">
            <code dangerouslySetInnerHTML={{ __html: highlightHtml(c.term) }} />
          </pre>
        </>
      );
    },
    filterHints: (hints, level) => hints.filter((h) => !hintRevealsSolution(h.text, level as LeanLevel)),
    renderSuccessExtras: ({ levelId, level, mode, outcome }) => {
      const l = level as LeanLevel;
      const canShare = (l.kind === 'proof' || l.kind === 'parsons') && !!outcome.body && !outcome.studied;
      const english = l.kind === 'proof' || l.kind === 'parsons' ? l.english : undefined;
      const source = canShare
        ? [l.setup, `${l.header}\n${outcome.body}${l.kind === 'proof' && l.after ? `\n${l.after}` : ''}`].filter(Boolean).join('\n')
        : '';
      return (
        <div className="actions">
          {canShare && <ShareButton card={{ kind: 'level', ref: levelId, title: l.title, english, source }} />}
          {canShare && <OpenInLean source={source} />}
          {mode === 'play' && <PracticeOffer levelId={levelId} when={outcome.studied ? 'studied' : 'after'} />}
        </div>
      );
    },
    renderAfterSuccess: AfterHint,
    introducedChips: (level) => {
      const l = level as LeanLevel;
      return [...(l.unlocks?.tactics ?? []), ...(l.unlocks?.lemmas ?? [])];
    },
    extraBanners: FixtureBanner,
    dashboardCards: [DailyCard],
    playerCardStats: ArenaPlayerCardStat,
    profileStats: ArenaProfileStat,
    extraSettings: StrictInventorySetting,
    useRecommendExtras: () => {
      const arena = useArenaSummary();
      const player = usePlayer();
      return {
        dailyDone: player.starsMax > 0 ? arena.dailyDone : null,
        // The precomputed list, not hasPractice(): that runs the puzzle generator, on every dashboard render.
        practiceable: (id) => practiceLevels.has(id),
        practiceLink: (id) => inhabitHref.practice(id),
        dailyLink: inhabitHref.arena('daily'),
        workshopLink: inhabitHref.workshop(),
      };
    },
    defaultSandbox: DEFAULT_INHABIT_SANDBOX,
  },

  firstSteps: {
    levelId: 'types-01',
    steps: [
      { target: '.wtp', title: '1 of 3', text: <>This is the task: the sentence, and the Lean line that says it.</> },
      {
        target: '.editor-panel .editor',
        title: '2 of 3',
        text: (
          <>
            The gray line <code>example : Nat :=</code> means &ldquo;give me something of type <code>Nat</code>.&rdquo; Type your answer here, in place of <code>sorry</code>.
          </>
        ),
      },
      {
        target: '.infoview',
        title: '3 of 3',
        text: (
          <>
            Lean checks as you type, so there's no Submit button. This panel shows what's still needed and turns to &ldquo;solved&rdquo; when you're right.
          </>
        ),
      },
    ],
  },
};

export const disc = inhabitDisc;
export default inhabitDisc;
