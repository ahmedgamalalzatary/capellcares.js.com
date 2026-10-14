import { describe, expect, it } from "vitest";
import { nextSort, sortRows } from "@/lib/table-sort";

type Row = { id: number; name: string | null };
const rows: Row[] = [{ id: 1, name: "b" }, { id: 2, name: null }, { id: 3, name: "a" }];
const accessors = { name: (row: Row) => row.name };

describe("nextSort", () => {
  it("cycles ascending, descending, then none, and restarts on another column", () => {
    expect(nextSort(null, "name")).toEqual({ key: "name", direction: "asc" });
    expect(nextSort({ key: "name", direction: "asc" }, "name")).toEqual({ key: "name", direction: "desc" });
    expect(nextSort({ key: "name", direction: "desc" }, "name")).toBeNull();
    expect(nextSort<"name" | "date">({ key: "name", direction: "desc" }, "date")).toEqual({ key: "date", direction: "asc" });
  });
});

describe("sortRows", () => {
  it("keeps the list order without a sort", () => {
    expect(sortRows(rows, accessors, null)).toBe(rows);
  });

  it("sorts both ways with empty values last", () => {
    expect(sortRows(rows, accessors, { key: "name", direction: "asc" }).map((row) => row.id)).toEqual([3, 1, 2]);
    expect(sortRows(rows, accessors, { key: "name", direction: "desc" }).map((row) => row.id)).toEqual([1, 3, 2]);
  });
});
