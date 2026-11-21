import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'about' }
  | { name: 'map' }
  | { name: 'world'; id: string }
  | { name: 'chapter'; id: string }
  | { name: 'level'; id: string }
  | { name: 'review' }
  | { name: 'codex'; id?: string }
  | { name: 'profile' }
  | { name: 'guide'; id?: string }
  | { name: 'gallery'; id?: string }
  | { name: 'extra'; screen: string; sub?: string; arg?: string }
  | { name: 'notfound'; path: string };

const BUILT_IN_SINGLETONS = new Set(['map', 'about', 'review', 'profile']);

export function parseHash(hash: string, extraNames?: ReadonlySet<string>): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const [a, b, c] = path.split('/').map((x) => decodeURIComponent(x));
  switch (a) {
    case '':
    case undefined:
      return { name: 'home' };
    case 'map':
    case 'about':
    case 'review':
    case 'profile':
      return { name: a };
    case 'world':
      return b ? { name: 'world', id: b } : { name: 'map' };
    case 'chapter':
      return b ? { name: 'chapter', id: b } : { name: 'map' };
    case 'level':
      return b ? { name: 'level', id: b } : { name: 'map' };
    case 'codex':
      return { name: 'codex', id: b };
    case 'guide':
      return { name: 'guide', id: b };
    case 'gallery':
      return { name: 'gallery', id: b };
    default:
      if (!BUILT_IN_SINGLETONS.has(a) && extraNames?.has(a)) {
        return { name: 'extra', screen: a, sub: b, arg: c };
      }
      return { name: 'notfound', path };
  }
}

export const href = {
  home: () => '#/',
  map: () => '#/map',
  about: () => '#/about',
  review: () => '#/review',
  profile: () => '#/profile',
  world: (id: string) => `#/world/${encodeURIComponent(id)}`,
  chapter: (id: string) => `#/chapter/${encodeURIComponent(id)}`,
  level: (id: string) => `#/level/${encodeURIComponent(id)}`,
  codex: (id?: string) => (id ? `#/codex/${encodeURIComponent(id)}` : '#/codex'),
  guide: (id?: string) => (id ? `#/guide/${encodeURIComponent(id)}` : '#/guide'),
  gallery: (id?: string) => (id ? `#/gallery/${encodeURIComponent(id)}` : '#/gallery'),
  extra: (name: string, sub?: string, arg?: string) =>
    `#/${encodeURIComponent(name)}` + (sub ? `/${encodeURIComponent(sub)}` : '') + (sub && arg ? `/${encodeURIComponent(arg)}` : ''),
  to: (name: string) => `#/${name}`,
};

export function navigate(h: string): void {
  window.location.hash = h;
}

export function useRoute(extraNames?: ReadonlySet<string>): Route {
  const [r, setR] = useState<Route>(() => parseHash(window.location.hash, extraNames));
  useEffect(() => {
    const f = () => setR(parseHash(window.location.hash, extraNames));
    f();
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, [extraNames]);
  return r;
}
