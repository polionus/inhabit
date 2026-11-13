import type { Quest } from '../../state/meta.ts';
import { useQuests } from '../usePlayer.ts';
import { Icon, ProgressBar } from './kit.tsx';

/** Today's quests. `compact` is the sidebar version (title + bar). */
export function QuestList({ quests, compact = false }: { quests?: Quest[]; compact?: boolean }) {
  const live = useQuests();
  const qs = quests ?? live;
  if (!qs.length) return null;
  return (
    <ul className={`quests ${compact ? 'compact' : ''}`}>
      {qs.map((q) => {
        const frac = q.goal > 0 ? Math.min(1, q.progress / q.goal) : q.done ? 1 : 0;
        return (
          <li key={q.id} className={`quest ${q.done ? 'done' : ''}`}>
            <a className="quest-link" href={q.href} aria-label={`${q.title}. ${q.done ? 'Complete.' : `${Math.min(q.progress, q.goal)} of ${q.goal}.`} ${q.xp} XP.`}>
              <span className="quest-icon" aria-hidden="true">{q.done ? <Icon name="check" size={compact ? 14 : 18} strokeWidth={3} /> : <Icon name="quest" size={compact ? 14 : 18} />}</span>
              <span className="quest-main">
                <span className="quest-title">{q.title}</span>
                {!compact && q.desc && <span className="quest-desc">{q.desc}</span>}
                <span className="quest-progress">
                  <ProgressBar value={frac} tone={q.done ? 'ok' : 'gold'} size="xs" />
                  <span className="quest-count tnum" aria-hidden="true">{Math.min(q.progress, q.goal)}/{q.goal}</span>
                </span>
              </span>
              <span className="quest-xp tnum" aria-hidden="true">+{q.xp}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
