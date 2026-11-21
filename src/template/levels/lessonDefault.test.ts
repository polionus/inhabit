import { describe, expect, it } from 'vitest';
import type { TemplateWorld } from '../types.ts';
import { lessonDefaultOpen } from './lessonDefault.ts';

const world1: TemplateWorld = {
  id: 'intro',
  title: 'Intro',
  tagline: 'Start here',
  intro: '',
  requires: [],
  codex: [],
  levels: [
    { id: 'intro-01', title: 'One', kind: 'choice', intro: '', unlocks: { codex: ['c1'] } },
    { id: 'intro-02', title: 'Two', kind: 'text', intro: '' },
    { id: 'intro-03', title: 'Three', kind: 'text', intro: '', unlocks: { items: ['tool'] } },
  ],
};

const world2: TemplateWorld = {
  id: 'next',
  title: 'Next',
  tagline: 'Later',
  intro: '',
  requires: ['intro'],
  codex: [],
  levels: [
    { id: 'next-01', title: 'First', kind: 'text', intro: '' },
    { id: 'next-02', title: 'Second', kind: 'text', intro: '' },
  ],
};

const base = { mode: 'play' as const, passed: false, narrow: false };
const auto = { lessonMode: 'auto' as const, lessonsOpen: true };

describe('lessonDefaultOpen', () => {
  it('opens on first level of a world and where something is introduced', () => {
    expect(lessonDefaultOpen({ world: world1, level: world1.levels[0], index: 0, settings: auto, ...base })).toBe(true);
    expect(lessonDefaultOpen({ world: world1, level: world1.levels[1], index: 1, settings: auto, ...base })).toBe(false);
    expect(lessonDefaultOpen({ world: world1, level: world1.levels[2], index: 2, settings: auto, ...base })).toBe(true);
    expect(lessonDefaultOpen({ world: world2, level: world2.levels[0], index: 0, settings: auto, ...base })).toBe(true);
    expect(lessonDefaultOpen({ world: world2, level: world2.levels[1], index: 1, settings: auto, ...base })).toBe(false);
  });

  it('respects firstWorldId opening collapsed count when configured', () => {
    const config = { firstWorldId: 'intro', openingCount: 2 };
    expect(lessonDefaultOpen({ world: world1, level: world1.levels[0], index: 0, settings: auto, config, ...base })).toBe(false);
    expect(lessonDefaultOpen({ world: world1, level: world1.levels[2], index: 2, settings: auto, config, ...base })).toBe(true);
  });

  it('never opens when narrow, in review, or already passed', () => {
    expect(lessonDefaultOpen({ world: world2, level: world2.levels[0], index: 0, settings: auto, ...base, narrow: true })).toBe(false);
    expect(lessonDefaultOpen({ world: world2, level: world2.levels[0], index: 0, settings: auto, ...base, mode: 'review' })).toBe(false);
    expect(lessonDefaultOpen({ world: world2, level: world2.levels[0], index: 0, settings: auto, ...base, passed: true })).toBe(false);
  });
});
