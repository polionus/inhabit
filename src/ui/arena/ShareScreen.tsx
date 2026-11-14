/**
 * `#/share/<code>`: a shared proof card. The payload is untrusted: Lean goes through the
 * highlighter (which escapes), everything else is rendered as plain text. The recipient's own
 * browser re-checks the proof with the real engine and says so honestly.
 */
import { useEffect, useState } from 'react';
import { decodeProof, type ProofCard } from '../../arena/net/codec.ts';
import { defaultSandbox } from '../../state/game.ts';
import { Lean } from '../components/Markdown.tsx';
import { Card, EmptyState, Icon, Modal, Pill } from '../components/kit.tsx';
import { data, engine } from '../data.ts';
import { game } from '../game.ts';
import { navigate } from '../router.ts';

export type Verdict =
  | { kind: 'complete' }
  | { kind: 'sorry' }
  | { kind: 'fails'; message: string }
  | { kind: 'incomplete'; message: string };

export function verdictOf(source: string): Verdict {
  const r = engine.check(data.fullEnv(), source);
  const err = r.diagnostics.find((d) => d.severity === 'error');
  if (err) return { kind: 'fails', message: err.message };
  if (r.complete) return { kind: 'complete' };
  if (r.diagnostics.some((d) => d.code === 'sorry') || /\bsorry\b/.test(source)) return { kind: 'sorry' };
  return { kind: 'incomplete', message: 'No theorem was found in this source.' };
}

/** Split a card's source into the statement (everything up to and including the first `:=`/`:= by` of the theorem) and the proof. */
export function splitStatement(source: string): { statement: string; proof: string; header: string } | null {
  const m = /^[ \t]*(theorem|lemma|example)\b/m.exec(source);
  if (!m) return null;
  const from = m.index;
  const rest = source.slice(from);
  const eq = /:=\s*(by\b)?/.exec(rest);
  if (!eq) return null;
  const end = from + eq.index + eq[0].length;
  const header = source.slice(0, end).replace(/\s+$/, '');
  return { statement: header, proof: source.slice(end).replace(/^\s*\n/, ''), header };
}

const KIND_LABEL: Record<ProofCard['kind'], string> = { level: 'From a level', workshop: 'From a Workshop theorem', sandbox: 'From a Sandbox', arena: 'From an Arena puzzle' };

export function ShareScreen({ code }: { code: string }) {
  const card = decodeProof(code);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [shown, setShown] = useState(false);
  const [ask, setAsk] = useState(false);
  const source = card?.source ?? '';

  useEffect(() => {
    if (!card) return;
    setVerdict(null);
    // A frame later, so the card paints first; the check itself is quick.
    const id = window.setTimeout(() => setVerdict(verdictOf(source)), 30);
    return () => clearTimeout(id);
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) {
    return (
      <div className="page narrow">
        <EmptyState glyph="?" title="This proof link is damaged" action={<a className="btn primary" href="#/">Start playing</a>}>
          The link is incomplete or was changed on the way. Ask the sender to share it again.
        </EmptyState>
      </div>
    );
  }

  const parts = splitStatement(source);
  const stmt = parts?.statement ?? null;
  const start = stmt ? stmt + (/by$/.test(stmt) ? '\n  sorry' : ' sorry') : null;

  const tryIt = () => {
    if (!start) return;
    const cur = game().save.sandbox;
    if (cur !== defaultSandbox && cur.trim() !== '' && cur !== start) setAsk(true);
    else go();
  };
  const go = () => {
    if (start) game().setSandbox(start);
    setAsk(false);
    navigate('#/sandbox');
  };

  return (
    <div className="page narrow share-card">
      <p className="eyebrow">Shared proof</p>
      <h1>{card.title}</h1>
      <p className="muted small">
        <Pill tone="neutral">{KIND_LABEL[card.kind]}</Pill>{' '}
        {card.by ? <span>by {card.by}</span> : <span>by someone</span>}
      </p>
      {card.english && <p className="share-english">{card.english}</p>}

      <section aria-label="Statement">
        <h2>The statement</h2>
        {stmt ? <Lean code={stmt} /> : <p className="muted">The statement is part of the proof below.</p>}
      </section>

      <Card as="section" aria-label="Verdict" tone={verdict?.kind === 'complete' ? 'ok' : 'flat'} className="share-verdict">
        {verdict === null && <p role="status"><Icon name="clock" size={16} /> Checking in your browser…</p>}
        {verdict?.kind === 'complete' && <p role="status"><Icon name="check-circle" size={18} /> <strong>Checked in your browser just now: this proof is complete.</strong></p>}
        {verdict?.kind === 'sorry' && <div role="status"><p><Icon name="warn" size={18} /> <strong>Checked in your browser just now: this contains <code>sorry</code>, so it is not a finished proof.</strong></p></div>}
        {verdict?.kind === 'fails' && <div role="status"><p><Icon name="warn" size={18} /> <strong>This proof does not check.</strong></p><p className="small">First error, in your browser&apos;s checker:</p><pre className="code share-err">{verdict.message}</pre></div>}
        {verdict?.kind === 'incomplete' && <p role="status"><Icon name="warn" size={18} /> <strong>This proof does not check.</strong> {verdict.message}</p>}
        <p className="muted small">The sender&apos;s claim means nothing here: your copy of the game checked it itself. It uses Inhabit&apos;s small Lean engine, which is close to real Lean but not the same program.</p>
      </Card>

      <section aria-label="The proof">
        <h2>The proof</h2>
        {!shown ? (
          <>
            <p>Want to try it first? The statement is all you need.</p>
            <div className="dl-actions">
              {start && <button className="btn primary big" onClick={tryIt}>Try it yourself</button>}
              <button className="btn" onClick={() => setShown(true)}>Show the proof</button>
            </div>
            {start && <p className="muted small">Try it yourself opens the Sandbox with the statement and <code>sorry</code> for you to replace.</p>}
          </>
        ) : (
          <Lean code={source} />
        )}
      </section>

      <Card as="section" aria-label="About Inhabit" tone="primary" className="share-cta">
        <h2>What is Inhabit?</h2>
        <p>Inhabit is a free game in your browser that teaches you to write and check proofs in Lean 4, one small puzzle at a time. No account, no download.</p>
        <a className="btn primary big" href="#/">Start playing</a>
      </Card>

      <Modal open={ask} onClose={() => setAsk(false)} title="Replace your Sandbox?" size="sm">
        <p>Your Sandbox already holds something of your own. Opening this statement there would replace it.</p>
        <div className="dl-actions">
          <button className="btn primary" onClick={go}>Replace it</button>
          <button className="btn ghost" onClick={() => setAsk(false)}>Keep mine</button>
        </div>
      </Modal>
    </div>
  );
}
