import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { game, useGame } from '../game.ts';

/** First-time tips, keyed by kind of screen (not by level id). Remembered in `save.seen` as `tip:<key>`. */
export type TipKey = 'check-click' | 'parsons' | 'predict' | 'tactic' | 'formalize';

export const TIP_TEXT: Record<TipKey, ReactNode> = {
  'check-click': <>Click any line in the code box to see what Lean says about it on the right.</>,
  parsons: <>Tap a line from <b>Lines</b> to move it into <b>Your proof</b> (or drag it). Tap a line in your proof to select it, then use the arrows to reorder. Some lines are traps: leave those behind.</>,
  predict: <>Read the goal first. Then pick what it becomes after the highlighted line runs.</>,
  tactic: <>This is tactic mode (<code>:= by</code>): each line changes the goal. Click a line to see the goal at that point. Click a hypothesis or an Inventory item to insert it. Type two letters for suggestions.</>,
  formalize: <>Type a Lean statement. Watch &ldquo;Lean reads this as&rdquo; update, then press Check.</>,
};

/** A calm one-time inline banner. Never blocks; "Got it" (or solving the level) retires it for good. */
export function FirstTimeTip({ tip, solved = false }: { tip: TipKey; solved?: boolean }) {
  const key = `tip:${tip}`;
  const seen = useGame((s) => !!s.save.seen[key]);
  useEffect(() => {
    if (solved && !seen) game().markSeen(key);
  }, [solved, seen, key]);
  if (seen) return null;
  return (
    <div className="first-tip" role="note">
      <p>{TIP_TEXT[tip]}</p>
      <button type="button" className="btn small ghost" onClick={() => game().markSeen(key)}>Got it</button>
    </div>
  );
}
