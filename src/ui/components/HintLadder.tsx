import type { Hint } from '../../content/types.ts';
import { Markdown } from './Markdown.tsx';
import { Icon } from './kit.tsx';

export function HintLadder({ hints, revealed, onReveal, lastGivesAway }: { hints: Hint[]; revealed: number; onReveal: () => void; lastGivesAway: boolean }) {
  if (!hints.length) return null;
  const more = revealed < hints.length;
  const nextIsLast = revealed === hints.length - 1;
  return (
    <section className="hints" aria-label="Hints">
      {hints.slice(0, revealed).map((h, i) => (
        <div className="hint" key={i}>
          <div className="label"><Icon name="bulb" size={14} /> Hint {i + 1} of {hints.length}</div>
          <Markdown text={h.text} />
        </div>
      ))}
      {more && (
        <div className="hint-more">
          <button className="btn outline" onClick={onReveal}>
            <Icon name="bulb" size={18} /> {revealed === 0 ? 'Need a hint?' : 'Another hint'}
            <span className="hint-count tnum" aria-label={`${hints.length - revealed} left`}>{hints.length - revealed}</span>
          </button>
          {nextIsLast && lastGivesAway && hints.length > 1 && (
            <span className="hint-warn">The last hint nearly gives the answer. If you use it, the level counts as “studied”.</span>
          )}
        </div>
      )}
    </section>
  );
}
