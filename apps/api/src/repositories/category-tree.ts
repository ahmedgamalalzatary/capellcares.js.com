// Pure, in-memory category-tree helpers. No DB access — they operate on rows
// the caller has already loaded, so they are trivially unit-testable and shared
// by the repository, the service, and the product controller.

type CategoryNode = { id: number; parentId: number | null };

/**
 * Returns `rootId` together with every category beneath it. Resilient to
 * malformed parent cycles (each id is visited at most once).
 */
export function collectDescendantIds(rootId: number, rows: CategoryNode[]): number[] {
  const descendantIds = new Set<number>([rootId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const row of rows) {
      if (row.parentId != null && descendantIds.has(row.parentId) && !descendantIds.has(row.id)) {
        descendantIds.add(row.id);
        changed = true;
      }
    }
  }

  return [...descendantIds];
}

/**
 * Walks parent links upward from `startId` and returns the chain root-first,
 * inclusive of the start node. Returns an empty array for a null start and
 * stops safely on broken chains or cycles.
 */
export function buildLineage<T extends CategoryNode>(startId: number | null, rows: T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const lineage: T[] = [];
  const seen = new Set<number>();
  let currentId = startId;

  while (currentId != null && !seen.has(currentId)) {
    seen.add(currentId);
    const current = byId.get(currentId);
    if (!current) {
      break;
    }
    lineage.unshift(current);
    currentId = current.parentId;
  }

  return lineage;
}
