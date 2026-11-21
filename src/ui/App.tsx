import { exhibitById } from '../gallery/registry.ts';
import { lazy, Suspense, useEffect } from 'react';
import { useRoute, href, type Route } from './router.ts';
import { ErrorBoundary } from './hooks.tsx';
import { game, useGame } from './game.ts';
import { data, getCodex, loadLessons } from './data.ts';
import { Toasts } from './components/Toasts.tsx';
import { Shell } from './shell/Shell.tsx';
import { EmptyState } from './components/kit.tsx';
import { HomeScreen } from './screens/Home.tsx';
import { chapterFor } from '../content/chapters/index.ts';
import { guideMeta } from '../content/guideMeta.ts';

// Everything except Home loads on demand. Each loader is also used to prefetch after first paint.
const loaders = {
  map: () => import('./screens/MapScreen.tsx').then((m) => ({ default: m.MapScreen })),
  world: () => loadLessons().then(() => import('./screens/WorldScreen.tsx').then((m) => ({ default: m.WorldScreen }))),
  level: () => loadLessons().then(() => import('./screens/LevelScreen.tsx').then((m) => ({ default: m.LevelScreen }))),
  review: () => loadLessons().then(() => import('./screens/ReviewScreen.tsx').then((m) => ({ default: m.ReviewScreen }))),
  codex: () => import('./screens/CodexScreen.tsx').then((m) => ({ default: m.CodexScreen })),
  sandbox: () => import('./screens/SandboxScreen.tsx').then((m) => ({ default: m.SandboxScreen })),
  workshop: () => import('./screens/WorkshopScreen.tsx').then((m) => ({ default: m.WorkshopScreen })),
  graduate: () => import('./screens/GraduateScreen.tsx').then((m) => ({ default: m.GraduateScreen })),
  profile: () => import('./screens/ProfileScreen.tsx').then((m) => ({ default: m.ProfileScreen })),
  about: () => import('./screens/About.tsx').then((m) => ({ default: m.AboutScreen })),
  guide: () => import('./screens/GuideScreen.tsx').then((m) => ({ default: m.GuideScreen })),
  gallery: () => import('./screens/GalleryScreen.tsx').then((m) => ({ default: m.GalleryScreen })),
  arena: () => import('./arena/ArenaScreen.tsx').then((m) => ({ default: m.ArenaScreen })),
  share: () => import('./arena/ShareScreen.tsx').then((m) => ({ default: m.ShareScreen })),
  practice: () => import('./practice/PracticeScreen.tsx').then((m) => ({ default: m.PracticeScreen })),
  chapter: () => import('./screens/ChapterScreen.tsx').then((m) => ({ default: m.ChapterScreen })),
};
const MapScreen = lazy(loaders.map);
const WorldScreen = lazy(loaders.world);
const LevelScreen = lazy(loaders.level);
const ReviewScreen = lazy(loaders.review);
const CodexScreen = lazy(loaders.codex);
const SandboxScreen = lazy(loaders.sandbox);
const WorkshopScreen = lazy(loaders.workshop);
const GraduateScreen = lazy(loaders.graduate);
const ProfileScreen = lazy(loaders.profile);
const AboutScreen = lazy(loaders.about);
const GuideScreen = lazy(loaders.guide);
const GalleryScreen = lazy(loaders.gallery);
const ArenaScreen = lazy(loaders.arena);
const ShareScreen = lazy(loaders.share);
const PracticeScreen = lazy(loaders.practice);
const ChapterScreen = lazy(loaders.chapter);

/** After first paint, quietly fetch the screens a new player reaches first. */
function prefetchSoon() {
  const run = () => [loaders.level, loaders.map, loaders.world].forEach((f) => void f().catch(() => {}));
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(run, { timeout: 3000 });
  else setTimeout(run, 1200);
}

/** Same footprint as a screen, so nothing jumps while a chunk arrives. */
function ScreenFallback() {
  return <div className="page" aria-busy="true" style={{ minHeight: '60vh' }} />;
}

