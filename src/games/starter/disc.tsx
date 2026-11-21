import './starter.css';
import { useState } from 'react';
import {
  CORE_BADGES,
  CodeBlock,
  type GameDisc,
  type IconName,
  type RankDef,
} from '../../template/index.ts';
import {
  starterAbout,
  starterChapters,
  starterChaptersMeta,
  starterGuideArticles,
  starterGuideMeta,
  starterGuideSections,
  starterHome,
  starterLessons,
  starterScreens,
  starterWorldLessons,
  starterWorlds,
} from './content.ts';
import { meta } from './meta.ts';
import { PatternLevelView, evaluatePattern, type PatternLevel } from './PatternLevel.tsx';

function PatternLogo() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="28" height="28" rx="8" fill="var(--primary)" />
      <path
        d="M8.5 9.5L13 6.5M8.5 9.5L19.5 9.5M8.5 9.5L11.5 21M16.5 21.5L20 12.5"
        stroke="var(--primary-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="19.5" cy="9.5" r="2.1" fill="var(--gold)" />
    </svg>
  );
}

const PREVIEW_SAMPLES = ['CS-101', 'MATH-240', 'cs-101', 'A-99'];

function HeroPatternDemo({ cta }: { cta: React.ReactNode }) {
  const [expr, setExpr] = useState('[A-Z]{2,4}-\\d{3}');
  const res = evaluatePattern(expr, {
    anchorFull: true,
    positive: ['CS-101', 'MATH-240'],
    negative: ['cs-101', 'A-99'],
  });
  return (
    <div className="pc-preview-hero" aria-label="Interactive regular expression preview">
      <div className="pc-case-label">Live pattern preview · Whole string match</div>
      <div className="pc-regex-row">
        <span className="pc-slash">/</span>
        <input
          className="pc-input"
          aria-label="Try editing the preview regular expression"
          value={expr}
          spellCheck={false}
          onChange={(e) => setExpr(e.target.value)}
        />
        <span className="pc-slash">/</span>
      </div>
      {!res.valid ? (
        <div className="feedback wrong">{res.error}</div>
      ) : (
        <ul className="pc-case-list">
          {PREVIEW_SAMPLES.map((s) => {
            const c = res.cases.find((x) => x.sample === s)!;
            const matched = c.matchStart >= 0;
            return (
              <li key={s} className={`pc-case ${c.passed ? 'pass' : 'fail'}`}>
                <span className="pc-case-sample">{s}</span>
                <span className={`pc-badge ${matched ? 'ok' : 'no'}`}>
                  {matched ? 'Matches' : 'No match'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="actions" style={{ margin: 0 }}>{cta}</div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightRegex(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '\\' && i + 1 < code.length) {
      out += `<span class="pc-tok-kw">${escapeHtml(code.slice(i, i + 2))}</span>`;
      i += 2;
    } else if (ch === '^' || ch === '$' || ch === '+' || ch === '*' || ch === '?' || ch === '|') {
      out += `<span class="pc-tok-op">${escapeHtml(ch)}</span>`;
      i++;
    } else if (ch === '[' || ch === ']' || ch === '{' || ch === '}' || ch === '(' || ch === ')') {
      out += `<span class="pc-tok-ty">${escapeHtml(ch)}</span>`;
      i++;
    } else {
      out += escapeHtml(ch);
      i++;
    }
  }
  return out;
}

const STARTER_RANKS: readonly RankDef[] = [
  { xp: 0, title: 'Apprentice' },
  { xp: 40, title: 'Matcher' },
  { xp: 100, title: 'Lexer' },
  { xp: 180, title: 'Patternsmith' },
];

const STARTER_BADGE_GROUPS: { id: string; title: string; icon: IconName }[] = [
  { id: 'path', title: 'Progress', icon: 'map' },
  { id: 'craft', title: 'Precision', icon: 'sparkle' },
  { id: 'memory', title: 'Retention', icon: 'review' },
  { id: 'reading', title: 'Reading', icon: 'guide' },
];

export const starterDisc: GameDisc = {
  brand: {
    id: meta.id,
    name: meta.name,
    homeTitle: meta.homeTitle,
    description: meta.description,
    logo: PatternLogo,
    storageKey: meta.storageKey,
    mapViewKey: 'patterncraft.mapView',
    saveAppId: 'patterncraft',
    footerNote: 'Patterncraft starter disc · Powered by the generic game template.',
  },
  theme: {
    preset: 'terracotta',
    defaultMode: 'dark',
    allowPalettePicker: true,
    worldVisuals: {
      literals: { glyph: '^$', hue: 18 },
      classes: { glyph: '[+]', hue: 38 },
    },
  },
  worlds: starterWorlds,
  allCodex: starterWorlds.flatMap((w) => w.codex),
  codexKinds: [
    { id: 'concept', label: 'Concepts' },
    { id: 'metachar', label: 'Metacharacters' },
    { id: 'syntax', label: 'Syntax' },
  ],
  findLevel: (id) => {
    for (const world of starterWorlds) {
      const index = world.levels.findIndex((l) => l.id === id);
      if (index >= 0) return { world, level: world.levels[index], index };
    }
    return undefined;
  },

  lessons: {
    forLevel: (id) => starterLessons[id],
    forWorld: (id) => starterWorldLessons[id],
  },
  chapters: {
    meta: starterChaptersMeta,
    loadAll: async () => starterChapters,
  },
  guide: {
    sections: starterGuideSections,
    meta: starterGuideMeta,
    loadArticles: async () => starterGuideArticles,
  },
  gallery: {
    groups: [{ id: 'sandbox', title: 'Pattern Sandbox', blurb: 'Test any regular expression live against sample text.' }],
    exhibits: [
      {
        id: 'regex-playground',
        title: 'Live Regex Playground',
        tagline: 'Type patterns and inspect every match span.',
        worlds: ['literals', 'classes'],
        glyph: '.*',
        group: 'sandbox',
        minutes: 2,
      },
    ],
    loadExhibit: () => import('./RegexPlayground.tsx'),
  },

  home: starterHome,
  heroWidget: HeroPatternDemo,
  about: starterAbout,
  screenIntro: (id) => starterScreens[id],

  levelKinds: {
    pattern: {
      label: 'Pattern Match',
      icon: 'sparkle',
      baseXp: 25,
      solutionText: (l) => (l as PatternLevel).solutions[0] ?? null,
      renderSolution: (solution, _l, api) => (
        <>
          <CodeBlock code={`/${solution}/`} lang="regex" />
          {api.current.setBody && (
            <button type="button" className="btn small" onClick={() => api.current.setBody?.(solution)}>
              Copy into pattern box
            </button>
          )}
        </>
      ),
      render: PatternLevelView,
    },
  },

  code: {
    highlightHtml: highlightRegex,
    fenceLabels: {
      regex: { className: 'real', label: 'Regex' },
    },
  },

  progression: {
    ranks: STARTER_RANKS,
    badges: CORE_BADGES,
    badgeGroups: STARTER_BADGE_GROUPS,
    questOptions: { hasArena: false, hasPractice: false, hasGuide: true },
    lessonDefault: {
      firstWorldId: 'literals',
      openingCount: 2,
      isIntroducing: (_w, l, index) => index === 0 || (l.unlocks?.codex?.length ?? 0) > 0,
    },
  },
};

export const disc = starterDisc;
export default starterDisc;
