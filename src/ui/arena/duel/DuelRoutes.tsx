/** Stub: replaced by the duel agent. */
import { EmptyState } from '../../components/kit.tsx';

export function DuelRoutes({ sub, arg }: { sub: string; arg?: string }) {
  return <div className="page narrow"><EmptyState glyph="⚔" title="Duels are being built">Check back soon.{sub ? '' : arg}</EmptyState></div>;
}
