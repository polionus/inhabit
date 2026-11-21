import { lazy, Suspense, useEffect, useMemo, type ComponentType, type LazyExoticComponent } from 'react';
import { DiscProvider, initDisc } from './context.tsx';
import { href, useRoute, type Route } from './router.ts';
import { ErrorBoundary } from './hooks.tsx';
import { game, initStore, useGame } from './store.ts';
import { applyTheme } from './theme/index.ts';
import type { ExtraScreenDef, GameDisc } from './types.ts';
import { Toasts } from './components/Toasts.tsx';
import { Shell } from './shell/Shell.tsx';
import { EmptyState } from './components/kit.tsx';
import { HomeScreen } from './screens/Home.tsx';

const coreLoaders = {
  map: () => import('./screens/MapScreen.tsx').then((m) => ({ default: m.MapScreen })),
  world: () => import('./screens/WorldScreen.tsx').then((m) => ({ default: m.WorldScreen })),
  level: () => import('./screens/LevelScreen.tsx').then((m) => ({ default: m.LevelScreen })),
  review: () => import('./screens/ReviewScreen.tsx').then((m) => ({ default: m.ReviewScreen })),
  codex: () => import('./screens/CodexScreen.tsx').then((m) => ({ default: m.CodexScreen })),
  profile: () => import('./screens/ProfileScreen.tsx').then((m) => ({ default: m.ProfileScreen })),
  about: () => import('./screens/About.tsx').then((m) => ({ default: m.AboutScreen })),
  guide: () => import('./screens/GuideScreen.tsx').then((m) => ({ default: m.GuideScreen })),
  gallery: () => import('./screens/GalleryScreen.tsx').then((m) => ({ default: m.GalleryScreen })),
  chapter: () => import('./screens/ChapterScreen.tsx').then((m) => ({ default: m.ChapterScreen })),
};

const MapScreen = lazy(coreLoaders.map);
const CodexScreen = lazy(coreLoaders.codex);
const ProfileScreen = lazy(coreLoaders.profile);
const AboutScreen = lazy(coreLoaders.about);
const GuideScreen = lazy(coreLoaders.guide);
const GalleryScreen = lazy(coreLoaders.gallery);
const ChapterScreen = lazy(coreLoaders.chapter);

const withLessons = <T,>(disc: GameDisc, load: () => Promise<T>): (() => Promise<T>) =>
  () => (disc.lessons?.load ? disc.lessons.load().then(load) : load());

const extraComponentCache = new WeakMap<ExtraScreenDef, LazyExoticComponent<ComponentType<{ sub?: string; arg?: string }>>>();

function lazyExtraComponent(def: ExtraScreenDef): LazyExoticComponent<ComponentType<{ sub?: string; arg?: string }>> {
  let cached = extraComponentCache.get(def);
  if (!cached) {
    cached = lazy(def.load);
    extraComponentCache.set(def, cached);
  }
  return cached;
}

