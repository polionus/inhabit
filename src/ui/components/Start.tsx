import { data } from '../data.ts';
import { useGame } from '../game.ts';
import { continueLevel } from '../../state/progress.ts';
import { href } from '../router.ts';

export interface StartTarget {
  kind: 'start' | 'continue' | 'workshop';
  href: string;
  /** Next level title, for a returning player. */
  title?: string;
  returning: boolean;
}

/** Where the primary "start / continue" action goes for this visitor. */
export function useStartTarget(): StartTarget {
  const levels = useGame((s) => s.save.levels);
  const cont = continueLevel(data.worlds, levels);
  const returning = Object.keys(levels).length > 0;
  if (!returning) return { kind: 'start', href: cont ? href.level(cont) : href.map(), returning };
  if (cont) return { kind: 'continue', href: href.level(cont), title: data.findLevel(cont)?.level.title, returning };
  return { kind: 'workshop', href: href.to('workshop'), returning };
}

export function StartLink({ start, className = 'btn primary big', startLabel, continueLabel }: { start: StartTarget; className?: string; startLabel?: string; continueLabel?: string }) {
  const s = startLabel ?? 'Start level one';
  const c = continueLabel ?? 'Continue';
  return (
    <a className={className} href={start.href}>
      {start.kind === 'start' && s}
      {start.kind === 'continue' && <>{c}{start.title && <span className="btn-title">{start.title}</span>}</>}
      {start.kind === 'workshop' && 'Open the Workshop'}
    </a>
  );
}
