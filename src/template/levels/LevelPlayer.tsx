import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDisc } from '../context.tsx';
import { game, useGame } from '../store.ts';
import type { EditorApi, RunCompletion, TemplateCodexEntry, TemplateLevel, TemplateWorld } from '../types.ts';
import { KbdHint } from '../components/KbdHint.tsx';
import { celebrate } from '../components/celebrate.ts';
import { HintLadder } from '../components/HintLadder.tsx';
import { CodeBlock, InlineMd, Markdown } from '../components/Markdown.tsx';
import { CodexCard } from '../components/CodexCard.tsx';
import { Success, type Reward } from '../components/Success.tsx';
import { EmptyState, Icon, Modal, Pill, Stars } from '../components/kit.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';
import { starsFor } from '../state/meta.ts';
import { prerequisiteWorlds, worldComplete } from '../state/progress.ts';
import { href } from '../router.ts';
import { LessonPanel } from './Lesson.tsx';
import { lessonDefaultOpen } from './lessonDefault.ts';
import { builtInLevelKinds } from './builtins.ts';
import { useMedia } from '../hooks.tsx';

export interface LevelPlayerProps {
  levelId: string;
  mode: 'play' | 'review';
  /** Called when the learner leaves via the success card's primary action. */
  onNext?: () => void;
  nextLabel?: string;
  /** Review only: called once the item is decided. */
  onReviewDone?: (passed: boolean) => void;
  extraActions?: React.ReactNode;
}

