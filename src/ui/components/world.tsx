/** World-level display pieces: the token (emblem in a progress ring) and derived world status. */
import type { CSSProperties } from 'react';
import type { World } from '../../content/types.ts';
import type { SaveData } from '../../state/game.ts';
import { worldStars } from '../../state/meta.ts';
import { worldComplete, worldIsEmpty, worldProgress, worldUnlocked } from '../../state/progress.ts';
import { data } from '../data.ts';
import { Icon, ProgressRing, WorldEmblem, worldHue } from './kit.tsx';

export type WorldState = 'locked' | 'open' | 'complete' | 'empty';

export interface WorldStatus {
  state: WorldState;
  done: number;
  total: number;
  frac: number;
  stars: { earned: number; total: number };
}

export function worldStatus(w: World, save: SaveData): WorldStatus {
  const empty = worldIsEmpty(w);
  const unlocked = worldUnlocked(w, data.worlds, save.levels);
  const complete = !empty && worldComplete(w, save.levels);
  const pr = worldProgress(w, save.levels);
  let stars = { earned: 0, total: 0 };
  try {
    stars = worldStars(w, save);
  } catch {
    /* ignore */
  }
  return {
    state: empty ? 'empty' : complete ? 'complete' : unlocked ? 'open' : 'locked',
    done: pr.done,
    total: pr.total,
    frac: pr.total ? pr.done / pr.total : 0,
    stars,
  };
}

/** The world's emblem as a round token with a progress ring and a state badge. Decorative. */
export function WorldToken({ world, size = 64, state = 'open', progress = 0, badge = true, className = '' }: { world: Pick<World, 'id' | 'title'>; size?: number; state?: WorldState; progress?: number; badge?: boolean; className?: string }) {
  const ring = Math.max(4, Math.round(size / 13));
  const style = { '--h': worldHue(world.id), '--ws': `${size}px`, '--wr': `${ring * 2 + 4}px` } as CSSProperties;
  return (
    <span className={`wtoken ${state} ${className}`} style={style} aria-hidden="true">
      <ProgressRing value={state === 'complete' ? 1 : progress} size={size} stroke={ring} tone={state === 'complete' ? 'gold' : 'primary'} />
      <span className="wtoken-face"><WorldEmblem worldId={world.id} title={world.title} /></span>
      {badge && state === 'complete' && <span className="wtoken-badge done"><Icon name="check" strokeWidth={3.5} /></span>}
      {badge && state === 'locked' && <span className="wtoken-badge lock"><Icon name="lock" strokeWidth={2.5} /></span>}
    </span>
  );
}
