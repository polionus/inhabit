import type { Hint } from '../../content/types.ts';
import { Markdown } from './Markdown.tsx';

export function HintLadder({ hints, revealed, onReveal, lastGivesAway }: { hints: Hint[]; revealed: number; onReveal: () => void; lastGivesAway: boolean }) {
  if (!hints.length) return null;
  const more = revealed < hints.length;
  const nextIsLast = revealed === hints.length - 1;
  return (
    <section className="hints" aria-label="Hints">
      {hints.slice(0, revealed).map((h, i) => (
        <div className="hint" key={i}>
          <div className="label">Hint {i + 1} of {hints.length}</div>
          <Markdown text={h.text} />
        </div>
      ))}
      {more && (
        <div className="hint-more">
          <button className="btn" onClick={onReveal}>
            {revealed === 0 ? 'Need a hint?' : 'Another hint'}
          </button>
          {nextIsLast && lastGivesAway && hints.length > 1 && (
            <span className="muted small"> The last hint nearly gives the answer. If you use it, the level counts as “studied”.</span>
          )}
        </div>
      )}
    </section>
  );
}
