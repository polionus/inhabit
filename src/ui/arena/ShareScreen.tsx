/** Stub: replaced by the arena social agent. Renders a shared proof card from `#/share/<code>`. */
export function ShareScreen({ code }: { code: string }) {
  return <div className="page narrow"><h1>Shared proof</h1><p className="muted small">{code.slice(0, 24)}…</p></div>;
}
