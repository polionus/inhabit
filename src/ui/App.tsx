import { useEffect } from 'react';
import { useRoute, href, type Route } from './router.ts';
import { ErrorBoundary } from './hooks.tsx';
import { game, useGame } from './game.ts';
import { data, getCodex } from './data.ts';
import { dueIds } from '../state/leitner.ts';
import { rankFor } from '../state/game.ts';
import { Toasts } from './components/Toasts.tsx';
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

const SITE = 'Inhabit';
const HOME_TITLE = 'Inhabit — learn Lean 4, the theorem prover, by playing';
const PAGE_TITLES: Record<string, string> = {
  map: 'Map', about: 'About', review: 'Review', codex: 'Codex', sandbox: 'Sandbox', workshop: 'Workshop', graduate: 'Graduate', profile: 'Profile',
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

const NAV: { name: string; label: string; to: string }[] = [
  { name: 'map', label: 'Map', to: '#/map' },
  { name: 'review', label: 'Review', to: '#/review' },
  { name: 'codex', label: 'Codex', to: '#/codex' },
  { name: 'sandbox', label: 'Sandbox', to: '#/sandbox' },
  { name: 'workshop', label: 'Workshop', to: '#/workshop' },
  { name: 'graduate', label: 'Graduate', to: '#/graduate' },
  { name: 'about', label: 'About', to: '#/about' },
];

function TopBar({ active }: { active: string }) {
  const deck = useGame((s) => s.save.deck);
  const xp = useGame((s) => s.save.xp);
  const due = dueIds(deck, Date.now()).length;
  const rank = rankFor(xp);
  const act = active === 'home' ? '' : active === 'world' || active === 'level' ? 'map' : active;
  return (
    <header className="topbar">
      <a className="brand" href={href.home()} aria-label="Inhabit, home">Inhabit</a>
      <nav aria-label="Main">
        {NAV.map((n) => (
          <a key={n.name} href={n.to} className={act === n.name ? 'active' : ''} aria-current={act === n.name ? 'page' : undefined}>
            {n.label}
            {n.name === 'review' && due > 0 && <span className="count" aria-label={`${due} due`}>{due}</span>}
          </a>
        ))}
      </nav>
      <a className={`rank ${act === 'profile' ? 'active' : ''}`} href="#/profile" title="Profile and settings">
        <span>{rank.title}</span> <span className="xp-pill">{xp} XP</span>
      </a>
    </header>
  );
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
      default:
        screen = (
          <div className="page narrow"><h1>Nothing here</h1><p>That page does not exist. <a href={href.map()}>Back to the map</a>.</p></div>
        );
    }
  }
  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <TopBar active={route.name} />
      {data.fixtures && <div className="fixture-banner">Fixture mode: fake engine and sample levels. <a href="?fixtures=0#/">Switch to real content</a></div>}
      {storageError && <div className="fixture-banner warn">Your browser is not letting Inhabit save progress. Export your save from Profile to keep it.</div>}
      <main id="main" tabIndex={-1}>
        <ErrorBoundary resetKey={key}>{screen}</ErrorBoundary>
      </main>
      <Toasts />
    </>
  );
}
