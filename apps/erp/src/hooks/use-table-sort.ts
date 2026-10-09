"use client";

import { useCallback, useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";
export interface SortState<K extends string> { key: K; direction: SortDirection }

type SortValue = string | number | null | undefined;

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

function compare(a: SortValue, b: SortValue) {
  // Empty values always sink to the end, whatever the direction.
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * Three-state column sort: ascending → descending → back to the list's own order.
 * `accessors` maps each sortable column key to the value it sorts by.
 */
export function useTableSort<T, K extends string>(rows: T[], accessors: Record<K, (row: T) => SortValue>) {
  const [sort, setSort] = useState<SortState<K> | null>(null);

  const toggleSort = useCallback((key: K) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }, []);

  const accessor = sort ? accessors[sort.key] : null;
  const sortedRows = useMemo(() => {
    if (!sort || !accessor) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index, value: accessor(row) }))
      .sort((a, b) => {
        const empty = (v: SortValue) => v == null || v === "";
        if (empty(a.value) || empty(b.value)) return compare(a.value, b.value) || a.index - b.index;
        return compare(a.value, b.value) * factor || a.index - b.index;
      })
      .map((entry) => entry.row);
  }, [rows, sort, accessor]);

  return { sort, setSort, toggleSort, sortedRows };
}
