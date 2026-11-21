/** The required tactics (canonical names) that a complete proof never used. Empty when nothing is required. */
export function missingTactics(mustUse: string[] | undefined, used: Iterable<string>): string[] {
  if (!mustUse?.length) return [];
  const u = new Set(used);
  return mustUse.filter((t) => !u.has(t));
}

/** The calm note shown when a proof is complete but skips the tactic the level is about. */
export function mustUseNote(missing: string[]): string {
  const [t] = missing;
  return `That proves it, but this level is about \`${t}\`. Try writing it with ${t === 'calc' ? 'a `calc` chain' : `\`${t}\``}.`;
}
