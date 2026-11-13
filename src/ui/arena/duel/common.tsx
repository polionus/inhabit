/** Small pieces shared by the duel screens. */
import { useState } from 'react';
import type { Puzzle } from '../../../arena/types.ts';
import { DUEL_FORMATS, type DuelFormat } from '../../../arena/plan.ts';
import { DUEL_CAP_MS } from '../../../arena/state/duel.ts';
import type { Bot } from '../../../arena/state/duelBots.ts';
import { seedFrom } from '../../../arena/state/duelBots.ts';
import { arenaStore, useArena } from '../../../arena/state/store.ts';
import { migrateDuel, type DuelData, type DuelHistoryEntry } from '../../../arena/state/duelStore.ts';
import { recordDuel } from '../../../arena/state/duelStore.ts';
import { Icon } from '../../components/kit.tsx';
import { copyText, shareOrCopy } from '../ShareButton.tsx';

/** Hand-off between the hub and the screens it opens (lost on reload, which then falls back to the hub). */
export const nav: { format: DuelFormat; bot: { botId: string; format: DuelFormat } | null; host: { format: DuelFormat } | null; make: { format: DuelFormat; seed: string } | null } = {
  format: 'standard',
  bot: null,
  host: null,
  make: null,
};

export const randomSeed = (): string => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return seedFrom(() => a[0] / 4294967296);
};

export const useMyName = (): string => useArena((s) => s.displayName) || 'Player';

export const useDuelData = (): DuelData => {
  const raw = useArena((s) => s.duel);
  return migrateDuel(raw);
};

export function saveDuel(entry: DuelHistoryEntry, botId?: string): void {
  const st = arenaStore.getState();
  st.setDuelState(recordDuel(migrateDuel(st.duel), entry, botId));
}

export const fmtSecs = (ms: number): string => (ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`);

export const puzzleLabel = (p: Puzzle): string => (p.kind === 'quick' ? `Quick, ${p.quick.replace('-', ' ')}` : { prop: 'Propositions', inhabit: 'Terms', quant: 'Quantifiers', set: 'Sets' }[p.family]);

export function Avatar({ bot, size = 44 }: { bot: Bot; size?: number }) {
  return (
    <span className="dl-avatar" style={{ width: size, height: size, fontSize: size * 0.5, background: `hsl(${bot.hue} 55% 36%)`, borderColor: `hsl(${bot.hue} 60% 62%)` }} aria-hidden="true">
      {bot.glyph}
    </span>
  );
}

export const BotBadge = () => <span className="dl-bot-badge" title="This opponent is a program, not a person">bot</span>;

export function FormatPicker({ value, onChange, label = 'Format' }: { value: DuelFormat; onChange: (f: DuelFormat) => void; label?: string }) {
  return (
    <div className="dl-formats" role="radiogroup" aria-label={label}>
      {(Object.keys(DUEL_FORMATS) as DuelFormat[]).map((f) => (
        <button key={f} type="button" role="radio" aria-checked={value === f} className={`dl-format ${value === f ? 'on' : ''}`} onClick={() => onChange(f)}>
          <strong>{DUEL_FORMATS[f].title}</strong>
          <span className="small">{DUEL_FORMATS[f].desc}</span>
          <span className="muted small tnum">up to {DUEL_CAP_MS[f] / 60_000} min</span>
        </button>
      ))}
    </div>
  );
}

/** A link with Copy and Share buttons and a visible confirmation. */
export function LinkBox({ url, shareTitle, shareText }: { url: string; shareTitle: string; shareText?: string }) {
  const [msg, setMsg] = useState('');
  return (
    <div className="dl-linkbox">
      <input className="dl-link" readOnly value={url} aria-label="Link" onFocus={(e) => e.currentTarget.select()} />
      <div className="dl-linkbtns">
        <button type="button" className="btn" onClick={async () => setMsg((await copyText(url)) ? 'Copied.' : 'Could not copy; select the link and copy it by hand.')}><Icon name="copy" size={16} /> Copy</button>
        <button type="button" className="btn primary" onClick={async () => {
          const o = await shareOrCopy(url, shareTitle, shareText);
          setMsg(o === 'copied' ? 'Link copied.' : o === 'shared' ? 'Shared.' : o === 'failed' ? 'Could not share; copy the link by hand.' : '');
        }}><Icon name="external" size={16} /> Share</button>
      </div>
      <p className="dl-msg small" role="status" aria-live="polite">{msg}</p>
    </div>
  );
}
