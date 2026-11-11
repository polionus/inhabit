import { openInLeanUrl, wrapForRealLean } from '../lean/openInLean.ts';

/** "Open in real Lean": a plain link that opens live.lean-lang.org in a new tab. */
export function OpenInLean({ source, className = 'btn' }: { source: string | string[]; className?: string }) {
  return (
    <a className={className} href={openInLeanUrl(wrapForRealLean(source))} target="_blank" rel="noopener noreferrer">
      Open in real Lean
    </a>
  );
}
