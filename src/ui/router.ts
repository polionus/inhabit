import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'about' }
  | { name: 'map' }
  | { name: 'world'; id: string }
  | { name: 'level'; id: string }
  | { name: 'review' }
  | { name: 'codex'; id?: string }
  | { name: 'sandbox' }
  | { name: 'workshop' }
  | { name: 'graduate' }
  | { name: 'profile' }
  | { name: 'guide'; id?: string }
  | { name: 'arena'; sub?: string; arg?: string }
  | { name: 'share'; code: string }
  | { name: 'notfound'; path: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const [a, b, c] = path.split('/').map((x) => decodeURIComponent(x));
  switch (a) {
    case '':
    case undefined:
      return { name: 'home' };
    case 'map':
    case 'about':
      return { name: a };
    case 'world':
      return b ? { name: 'world', id: b } : { name: 'map' };
    case 'level':
      return b ? { name: 'level', id: b } : { name: 'map' };
    case 'review':
    case 'sandbox':
    case 'workshop':
    case 'graduate':
    case 'profile':
      return { name: a };
    case 'codex':
      return { name: 'codex', id: b };
    case 'guide':
      return { name: 'guide', id: b };
    case 'share':
      return b ? { name: 'share', code: b } : { name: 'home' };
    case 'arena':
      return { name: 'arena', sub: b, arg: c };
    default:
      return { name: 'notfound', path };
  }
}

export const href = {
  home: () => '#/',
  map: () => '#/map',
  about: () => '#/about',
  world: (id: string) => `#/world/${encodeURIComponent(id)}`,
  level: (id: string) => `#/level/${encodeURIComponent(id)}`,
  codex: (id?: string) => (id ? `#/codex/${encodeURIComponent(id)}` : '#/codex'),
  guide: (id?: string) => (id ? `#/guide/${encodeURIComponent(id)}` : '#/guide'),
  arena: (sub?: string, arg?: string) => '#/arena' + (sub ? `/${encodeURIComponent(sub)}` : '') + (sub && arg ? `/${encodeURIComponent(arg)}` : ''),
  share: (code: string) => `#/share/${encodeURIComponent(code)}`,
  to: (name: string) => `#/${name}`,
};

export function navigate(h: string): void {
  window.location.hash = h;
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const f = () => setR(parseHash(window.location.hash));
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
