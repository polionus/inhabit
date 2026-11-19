import { useEffect, useId, useMemo, useState } from 'react';
import { goalFromHeader, readGoal, type Reading } from '../../coach/index.ts';
import type { Hint, Level } from '../../content/types.ts';
import type { LevelContext } from '../../content/index.ts';
import { HintLadder } from '../components/HintLadder.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { Icon, Pill } from '../components/kit.tsx';
import { PracticeOffer } from '../practice/PracticeOffer.tsx';
import type { LiveState } from './run.ts';
import { useMedia } from '../hooks.tsx';

export interface StuckHelpProps {
  level: Level;
  levelId: string;
  ctx: LevelContext;
  /** Obey the level's inventory (the learner setting can lift it). */
  strict: boolean;
  /** Authored hints, already without any rung that states the solution. */
  hints: Hint[];
  live: LiveState | null;
  revealed: number;
  onRevealHint: () => void;
  /** "Which tool?" was opened: counts as one hint. */
  toolUsed: boolean;
  onUseTool: () => void;
  failedChecks: number;
  canShowSolution: boolean;
  onShowSolution: () => void;
  mode: 'play' | 'review';
}

const WHERE: Record<string, string> = {
  cursor: 'At your cursor',
  'last-step': 'After your last step',
  unsolved: 'What is still to prove',
  start: 'At the start',
};

function ReadingCard({ reading, where, empty }: { reading: Reading | null; where: string; empty: boolean }) {
  if (!reading) {
    return (
      <div className="stuck-card reading" aria-live="polite">
        <p className="stuck-note">
          {empty ? 'No goals are open here. Move the cursor onto an earlier line to read the goal at that point.' : 'There is no open goal to read right now. Once the editor holds a statement to prove, it will appear here.'}
        </p>
      </div>
    );
  }
  return (
    <div className="stuck-card reading" aria-live="polite">
      <div className="stuck-where">{where}</div>
      <Markdown text={reading.say} className="stuck-say" />
      {reading.uses.length > 0 && (
        <>
          <div className="label">What your hypotheses offer</div>
          <ul className="stuck-uses">
            {reading.uses.map((u, i) => (
              <li key={`${u.hyp}-${i}`}><Markdown text={u.text} /></li>
            ))}
          </ul>
        </>
      )}
      <div className="stuck-ask"><Icon name="target" size={16} /> <Markdown text={reading.ask} /></div>
    </div>
  );
}

function ToolsCard({ reading, term }: { reading: Reading | null; term: boolean }) {
  const tools = reading?.tools ?? null;
  return (
    <div className="stuck-card tools" aria-live="polite">
      <div className="label">{term ? 'Which construct fits' : 'Which tool fits'}</div>
      {tools && tools.length > 0 ? (
        <ul className="stuck-tools">
          {tools.map((t, i) => (
            <li key={`${t.code}-${i}`}>
              <Markdown text={t.says} />
              {t.also && t.also.length > 0 && (
                <p className="stuck-also">Also possible here: {t.also.map((a, j) => <span key={a.code}>{j > 0 && ', '}<code className="inline">{a.code}</code></span>)}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="stuck-note">Nothing in your toolbox fits this goal directly. The hints below may help, or read the goal again and ask what it needs first.</p>
      )}
    </div>
  );
}

export function StuckHelp(p: StuckHelpProps) {
  const { level } = p;
  const isProof = level.kind === 'proof';
  const [readOpen, setReadOpen] = useState(false);
  const [readUsed, setReadUsed] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  // On a phone the panel starts as one line, so the editor stays in view; it opens itself the
  // first time a check fails, which is when help is wanted.
  const narrow = useMedia('(max-width: 900px)');
  const [expanded, setExpanded] = useState<boolean | null>(null);
  useEffect(() => {
    if (p.failedChecks >= 1) setExpanded((e) => (e === null ? true : e));
  }, [p.failedChecks]);
  const open = expanded ?? !narrow;
  const bodyId = useId();

  const initial = useMemo(() => (level.kind === 'proof' ? goalFromHeader(level.header) : null), [level]);
  const goals = isProof ? (p.live?.goals ?? (initial ? [initial] : null)) : null;
  const where = WHERE[p.live?.goals ? p.live.at ?? 'cursor' : 'start'];
  const allowed = p.strict ? p.ctx.allowedTactics : null;
  const mode = level.kind === 'proof' ? level.mode : 'tactic';
  const reading = useMemo(() => (goals && goals.length ? readGoal(goals, { allowedTactics: allowed, mode, codex: p.ctx.codex }) : null), [goals, allowed, mode, p.ctx.codex]);
  const emptyGoals = !!goals && goals.length === 0;

  const steps = (readUsed ? 1 : 0) + (p.toolUsed ? 1 : 0) + p.revealed;
  const showPractice = steps >= 2 && p.failedChecks >= 1;
  const hasHints = p.hints.length > 0;
  if (!isProof && !hasHints && !p.canShowSolution) return null;

  const toggleRead = () => {
    setReadOpen(!readOpen);
    setReadUsed(true);
  };
  const toggleTools = () => {
    if (!p.toolUsed) p.onUseTool();
    setToolsOpen(!toolsOpen);
  };
  const toolsVisible = p.toolUsed && toolsOpen;

  return (
    <section className="stuck" aria-label="Help">
      <button type="button" className="stuck-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setExpanded(!open)}>
        <span className="stuck-badge" aria-hidden="true"><Icon name="bulb" size={16} /></span>
        <h2>{isProof ? 'Stuck?' : 'Hints'}</h2>
        {isProof && <span className="stuck-sub">{open ? 'Start by reading the goal. It costs nothing.' : 'Help that reads your goal'}</span>}
        <Icon name="chevron-down" size={18} className={`stuck-chev ${open ? 'up' : ''}`} />
      </button>
      {open && <div className="stuck-body" id={bodyId}>
      {isProof && (
        <div className="stuck-steps">
          <button type="button" className={`btn small stuck-step ${readOpen ? 'on' : ''}`} aria-expanded={readOpen} onClick={toggleRead}>
            <Icon name="eye" size={16} /> Read the goal <Pill tone="ok" className="stuck-tag">free</Pill>
          </button>
          <button type="button" className={`btn small stuck-step ${toolsVisible ? 'on' : ''}`} aria-expanded={toolsVisible} onClick={toggleTools} title={p.toolUsed ? undefined : 'Counts as a hint'}>
            <Icon name="target" size={16} /> Which tool? {!p.toolUsed && <Pill tone="gold" className="stuck-tag">1 hint</Pill>}
          </button>
        </div>
      )}
      {isProof && readOpen && <ReadingCard reading={reading} where={where} empty={emptyGoals} />}
      {isProof && toolsVisible && <ToolsCard reading={reading} term={mode === 'term'} />}
      {hasHints && <HintLadder hints={p.hints} revealed={p.revealed} onReveal={p.onRevealHint} lastGivesAway={false} />}
      {showPractice && <PracticeOffer levelId={p.levelId} when="stuck" />}
      {p.canShowSolution && (
        <div className="stuck-solution">
          <button type="button" className="btn ghost small" onClick={p.onShowSolution} title="Marks the level as studied">
            <Icon name="eye" size={16} /> Show the solution
          </button>
          <span className="stuck-solution-note">Always here. It marks the level as studied.</span>
        </div>
      )}
      </div>}
    </section>
  );
}
