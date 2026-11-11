import { useEffect, useRef } from 'react';
import { useGame, game } from '../game.ts';

const MAX_VISIBLE = 3;
const LIFETIME_MS = 4500;

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const visible = toasts.slice(0, MAX_VISIBLE);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // One independent timer per visible toast; started when it first appears, never reset by others.
  useEffect(() => {
    const live = new Set(visible.map((t) => t.id));
    for (const t of visible) {
      if (!timers.current.has(t.id)) {
        timers.current.set(t.id, setTimeout(() => {
          timers.current.delete(t.id);
          game().dismissToast(t.id);
        }, LIFETIME_MS));
      }
    }
    for (const [id, h] of timers.current) {
      if (!live.has(id)) {
        clearTimeout(h);
        timers.current.delete(id);
      }
    }
  }, [visible]);
  useEffect(() => {
    const m = timers.current;
    return () => {
      m.forEach(clearTimeout);
      m.clear();
    };
  }, []);

  return (
    <div className="toasts" role="status" aria-live="polite">
      {visible.map((t) => (
        <div className="toast" key={t.id}>{t.text}</div>
      ))}
    </div>
  );
}
