import type { ComponentType } from 'react';
import type { CheckResult, Engine, Env } from './engine/types.ts';
import type { TemplateCodexEntry } from '../../template/types.ts';
import type { Assembled, LevelSession } from './env.ts';
import type { GraduateSection, LeanLemma, LeanLevelContext, PhrasebookRow, TheoremIdea } from './types.ts';

export interface ShareCardPayload {
  kind: 'level' | 'sandbox' | 'workshop';
  title: string;
  english?: string;
  source: string;
}

export interface LeanDomainRuntime {
  engine: Engine;
  allLemmas: LeanLemma[];
  allCodex: TemplateCodexEntry[];
  getCodex: (id: string) => TemplateCodexEntry | undefined;
  levelContext: (levelId: string) => LeanLevelContext;
  sessionFor: (levelId: string, strictInventory?: boolean) => LevelSession;
  fullEnv: () => Env;
  checkBody: (session: LevelSession, body: string) => { result: CheckResult; assembled: Assembled };
  getIdeas?: () => TheoremIdea[];
  getGraduate?: () => { sections: GraduateSection[]; phrasebook: PhrasebookRow[] };
  ShareButton?: ComponentType<{ card: ShareCardPayload; className?: string }>;
  PracticeOffer?: ComponentType<{ levelId: string; when: 'stuck' | 'after' }>;
}

let activeRuntime: LeanDomainRuntime | null = null;

export function registerLeanRuntime(runtime: LeanDomainRuntime): void {
  activeRuntime = runtime;
}

export function getLeanRuntime(): LeanDomainRuntime {
  if (!activeRuntime) {
    throw new Error('Lean domain runtime has not been registered.');
  }
  return activeRuntime;
}

export function tryGetLeanRuntime(): LeanDomainRuntime | null {
  return activeRuntime;
}
