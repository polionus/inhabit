import { useEffect, useRef, useState } from 'react';
import type { Rating } from '../../state/progress.ts';
import { playerLevel } from '../../state/meta.ts';
import { Markdown, Lean } from './Markdown.tsx';
import { Icon, ProgressBar, Stars, celebrate, centerOf, sfx, type CelebrateKind } from './kit.tsx';

export interface Reward {
  /** Stars this level now has (0 when not applicable, e.g. review). */
  stars: number;
  xpBefore: number;
  xpAfter: number;
  /** Proportional celebration to run when the card appears. */
  celebration: CelebrateKind | null;
  sound: 'solve' | 'win' | 'correct' | 'tap' | null;
  boss: boolean;
}

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
  reward,
  review = false,
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
  reward?: Reward;
  review?: boolean;
}) {
  const [showTerm, setShowTerm] = useState(!!termOpen);
  const ref = useRef<HTMLElement>(null);
  const before = reward ? playerLevel(reward.xpBefore) : null;
  const after = reward ? playerLevel(reward.xpAfter) : null;
  const levelUp = !!before && !!after && after.level > before.level;

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

  // Sound and celebration, once.
  useEffect(() => {
    if (!reward) return;
    const timers: number[] = [];
    if (reward.sound) timers.push(window.setTimeout(() => sfx.play(reward.sound!), 0));
    if (reward.celebration) timers.push(window.setTimeout(() => celebrate(reward.celebration!, centerOf(ref.current?.querySelector('.success-check'))), 120));
    if (levelUp) {
      timers.push(window.setTimeout(() => {
        sfx.play('levelup');
        celebrate('levelup', centerOf(ref.current?.querySelector('.levelup')));
      }, 1200));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = studied ? 'Studied' : review ? 'Remembered' : reward?.boss ? 'Boss defeated' : 'Solved';
  return (
    <section className={`success ${studied ? 'studied' : ''} ${reward?.boss && !studied ? 'boss' : ''}`} aria-label="Level complete" role="status" aria-live="polite" ref={ref}>
      <div className="success-top">
        <span className="success-check" aria-hidden="true">
          <Icon name={studied ? 'book' : reward?.boss ? 'crown-fill' : 'check'} size={26} strokeWidth={3.2} />
        </span>
        <div className="success-title">
          <h2>{title}</h2>
          {studied ? (
            <span className="success-sub">You saw the answer, so this one comes back in Review for you to solve fresh.</span>
          ) : review ? (
            <span className="success-sub">It moves up a box in your review deck.</span>
          ) : (
            reward && reward.stars < 3 && <span className="success-sub">{reward.stars < 2 ? 'Solve it again without hints for a second star.' : 'Solve it again in Review for the third star.'}</span>
          )}
        </div>
        {reward && reward.stars > 0 && !review && <Stars value={reward.stars} size="lg" animate sound={!studied} />}
      </div>
      {note && <p className="muted small">{note}</p>}
      {xp > 0 && before && after && (
        <>
          <div className="success-rewards">
            <span className="xp-gain tnum"><Icon name="bolt" size={20} /> +{xp} XP</span>
            {levelUp && <span className="levelup"><Icon name="sparkle" size={14} /> Level {after.level}</span>}
          </div>
          <div className="success-level">
            <span className="lv tnum">Lv {after.level}</span>
            <ProgressBar
              value={after.frac}
              from={levelUp ? 0 : before.frac}
              tone="gold"
              size="md"
              label={`XP toward level ${after.level + 1}`}
            />
            <span className="tnum">{after.into}/{after.span}</span>
          </div>
        </>
      )}
      {outro && <Markdown text={outro} className="outro" />}
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
