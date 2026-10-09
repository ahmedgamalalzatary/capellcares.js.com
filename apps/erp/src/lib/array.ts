/**
 * Moves an item one slot up or down. Returns the same array when the move would fall outside the
 * bounds, so callers can hand it straight to a state setter without extra guards.
 */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items as T[];
  }
  const next = items.slice();
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