/** Generic Codex drawer for discs that don't provide a custom Inventory renderer. */
function DefaultInventoryDrawer({
  world,
  index,
  allCodex,
  onClose,
}: {
  world: TemplateWorld;
  index: number;
  allCodex: TemplateCodexEntry[];
  onClose: () => void;
}) {
  const disc = useDisc();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const unlocked = useMemo(() => {
    const ids = new Set<string>();
    const absorb = (l: TemplateLevel) => l.unlocks?.codex?.forEach((c) => ids.add(c));
    for (const pw of prerequisiteWorlds(world.id, disc.worlds)) pw.levels.forEach(absorb);
    world.levels.slice(0, index + 1).forEach(absorb);
    return allCodex.filter((c) => ids.has(c.id));
  }, [world, index, allCodex, disc.worlds]);

  return (
    <aside className="drawer" role="dialog" aria-label="Reference" tabIndex={-1} ref={ref}>
      <div className="drawer-head">
        <h2>Codex</h2>
        <button className="btn ghost" onClick={onClose} aria-label="Close reference">×</button>
      </div>
      {unlocked.length === 0 ? (
        <p className="muted">No concepts unlocked yet in this chapter.</p>
      ) : (
        <ul className="inv">
          {unlocked.map((c) => (
            <li key={c.id} className="inv-row">
              <button className="inv-name" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span className="entry-name">{c.name}</span>{' '}
                <span className="muted small"><InlineMd text={c.summary} /></span>
              </button>
              {open === c.id && (
                <div className="inv-doc">
                  <CodexCard entry={c} headingLevel={4} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function LevelPlayer(props: LevelPlayerProps) {
  const { levelId, mode } = props;
  const disc = useDisc();
  const strict = useGame((s) => s.save.settings.strictInventory);
  const fontSize = useGame((s) => s.save.settings.fontSize);
  const progress = useGame((s) => s.save.levels[levelId]);
  const draft = useGame((s) => s.save.drafts[levelId]);

  const found = useMemo(() => disc.findLevel(levelId), [disc, levelId]);
  const levelKinds = useMemo(() => ({ ...builtInLevelKinds, ...(disc.levelKinds ?? {}) }), [disc.levelKinds]);

  const [revealed, setRevealed] = useState(0);
  const [toolUsed, setToolUsed] = useState(false);
  const [failedChecks, setFailedChecks] = useState(0);
  const [live, setLive] = useState<unknown>(null);
  const [usedSolution, setUsedSolution] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [inventory, setInventory] = useState(false);
  const [outcome, setOutcome] = useState<(RunCompletion & { xp: number; studied: boolean; reward: Reward }) | null>(null);
  const [worldDone, setWorldDone] = useState(false);

  // Ctrl/Cmd+Enter advances once the level is solved.
  const advanceRef = useRef<(() => void) | undefined>(undefined);
  advanceRef.current = outcome || (mode === 'review' && showSolution) ? props.onNext : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (!advanceRef.current || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      e.stopPropagation();
      advanceRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const lessonSettings = useGame((s) => s.save.settings);
  const narrow = useMedia('(max-width: 900px)');
  const deckItem = useGame((s) => s.save.deck[levelId]);
  const save = useGame((s) => s.save);
  const api = useRef<EditorApi>({});
  const done = useRef(false);
  const helpUsed = revealed + (toolUsed ? 1 : 0);

  const kindDef = found ? levelKinds[found.level.kind] : undefined;
  const rawHints = useMemo(() => found?.level.hints ?? [], [found]);
  const hints = useMemo(() => {
    if (!found) return rawHints;
    return disc.hooks?.filterHints ? disc.hooks.filterHints(rawHints, found.level) : rawHints;
  }, [disc.hooks, found, rawHints]);

  const initialBody = useMemo(() => {
    if (!found || !kindDef?.initialBody) return '';
    return kindDef.initialBody(found.level, mode, draft, progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId, mode]);

  const revealHint = () => {
    const n = Math.min(hints.length, revealed + 1);
    setRevealed(n);
    if (mode === 'play') game().recordHints(levelId, n + (toolUsed ? 1 : 0));
  };

  const useTool = () => {
    if (toolUsed) return;
    setToolUsed(true);
    if (mode === 'play') game().recordHints(levelId, revealed + 1);
  };

  const reveal = () => {
    setShowSolution(true);
    if (!usedSolution) {
      setUsedSolution(true);
      if (mode === 'play') {
        game().completeLevel(levelId, { studied: true, clean: false });
      } else if (!done.current) {
        done.current = true;
        props.onReviewDone?.(false);
      }
    }
  };

  const complete = useCallback(
    (c: RunCompletion = {}) => {
      if (!found || done.current) return;
      done.current = true;
      const studied = !!c.studied || usedSolution;
      const clean = !studied && helpUsed === 0;
      const world = found.world;
      const before = game().save;
      if (mode === 'play') {
        const r = game().completeLevel(levelId, { studied, clean, body: c.body, selfAssessed: c.selfAssessed });
        const after = game().save;
        const finishedWorld =
          r.firstPass &&
          world.levels.length > 0 &&
          !worldComplete(world, before.levels) &&
          worldComplete(world, after.levels);
        const boss = !!found.level.boss;
        const reward: Reward = {
          stars: starsFor(after.levels[levelId], after.deck[levelId]),
          xpBefore: before.xp,
          xpAfter: after.xp,
          boss,
          celebration: studied ? null : finishedWorld ? null : boss ? 'boss' : 'solve',
          sound: studied ? 'tap' : boss || finishedWorld ? 'win' : 'solve',
        };
        setOutcome({ ...c, xp: r.xp, studied, reward });
        if (finishedWorld) setTimeout(() => setWorldDone(true), 700);
      } else {
        const reward: Reward = {
          stars: 0,
          xpBefore: before.xp,
          xpAfter: before.xp,
          boss: false,
          celebration: studied ? null : 'tick',
          sound: studied ? 'tap' : 'correct',
        };
        setOutcome({ ...c, xp: 0, studied, reward });
        props.onReviewDone?.(!studied);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [found, levelId, mode, usedSolution, helpUsed],
  );

  if (!found || !kindDef) {
    return (
      <div className="page narrow">
        <EmptyState glyph="?" title="Unknown level" action={<a className="btn primary" href={href.map()}>Back to the map</a>}>
          {found ? `Level kind "${found.level.kind}" is not registered.` : 'That level could not be found.'}
        </EmptyState>
      </div>
    );
  }

  const { world, level, index } = found;
  const wStatus = worldStatus(world, save, disc.worlds);
  const passed = progress?.status === 'solved' || progress?.status === 'studied';
  const currentStars = starsFor(progress, deckItem);
  const lesson = useMemo(() => disc.lessons?.forLevel(levelId), [disc.lessons, levelId]);
  const sol = kindDef.solutionText?.(level) ?? null;
  const rating = progress?.rating;
  const tags = kindDef.tags?.(level) ?? [];

  const CustomStuckHelp = disc.hooks?.renderStuckHelp;
  const CustomInventory = disc.hooks?.renderInventory;
  const SuccessExtras = disc.hooks?.renderSuccessExtras;
  const AfterSuccess = disc.hooks?.renderAfterSuccess;
  const hasCodexButton = !!CustomInventory || disc.allCodex.length > 0;
  const leading = hasCodexButton ? (
    <button className="btn small" onClick={() => setInventory(true)}>
      <Icon name="bag" size={16} /> {CustomInventory ? 'Inventory' : 'Codex'}
    </button>
  ) : undefined;

  const LevelView = kindDef.render;
  const canRevealHelp = hints.length > 0 || !!sol;

  return (
    <div className={`level kind-${level.kind}`}>
      <section className="task" aria-label="Task">
        <nav className="task-crumb" aria-label="Breadcrumb">
          {mode === 'play' && (
            <>
              <a href={href.world(world.id)}>
                <WorldToken world={world} size={28} state={wStatus.state} progress={wStatus.frac} badge={false} />
                <span className="crumb-world">{world.title}</span>
              </a>
              <span className="crumb-sep" aria-hidden="true">·</span>
              <span className="crumb-pos">Level {index + 1} of {world.levels.length}</span>
              <span className="crumb-sep" aria-hidden="true">·</span>
            </>
          )}
          <span className="crumb-kind">{kindDef.label}</span>
        </nav>

        <div className="task-head">
          {(level.boss || level.optional || tags.length > 0) && (
            <div className="task-tags">
              {level.boss && <Pill tone="gold" icon="crown-fill">Boss</Pill>}
              {level.optional && <Pill>Side quest</Pill>}
              {tags.map((t) => <Pill key={t.label} tone={t.tone} icon={t.icon}>{t.label}</Pill>)}
            </div>
          )}
          <div className="task-title-row">
            <h1>{level.title}</h1>
            {mode === 'play' && !outcome && <Stars value={currentStars} size="md" />}
          </div>
        </div>

        <Markdown text={level.intro} className="task-intro" />

        {CustomStuckHelp ? (
          <CustomStuckHelp
            level={level}
            levelId={levelId}
            world={world}
            index={index}
            strict={strict}
            hints={hints}
            live={live}
            revealed={revealed}
            onRevealHint={revealHint}
            toolUsed={toolUsed}
            onUseTool={useTool}
            failedChecks={failedChecks}
            canShowSolution={!!sol && !showSolution}
            onShowSolution={reveal}
            finished={!!outcome}
            leading={leading}
          />
        ) : (
          <DefaultStuckHelp
            hints={hints}
            revealed={revealed}
            onRevealHint={revealHint}
            canShowSolution={!!sol && !showSolution && canRevealHelp}
            onShowSolution={reveal}
            finished={!!outcome}
            leading={leading}
          />
        )}

        <LessonPanel
          lesson={lesson}
          defaultOpen={lessonDefaultOpen({
            world,
            level,
            index,
            mode,
            passed,
            settings: lessonSettings,
            narrow,
            config: disc.progression?.lessonDefault,
          })}
          remember={mode === 'play'}
          nudge={failedChecks >= 2 && !outcome && !passed}
        />

        {showSolution && sol && (
          <div className="solution">
            <div className="label">A solution</div>
            {kindDef.renderSolution ? kindDef.renderSolution(sol, level, api) : <CodeBlock code={sol} />}
            <p className="muted small">
              {mode === 'review' ? 'Noted. This one will come back sooner.' : 'This level is now marked studied. Solve it again later to earn “solved”.'}
            </p>
          </div>
        )}

        {outcome && (
          <Success
            outro={level.outro}
            term={outcome.term}
            termOpen={Boolean((level as { showTerm?: boolean }).showTerm)}
            termLabel="See the term your tactics built"
            studied={outcome.studied}
            xp={outcome.xp}
            rating={mode === 'play' ? rating : undefined}
            onRate={mode === 'play' ? (r) => game().rateLevel(levelId, r) : undefined}
            note={outcome.selfAssessed ? 'You judged this one yourself.' : undefined}
            reward={outcome.reward}
            review={mode === 'review'}
            extras={SuccessExtras ? <SuccessExtras levelId={levelId} level={level} world={world} mode={mode} outcome={outcome} /> : undefined}
            actions={
              <>
                <button className="btn primary big" onClick={props.onNext}>
                  {props.nextLabel ?? 'Next'} <Icon name="arrow-right" size={18} /><KbdHint />
                </button>
                {props.extraActions}
              </>
            }
          />
        )}

        {outcome && mode === 'play' && AfterSuccess && (
          <AfterSuccess levelId={levelId} hints={helpUsed} studied={outcome.studied} />
        )}

        {!outcome && mode === 'review' && showSolution && (
          <div className="actions">
            <button className="btn primary" onClick={props.onNext}>
              {props.nextLabel ?? 'Continue'} <KbdHint />
            </button>
          </div>
        )}

        {progress?.status && progress.status !== 'unseen' && !outcome && mode === 'play' && (
          <p className="already">
            <Icon name="check-circle" size={16} /> You have already {progress.status === 'solved' ? 'solved' : 'studied'} this level{progress.testedOut ? ' (tested out)' : ''}.
          </p>
        )}
      </section>

      <div className="work">
        <LevelView
          level={level}
          world={world}
          index={index}
          mode={mode}
          fontSize={fontSize}
          strictInventory={strict}
          solved={!!outcome}
          initialBody={initialBody}
          attempt={() => {
            setFailedChecks((n) => n + 1);
            if (mode === 'play') game().recordAttempt(levelId);
          }}
          complete={complete}
          saveDraft={(t) => mode === 'play' && game().setDraft(levelId, t)}
          reportLive={setLive}
          api={api}
        />
      </div>

      <Modal open={worldDone} onClose={() => setWorldDone(false)} title="World complete" tone="gold" size="md" className="world-done">
        <WorldDone worldId={world.id} onNext={() => { setWorldDone(false); props.onNext?.(); }} />
      </Modal>

      {inventory && (
        CustomInventory ? (
          <CustomInventory
            levelId={levelId}
            level={level}
            onInsert={(t) => api.current.insert?.(t)}
            onClose={() => setInventory(false)}
          />
        ) : (
          <DefaultInventoryDrawer
            world={world}
            index={index}
            allCodex={disc.allCodex}
            onClose={() => setInventory(false)}
          />
        )
      )}
    </div>
  );
}

function DefaultStuckHelp({
  hints,
  revealed,
  onRevealHint,
  canShowSolution,
  onShowSolution,
  finished,
  leading,
}: {
  hints: { text: string }[];
  revealed: number;
  onRevealHint: () => void;
  canShowSolution: boolean;
  onShowSolution: () => void;
  finished: boolean;
  leading?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasHints = hints.length > 0;
  return (
    <>
      <div className="utility">
        {leading}
        {hasHints && !finished && (
          <button type="button" className={`btn small stuck-toggle ${open ? 'on' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name="bulb" size={16} /> Hints
            <Icon name="chevron-down" size={14} className={`stuck-chev ${open ? 'up' : ''}`} />
          </button>
        )}
        {canShowSolution && !finished && (
          <button type="button" className="linkish quiet show-solution" onClick={onShowSolution} title="Always here. It marks the level as studied.">
            Show solution
          </button>
        )}
      </div>
      {hasHints && open && !finished && (
        <section className="stuck" aria-label="Hints">
          <div className="stuck-body">
            <HintLadder hints={hints} revealed={revealed} onReveal={onRevealHint} lastGivesAway={false} />
          </div>
        </section>
      )}
    </>
  );
}

function WorldDone({ worldId, onNext }: { worldId: string; onNext: () => void }) {
  const disc = useDisc();
  const save = useGame((s) => s.save);
  const w = disc.worlds.find((x) => x.id === worldId);
  useEffect(() => {
    const t = window.setTimeout(() => celebrate('world'), 60);
    return () => clearTimeout(t);
  }, []);
  if (!w) return null;
  const st = worldStatus(w, save, disc.worlds);
  const nextWorlds = disc.worlds.filter(
    (x) =>
      x.requires.includes(w.id) &&
      x.requires.every((r) => {
        const rw = disc.worlds.find((y) => y.id === r);
        return !!rw && worldComplete(rw, save.levels);
      }),
  );
  const recap = disc.lessons?.forWorld(w.id)?.recap;
  const hasChapter = (id: string) => disc.chapters?.meta.some((c) => c.worldId === id);
  return (
    <div className="wd">
      <div className="wd-hero">
        <WorldToken world={w} size={120} state="complete" />
        <h3>{w.title}</h3>
        <span className="wd-stars"><Icon name="star" size={18} className="goldc" /> <span className="tnum">{st.stars.earned} of {st.stars.total} stars</span></span>
      </div>
      {recap && <Markdown text={recap} className="prose compact wd-recap" />}
      {nextWorlds.length > 0 ? (
        <>
          {nextWorlds.map((n) => (
            <div key={n.id} className="wd-next">
              <a className="btn primary big" href={href.world(n.id)}>
                {nextWorlds.length > 1 ? 'Next track' : 'Next chapter'}: {n.title} <Icon name="arrow-right" size={18} />
              </a>
              {hasChapter(n.id) && <a className="linkish" href={href.chapter(n.id)}>Read the chapter explainer</a>}
            </div>
          ))}
          <div className="actions">
            <a className="linkish" href={href.map()}>Back to the map</a>
            <button type="button" className="linkish" onClick={onNext}>See the world page</button>
          </div>
        </>
      ) : (
        <div className="actions">
          <a className="btn primary big" href={href.map()}><Icon name="map" size={18} /> Back to the map</a>
          <button type="button" className="btn ghost" onClick={onNext}>See the world page</button>
        </div>
      )}
    </div>
  );
}
