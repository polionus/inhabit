import { useRef, useState } from 'react';
import { useDisc } from '../context.tsx';
import { game, useGame } from '../store.ts';
import { CORE_BADGES, dayKey } from '../state/game.ts';
import { worldMastery } from '../state/meta.ts';
import { availablePresetsFor } from '../theme/index.ts';
import { usePlayer } from '../usePlayer.ts';
import { PlayerCard } from '../shell/PlayerCard.tsx';
import { Card, Icon, ProgressBar, ScreenHeader, StatTile, type IconName } from '../components/kit.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';
import { href } from '../router.ts';

const DEFAULT_GROUPS: { id: string; title: string; icon: IconName }[] = [
  { id: 'path', title: 'The path', icon: 'map' },
  { id: 'craft', title: 'Craft', icon: 'workshop' },
  { id: 'memory', title: 'Memory', icon: 'review' },
  { id: 'practice', title: 'Practice', icon: 'bolt' },
  { id: 'reading', title: 'Reading', icon: 'guide' },
  { id: 'arena', title: 'Arena', icon: 'arena' },
];

export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg-field" role="radiogroup" aria-label={label}>
      <span className="seg-label">{label}</span>
      <div className="seg">
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span className="tr-text"><span className="tr-label">{label}</span>{desc && <span className="tr-desc">{desc}</span>}</span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function ProfileScreen() {
  const disc = useDisc();
  const save = useGame((s) => s.save);
  const s = save.settings;
  const p = usePlayer();
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const levels = Object.values(save.levels);
  const solved = levels.filter((l) => l.status === 'solved' && !l.testedOut).length;
  const clean = levels.filter((l) => l.clean).length;

  const badges = disc.progression?.badges ?? CORE_BADGES;
  const groups = disc.progression?.badgeGroups ?? DEFAULT_GROUPS;
  const earned = badges.filter((b) => save.badges[b.id]).length;

  const presets = availablePresetsFor(disc.theme);
  const showPalettePicker = disc.theme?.allowPalettePicker !== false && presets.length > 1;
  const discDefaultPalette = disc.theme?.preset ?? 'indigo';
  const activePalette = s.palette && presets.some((x) => x.id === s.palette) ? s.palette : discDefaultPalette;

  const ExtraProfileStats = disc.hooks?.profileStats;
  const ExtraSettings = disc.hooks?.extraSettings;

  const exportSave = () => {
    const blob = new Blob([game().exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${disc.brand.id}-save-${dayKey(Date.now())}.json`;
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
          <StatTile icon="trophy" tone="primary" value={earned} label={`of ${badges.length} achievements`} />
          <StatTile icon="review" value={save.reviewsPassed} label="reviews passed" />
          {ExtraProfileStats && <ExtraProfileStats />}
        </div>
      </div>

      <h2 className="section-title"><Icon name="map" size={20} /> Worlds</h2>
      <ul className="world-stars">
        {disc.worlds.filter((w) => w.levels.length > 0).map((w) => {
          const st = worldStatus(w, save, disc.worlds);
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

      <h2 className="section-title"><Icon name="check-circle" size={20} /> Mastery</h2>
      <p className="muted small mastery-note">Levels you solved yourself. A level whose solution you looked at is marked studied and counts in full once you solve it on your own.</p>
      <ul className="mastery-list">
        {disc.worlds.filter((w) => w.levels.length > 0).map((w) => {
          const m = worldMastery(w, save);
          return (
            <li key={w.id}>
              <a href={href.world(w.id)} className="mastery-row">
                <span className="ms-title">{w.title}</span>
                <ProgressBar value={m.total ? m.unaided / m.total : 0} tone="ok" size="xs" label={`${w.title}: ${m.unaided} of ${m.total} solved on your own`} />
                <span className="ms-nums tnum">
                  <span title="Solved on your own">{m.unaided}/{m.total} own</span>
                  <span className="ms-sep" aria-hidden="true">·</span>
                  <span title="Solved without hints">{m.clean} no hints</span>
                  {m.studied > 0 && <><span className="ms-sep" aria-hidden="true">·</span><span className="ms-studied" title="Solution seen">{m.studied} studied</span></>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      <h2 className="section-title"><Icon name="trophy" size={20} /> Achievements <span className="count tnum">{earned}/{badges.length}</span></h2>
      {groups.map((g) => {
        const list = badges.filter((b) => (b.group ?? 'path') === g.id);
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
          {showPalettePicker && (
            <div className="seg-field" role="radiogroup" aria-label="Color palette">
              <span className="seg-label">Color palette</span>
              <div className="palette-grid">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={activePalette === preset.id}
                    className={`palette-swatch ${activePalette === preset.id ? 'on' : ''}`}
                    title={preset.description}
                    onClick={() => game().setSettings({ palette: preset.id })}
                  >
                    <span className="palette-dots" aria-hidden="true">
                      {preset.swatches.map((hex, i) => (
                        <span key={i} className="palette-dot" style={{ background: hex }} />
                      ))}
                    </span>
                    <span className="palette-name">{preset.name}</span>
                    {preset.id === discDefaultPalette && <span className="palette-badge">Default</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Seg label="Motion" value={s.motion} options={[['system', 'System'], ['full', 'Full'], ['reduce', 'Reduced']]} onChange={(v) => game().setSettings({ motion: v })} />
          <label className="range-field">
            <span className="seg-label">Code font size <span className="tnum muted">{s.fontSize}px</span></span>
            <input type="range" min={12} max={22} value={s.fontSize} onChange={(e) => game().setSettings({ fontSize: Number(e.target.value) })} />
          </label>
          <Toggle label="Sound effects" desc="Quiet, synthesised sounds for solves, stars and quests." checked={s.sound} onChange={(v) => game().setSettings({ sound: v })} />
          <Seg label="Open the lesson" value={s.lessonMode} options={[['auto', 'When a level teaches something new'], ['open', 'Always'], ['closed', 'Never']]} onChange={(v) => game().setSettings({ lessonMode: v })} />
          {ExtraSettings && <ExtraSettings />}
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
