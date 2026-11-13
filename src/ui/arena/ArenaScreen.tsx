/** Stub: replaced by the arena UI agent. `sub`/`arg` come from `#/arena/<sub>/<arg>`. */
export function ArenaScreen({ sub, arg }: { sub?: string; arg?: string }) {
  return (
    <div className="page narrow">
      <h1>Arena</h1>
      <p className="muted">Coming soon{sub ? `: ${sub}${arg ? ` / ${arg}` : ''}` : ''}.</p>
    </div>
  );
}
