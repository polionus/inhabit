/**
 * Synthesised sound effects (Web Audio, no audio files). Quiet by design.
 *
 *   sfx.play('solve')
 *
 * - Gated by `settings.sound` (read from the game store at call time).
 * - Plays only after the page has had a user gesture (browsers require it); before that, calls
 *   are silently dropped.
 * - Never throws: if Web Audio is missing or fails, it does nothing.
 */
import { store } from '../game.ts';

export type SfxName = 'tap' | 'correct' | 'wrong' | 'solve' | 'star' | 'levelup' | 'quest' | 'win' | 'lose' | 'tick' | 'badge' | 'open';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let gestured = false;

function markGesture() {
  gestured = true;
  try {
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* ignore */
  }
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, markGesture, { capture: true, passive: true });
}

function hasGesture(): boolean {
  if (gestured) return true;
  try {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua?.hasBeenActive) gestured = true;
  } catch {
    /* ignore */
  }
  return gestured;
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return master ? { ctx, out: master } : null;
  } catch {
    return null;
  }
}

/** One enveloped oscillator note. `t` = start offset in seconds. */
function note(a: { ctx: AudioContext; out: GainNode }, freq: number, t: number, dur: number, o: { type?: OscillatorType; vol?: number; to?: number; attack?: number } = {}) {
  const { ctx: c, out } = a;
  const start = c.currentTime + t;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, start);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + dur);
  const vol = o.vol ?? 0.5;
  const atk = o.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

const N = (semis: number) => 523.25 * Math.pow(2, semis / 12); // C5 = 0

const RECIPES: Record<SfxName, (a: { ctx: AudioContext; out: GainNode }) => void> = {
  tap: (a) => note(a, 880, 0, 0.05, { type: 'sine', vol: 0.25 }),
  tick: (a) => note(a, 1400, 0, 0.03, { type: 'square', vol: 0.06 }),
  open: (a) => note(a, N(7), 0, 0.09, { type: 'sine', vol: 0.25, to: N(12) }),
  correct: (a) => {
    note(a, N(4), 0, 0.12, { vol: 0.4 });
    note(a, N(9), 0.08, 0.22, { vol: 0.4 });
  },
  wrong: (a) => note(a, 220, 0, 0.2, { type: 'triangle', vol: 0.35, to: 160 }),
  solve: (a) => {
    [0, 4, 7, 12].forEach((s, i) => note(a, N(s), i * 0.07, 0.28, { vol: 0.38 }));
    note(a, N(24), 0.3, 0.5, { type: 'sine', vol: 0.12 });
  },
  star: (a) => {
    note(a, N(16), 0, 0.12, { type: 'sine', vol: 0.3 });
    note(a, N(19), 0.06, 0.2, { type: 'sine', vol: 0.25 });
  },
  badge: (a) => {
    [7, 12, 16].forEach((s, i) => note(a, N(s), i * 0.06, 0.25, { type: 'sine', vol: 0.3 }));
  },
  quest: (a) => {
    note(a, N(7), 0, 0.15, { vol: 0.35 });
    note(a, N(12), 0.1, 0.35, { vol: 0.35 });
    note(a, N(19), 0.2, 0.4, { type: 'sine', vol: 0.12 });
  },
  levelup: (a) => {
    [0, 4, 7, 12, 16].forEach((s, i) => note(a, N(s), i * 0.075, 0.32, { vol: 0.34 }));
    [12, 16, 19].forEach((s) => note(a, N(s), 0.42, 0.7, { type: 'sine', vol: 0.14 }));
  },
  win: (a) => {
    [0, 4, 7].forEach((s, i) => note(a, N(s), i * 0.09, 0.2, { vol: 0.36 }));
    [12, 16, 19, 24].forEach((s) => note(a, N(s), 0.3, 0.8, { vol: 0.16 }));
  },
  lose: (a) => {
    [7, 3, 0].forEach((s, i) => note(a, N(s - 12), i * 0.12, 0.3, { vol: 0.3 }));
  },
};

function enabled(): boolean {
  try {
    return store.getState().save.settings.sound !== false;
  } catch {
    return false;
  }
}

export const sfx = {
  /** Play a named effect (if sound is on and the page has had a gesture). Never throws. */
  play(name: SfxName): void {
    try {
      if (!enabled() || !hasGesture()) return;
      const a = audio();
      if (!a) return;
      RECIPES[name]?.(a);
    } catch {
      /* never throw from a sound */
    }
  },
};
