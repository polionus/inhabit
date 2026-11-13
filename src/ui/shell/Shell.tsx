/**
 * App shell: persistent left sidebar (desktop), icon rail (medium widths, and on the level
 * screen), mobile top bar + bottom tab bar with a "More" sheet (phones).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { href, type Route } from '../router.ts';
import { usePlayer } from '../usePlayer.ts';
import { Icon, Modal, type IconName } from '../components/kit.tsx';
import { QuestList } from '../components/Quests.tsx';
import { PlayerCard, SoundToggle } from './PlayerCard.tsx';

interface NavItem { name: string; label: string; to: string; icon: IconName }

export const NAV: NavItem[] = [
  { name: 'home', label: 'Home', to: href.home(), icon: 'home' },
  { name: 'map', label: 'Map', to: href.map(), icon: 'map' },
  { name: 'arena', label: 'Arena', to: href.arena(), icon: 'arena' },
  { name: 'review', label: 'Review', to: '#/review', icon: 'review' },
  { name: 'guide', label: 'Guide', to: href.guide(), icon: 'guide' },
  { name: 'codex', label: 'Codex', to: href.codex(), icon: 'codex' },
  { name: 'sandbox', label: 'Sandbox', to: '#/sandbox', icon: 'sandbox' },
  { name: 'workshop', label: 'Workshop', to: '#/workshop', icon: 'workshop' },
  { name: 'graduate', label: 'Graduate', to: '#/graduate', icon: 'graduate' },
  { name: 'about', label: 'About', to: href.about(), icon: 'about' },
];
const TAB_PRIMARY = ['home', 'map', 'arena', 'review'];

/** Which nav entry a route belongs to. */
export function activeNav(route: Route): string {
  switch (route.name) {
    case 'world':
    case 'level':
      return 'map';
    case 'share':
      return 'arena';
    case 'notfound':
      return '';
    default:
      return route.name;
  }
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand ${compact ? 'compact' : ''}`} href={href.home()} aria-label="Inhabit, home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
          <rect width="32" height="32" rx="9" fill="var(--primary)" />
          <path d="M10.5 7.5v17M10.5 16h12" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" fill="none" />
          <circle cx="23.2" cy="16" r="2.3" fill="var(--gold)" />
        </svg>
      </span>
      {!compact && <span className="brand-word">Inhabit</span>}
    </a>
  );
}

function NavLinks({ active, due, onNavigate }: { active: string; due: number; onNavigate?: () => void }) {
  return (
    <ul className="nav-list">
      {NAV.map((n) => {
        const on = active === n.name;
        return (
          <li key={n.name}>
            <a
              className={`nav-link ${on ? 'active' : ''}`}
              href={n.to}
              aria-current={on ? 'page' : undefined}
              data-tip={n.label}
              onClick={onNavigate}
            >
              <span className="nav-icon" aria-hidden="true"><Icon name={n.icon} size={22} /></span>
              <span className="nav-label">{n.label}</span>
              {n.name === 'review' && due > 0 && (
                <span className="nav-count tnum" aria-label={`${due} due`}>{due > 99 ? '99+' : due}</span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Sidebar({ active, rail }: { active: string; rail: boolean }) {
  const p = usePlayer();
  return (
    <aside className={`sidebar ${rail ? 'force-rail' : ''}`} aria-label="Sidebar">
      <div className="side-head">
        <Brand />
        <Brand compact />
        <SoundToggle className="head-sound" />
      </div>
      <nav aria-label="Main" className="side-nav">
        <NavLinks active={active} due={p.due} />
      </nav>
      <div className="side-foot">
        <section className="side-quests" aria-label="Today's quests">
          <div className="side-quests-head">
            <span className="eyebrow">Today</span>
          </div>
          <QuestList compact />
        </section>
        <PlayerCard variant="side" active={active === 'profile'} />
        <PlayerCard variant="rail" active={active === 'profile'} />
        <div className="side-tools">
          <SoundToggle className="foot-sound" />
        </div>
      </div>
    </aside>
  );
}

function MobileBar({ active }: { active: string }) {
  const p = usePlayer();
  return (
    <header className="mbar">
      <Brand />
      <div className="mbar-stats">
        <a className={`mbar-stat flame ${p.streak.activeToday ? 'lit' : ''}`} href="#/profile" aria-label={`${p.streak.current} day streak. Profile.`}>
          <Icon name="flame" size={16} /><span className="tnum">{p.streak.current}</span>
        </a>
        <a className={`mbar-stat lvl ${active === 'profile' ? 'active' : ''}`} href="#/profile" aria-label={`Level ${p.level.level}, ${p.xp} XP. Profile.`}>
          <Icon name="bolt" size={16} /><span className="tnum">Lv {p.level.level}</span>
        </a>
        <SoundToggle />
      </div>
    </header>
  );
}

function TabBar({ active }: { active: string }) {
  const p = usePlayer();
  const [more, setMore] = useState(false);
  const moreActive = !!active && !TAB_PRIMARY.includes(active);
  useEffect(() => {
    const close = () => setMore(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);
  return (
    <>
      <nav className="tabbar-m" aria-label="Main">
        {NAV.filter((n) => TAB_PRIMARY.includes(n.name)).map((n) => {
          const on = active === n.name;
          return (
            <a key={n.name} className={`tb-link ${on ? 'active' : ''}`} href={n.to} aria-current={on ? 'page' : undefined}>
              <span className="tb-icon" aria-hidden="true">
                <Icon name={n.icon} size={22} />
                {n.name === 'review' && p.due > 0 && <span className="tb-dot tnum">{p.due > 99 ? '99+' : p.due}</span>}
              </span>
              <span className="tb-label">{n.label}</span>
              {n.name === 'review' && p.due > 0 && <span className="sr-only">, {p.due} due</span>}
            </a>
          );
        })}
        <button type="button" className={`tb-link ${moreActive ? 'active' : ''}`} aria-haspopup="dialog" aria-expanded={more} onClick={() => setMore(true)}>
          <span className="tb-icon" aria-hidden="true"><Icon name="more" size={24} strokeWidth={3} /></span>
          <span className="tb-label">More</span>
        </button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More" size="sheet" className="more-sheet">
        <PlayerCard variant="side" active={active === 'profile'} />
        <nav aria-label="More pages">
          <ul className="more-grid">
            {[...NAV.filter((n) => !TAB_PRIMARY.includes(n.name)), { name: 'profile', label: 'Profile', to: '#/profile', icon: 'profile' as IconName }].map((n) => (
              <li key={n.name}>
                <a className={`more-link ${active === n.name ? 'active' : ''}`} href={n.to} aria-current={active === n.name ? 'page' : undefined} onClick={() => setMore(false)}>
                  <Icon name={n.icon} size={22} />
                  <span>{n.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <section className="side-quests" aria-label="Today's quests">
          <span className="eyebrow">Today</span>
          <QuestList compact />
        </section>
        <SoundToggle withLabel className="sheet-sound" />
      </Modal>
    </>
  );
}

export function Shell({ route, banners, children }: { route: Route; banners?: ReactNode; children: ReactNode }) {
  const active = activeNav(route);
  const rail = route.name === 'level';
  return (
    <div className={`app ${rail ? 'is-rail' : ''} route-${route.name}`}>
      <Sidebar active={active} rail={rail} />
      <MobileBar active={active} />
      <div className="app-main">
        {banners}
        {children}
      </div>
      <TabBar active={active} />
    </div>
  );
}
