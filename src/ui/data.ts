/**
 * The single data layer the UI talks to. In production it is the real engine + real content.
 * With `?fixtures=1` (remembered for the tab session) it is a fake engine + fixture worlds.
 */
import { engine as realEngine } from '../engine/index.ts';
import type { Engine, Env, CheckOptions, CheckResult } from '../engine/types.ts';
import * as content from '../content/index.ts';
import type { LevelContext } from '../content/index.ts';
import { ideas as realIdeas } from '../content/ideas.ts';
import { graduate as realGraduate, phrasebook as realPhrasebook } from '../content/graduate.ts';
import * as realEnv from '../game/env.ts';
import type { LevelSession, Assembled } from '../game/env.ts';
import type { CodexEntry, GraduateSection, GuideArticle, GuideSection, Lemma, Level, LevelLesson, PhrasebookRow, ScreenId, ScreenIntro, TheoremIdea, World, WorldLessons } from '../content/types.ts';
import { levelLesson as realLevelLesson, worldLessons as realWorldLessons } from '../content/lessons/index.ts';
import { guide as realGuide, guideSections as realGuideSections } from '../content/guide.ts';
import { screens as realScreens } from '../content/screens.ts';
import { fakeEngine } from './dev/fakeEngine.ts';
import { fxGraduate, fxIdeas, fxPhrasebook, fxWorlds } from './dev/fixtures.ts';
import { fxGuide, fxLessons, fxScreens } from './dev/proseFixtures.ts';

export interface Catalog {
  fixtures: boolean;
  storageKey: string;
  engine: Engine;
  worlds: World[];
  ideas: TheoremIdea[];
  graduate: GraduateSection[];
  phrasebook: PhrasebookRow[];
  allCodex: CodexEntry[];
  allLemmas: Lemma[];
  findLevel(id: string): { world: World; level: Level; index: number } | undefined;
  levelContext(id: string): LevelContext;
  levelSession(id: string, strict: boolean): LevelSession;
  checkBody(s: LevelSession, body: string): { result: CheckResult; assembled: Assembled };
  fullEnv(): Env;
  envWithLemmas(l: Lemma[]): Env;
  /** Prose layers (SPEC §9). Empty strings count as missing: these return undefined for them. */
  levelLesson(levelId: string): LevelLesson | undefined;
  worldLessons(worldId: string): { primer?: string; recap?: string } | undefined;
  guide: GuideArticle[];
  guideSections: { id: GuideSection; title: string; blurb: string }[];
  screen(id: ScreenId): ScreenIntro | undefined;
}

const nonEmpty = (s: string | undefined): string | undefined => (s && s.trim() ? s : undefined);

function proseAccess(lessonOf: (id: string) => LevelLesson | undefined, worldOf: (id: string) => WorldLessons | undefined, screens: Partial<Record<ScreenId, ScreenIntro>>) {
  return {
    levelLesson(id: string): LevelLesson | undefined {
      const l = lessonOf(id);
      if (!l || !nonEmpty(l.body)) return undefined;
      return { body: l.body, pitfall: nonEmpty(l.pitfall), realLean: nonEmpty(l.realLean) };
    },
    worldLessons(id: string) {
      const w = worldOf(id);
      if (!w) return undefined;
      const primer = nonEmpty(w.primer);
      const recap = nonEmpty(w.recap);
      return primer || recap ? { primer, recap } : undefined;
    },
    screen(id: ScreenId): ScreenIntro | undefined {
      const s = screens[id];
      return s && nonEmpty(s.title) ? s : undefined;
    },
  };
}

export function wantsFixtures(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('fixtures') === '1') {
      sessionStorage.setItem('inhabit.fixtures', '1');
      return true;
    }
    if (q.get('fixtures') === '0') {
      sessionStorage.removeItem('inhabit.fixtures');
      return false;
    }
    return sessionStorage.getItem('inhabit.fixtures') === '1';
  } catch {
    return false;
  }
}

