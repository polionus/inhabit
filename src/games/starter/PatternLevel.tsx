import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, WhatToProve, type LevelRenderProps, type TemplateLevel } from '../../template/index.ts';

export interface PatternLevel extends TemplateLevel {
  kind: 'pattern';
  prompt: string;
  flags?: string;
  starter?: string;
  solutions: string[];
  positive: string[];
  negative: string[];
  /** Check against full string (^...$ wrapped automatically if anchorFull is true). */
  anchorFull?: boolean;
}

export interface CaseEvaluation {
  sample: string;
  shouldMatch: boolean;
  passed: boolean;
  matchedText: string | null;
  matchStart: number;
  matchEnd: number;
}

export interface PatternEvalResult {
  valid: boolean;
  error?: string;
  solved: boolean;
  cases: CaseEvaluation[];
}

export function evaluatePattern(
  source: string,
  level: Pick<PatternLevel, 'flags' | 'positive' | 'negative' | 'anchorFull'>,
): PatternEvalResult {
  if (!source.trim()) {
    return {
      valid: true,
      solved: false,
      cases: [
        ...level.positive.map((sample) => ({ sample, shouldMatch: true, passed: false, matchedText: null, matchStart: -1, matchEnd: -1 })),
        ...level.negative.map((sample) => ({ sample, shouldMatch: false, passed: true, matchedText: null, matchStart: -1, matchEnd: -1 })),
      ],
    };
  }
  const cleanFlags = (level.flags ?? '').replace(/g/g, '');
  let re: RegExp;
  try {
    const expr = level.anchorFull ? `^(?:${source})$` : source;
    re = new RegExp(expr, cleanFlags);
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : String(e),
      solved: false,
      cases: [
        ...level.positive.map((sample) => ({ sample, shouldMatch: true, passed: false, matchedText: null, matchStart: -1, matchEnd: -1 })),
        ...level.negative.map((sample) => ({ sample, shouldMatch: false, passed: false, matchedText: null, matchStart: -1, matchEnd: -1 })),
      ],
    };
  }

  const evalList = (samples: string[], shouldMatch: boolean): CaseEvaluation[] =>
    samples.map((sample) => {
      const m = re.exec(sample);
      const matched = m !== null;
      const start = m ? m.index : -1;
      const end = m ? m.index + m[0].length : -1;
      return {
        sample,
        shouldMatch,
        passed: shouldMatch ? matched : !matched,
        matchedText: m ? m[0] : null,
        matchStart: start,
        matchEnd: end,
      };
    });

  const pos = evalList(level.positive, true);
  const neg = evalList(level.negative, false);
  const cases = [...pos, ...neg];
  return {
    valid: true,
    solved: cases.every((c) => c.passed),
    cases,
  };
}

function renderSample(sample: string, start: number, end: number): ReactNode {
  if (start < 0 || end <= start) return sample;
  return (
    <>
      {sample.slice(0, start)}
      <mark className="pc-hit">{sample.slice(start, end)}</mark>
      {sample.slice(end)}
    </>
  );
}

export function PatternLevelView(props: LevelRenderProps) {
  const level = props.level as PatternLevel;
  const [pattern, setPattern] = useState(props.initialBody || level.starter || '');
  const propsRef = useRef(props);
  propsRef.current = props;
  const completedRef = useRef(false);
  const lastErrRef = useRef('');

  useEffect(() => {
    props.api.current = {
      setBody: (text: string) => {
        setPattern(text);
        propsRef.current.saveDraft(text);
      },
      insert: (text: string) => {
        setPattern((prev) => {
          const next = prev + text;
          propsRef.current.saveDraft(next);
          return next;
        });
      },
    };
  }, [props.api]);

  const evalResult = useMemo(() => evaluatePattern(pattern, level), [pattern, level]);

  useEffect(() => {
    if (evalResult.solved && !completedRef.current) {
      completedRef.current = true;
      propsRef.current.complete({ body: pattern });
    } else if (!evalResult.valid && evalResult.error && evalResult.error !== lastErrRef.current && pattern.trim()) {
      lastErrRef.current = evalResult.error;
      propsRef.current.attempt();
    }
  }, [evalResult, pattern]);

  const posCases = evalResult.cases.filter((c) => c.shouldMatch);
  const negCases = evalResult.cases.filter((c) => !c.shouldMatch);

  return (
    <>
      <div className="editor-panel">
        <WhatToProve english={level.prompt} label="Pattern goal" />
        <div className="pc-regex-box">
          <label className="pc-case-label" htmlFor={`pc-input-${level.id}`}>
            Regular expression {level.anchorFull ? '(must match whole string)' : '(matches substring)'}
          </label>
          <div className="pc-regex-row">
            <span className="pc-slash" aria-hidden="true">/</span>
            <input
              id={`pc-input-${level.id}`}
              className="pc-input"
              type="text"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={level.starter ?? 'Type a regex pattern…'}
              value={pattern}
              onChange={(e) => {
                setPattern(e.target.value);
                propsRef.current.saveDraft(e.target.value);
              }}
            />
            <span className="pc-slash" aria-hidden="true">/</span>
            {level.flags && <span className="pc-flags">{level.flags}</span>}
          </div>
          {!evalResult.valid && (
            <div className="feedback wrong" role="status">
              Syntax error: <code className="inline">{evalResult.error}</code>
            </div>
          )}
          {evalResult.valid && evalResult.solved && (
            <div className="feedback right" role="status">
              Every test case matches as required!
            </div>
          )}
          {pattern !== (level.starter ?? '') && (
            <div>
              <button
                type="button"
                className="linkish quiet"
                onClick={() => {
                  const s = level.starter ?? '';
                  setPattern(s);
                  propsRef.current.saveDraft(s);
                }}
              >
                Reset pattern
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="infoview" aria-label="Test cases">
        <div className="info-head">
          <span className="eyebrow"><Icon name="target" size={14} /> Test Cases</span>
          <span className={`pill info-status ${evalResult.solved ? 'pill-ok' : !evalResult.valid ? 'pill-err' : 'pill-primary'}`}>
            {evalResult.solved
              ? 'All passing'
              : `${evalResult.cases.filter((c) => c.passed).length}/${evalResult.cases.length} passing`}
          </span>
        </div>
        <div className="info-body pc-cases">
          <div className="pc-case-group">
            <div className="pc-case-label">Should match</div>
            <ul className="pc-case-list">
              {posCases.map((c) => (
                <li key={c.sample} className={`pc-case ${c.passed ? 'pass' : 'fail'}`}>
                  <span className="pc-case-sample">{renderSample(c.sample, c.matchStart, c.matchEnd)}</span>
                  <span className={`pc-badge ${c.passed ? 'ok' : 'no'}`}>{c.passed ? 'Matched' : 'Missed'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pc-case-group">
            <div className="pc-case-label">Should NOT match</div>
            <ul className="pc-case-list">
              {negCases.map((c) => (
                <li key={c.sample} className={`pc-case ${c.passed ? 'pass' : 'fail'}`}>
                  <span className="pc-case-sample">{renderSample(c.sample, c.matchStart, c.matchEnd)}</span>
                  <span className={`pc-badge ${c.passed ? 'ok' : 'no'}`}>{c.passed ? 'Rejected' : 'Matched!'}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