/** After first paint, quietly fetch the screens a new player reaches first. */
function prefetchSoon(disc: GameDisc) {
  const run = () => {
    void (disc.lessons?.load?.() ?? Promise.resolve()).catch(() => {});
    void coreLoaders.level().catch(() => {});
    void coreLoaders.map().catch(() => {});
    void coreLoaders.world().catch(() => {});
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(run, { timeout: 3000 });
  else setTimeout(run, 1200);
}

/** Same footprint as a screen, so nothing jumps while a chunk arrives. */
function ScreenFallback() {
  return <div className="page" aria-busy="true" style={{ minHeight: '60vh' }} />;
}

const PAGE_TITLES: Record<string, string> = {
  map: 'Map',
  about: 'About',
  review: 'Review',
  codex: 'Codex',
  profile: 'Profile',
  guide: 'Guide',
  gallery: 'Gallery',
};

function titleFor(route: Route, disc: GameDisc): string {
  const site = disc.brand.name;
  switch (route.name) {
    case 'home':
      return disc.brand.homeTitle;
    case 'level':
      return `${disc.findLevel(route.id)?.level.title ?? 'Level'} · ${site}`;
    case 'world':
      return `${disc.worlds.find((w) => w.id === route.id)?.title ?? 'Region'} · ${site}`;
    case 'chapter': {
      const ch = disc.chapters?.meta.find((c) => c.worldId === route.id)?.title;
      const w = disc.worlds.find((x) => x.id === route.id)?.title;
      return `${ch ?? w ?? 'Chapter'} · ${site}`;
    }
    case 'gallery': {
      const ex = route.id ? disc.gallery?.exhibits.find((e) => e.id === route.id)?.title : undefined;
      return `${ex ?? 'Gallery'} · ${site}`;
    }
    case 'guide': {
      const art = route.id ? disc.guide?.meta.find((a) => a.id === route.id)?.title : undefined;
      return `${art ?? 'Guide'} · ${site}`;
    }
    case 'codex': {
      const entry = route.id ? disc.allCodex.find((c) => c.id === route.id)?.name : undefined;
      return `${entry ?? 'Codex'} · ${site}`;
    }
    case 'extra': {
      const def = disc.extraScreens?.find((s) => s.name === route.screen);
      const t = def?.title?.(route.sub, route.arg) ?? def?.nav?.label ?? route.screen;
      return `${t} · ${site}`;
    }
    case 'notfound':
      return `Not found · ${site}`;
    default:
      return `${PAGE_TITLES[route.name] ?? site} · ${site}`;
  }
}

function useSettingsEffect(disc: GameDisc) {
  const s = useGame((x) => x.save.settings);
  useEffect(() => {
    const storageKey = disc.brand.storageKey ?? `${disc.brand.id}.save`;
    applyTheme(disc.theme, s.theme, s.palette, storageKey);
    const el = document.documentElement;
    el.setAttribute('data-motion', s.motion);
    el.style.setProperty('--editor-font', `${s.fontSize}px`);
  }, [disc.theme, disc.brand.id, disc.brand.storageKey, s.theme, s.palette, s.motion, s.fontSize]);
}

function GameAppInner({ disc }: { disc: GameDisc }) {
  const extraNames = useMemo(() => new Set((disc.extraScreens ?? []).map((s) => s.name)), [disc.extraScreens]);
  const route = useRoute(extraNames);
  const storageError = useGame((s) => s.storageError);

  const WorldScreen = useMemo(() => lazy(withLessons(disc, coreLoaders.world)), [disc]);
  const LevelScreen = useMemo(() => lazy(withLessons(disc, coreLoaders.level)), [disc]);
  const ReviewScreen = useMemo(() => lazy(withLessons(disc, coreLoaders.review)), [disc]);

  useSettingsEffect(disc);
  useEffect(() => {
    game().touch();
    prefetchSoon(disc);
  }, [disc]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const key = JSON.stringify(route);
  useEffect(() => {
    document.title = titleFor(route, disc);
  }, [route, disc]);

  let screen;
  switch (route.name) {
    case 'home':
      screen = <HomeScreen />;
      break;
    case 'about':
      screen = <AboutScreen />;
      break;
    case 'map':
      screen = <MapScreen />;
      break;
    case 'world':
      screen = <WorldScreen id={route.id} />;
      break;
    case 'level':
      screen = <LevelScreen id={route.id} />;
      break;
    case 'chapter':
      screen = <ChapterScreen id={route.id} />;
      break;
    case 'review':
      screen = <ReviewScreen />;
      break;
    case 'codex':
      screen = <CodexScreen focus={route.id} />;
      break;
    case 'profile':
      screen = <ProfileScreen />;
      break;
    case 'guide':
      screen = <GuideScreen id={route.id} />;
      break;
    case 'gallery':
      screen = <GalleryScreen id={route.id} />;
      break;
    case 'extra': {
      const def = disc.extraScreens?.find((s) => s.name === route.screen);
      if (def) {
        const Extra = lazyExtraComponent(def);
        screen = <Extra sub={route.sub} arg={route.arg} />;
      } else {
        screen = (
          <div className="page narrow">
            <EmptyState glyph="?" title="Nothing here" action={<a className="btn primary" href={href.map()}>Back to the map</a>}>
              That page does not exist.
            </EmptyState>
          </div>
        );
      }
      break;
    }
    default:
      screen = (
        <div className="page narrow">
          <EmptyState glyph="?" title="Nothing here" action={<a className="btn primary" href={href.map()}>Back to the map</a>}>
            That page does not exist.
          </EmptyState>
        </div>
      );
  }

  const ExtraBanners = disc.hooks?.extraBanners;
  const storageWarning =
    disc.brand.storageErrorText ??
    `Your browser is not letting ${disc.brand.name} save progress. Export your save from Profile to keep it.`;
  const banners = (
    <>
      {ExtraBanners && <ExtraBanners />}
      {storageError && <div className="fixture-banner warn">{storageWarning}</div>}
    </>
  );

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <Shell route={route} banners={banners}>
        <main id="main" tabIndex={-1}>
          <ErrorBoundary resetKey={key}><Suspense fallback={<ScreenFallback />}>{screen}</Suspense></ErrorBoundary>
        </main>
      </Shell>
      <Toasts />
    </>
  );
}

export function GameApp({ disc }: { disc: GameDisc }) {
  initDisc(disc);
  initStore(disc);
  return (
    <DiscProvider value={disc}>
      <GameAppInner disc={disc} />
    </DiscProvider>
  );
}
