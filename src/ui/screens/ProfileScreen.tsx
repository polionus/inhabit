import { useRef, useState } from 'react';
import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { BADGES, dayKey, type BadgeDef } from '../../state/game.ts';
import { useArenaSummary } from '../../arena/state/summary.ts';
import { usePlayer } from '../usePlayer.ts';
import { PlayerCard } from '../shell/PlayerCard.tsx';
import { Card, Icon, ProgressBar, ScreenHeader, StatTile, type IconName } from '../components/kit.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';
import { href } from '../router.ts';

const GROUPS: { id: NonNullable<BadgeDef['group']>; title: string; icon: IconName }[] = [
  { id: 'path', title: 'The path', icon: 'map' },
  { id: 'craft', title: 'Craft', icon: 'workshop' },
  { id: 'memory', title: 'Memory', icon: 'review' },
  { id: 'reading', title: 'Reading', icon: 'guide' },
  { id: 'arena', title: 'Arena', icon: 'arena' },
];

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg-field" role="radiogroup" aria-label={label}>
      <span className="seg-label">{label}</span>
      <div className="seg">
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span className="tr-text"><span className="tr-label">{label}</span>{desc && <span className="tr-desc">{desc}</span>}</span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function ProfileScreen() {
  const save = useGame((s) => s.save);
  const s = save.settings;
  const p = usePlayer();
  const arena = useArenaSummary();
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const levels = Object.values(save.levels);
  const solved = levels.filter((l) => l.status === 'solved').length;
  const clean = levels.filter((l) => l.clean).length;
  const earned = BADGES.filter((b) => save.badges[b.id]).length;

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
    <div className="page profile">
      <ScreenHeader id="profile" title="Profile" icon="profile" />
      <div className="profile-top">
        <PlayerCard variant="large" active={false} />
        <div className="profile-stats">
          <StatTile icon="check" tone="ok" value={solved} label="levels solved" sub={`${clean} without hints`} />
          <StatTile icon="star" tone="gold" value={p.stars} label={`of ${p.starsMax} stars`} />
          <StatTile icon="flame" tone="flame" value={p.streak.current} label="day streak" sub={`Best ${p.streak.best} · ${save.activeDays.length} days in all`} />
          <StatTile icon="trophy" tone="primary" value={earned} label={`of ${BADGES.length} achievements`} />
          <StatTile icon="review" value={save.reviewsPassed} label="reviews passed" />
          <StatTile icon="arena" value={arena.rating ?? '—'} label="Arena rating" href={href.arena()} sub={arena.rating === null ? 'Play a rated puzzle to get one' : `${arena.solved} rated puzzles solved`} />
        </div>
      </div>

      <h2 className="section-title"><Icon name="map" size={20} /> Worlds</h2>
      <ul className="world-stars">
        {data.worlds.filter((w) => w.levels.length > 0).map((w) => {
          const st = worldStatus(w, save);
          return (
            <li key={w.id}>
              <a href={href.world(w.id)} className="ws-row">
                <WorldToken world={w} size={44} state={st.state} progress={st.frac} badge={false} />
                <span className="ws-main">
                  <span className="ws-title">{w.title}</span>
                  <ProgressBar value={st.stars.total ? st.stars.earned / st.stars.total : 0} tone="gold" size="xs" label={`${w.title}: ${st.stars.earned} of ${st.stars.total} stars`} />
                </span>
                <span className="ws-num tnum"><Icon name="star" size={14} className="goldc" /> {st.stars.earned}/{st.stars.total}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <h2 className="section-title"><Icon name="trophy" size={20} /> Achievements <span className="count tnum">{earned}/{BADGES.length}</span></h2>
      {GROUPS.map((g) => {
        const list = BADGES.filter((b) => (b.group ?? 'path') === g.id);
        if (!list.length) return null;
        const got = list.filter((b) => save.badges[b.id]).length;
        return (
          <section key={g.id} className="badge-group" aria-labelledby={`bg-${g.id}`}>
            <h3 id={`bg-${g.id}`}><Icon name={g.icon} size={16} /> {g.title} <span className="muted tnum">{got}/{list.length}</span></h3>
            <ul className="badges">
              {list.map((b) => {
                const at = save.badges[b.id];
                return (
                  <li key={b.id} className={at ? 'got' : 'not'}>
                    <span className="badge-medal" aria-hidden="true"><Icon name={at ? g.icon : 'lock'} size={20} /></span>
                    <span className="badge-text">
                      <strong>{b.title}</strong>
                      <span className="small">{b.desc}</span>
                      <span className="sr-only">{at ? 'Earned' : 'Not yet earned'}</span>
                    </span>
                    {at && <span className="badge-date tnum">{new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div className="profile-bottom">
        <Card as="section" className="settings-card" aria-labelledby="set-h">
          <h2 id="set-h" className="card-title"><Icon name="sun" size={18} /> Settings</h2>
          <Seg label="Theme" value={s.theme} options={[['system', 'System'], ['dark', 'Dark'], ['light', 'Light']]} onChange={(v) => game().setSettings({ theme: v })} />
          <Seg label="Motion" value={s.motion} options={[['system', 'System'], ['full', 'Full'], ['reduce', 'Reduced']]} onChange={(v) => game().setSettings({ motion: v })} />
          <label className="range-field">
            <span className="seg-label">Editor font size <span className="tnum muted">{s.fontSize}px</span></span>
            <input type="range" min={12} max={22} value={s.fontSize} onChange={(e) => game().setSettings({ fontSize: Number(e.target.value) })} />
          </label>
          <Toggle label="Sound effects" desc="Quiet, synthesised sounds for solves, stars and quests." checked={s.sound} onChange={(v) => game().setSettings({ sound: v })} />
          <Toggle label="Open lessons by default" desc="Show each unsolved level's lesson expanded under the task." checked={s.lessonsOpen} onChange={(v) => game().setSettings({ lessonsOpen: v })} />
          <Toggle label="Tactic inventory lock" desc="Only allow tactics you have unlocked." checked={s.strictInventory} onChange={(v) => game().setSettings({ strictInventory: v })} />
        </Card>
        <Card as="section" className="save-card" aria-labelledby="save-h">
          <h2 id="save-h" className="card-title"><Icon name="download" size={18} /> Your save</h2>
          <p className="muted small">Progress is stored in this browser only. Export it to keep a copy or move to another device.</p>
          <div className="actions">
            <button className="btn" onClick={exportSave}><Icon name="download" size={18} /> Export</button>
            <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={18} /> Import</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importSave(e.target.files[0])} />
          </div>
          {!confirm ? (
            <button className="btn danger" onClick={() => setConfirm(true)}><Icon name="reset" size={18} /> Reset everything…</button>
          ) : (
            <div className="confirm" role="alert">
              <p>This erases all progress in this browser.</p>
              <div className="actions">
                <button className="btn danger" onClick={() => { game().resetAll(); setConfirm(false); setMsg('Progress reset.'); }}>Yes, erase</button>
                <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
          {msg && <p role="status" className="ok-line">{msg}</p>}
        </Card>
      </div>
    </div>
  );
}