function buildFixtureCatalog(): Catalog {
  const worlds = fxWorlds;
  const eng = fakeEngine;
  const byId = new Map(worlds.map((w) => [w.id, w]));
  const prereq = (id: string): World[] => {
    const seen = new Set<string>();
    const visit = (i: string) => byId.get(i)?.requires.forEach((r) => !seen.has(r) && (seen.add(r), visit(r)));
    visit(id);
    return worlds.filter((w) => seen.has(w.id));
  };
  const allLemmas = worlds.flatMap((w) => w.lemmas);
  const allCodex = worlds.flatMap((w) => w.codex);
  const findLevel: Catalog['findLevel'] = (id) => {
    for (const world of worlds) {
      const index = world.levels.findIndex((l) => l.id === id);
      if (index >= 0) return { world, level: world.levels[index], index };
    }
    return undefined;
  };
  const levelContext: Catalog['levelContext'] = (id) => {
    const f = findLevel(id);
    if (!f) throw new Error(`Unknown level ${id}`);
    const tactics = new Set<string>();
    const lem = new Set<string>();
    const codex = new Set<string>();
    const absorb = (l: Level, cur: boolean) => {
      l.unlocks?.tactics?.forEach((t) => tactics.add(t));
      l.unlocks?.codex?.forEach((c) => codex.add(c));
      l.grants?.forEach((g) => lem.add(g));
      if (!cur) l.unlocks?.lemmas?.forEach((n) => lem.add(n));
    };
    prereq(f.world.id).forEach((w) => w.levels.forEach((l) => absorb(l, false)));
    f.world.levels.slice(0, f.index).forEach((l) => absorb(l, false));
    absorb(f.level, true);
    if (f.level.kind === 'proof') f.level.extraTactics?.forEach((t) => tactics.add(t));
    return { ...f, lemmas: allLemmas.filter((l) => lem.has(l.name)), allowedTactics: [...tactics], codex: [...codex] };
  };
  const envWithLemmas = (ls: Lemma[]) => ls.reduce((e, l) => eng.extend(e, l.source).env, eng.baseEnv());
  return {
    fixtures: true,
    storageKey: 'inhabit.fixtures.save',
    engine: eng,
    worlds,
    ideas: fxIdeas,
    graduate: fxGraduate,
    phrasebook: fxPhrasebook,
    allCodex,
    allLemmas,
    findLevel,
    levelContext,
    levelSession(id, strict) {
      const ctx = levelContext(id);
      const options: CheckOptions = {};
      const l = ctx.level;
      if (l.kind === 'proof' && l.mode === 'term') options.allowedTactics = [];
      else if (strict) options.allowedTactics = ctx.allowedTactics;
      if (l.kind === 'proof' && l.forbidden?.length) options.forbiddenNames = l.forbidden;
      return { ctx, env: envWithLemmas(ctx.lemmas), options };
    },
    checkBody(s, body) {
      const l = s.ctx.level;
      if (l.kind !== 'proof' && l.kind !== 'parsons') throw new Error('no body');
      const assembled = realEnv.assemble({ setup: l.setup, header: l.header, after: l.kind === 'proof' ? l.after : undefined }, body);
      return { result: eng.check(s.env, assembled.source, s.options), assembled };
    },
    fullEnv: () => envWithLemmas(allLemmas),
    envWithLemmas,
    ...proseAccess((id) => fxLessons.flatMap((w) => (w.levels[id] ? [w.levels[id]] : []))[0], (id) => fxLessons.find((w) => w.worldId === id), fxScreens),
    guide: fxGuide,
    guideSections: realGuideSections,
  };
}

function buildRealCatalog(): Catalog {
  return {
    fixtures: false,
    storageKey: 'inhabit.save',
    engine: realEngine,
    worlds: content.worlds,
    ideas: realIdeas,
    graduate: realGraduate,
    phrasebook: realPhrasebook,
    allCodex: content.allCodex,
    allLemmas: content.allLemmas,
    findLevel(id) {
      try {
        return content.findLevel(id);
      } catch {
        return undefined;
      }
    },
    levelContext: content.levelContext,
    levelSession: realEnv.levelSession,
    checkBody: realEnv.checkBody,
    fullEnv: realEnv.fullEnv,
    envWithLemmas: realEnv.envWithLemmas,
    ...proseAccess(realLevelLesson, realWorldLessons, realScreens),
    guide: realGuide,
    guideSections: realGuideSections,
  };
}

export const data: Catalog = wantsFixtures() ? buildFixtureCatalog() : buildRealCatalog();
export const engine = data.engine;
export const getCodex = (id: string): CodexEntry | undefined => data.allCodex.find((c) => c.id === id);
export const getArticle = (id: string): GuideArticle | undefined => data.guide.find((a) => a.id === id);
export const getLemma = (name: string): Lemma | undefined => data.allLemmas.find((l) => l.name === name);
