/**
 * Celebrations: a short particle burst on a full-screen canvas (pointer-events: none).
 *
 *   celebrate('solve')                    small burst from the centre
 *   celebrate('boss', { x, y })           bigger burst from a point (client px)
 *   celebrate('world')                    confetti rain plus bursts
 *
 * Kinds, smallest to largest: 'tick' (a ring pulse), 'solve', 'star', 'quest', 'levelup', 'boss',
 * 'win', 'world'. Does nothing when the user prefers reduced motion (system setting, or
 * `data-motion="reduce"` on <html>). Never throws.
 */
export type CelebrateKind = 'tick' | 'solve' | 'star' | 'quest' | 'levelup' | 'boss' | 'win' | 'world';

export function motionReduced(): boolean {
  try {
    const m = document.documentElement.getAttribute('data-motion');
    if (m === 'reduce') return true;
    if (m === 'full') return false;
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

interface Particle {
  x: number; y: number; vx: number; vy: number; rot: number; vr: number;
  w: number; h: number; color: string; life: number; max: number; shape: 0 | 1 | 2; drag: number; g: number;
}

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let rings: { x: number; y: number; t: number; color: string }[] = [];
let raf = 0;

function palette(): string[] {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return [v('--primary', '#6c4cf5'), v('--gold', '#ffc53d'), v('--ok', '#2fcf78'), v('--primary-text', '#b4a4ff'), '#ff6fa8', v('--info', '#4cc9ec')];
}

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'celebrate-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '95' });
    document.body.appendChild(canvas);
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const c = canvas.getContext('2d');
  c?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}

function burst(x: number, y: number, n: number, speed: number, colors: string[]) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.35 + Math.random() * 0.75);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.35,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
      color: colors[i % colors.length], life: 0, max: 55 + Math.random() * 45,
      shape: (i % 3) as 0 | 1 | 2, drag: 0.965, g: 0.22,
    });
  }
}

function rain(n: number, colors: string[]) {
  const w = window.innerWidth;
  for (let i = 0; i < n; i++) {
    particles.push({
      x: Math.random() * w, y: -20 - Math.random() * window.innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
      color: colors[i % colors.length], life: 0, max: 160 + Math.random() * 80,
      shape: (i % 3) as 0 | 1 | 2, drag: 0.99, g: 0.06,
    });
  }
}

function frame() {
  const c = ensureCanvas();
  if (!c) return;
  c.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => p.life < p.max && p.y < window.innerHeight + 40);
  for (const p of particles) {
    p.life++;
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const fade = Math.min(1, (p.max - p.life) / 20);
    c.globalAlpha = Math.max(0, fade);
    c.fillStyle = p.color;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    if (p.shape === 0) c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    else if (p.shape === 1) {
      c.beginPath();
      c.arc(0, 0, p.h * 0.6, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(0, -p.w * 0.6);
      c.lineTo(p.w * 0.5, p.w * 0.4);
      c.lineTo(-p.w * 0.5, p.w * 0.4);
      c.closePath();
      c.fill();
    }
    c.restore();
  }
  rings = rings.filter((r) => r.t < 1);
  for (const r of rings) {
    r.t += 0.045;
    c.globalAlpha = Math.max(0, 1 - r.t);
    c.strokeStyle = r.color;
    c.lineWidth = 4 * (1 - r.t) + 1;
    c.beginPath();
    c.arc(r.x, r.y, 12 + r.t * 70, 0, Math.PI * 2);
    c.stroke();
  }
  c.globalAlpha = 1;
  if (particles.length || rings.length) raf = requestAnimationFrame(frame);
  else {
    raf = 0;
    canvas?.remove();
    canvas = null;
  }
}

export function celebrate(kind: CelebrateKind, at?: { x: number; y: number }): void {
  try {
    if (typeof window === 'undefined' || motionReduced()) return;
    const colors = palette();
    const x = at?.x ?? window.innerWidth / 2;
    const y = at?.y ?? window.innerHeight * 0.42;
    switch (kind) {
      case 'tick':
        rings.push({ x, y, t: 0, color: colors[2] });
        break;
      case 'star':
        burst(x, y, 14, 7, [colors[1], colors[1], colors[3]]);
        break;
      case 'solve':
        rings.push({ x, y, t: 0, color: colors[2] });
        burst(x, y, 34, 9, colors);
        break;
      case 'quest':
        burst(x, y, 30, 8, [colors[1], colors[0], colors[2]]);
        break;
      case 'levelup':
        rings.push({ x, y, t: 0, color: colors[1] });
        burst(x, y, 60, 11, [colors[1], colors[1], colors[0], colors[3]]);
        break;
      case 'boss':
      case 'win':
        rings.push({ x, y, t: 0, color: colors[1] });
        burst(x, y, 90, 13, colors);
        setTimeout(() => burst(x - 160, y + 30, 40, 9, colors), 180);
        setTimeout(() => burst(x + 160, y + 30, 40, 9, colors), 300);
        break;
      case 'world':
        rain(200, colors);
        burst(window.innerWidth * 0.25, window.innerHeight * 0.5, 70, 12, colors);
        setTimeout(() => burst(window.innerWidth * 0.75, window.innerHeight * 0.5, 70, 12, colors), 220);
        setTimeout(() => burst(window.innerWidth * 0.5, window.innerHeight * 0.35, 90, 14, colors), 450);
        break;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  } catch {
    /* never throw from a celebration */
  }
}

/** Centre of an element, for `celebrate(kind, centerOf(el))`. */
export function centerOf(el: Element | null | undefined): { x: number; y: number } | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
