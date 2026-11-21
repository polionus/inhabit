import { meta as inhabitMeta } from './inhabit/meta.ts';
import { meta as starterMeta } from './starter/meta.ts';

export const GAMES = {
  inhabit: { meta: inhabitMeta, discModule: '/src/games/inhabit/disc.tsx' },
  starter: { meta: starterMeta, discModule: '/src/games/starter/disc.tsx' },
} as const;

export type GameId = keyof typeof GAMES;
