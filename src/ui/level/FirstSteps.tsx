import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { game, useGame } from '../game.ts';

/**
 * A one-time, three-step pointer sequence on the very first level for a brand-new player
 * ("this is the task", "type here", "this shows what Lean still needs"). Non-modal: it never
 * takes focus and never blocks typing. Escape or "Skip" dismisses it for good.
 * Mounted from LessonPanel (present on every level) and gates itself on the route.
 */
const LEVEL_HASH = '#/level/types-01';
const SEEN_KEY = 'first-steps';

/** `target` is outlined; the card sits under `anchor` (default: the target) so it hides no text. */
const STEPS: { target: string; anchor?: string; title: string; text: React.ReactNode }[] = [
  { target: '.task-title-row', anchor: '.task-intro', title: '1 of 3', text: <>This is the task.</> },
  { target: '.editor-panel .editor', title: '2 of 3', text: <>Type your answer here, in place of <code>sorry</code>.</> },
  { target: '.infoview', title: '3 of 3', text: <>This panel shows what Lean still needs.</> },
];

interface Box { top: number; left: number; width: number; height: number }
const rectOf = (r: DOMRect): Box => ({ top: r.top, left: r.left, width: r.width, height: r.height });

export function FirstSteps() {
  const seen = useGame((s) => !!s.save.seen[SEEN_KEY]);
  const anyPassed = useGame((s) => Object.values(s.save.levels).some((p) => p?.status === 'solved' || p?.status === 'studied'));
  const [hash, setHash] = useState(() => window.location.hash);
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [anchor, setAnchor] = useState<Box | null>(null);
  const [vh, setVh] = useState(() => window.innerHeight);
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 900);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(110);
  const active = hash === LEVEL_HASH && !seen && !anyPassed;

  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const dismiss = useCallback(() => game().markSeen(SEEN_KEY), []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, dismiss]);

  const measure = useCallback(() => {
    const el = document.querySelector(STEPS[step].target);
    setVh(window.innerHeight);
    setNarrow(window.innerWidth <= 900);
    const same = (b: Box | null, r: Box | null) => (b && r ? b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height : b === r);
    const a = STEPS[step].anchor ? document.querySelector(STEPS[step].anchor!) : el;
    const rb = el ? rectOf(el.getBoundingClientRect()) : null;
    const ra = a ? rectOf(a.getBoundingClientRect()) : rb;
    setBox((b) => (same(b, rb) ? b : rb));
    setAnchor((b) => (same(b, ra) ? b : ra));
  }, [step]);

  useEffect(() => {
    if (!active) return;
    // On a stacked (phone) layout the target may be off screen: bring it into view once per step.
    const el = document.querySelector(STEPS[step].target);
    if (el && window.innerWidth <= 900) {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
    measure();
    const t = window.setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, step, measure]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  }, [step, box, anchor]);

  if (!active) return null;

  const last = step === STEPS.length - 1;
  const next = () => (last ? dismiss() : setStep(step + 1));
  const margin = 12;
  let style: React.CSSProperties;
  if (narrow || !box || !anchor) {
    style = { left: margin, right: margin, bottom: margin };
  } else {
    const w = Math.min(320, window.innerWidth - 2 * margin);
    const left = Math.max(margin, Math.min(anchor.left + 12, window.innerWidth - w - margin));
    let top: number;
    if (anchor.height > 260) top = Math.min(anchor.top + anchor.height, vh) - cardH - margin;
    else if (anchor.top + anchor.height + 10 + cardH < vh) top = anchor.top + anchor.height + 10;
    else top = anchor.top - cardH - 10;
    style = { left, top: Math.max(margin, top), width: w };
  }
  const ringBox = box && box.height > 0 ? box : null;

  return createPortal(
    <>
      {ringBox && <div className="fs-ring" aria-hidden="true" style={{ top: ringBox.top - 4, left: ringBox.left - 4, width: ringBox.width + 8, height: ringBox.height + 8 }} />}
      <div ref={card} className="fs-card" role="group" aria-label={`First steps, ${STEPS[step].title}`} style={style}>
        <div className="fs-step">{STEPS[step].title}</div>
        <p className="fs-text">{STEPS[step].text}</p>
        <div className="fs-actions">
          <button type="button" className="btn small ghost" onClick={dismiss}>Skip</button>
          <button type="button" className="btn small primary" onClick={next}>{last ? 'Got it' : 'Next'}</button>
        </div>
      </div>
    </>,
    document.body,
  );
}
