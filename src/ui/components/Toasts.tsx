import { useEffect, useRef } from 'react';
import { useGame, game } from '../game.ts';
import { Icon, celebrate, sfx, type IconName } from './kit.tsx';

const MAX_VISIBLE = 3;
const LIFETIME_MS = 5000;

type Kind = 'badge' | 'quest' | 'info';

/** Toast texts come from the store ("Badge: …", "Quest complete: … (+N XP)", plain notes). */
export function classifyToast(text: string): { kind: Kind; label: string; body: string; icon: IconName } {
  const badge = /^badge:\s*(.*)$/i.exec(text);
  if (badge) return { kind: 'badge', label: 'Achievement', body: badge[1], icon: 'trophy' };
  const quest = /^quest complete:\s*(.*)$/i.exec(text) ?? /^quest:\s*(.*)$/i.exec(text);
  if (quest) return { kind: 'quest', label: 'Quest complete', body: quest[1], icon: 'quest' };
  return { kind: 'info', label: '', body: text, icon: 'sparkle' };
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const visible = toasts.slice(0, MAX_VISIBLE);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const announced = useRef(new Set<number>());

  // One independent timer per visible toast; started when it first appears, never reset by others.
  useEffect(() => {
    const live = new Set(visible.map((t) => t.id));
    let delay = 0;
    let burst = false;
    for (const t of visible) {
      if (!timers.current.has(t.id)) {
        timers.current.set(t.id, setTimeout(() => {
          timers.current.delete(t.id);
          game().dismissToast(t.id);
        }, LIFETIME_MS));
      }
      if (!announced.current.has(t.id)) {
        announced.current.add(t.id);
        const k = classifyToast(t.text).kind;
        // Let a level's own celebration sound first; stagger the rest.
        const d = 650 + delay;
        delay += 450;
        const withBurst = k !== 'info' && !burst;
        if (withBurst) burst = true;
        setTimeout(() => {
          sfx.play(k === 'badge' ? 'badge' : k === 'quest' ? 'quest' : 'tap');
          if (withBurst) celebrate('star', { x: window.innerWidth - 180, y: 60 });
        }, d);
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
      {visible.map((t) => {
        const c = classifyToast(t.text);
        return (
          <div className={`toast toast-${c.kind}`} key={t.id}>
            <span className="toast-icon" aria-hidden="true"><Icon name={c.icon} size={20} /></span>
            <span>
              {c.label && <span className="toast-kind">{c.label}</span>}
              {c.body}
            </span>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => game().dismissToast(t.id)}>
              <Icon name="close" size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
