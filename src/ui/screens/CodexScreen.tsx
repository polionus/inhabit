import { useMemo, useState } from 'react';
import type { CodexEntry } from '../../content/types.ts';
import { data } from '../data.ts';
import { useGame } from '../game.ts';
import { CodexCard } from '../components/CodexCard.tsx';

const KINDS: { k: CodexEntry['kind']; label: string }[] = [
  { k: 'concept', label: 'Concepts' },
  { k: 'tactic', label: 'Tactics' },
  { k: 'term', label: 'Terms' },
  { k: 'symbol', label: 'Symbols' },
  { k: 'definition', label: 'Definitions' },
];

export function unlockedCodex(levels: Record<string, { status: string }>): Set<string> {
  const out = new Set<string>();
  for (const w of data.worlds)
    for (const l of w.levels) {
      if (!levels[l.id]) continue; // visited or passed
      l.unlocks?.codex?.forEach((c) => out.add(c));
      l.unlocks?.tactics?.forEach((c) => out.add(c));
    }
  return out;
}

function whereUnlocked(id: string): string | null {
  for (const w of data.worlds)
    for (let i = 0; i < w.levels.length; i++) {
      const u = w.levels[i].unlocks;
      if (u?.codex?.includes(id) || u?.tactics?.includes(id)) return `${w.title}, level ${i + 1}`;
    }
  return null;
}

export function CodexScreen({ focus }: { focus?: string }) {
  const levels = useGame((s) => s.save.levels);
  const unlocked = useMemo(() => unlockedCodex(levels), [levels]);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const entries = data.allCodex;
  const match = (e: CodexEntry) => !query || (e.name + ' ' + e.summary + ' ' + e.body).toLowerCase().includes(query);
  const unlockedCount = entries.filter((e) => unlocked.has(e.id)).length;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Codex</h1>
          <p className="muted">{unlockedCount} of {entries.length} entries found. Your own reference, filled in as you play.</p>
        </div>
        <label className="search">
          <span className="sr-only">Search the codex</span>
          <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {entries.length === 0 && <p className="notice">The codex is empty so far.</p>}
      {KINDS.map(({ k, label }) => {
        const es = entries.filter((e) => e.kind === k && match(e));
        if (!es.length) return null;
        return (
          <section key={k} className="codex-group">
            <h2>{label}</h2>
            <div className="codex-grid">
              {es.map((e) =>
                unlocked.has(e.id) ? (
                  <div key={e.id} id={`codex-${e.id}`} className={focus === e.id ? 'focus-card' : ''} ref={(el) => focus === e.id && el?.scrollIntoView({ block: 'center' })}>
                    <CodexCard entry={e} />
                  </div>
                ) : (
                  <article key={e.id} className="codex-card locked" aria-label="Locked entry">
                    <h3><span className="tag">{e.kind}</span> <span className="silhouette" aria-hidden="true">{'▒'.repeat(Math.min(8, Math.max(3, e.name.length)))}</span></h3>
                    <p className="muted small">Unlocks in {whereUnlocked(e.id) ?? 'a later level'}.</p>
                  </article>
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
