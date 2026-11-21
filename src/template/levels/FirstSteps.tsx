import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDisc } from '../context.tsx';
import { game, useGame } from '../store.ts';

/**
 * A one-time, multi-step pointer sequence on the disc's opening level for a brand-new player.
 * Non-modal: never takes focus and never blocks typing. Escape or "Skip" dismisses it for good.
 */
const SEEN_KEY = 'first-steps';

interface Box { top: number; left: number; width: number; height: number }
const rectOf = (r: DOMRect): Box => ({ top: r.top, left: r.left, width: r.width, height: r.height });

export function FirstSteps() {
  const disc = useDisc();
  const cfg = disc.firstSteps;
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

  const steps = cfg?.steps ?? [];
  const levelHash = cfg ? `#/level/${encodeURIComponent(cfg.levelId)}` : '';
  const active = !!cfg && steps.length > 0 && hash === levelHash && !seen && !anyPassed;

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

  const cur = steps[step];
  const measure = useCallback(() => {
    if (!cur) return;
    const el = document.querySelector(cur.target);
    setVh(window.innerHeight);
    setNarrow(window.innerWidth <= 900);
    const same = (b: Box | null, r: Box | null) => (b && r ? b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height : b === r);
    const a = cur.anchor ? document.querySelector(cur.anchor) : el;
    const rb = el ? rectOf(el.getBoundingClientRect()) : null;
    const ra = a ? rectOf(a.getBoundingClientRect()) : rb;
    setBox((b) => (same(b, rb) ? b : rb));
    setAnchor((b) => (same(b, ra) ? b : ra));
  }, [cur]);

  useEffect(() => {
    if (!active || !cur) return;
    const el = document.querySelector(cur.target);
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
  }, [active, cur, measure]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  }, [step, box, anchor]);

  if (!active || !cur) return null;

  const last = step === steps.length - 1;
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
      <div ref={card} className="fs-card" role="group" aria-label={`First steps, ${cur.title}`} style={style}>
        <div className="fs-step">{cur.title}</div>
        <p className="fs-text">{cur.text}</p>
        <div className="fs-actions">
          <button type="button" className="btn small ghost" onClick={dismiss}>Skip</button>
          <button type="button" className="btn small primary" onClick={next}>{last ? 'Got it' : 'Next'}</button>
        </div>
      </div>
    </>,
    document.body,
  );
}
