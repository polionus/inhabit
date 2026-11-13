import { useEffect } from 'react';
import { useRoute, href, type Route } from './router.ts';
import { ErrorBoundary } from './hooks.tsx';
import { game, useGame } from './game.ts';
import { data, getCodex } from './data.ts';
import { Toasts } from './components/Toasts.tsx';
import { Shell } from './shell/Shell.tsx';
import { EmptyState } from './components/kit.tsx';
import { MapScreen } from './screens/MapScreen.tsx';
import { WorldScreen } from './screens/WorldScreen.tsx';
import { LevelScreen } from './screens/LevelScreen.tsx';
import { ReviewScreen } from './screens/ReviewScreen.tsx';
import { CodexScreen } from './screens/CodexScreen.tsx';
import { SandboxScreen } from './screens/SandboxScreen.tsx';
import { WorkshopScreen } from './screens/WorkshopScreen.tsx';
import { GraduateScreen } from './screens/GraduateScreen.tsx';
import { ProfileScreen } from './screens/ProfileScreen.tsx';
import { HomeScreen } from './screens/Home.tsx';
import { AboutScreen } from './screens/About.tsx';
import { GuideScreen } from './screens/GuideScreen.tsx';
import { ArenaScreen } from './arena/ArenaScreen.tsx';
import { ShareScreen } from './arena/ShareScreen.tsx';

const SITE = 'Inhabit';
const HOME_TITLE = 'Inhabit — learn Lean 4, the theorem prover, by playing';
const PAGE_TITLES: Record<string, string> = {
  map: 'Map', about: 'About', review: 'Review', codex: 'Codex', sandbox: 'Sandbox', workshop: 'Workshop', graduate: 'Graduate', profile: 'Profile', guide: 'Guide', arena: 'Arena', share: 'Shared proof',
};

function titleFor(route: Route): string {
  switch (route.name) {
    case 'home': return HOME_TITLE;
    case 'level': return `${data.findLevel(route.id)?.level.title ?? 'Level'} · ${SITE}`;
    case 'world': return `${data.worlds.find((w) => w.id === route.id)?.title ?? 'Region'} · ${SITE}`;
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
      case 'review': screen = <ReviewScreen />; break;
      case 'codex': screen = <CodexScreen focus={route.id} />; break;
      case 'sandbox': screen = <SandboxScreen />; break;
      case 'workshop': screen = <WorkshopScreen />; break;
      case 'graduate': screen = <GraduateScreen />; break;
      case 'profile': screen = <ProfileScreen />; break;
      case 'guide': screen = <GuideScreen id={route.id} />; break;
      case 'share': screen = <ShareScreen code={route.code} />; break;
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
          <ErrorBoundary resetKey={key}>{screen}</ErrorBoundary>
        </main>
      </Shell>
      <Toasts />
    </>
  );
}
