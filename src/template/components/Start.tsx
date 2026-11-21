import { useDisc } from '../context.tsx';
import { useGame } from '../store.ts';
import { continueLevel } from '../state/progress.ts';
import { href } from '../router.ts';

export interface StartTarget {
  kind: 'start' | 'continue' | 'complete';
  href: string;
  title?: string;
  completeLabel?: string;
  returning: boolean;
}

/** Where the primary "start / continue" action goes for this visitor. */
export function useStartTarget(): StartTarget {
  const disc = useDisc();
  const levels = useGame((s) => s.save.levels);
  const cont = continueLevel(disc.worlds, levels);
  const returning = Object.keys(levels).length > 0;
  if (!returning) return { kind: 'start', href: cont ? href.level(cont) : href.map(), returning };
  if (cont) return { kind: 'continue', href: href.level(cont), title: disc.findLevel(cont)?.level.title, returning };
  const afterAll = disc.progression?.afterAllWorlds;
  return {
    kind: 'complete',
    href: afterAll?.href ?? href.map(),
    completeLabel: afterAll?.cta ?? 'Review the roadmap',
    returning,
  };
}

export function StartLink({
  start,
  className = 'btn primary big',
  startLabel,
  continueLabel,
}: {
  start: StartTarget;
  className?: string;
  startLabel?: string;
  continueLabel?: string;
}) {
  const s = startLabel ?? 'Start level one';
  const c = continueLabel ?? 'Continue';
  return (
    <a className={className} href={start.href}>
      {start.kind === 'start' && s}
      {start.kind === 'continue' && (
        <>
          {c}
          {start.title && <span className="btn-title">{start.title}</span>}
        </>
      )}
      {start.kind === 'complete' && (start.completeLabel ?? 'Continue')}
    </a>
  );
}
