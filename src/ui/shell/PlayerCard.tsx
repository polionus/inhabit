import { useArenaSummary } from '../../arena/state/summary.ts';
import { game, useGame } from '../game.ts';
import { usePlayer } from '../usePlayer.ts';
import { Icon, ProgressBar, ProgressRing, sfx } from '../components/kit.tsx';

/** Player card: rank, level with XP bar, streak, stars, Arena rating. Links to the profile. */
export function PlayerCard({ variant = 'side', active = false }: { variant?: 'side' | 'rail' | 'large'; active?: boolean }) {
  const p = usePlayer();
  const arena = useArenaSummary();
  const streakLabel = `${p.streak.current} day streak${p.streak.activeToday ? '' : ', not yet active today'}`;
  if (variant === 'rail') {
    return (
      <a className={`pc-rail ${active ? 'active' : ''}`} href="#/profile" aria-label={`Profile. Level ${p.level.level}, ${p.rank.title}. ${streakLabel}. ${p.stars} stars.`} data-tip="Profile">
        <ProgressRing value={p.level.frac} size={44} stroke={4} tone="gold">
          <span className="pc-rail-lvl tnum">{p.level.level}</span>
        </ProgressRing>
        <span className={`pc-rail-streak ${p.streak.activeToday ? 'lit' : ''}`} aria-hidden="true">
          <Icon name="flame" size={14} />
          <span className="tnum">{p.streak.current}</span>
        </span>
      </a>
    );
  }
  return (
    <a className={`player-card pc-${variant} ${active ? 'active' : ''}`} href="#/profile" aria-label={`Your profile: ${p.rank.title}, level ${p.level.level}`}>
      <span className="pc-top">
        <ProgressRing value={p.level.frac} size={variant === 'large' ? 84 : 46} stroke={variant === 'large' ? 7 : 4} tone="gold">
          <span className="pc-lvl tnum">{p.level.level}</span>
        </ProgressRing>
        <span className="pc-id">
          <span className="pc-rank">{p.rank.title}</span>
          <span className="pc-sub tnum">Level {p.level.level} · {p.xp.toLocaleString()} XP</span>
        </span>
      </span>
      <span className="pc-xp">
        <ProgressBar value={p.level.frac} tone="gold" size={variant === 'large' ? 'md' : 'xs'} label={`XP toward level ${p.level.level + 1}`} />
        <span className="pc-xp-text tnum">{p.level.into} / {p.level.span} XP to level {p.level.level + 1}</span>
      </span>
      <span className="pc-stats">
        <span className={`pc-stat flame ${p.streak.activeToday ? 'lit' : ''}`} title={streakLabel}>
          <Icon name="flame" size={16} />
          <span className="tnum">{p.streak.current}</span>
          <span className="sr-only"> day streak</span>
        </span>
        <span className="pc-stat gold" title={`${p.stars} of ${p.starsMax} stars`}>
          <Icon name="star" size={16} />
          <span className="tnum">{p.stars}</span>
          <span className="sr-only"> stars</span>
        </span>
        {arena.rating !== null && (
          <span className="pc-stat arena" title="Arena rating">
            <Icon name="arena" size={16} />
            <span className="tnum">{arena.rating}</span>
            <span className="sr-only"> Arena rating</span>
          </span>
        )}
      </span>
    </a>
  );
}

export function SoundToggle({ withLabel = false, className = '' }: { withLabel?: boolean; className?: string }) {
  const on = useGame((s) => s.save.settings.sound);
  return (
    <button
      type="button"
      className={`sound-toggle ${on ? 'on' : 'off'} ${className}`}
      aria-pressed={on}
      aria-label={withLabel ? undefined : on ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on'}
      data-tip={on ? 'Sound on' : 'Sound off'}
      onClick={() => {
        game().setSettings({ sound: !on });
        if (!on) setTimeout(() => sfx.play('tap'), 0);
      }}
    >
      <Icon name={on ? 'sound' : 'mute'} size={18} />
      {withLabel && <span>{on ? 'Sound on' : 'Sound off'}</span>}
    </button>
  );
}
