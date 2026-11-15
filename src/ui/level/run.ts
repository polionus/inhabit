import type { MutableRefObject } from 'react';
import type { Level } from '../../content/types.ts';
import type { LevelSession } from '../../game/env.ts';
import type { Goal } from '../../engine/types.ts';

export interface EditorApi {
  insert?: (text: string) => void;
  setBody?: (text: string) => void;
}

export interface RunCompletion {
  body?: string;
  selfAssessed?: boolean;
  /** Passed, but only by looking at the answer (e.g. "I see the difference"). */
  studied?: boolean;
  term?: string;
}

/** The live proof state a proof level reports upward, for the stuck panel. */
export interface LiveState {
  /** State at the cursor, else after the last successful tactic, else what was left unsolved; null when the engine has none. */
  goals: Goal[] | null;
  /** Where `goals` came from. */
  at: 'cursor' | 'last-step' | 'unsolved' | null;
  /** The body differs from the starter. */
  edited: boolean;
}

/** What each level-kind component gets from the LevelPlayer. */
export interface Run {
  level: Level;
  mode: 'play' | 'review';
  session: LevelSession;
  fontSize: number;
  solved: boolean;
  /** Initial text for body levels (draft, best solution or starter). */
  initialBody: string;
  attempt(): void;
  complete(c?: RunCompletion): void;
  saveDraft(text: string): void;
  /** Proof levels report their live state here (called only when it changes). */
  reportLive?: (live: LiveState) => void;
  api: MutableRefObject<EditorApi>;
}

export const hintsOf = (l: Level) => ('hints' in l ? l.hints : []);