const SITE = 'Inhabit';
const HOME_TITLE = 'Inhabit — learn Lean 4, the theorem prover, by playing';
const PAGE_TITLES: Record<string, string> = {
  map: 'Map', about: 'About', review: 'Review', codex: 'Codex', sandbox: 'Sandbox', workshop: 'Workshop', graduate: 'Graduate', profile: 'Profile', guide: 'Guide', arena: 'Arena', share: 'Shared proof', practice: 'Practice',
};

function titleFor(route: Route): string {
  switch (route.name) {
    case 'home': return HOME_TITLE;
    case 'level': return `${data.findLevel(route.id)?.level.title ?? 'Level'} · ${SITE}`;
    case 'world': return `${data.worlds.find((w) => w.id === route.id)?.title ?? 'Region'} · ${SITE}`;
    case 'chapter': return `${chapterFor(route.id)?.title ?? data.worlds.find((w) => w.id === route.id)?.title ?? 'Chapter'} · ${SITE}`;
    case 'gallery': return `${route.id ? (exhibitById(route.id)?.title ?? 'Gallery') : 'Gallery'} · ${SITE}`;
    case 'guide': return `${route.id ? (guideMeta.find((a) => a.id === route.id)?.title ?? 'Guide') : 'Guide'} · ${SITE}`;
    case 'codex': return `${route.id ? (getCodex(route.id)?.name ?? 'Codex') : 'Codex'} · ${SITE}`;
    case 'notfound': return `Not found · ${SITE}`;
    default: return `${PAGE_TITLES[route.name]} · ${SITE}`;
  }
}

function useSettingsEffect() {
  const s = useGame((x) => x.save.settings);
  useEffect(() => {
    const el = document.documentElement;
    if (s.theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', s.theme);
    el.setAttribute('data-motion', s.motion);
    el.style.setProperty('--editor-font', `${s.fontSize}px`);
  }, [s.theme, s.motion, s.fontSize]);
}

export function App() {
  const route = useRoute();
  const storageError = useGame((s) => s.storageError);
  useSettingsEffect();
  useEffect(() => {
    game().touch();
    prefetchSoon();
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const key = JSON.stringify(route);
  useEffect(() => {
    document.title = titleFor(route);
  }, [route]);
  let screen;
  {
    switch (route.name) {
      case 'home': screen = <HomeScreen />; break;
      case 'about': screen = <AboutScreen />; break;
      case 'map': screen = <MapScreen />; break;
      case 'world': screen = <WorldScreen id={route.id} />; break;
      case 'level': screen = <LevelScreen id={route.id} />; break;
      case 'chapter': screen = <ChapterScreen id={route.id} />; break;
      case 'review': screen = <ReviewScreen />; break;
      case 'codex': screen = <CodexScreen focus={route.id} />; break;
      case 'sandbox': screen = <SandboxScreen />; break;
      case 'workshop': screen = <WorkshopScreen />; break;
      case 'graduate': screen = <GraduateScreen />; break;
      case 'profile': screen = <ProfileScreen />; break;
      case 'guide': screen = <GuideScreen id={route.id} />; break;
      case 'gallery': screen = <GalleryScreen id={route.id} />; break;
      case 'share': screen = <ShareScreen code={route.code} />; break;
      case 'practice': screen = <PracticeScreen id={route.id} />; break;
      case 'arena': screen = <ArenaScreen sub={route.sub} arg={route.arg} />; break;
      default:
        screen = (
          <div className="page narrow"><EmptyState glyph="?" title="Nothing here" action={<a className="btn primary" href={href.map()}>Back to the map</a>}>That page does not exist.</EmptyState></div>
        );
    }
  }
  const banners = (
    <>
      {data.fixtures && <div className="fixture-banner">Fixture mode: fake engine and sample levels. <a href="?fixtures=0#/">Switch to real content</a></div>}
      {storageError && <div className="fixture-banner warn">Your browser is not letting Inhabit save progress. Export your save from Profile to keep it.</div>}
    </>
  );
  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Shell route={route} banners={banners}>
        <main id="main" tabIndex={-1}>
          <ErrorBoundary resetKey={key}><Suspense fallback={<ScreenFallback />}>{screen}</Suspense></ErrorBoundary>
        </main>
      </Shell>
      <Toasts />
    </>
  );
}
