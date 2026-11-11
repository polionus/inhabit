import { useEffect, useRef, useState } from 'react';
import type { Rating } from '../../state/progress.ts';
import { Markdown, Lean } from './Markdown.tsx';

export function Success({
  outro,
  term,
  termOpen,
  studied,
  xp,
  rating,
  onRate,
  actions,
  note,
}: {
  outro?: string;
  term?: string;
  termOpen?: boolean;
  studied: boolean;
  xp: number;
  rating?: Rating;
  onRate?: (r: Rating) => void;
  actions: React.ReactNode;
  note?: string;
}) {
  const [showTerm, setShowTerm] = useState(!!termOpen);
  const ref = useRef<HTMLElement>(null);
  // Bring the card into view if it is off-screen, but never move focus out of the editor.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.closest('.task') as HTMLElement | null;
    const r = el.getBoundingClientRect();
    const pr = parent ? parent.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const top = Math.max(0, pr.top);
    const bottom = Math.min(window.innerHeight, pr.bottom);
    if (r.top < top || r.bottom > bottom) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, []);
  return (
    <section className="success" aria-label="Level complete" role="status" aria-live="polite" ref={ref}>
      <h2>{studied ? 'Studied' : 'Solved'}{xp > 0 && <span className="xp"> +{xp} XP</span>}</h2>
      {studied && <p className="muted small">You saw the answer, so this one will come back in review for you to solve fresh.</p>}
      {note && <p className="muted small">{note}</p>}
      {outro && <Markdown text={outro} />}
      {term && (
        <div className="term">
          <button className="linkish" aria-expanded={showTerm} onClick={() => setShowTerm(!showTerm)}>
            {showTerm ? 'Hide the term' : 'See the term your tactics built'}
          </button>
          {showTerm && <Lean code={term} className="term-code" />}
        </div>
      )}
      {onRate && (
        <div className="rating" role="group" aria-label="How did that feel?">
          <span className="muted small">How did that feel?</span>
          {(['easy', 'right', 'hard'] as Rating[]).map((r) => (
            <button key={r} className={`chip ${rating === r ? 'on' : ''}`} aria-pressed={rating === r} onClick={() => onRate(r)}>
              {r === 'right' ? 'just right' : r}
            </button>
          ))}
        </div>
      )}
      <div className="actions">{actions}</div>
    </section>
  );
}
