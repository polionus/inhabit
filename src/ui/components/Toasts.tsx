import { useEffect } from 'react';
import { useGame, game } from '../game.ts';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  useEffect(() => {
    const ids = toasts.map((t) => setTimeout(() => game().dismissToast(t.id), 4500));
    return () => ids.forEach(clearTimeout);
  }, [toasts]);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>{t.text}</div>
      ))}
    </div>
  );
}
