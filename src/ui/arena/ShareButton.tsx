/**
 * Share a proof card (SPEC §10.5). Builds a `#/share/<code>` link from the payload, then uses
 * `navigator.share` when the browser has it, otherwise copies the link to the clipboard, with a
 * visible confirmation. Everything travels inside the link: nothing is uploaded anywhere.
 *
 *   <ShareButton card={{ title, english?, source, kind, ref? }} />
 */
import { useEffect, useRef, useState } from 'react';
import { absoluteLink, encodeProof, proofHash, type ProofCard } from '../../arena/net/codec.ts';
import { arenaStore } from '../../arena/state/store.ts';
import { Icon } from '../components/kit.tsx';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Share through the system sheet when there is one, else copy. */
export async function shareOrCopy(url: string, title: string, text?: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // fall through to copying
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

export type ShareCard = Omit<ProofCard, 'v' | 'by'> & { by?: string };

export function ShareButton({ card, label = 'Share', className = 'btn', small = false }: { card: ShareCard; label?: string; className?: string; small?: boolean }) {
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const say = (text: string, err = false) => {
    setMsg({ text, err });
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), err ? 8000 : 4000);
  };

  const click = async () => {
    const by = card.by ?? (arenaStore.getState().displayName || undefined);
    const r = encodeProof({ ...card, by });
    if (!r.ok) return say(r.message, true);
    const url = absoluteLink(proofHash(r.code));
    const o = await shareOrCopy(url, card.title || 'A proof on Inhabit', 'A proof I checked on Inhabit. Your browser re-checks it when you open the link.');
    if (o === 'copied') say('Link copied. Anyone you send it to can open it; their browser re-checks the proof.');
    else if (o === 'shared') say('Shared.');
    else if (o === 'failed') say('Could not copy the link automatically. Your browser blocked it.', true);
  };

  return (
    <span className="share-wrap">
      <button type="button" className={`${className} ${small ? 'small' : ''}`} onClick={click}><Icon name="external" size={small ? 14 : 18} /> {label}</button>
      {msg && <span className={`share-msg ${msg.err ? 'err' : ''}`} role="status">{msg.text}</span>}
    </span>
  );
}
