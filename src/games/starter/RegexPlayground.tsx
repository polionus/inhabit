import { useMemo, useState } from 'react';
import { Card } from '../../template/index.ts';

const PRESETS = [
  { label: 'Hex color', pattern: '#[0-9a-fA-F]{6}\\b', sample: 'Accent #f06a35 over #171210 (not #xyz).' },
  { label: 'Dates', pattern: '\\d{4}-\\d{2}-\\d{2}', sample: 'Released on 2026-11-21, patched 2026-12-01.' },
  { label: 'Repeated word', pattern: '\\bcolou?r\\b', sample: 'Both color and colour work, not colors.' },
];

export default function RegexPlayground() {
  const [pattern, setPattern] = useState(PRESETS[0].pattern);
  const [sample, setSample] = useState(PRESETS[0].sample);

  const matches = useMemo(() => {
    if (!pattern) return { ok: true as const, spans: [] as { start: number; end: number; text: string }[] };
    try {
      const re = new RegExp(pattern, 'g');
      const spans: { start: number; end: number; text: string }[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(sample)) !== null) {
        spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
        if (m[0].length === 0) re.lastIndex++;
      }
      return { ok: true as const, spans };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [pattern, sample]);

  return (
    <div className="pc-panel">
      <div className="pc-presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="btn small"
            onClick={() => {
              setPattern(p.pattern);
              setSample(p.sample);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Card className="pc-regex-box">
        <label className="pc-case-label" htmlFor="pg-pat">Pattern</label>
        <div className="pc-regex-row">
          <span className="pc-slash">/</span>
          <input id="pg-pat" className="pc-input" value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} />
          <span className="pc-slash">/g</span>
        </div>
        <label className="pc-case-label" htmlFor="pg-txt">Sample text</label>
        <input id="pg-txt" className="pc-input" style={{ padding: '6px 0' }} value={sample} onChange={(e) => setSample(e.target.value)} spellCheck={false} />
        {!matches.ok ? (
          <p className="feedback wrong">{matches.error}</p>
        ) : (
          <p className="muted small">
            Found <strong>{matches.spans.length}</strong> match{matches.spans.length === 1 ? '' : 'es'}:{' '}
            {matches.spans.map((s, i) => (
              <span key={`${s.start}-${i}`}>
                {i > 0 && ', '}
                <mark className="pc-hit">{s.text}</mark>
              </span>
            ))}
          </p>
        )}
      </Card>
    </div>
  );
}
