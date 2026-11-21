/**
 * One suggestion on the success card, when the recommender thinks something beats moving straight on.
 */
import { useRecommendations } from '../../template/useRecommend.ts';
import { Icon } from '../../template/components/kit.tsx';

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
