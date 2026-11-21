/** Shared pieces for the roadmap and the chapter page: level rows with unlocked concepts, read-time, chapter numbers. */
import { useDisc } from '../context.tsx';
import type { SaveData } from '../state/game.ts';
import { masteryOf } from '../state/meta.ts';
import type { TemplateLevel, TemplateWorld } from '../types.ts';
import { href } from '../router.ts';
import { Icon } from './kit.tsx';

export const readMinutes = (text: string): number => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));

function defaultChips(l: TemplateLevel): string[] {
  return [...(l.unlocks?.tactics ?? []), ...(l.unlocks?.lemmas ?? []), ...(l.unlocks?.items ?? [])];
}

/** One row per level: number, title, state, boss/optional marks, and unlocked items as code chips. */
export function LevelRows({ world, save, locked }: { world: TemplateWorld; save: SaveData; locked: boolean }) {
  const disc = useDisc();
  const chipFn = disc.hooks?.introducedChips ?? defaultChips;
  return (
    <ol className="lrows">
      {world.levels.map((l, i) => {
        const m = masteryOf(save.levels[l.id]);
        const done = m !== 'none';
        const state = m === 'studied' ? 'Studied' : done ? 'Solved' : '';
        const chips = chipFn(l);
        return (
          <li key={l.id} className={`lrow ${done ? 'done' : ''} ${l.boss ? 'boss' : ''}`}>
            <span className="lrow-num tnum" aria-hidden="true">{i + 1}</span>
            <span className="lrow-main">
              <span className="lrow-title">
                {locked ? l.title : <a href={href.level(l.id)}>{l.title}</a>}
                {l.boss && <span className="lrow-tag boss"><Icon name="crown-fill" size={12} /> Boss</span>}
                {l.optional && <span className="lrow-tag">optional</span>}
              </span>
              {chips.length > 0 && (
                <span className="lrow-chips">
                  <span className="lrow-new">New</span>
                  {chips.map((c) => <code key={c} className="lrow-chip">{c}</code>)}
                </span>
              )}
            </span>
            <span className={`lrow-state ${m}`}>
              {done ? <><Icon name={m === 'studied' ? 'book' : 'check'} size={14} /> {state}</> : <span className="sr-only">Not done</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
