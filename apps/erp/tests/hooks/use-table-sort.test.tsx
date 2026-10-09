import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTableSort } from "@/hooks/use-table-sort";

type Row = { id: number; name: string | null };

const rows: Row[] = [
  { id: 1, name: "banana" },
  { id: 2, name: "apple" },
  { id: 3, name: null },
  { id: 4, name: "" }
];

const accessors = { name: (row: Row) => row.name };

describe("useTableSort", () => {
  it("cycles a column through ascending, descending, then list order", () => {
    const { result } = renderHook(() => useTableSort(rows, accessors));

    expect(result.current.sort).toBeNull();

    act(() => result.current.toggleSort("name"));
    expect(result.current.sort).toEqual({ key: "name", direction: "asc" });

    act(() => result.current.toggleSort("name"));
    expect(result.current.sort).toEqual({ key: "name", direction: "desc" });

    act(() => result.current.toggleSort("name"));
    expect(result.current.sort).toBeNull();
  });

  it("keeps the list's own order when no column is active", () => {
    const { result } = renderHook(() => useTableSort(rows, accessors));

    expect(result.current.sortedRows.map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });

  it("sorts ascending and sinks empty values to the end", () => {
    const { result } = renderHook(() => useTableSort(rows, accessors));

    act(() => result.current.toggleSort("name"));

    expect(result.current.sortedRows.map((row) => row.id)).toEqual([2, 1, 3, 4]);
  });

  it("keeps empty values at the end when sorting descending", () => {
    const { result } = renderHook(() => useTableSort(rows, accessors));

    act(() => result.current.toggleSort("name"));
    act(() => result.current.toggleSort("name"));

    expect(result.current.sort).toEqual({ key: "name", direction: "desc" });
    expect(result.current.sortedRows.map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });
});
