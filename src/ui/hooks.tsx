import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CheckResult } from '../engine/types.ts';

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Run a (synchronous, engine-backed) check, debounced; never throws. */
export function useCheck<R>(input: unknown, run: () => R, ms = 150): { result: R | null; pending: boolean } {
  const debounced = useDebounced(input, ms);
  const runRef = useRef(run);
  runRef.current = run;
  const [result, setResult] = useState<R | null>(null);
  useEffect(() => {
    try {
      setResult(runRef.current());
    } catch (e) {
      console.error('engine error', e);
      setResult({
        diagnostics: [{ severity: 'error', code: 'other', message: `Internal engine error: ${String(e)}`, from: 0, to: 0 }],
        steps: [],
        decls: [],
        ok: false,
        complete: false,
      } as unknown as R);
    }
  }, [debounced]);
  return { result, pending: debounced !== input };
}

export const emptyResult: CheckResult = { diagnostics: [], steps: [], decls: [], ok: true, complete: false };

export function safe<T>(f: () => T, fallback: T): T {
  try {
    return f();
  } catch (e) {
    console.error(e);
    return fallback;
  }
}

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page narrow" role="alert">
          <h1>Something went wrong here</h1>
          <p>This screen hit an unexpected error. Your progress is saved. You can go back to the map and carry on.</p>
          <pre className="raw">{String(this.state.error.message)}</pre>
          <p>
            <a className="btn" href="#/map">Back to the map</a>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
