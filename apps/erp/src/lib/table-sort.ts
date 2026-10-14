export type SortDirection = "asc" | "desc";
export interface SortState<K extends string> { key: K; direction: SortDirection }

export type SortValue = string | number | null | undefined;
export type SortAccessors<T, K extends string> = Record<K, (row: T) => SortValue>;

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

const isEmpty = (value: SortValue) => value == null || value === "";

function compare(a: SortValue, b: SortValue) {
  // Empty values always sink to the end, whatever the direction.
  if (isEmpty(a)) return isEmpty(b) ? 0 : 1;
  if (isEmpty(b)) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

/** Three-state column sort: ascending → descending → back to the list's own order. */
export function nextSort<K extends string>(current: SortState<K> | null, key: K): SortState<K> | null {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

/** Stable sort by one column; `null` keeps the list's own order. */
export function sortRows<T, K extends string>(rows: T[], accessors: SortAccessors<T, K>, sort: SortState<K> | null) {
  const accessor = sort ? accessors[sort.key] : null;
  if (!sort || !accessor) return rows;
  const factor = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: accessor(row) }))
    .sort((a, b) => {
      if (isEmpty(a.value) || isEmpty(b.value)) return compare(a.value, b.value) || a.index - b.index;
      return compare(a.value, b.value) * factor || a.index - b.index;
    })
    .map((entry) => entry.row);
}
