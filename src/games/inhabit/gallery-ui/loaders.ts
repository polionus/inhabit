/** Lazy loaders for exhibit components, keyed by exhibit id. Each exhibit is its own chunk. */
import type { ComponentType } from 'react';
import type { ExhibitId } from '../gallery/registry.ts';
import type { ExhibitProps } from './types.ts';

type Loader = () => Promise<{ default: ComponentType<ExhibitProps> }>;

export const exhibitLoaders: Record<ExhibitId, Loader> = {
  'proof-replay': () => import('./exhibits/ProofReplay.tsx'),
  venn: () => import('./exhibits/Venn.tsx'),
  'function-arrows': () => import('./exhibits/FunctionArrows.tsx'),
  'quantifier-game': () => import('./exhibits/QuantifierGame.tsx'),
  'truth-table': () => import('./exhibits/TruthTable.tsx'),
  'rewrite-compute': () => import('./exhibits/RewriteCompute.tsx'),
  'induction-dominoes': () => import('./exhibits/InductionDominoes.tsx'),
  'cantor-diagonal': () => import('./exhibits/CantorDiagonal.tsx'),
};
