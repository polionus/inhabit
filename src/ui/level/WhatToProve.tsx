import type { ReactNode } from 'react';
import { Markdown } from '../components/Markdown.tsx';

/**
 * The top of the work column: the statement in English, directly above its Lean form
 * (header, or the names in scope), as one unit.
 */
export function WhatToProve({ english, label = 'Goal', children }: { english: string; label?: string; children?: ReactNode }) {
  return (
    <section className="wtp" aria-label="What to prove">
      <div className="wtp-goal">
        <span className="wtp-label">{label}</span>
        <Markdown className="wtp-text" text={english} />
      </div>
      {children}
    </section>
  );
}
