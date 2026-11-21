/**
 * App shell: persistent left sidebar (desktop), icon rail (medium widths, and on the level
 * screen), mobile top bar + bottom tab bar with a "More" sheet (phones).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useDisc } from '../context.tsx';
import { href, type Route } from '../router.ts';
import type { GameDisc } from '../types.ts';
import { usePlayer } from '../usePlayer.ts';
import { Icon, Modal, type IconName } from '../components/kit.tsx';
import { QuestList } from '../components/Quests.tsx';
import { PlayerCard, SoundToggle } from './PlayerCard.tsx';

export interface NavItem {
  name: string;
  label: string;
  to: string;
  icon: IconName;
  group: string;
  tabPrimary?: boolean;
}

const DEFAULT_GROUPS = [
  { id: 'learn', label: 'Learn' },
  { id: 'play', label: 'Play and build' },
  { id: 'reference', label: 'Reference' },
];

export function buildNav(disc: GameDisc): {
  items: NavItem[];
  groups: { id: string; label: string; items: NavItem[] }[];
  tabPrimary: NavItem[];
} {
  const core: NavItem[] = [
    { name: 'home', label: 'Home', to: href.home(), icon: 'home', group: 'learn', tabPrimary: true },
    { name: 'map', label: 'Map', to: href.map(), icon: 'map', group: 'learn', tabPrimary: true },
  ];
  if ((disc.gallery?.exhibits.length ?? 0) > 0) {
    core.push({ name: 'gallery', label: 'Gallery', to: href.gallery(), icon: 'sparkle', group: 'learn' });
  }
  core.push({ name: 'review', label: 'Review', to: href.review(), icon: 'review', group: 'learn', tabPrimary: true });
  if ((disc.guide?.meta.length ?? 0) > 0) {
    core.push({ name: 'guide', label: 'Guide', to: href.guide(), icon: 'guide', group: 'reference' });
  }
  if (disc.allCodex.length > 0) {
    core.push({ name: 'codex', label: 'Codex', to: href.codex(), icon: 'codex', group: 'reference' });
  }
  core.push({ name: 'about', label: 'About', to: href.about(), icon: 'about', group: 'reference' });

  const extras: NavItem[] = [];
  for (const s of disc.extraScreens ?? []) {
    if (!s.nav) continue;
    extras.push({
      name: s.name,
      label: s.nav.label,
      to: s.nav.to ?? href.extra(s.name),
      icon: s.nav.icon,
      group: s.nav.group,
      tabPrimary: s.nav.tabPrimary,
    });
  }

  // Place extra items in natural order: extras for 'learn'/'play' before 'about', etc.
  const items: NavItem[] = [];
  const groupDefs = disc.navGroups ?? DEFAULT_GROUPS;
  const all = [...core.filter((i) => i.group !== 'reference'), ...extras, ...core.filter((i) => i.group === 'reference')];
  const seen = new Set<string>();
  for (const it of all) {
    if (!seen.has(it.name)) {
      seen.add(it.name);
      items.push(it);
    }
  }

  const groups = groupDefs
    .map((g) => ({ ...g, items: items.filter((it) => it.group === g.id) }))
    .filter((g) => g.items.length > 0);

  // Mobile primary tabs: up to 4 primary items (falling back to home/map/review/codex or about).
  const flagged = items.filter((it) => it.tabPrimary);
  const tabPrimary = (flagged.length >= 4
    ? flagged.slice(0, 4)
    : [...flagged, ...items.filter((it) => !flagged.includes(it))].slice(0, 4));

  return { items, groups, tabPrimary };
}

/** Which nav entry a route belongs to. */
export function activeNav(route: Route, disc?: GameDisc): string {
  switch (route.name) {
    case 'world':
    case 'level':
    case 'chapter':
      return 'map';
    case 'extra': {
      for (const s of disc?.extraScreens ?? []) {
        if (s.name === route.screen) return route.screen;
        if (s.nav?.activeRoutes?.includes(route.screen)) return s.name;
      }
      return route.screen;
    }
    case 'notfound':
      return '';
    default:
      return route.name;
  }
}

