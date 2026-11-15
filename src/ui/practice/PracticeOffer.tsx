/**
 * Offers generated practice tied to a level, and renders NOTHING when the generator cannot cover
 * that level's topic.
 *   when = 'after'    on the success card: "Practice this: three more like it"
 *   when = 'stuck'    in the stuck panel, after hints: "Try a smaller version first"
 *   when = 'studied'  after the solution was shown: "Prove one like it yourself"
 * The generation is deferred past the first paint, so the level screen never waits for it.
 */
import { useEffect, useState } from 'react';
import { practiceSet, smallerVersion } from '../../arena/practice.ts';
import { href } from '../router.ts';

export interface PracticeOfferProps {
  levelId: string;
  when: 'after' | 'stuck' | 'studied';
}

/** `#/practice/<levelId>~s` is the smaller-version mode of the practice screen. */
export const smallHref = (levelId: string): string => href.practice(levelId + '~s');

export function PracticeOffer({ levelId, when }: PracticeOfferProps) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    const id = setTimeout(() => {
      try {
        setCount(when === 'after' ? practiceSet(levelId, 0).length : smallerVersion(levelId) ? 1 : 0);
      } catch {
        setCount(0);
      }
    }, 40);
    return () => clearTimeout(id);
  }, [levelId, when]);

  if (count === 0) return null;
  if (when === 'after') {
    return (
      <a className="btn practice-offer" href={href.practice(levelId)}>
        Practice this: {count} more like it
      </a>
    );
  }
  if (when === 'studied') {
    return (
      <a className="btn practice-offer" href={smallHref(levelId)}>
        Prove one like it yourself
      </a>
    );
  }
  return (
    <section className="practice-stuck" aria-label="A smaller version">
      <strong>Try a smaller version first</strong>
      <p className="small">A simpler problem with the same shape. Solve it, then come back.</p>
      <a className="btn" href={smallHref(levelId)}>Try the smaller one</a>
    </section>
  );
}
