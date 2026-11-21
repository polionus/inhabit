/**
 * One suggestion on the success card, when the recommender thinks something beats moving straight on
 * (a struggle → see the idea in the Gallery; a finished world → its chapter; a clean run → the boss).
 * The Next button already covers "continue", and PracticeOffer covers practice on this level.
 */
import { useRecommendations } from '../useRecommend.ts';
import { Icon } from '../components/kit.tsx';

export function AfterHint({ levelId, hints, studied }: { levelId: string; hints: number; studied: boolean }) {
  const recs = useRecommendations(3, { levelId, hints, studied });
  const r = recs.find((x) => x.kind !== 'continue' && x.kind !== 'workshop' && !(x.kind === 'practice' && x.levelId === levelId));
  const cont = recs.find((x) => x.kind === 'continue');
  if (!r || (cont && cont.score >= r.score)) return null;
  return (
    <p className="after-hint">
      <Icon name="bulb" size={16} />
      <span>
        <span className="muted">Suggested: </span>
        <a href={r.href}>{r.title}</a>
        <span className="muted"> · {r.reason}</span>
      </span>
    </p>
  );
}