function DefaultBrandMark({ name }: { name: string }) {
  const letter = (name.trim()[0] ?? 'G').toUpperCase();
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <text x="16" y="22" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800" fontFamily="var(--font-ui)">{letter}</text>
      <circle cx="24" cy="8.5" r="2.2" fill="var(--gold)" />
    </svg>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { brand } = useDisc();
  const CustomLogo = brand.logo;
  if (CustomLogo) return <CustomLogo compact={compact} />;
  return (
    <a className={`brand ${compact ? 'compact' : ''}`} href={href.home()} aria-label={`${brand.name}, home`}>
      <span className="brand-mark" aria-hidden="true">
        <DefaultBrandMark name={brand.name} />
      </span>
      {!compact && <span className="brand-word">{brand.name}</span>}
    </a>
  );
}

function NavLinks({
  groups,
  active,
  due,
  onNavigate,
}: {
  groups: { id: string; label: string; items: NavItem[] }[];
  active: string;
  due: number;
  onNavigate?: () => void;
}) {
  return (
    <ul className="nav-list">
      {groups.map((g) => (
        <li key={g.id} className="nav-group" role="presentation">
          <span className="nav-group-label" aria-hidden="true">{g.label}</span>
          <ul className="nav-sub" aria-label={g.label}>
            {g.items.map((n) => {
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
                      <span className="nav-count tnum" aria-label={`${due} ready today`}>{due}</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Sidebar({
  groups,
  active,
  rail,
}: {
  groups: { id: string; label: string; items: NavItem[] }[];
  active: string;
  rail: boolean;
}) {
  const p = usePlayer();
  return (
    <aside className={`sidebar ${rail ? 'force-rail' : ''}`} aria-label="Sidebar">
      <div className="side-head">
        <Brand />
        <Brand compact />
        <SoundToggle className="head-sound" />
      </div>
      <nav aria-label="Main" className="side-nav">
        <NavLinks groups={groups} active={active} due={p.due} />
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

function TabBar({
  items,
  tabPrimary,
  active,
}: {
  items: NavItem[];
  tabPrimary: NavItem[];
  active: string;
}) {
  const p = usePlayer();
  const [more, setMore] = useState(false);
  const primarySet = new Set(tabPrimary.map((t) => t.name));
  const moreActive = !!active && !primarySet.has(active);
  useEffect(() => {
    const close = () => setMore(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);
  const rest = [
    ...items.filter((n) => !primarySet.has(n.name)),
    { name: 'profile', label: 'Profile', to: '#/profile', icon: 'profile' as IconName, group: 'account' },
  ];
  return (
    <>
      <nav className="tabbar-m" aria-label="Main">
        {tabPrimary.map((n) => {
          const on = active === n.name;
          return (
            <a key={n.name} className={`tb-link ${on ? 'active' : ''}`} href={n.to} aria-current={on ? 'page' : undefined}>
              <span className="tb-icon" aria-hidden="true">
                <Icon name={n.icon} size={22} />
                {n.name === 'review' && p.due > 0 && <span className="tb-dot tnum">{p.due}</span>}
              </span>
              <span className="tb-label">{n.label}</span>
              {n.name === 'review' && p.due > 0 && <span className="sr-only">, {p.due} ready today</span>}
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
            {rest.map((n) => (
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
  const disc = useDisc();
  const nav = useMemo(() => buildNav(disc), [disc]);
  const active = activeNav(route, disc);
  const rail = route.name === 'level';
  const routeClass = route.name === 'extra' ? `route-${route.screen}` : `route-${route.name}`;
  return (
    <div className={`app ${rail ? 'is-rail' : ''} ${routeClass}`}>
      <Sidebar groups={nav.groups} active={active} rail={rail} />
      <MobileBar active={active} />
      <div className="app-main">
        {banners}
        {children}
      </div>
      <TabBar items={nav.items} tabPrimary={nav.tabPrimary} active={active} />
    </div>
  );
}
