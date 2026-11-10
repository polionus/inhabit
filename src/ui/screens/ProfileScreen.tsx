import { useRef, useState } from 'react';
import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { BADGES, currentStreak, rankFor } from '../../state/game.ts';
import { worldComplete, worldIsEmpty, worldProgress } from '../../state/progress.ts';
import { dayKey } from '../../state/game.ts';

export function ProfileScreen() {
  const save = useGame((s) => s.save);
  const s = save.settings;
  const rank = rankFor(save.xp);
  const streak = currentStreak(save.activeDays, Date.now());
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const levels = Object.values(save.levels);
  const solved = levels.filter((l) => l.status === 'solved').length;
  const studied = levels.filter((l) => l.status === 'studied').length;

  const exportSave = () => {
    const blob = new Blob([game().exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inhabit-save-${dayKey(Date.now())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importSave = async (f: File) => {
    const r = game().importJson(await f.text());
    setMsg(r.ok ? 'Save imported.' : (r.error ?? 'Import failed.'));
  };

  return (
    <div className="page narrow profile">
      <h1>Profile</h1>
      <section className="stats">
        <div className="stat"><div className="big">{rank.title}</div><div className="muted small">{save.xp} XP{rank.next ? ` · ${rank.next.at - save.xp} to ${rank.next.title}` : ''}</div>
          <div className="bar wide" role="progressbar" aria-label="Progress to next rank" aria-valuenow={Math.round(rank.frac * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${rank.frac * 100}%` }} /></div></div>
        <div className="stat"><div className="big">{solved}</div><div className="muted small">solved</div></div>
        <div className="stat"><div className="big">{studied}</div><div className="muted small">studied</div></div>
        <div className="stat"><div className="big">{streak}</div><div className="muted small">{streak === 1 ? 'day' : 'days'} in a row · {save.activeDays.length} days total</div></div>
      </section>

      <h2>Mastery</h2>
      <ul className="plain">
        {data.worlds.filter((w) => !worldIsEmpty(w)).map((w) => {
          const p = worldProgress(w, save.levels);
          const clean = w.levels.filter((l) => save.levels[l.id]?.clean).length;
          return <li key={w.id}>{w.title}: {p.done}/{p.total}{worldComplete(w, save.levels) ? ' ✓' : ''} <span className="muted">· {clean} solved without hints</span></li>;
        })}
      </ul>

      <h2>Badges</h2>
      <ul className="badges">
        {BADGES.map((b) => {
          const got = save.badges[b.id];
          return (
            <li key={b.id} className={got ? 'got' : 'not'}>
              <strong>{b.title}</strong>
              <span className="muted small">{b.desc}</span>
              <span className="sr-only">{got ? 'Earned' : 'Not yet earned'}</span>
            </li>
          );
        })}
      </ul>

      <h2>Settings</h2>
      <div className="settings">
        <label>Theme
          <select value={s.theme} onChange={(e) => game().setSettings({ theme: e.target.value as typeof s.theme })}>
            <option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
        <label>Editor font size: {s.fontSize}px
          <input type="range" min={12} max={22} value={s.fontSize} onChange={(e) => game().setSettings({ fontSize: Number(e.target.value) })} />
        </label>
        <label>Motion
          <select value={s.motion} onChange={(e) => game().setSettings({ motion: e.target.value as typeof s.motion })}>
            <option value="system">Match system</option><option value="reduce">Reduce</option><option value="full">Full</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.strictInventory} onChange={(e) => game().setSettings({ strictInventory: e.target.checked })} />
          Keep the tactic inventory lock (only use tactics you have unlocked)
        </label>
      </div>

      <h2>Your save</h2>
      <div className="actions">
        <button className="btn" onClick={exportSave}>Export save</button>
        <button className="btn" onClick={() => file.current?.click()}>Import save</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importSave(e.target.files[0])} />
        {!confirm ? (
          <button className="btn danger" onClick={() => setConfirm(true)}>Reset everything…</button>
        ) : (
          <span className="confirm" role="alert">
            This erases all progress. <button className="btn danger" onClick={() => { game().resetAll(); setConfirm(false); setMsg('Progress reset.'); }}>Yes, erase</button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
          </span>
        )}
      </div>
      {msg && <p role="status" className="muted">{msg}</p>}
      <p className="muted small">Progress is stored in this browser only.</p>
    </div>
  );
}
