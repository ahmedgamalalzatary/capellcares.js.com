"use client";

import { useCallback, useMemo, useState } from "react";
import { nextSort, sortRows, type SortAccessors, type SortState } from "@/lib/table-sort";

export type { SortDirection, SortState } from "@/lib/table-sort";

/**
 * Three-state column sort for tables that are not paginated lists (paginated lists keep their sort in `usePaginatedList`).
 * `accessors` maps each sortable column key to the value it sorts by.
 */
export function useTableSort<T, K extends string>(rows: T[], accessors: SortAccessors<T, K>) {
  const [sort, setSort] = useState<SortState<K> | null>(null);

  const toggleSort = useCallback((key: K) => {
    setSort((current) => nextSort(current, key));
  }, []);

  const accessor = sort ? accessors[sort.key] : null;
  // Depend on the active accessor, not the accessors object, so an inline accessors literal doesn't re-sort every render.
  const sortedRows = useMemo(() => sortRows(rows, accessors, sort), [rows, sort, accessor]);

  return { sort, setSort, toggleSort, sortedRows };
}
