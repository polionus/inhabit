/**
 * Extra save sections owned by other stores (e.g. the Arena keeps its own localStorage key).
 * The main store's export / import / reset go through this registry so one save file holds
 * everything. FROZEN contract.
 */
export interface SaveSection {
  /** JSON-serialisable snapshot. */
  export(): unknown;
  /** Accept anything (validate inside); ignore what is invalid. */
  import(raw: unknown): void;
  reset(): void;
}

const sections = new Map<string, SaveSection>();

export function registerSaveSection(key: string, s: SaveSection): void {
  sections.set(key, s);
}

export function exportSections(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, s] of sections) out[k] = s.export();
  return out;
}

export function importSections(raw: unknown): void {
  if (typeof raw !== 'object' || raw === null) return;
  for (const [k, s] of sections) if (k in (raw as Record<string, unknown>)) s.import((raw as Record<string, unknown>)[k]);
}

export function resetSections(): void {
  for (const s of sections.values()) s.reset();
}
