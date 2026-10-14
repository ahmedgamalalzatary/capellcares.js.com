import { describe, expect, it } from "vitest";
import {
  clampPage,
  defaultListState,
  pageNumbers,
  parseListState,
  serializeListState,
  pageSlice,
  type ListSchema,
  type ListState
} from "@/lib/pagination";

describe("pageNumbers", () => {
  it("lists every page when there are few", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps first, last and the pages beside the current one, with gaps between", () => {
    expect(pageNumbers(5, 125)).toEqual([1, "gap", 4, 5, 6, "gap", 125]);
  });

  it("shows the start and end without a leading or trailing gap", () => {
    expect(pageNumbers(1, 125)).toEqual([1, 2, "gap", 125]);
    expect(pageNumbers(125, 125)).toEqual([1, "gap", 124, 125]);
  });

  it("never hides a single page behind a gap", () => {
    expect(pageNumbers(4, 125)).toEqual([1, 2, 3, 4, 5, "gap", 125]);
    expect(pageNumbers(122, 125)).toEqual([1, "gap", 121, 122, 123, 124, 125]);
  });

  it("can drop the neighbours for narrow screens", () => {
    expect(pageNumbers(5, 125, 0)).toEqual([1, "gap", 5, "gap", 125]);
    expect(pageNumbers(3, 125, 0)).toEqual([1, 2, 3, "gap", 125]);
  });

  it("is empty when there are no pages", () => {
    expect(pageNumbers(1, 0)).toEqual([]);
  });
});

describe("clampPage", () => {
  it("keeps a page inside 1..totalPages", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(4, 0)).toBe(1);
  });

  it("falls back to the first page for anything that is not a whole number", () => {
    expect(clampPage(Number.NaN, 5)).toBe(1);
    expect(clampPage(2.5, 5)).toBe(2);
  });
});

describe("pageSlice", () => {
  it("returns the 20 rows of a page", () => {
    const rows = Array.from({ length: 45 }, (_, index) => index + 1);
    expect(pageSlice(rows, 1)).toEqual(rows.slice(0, 20));
    expect(pageSlice(rows, 3)).toEqual([41, 42, 43, 44, 45]);
    expect(pageSlice(rows, 4)).toEqual([]);
  });
});

const schema = {
  filters: {
    status: { default: "all", values: ["all", "active", "inactive"] },
    from: { default: "", accepts: (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) }
  },
  sortKeys: ["name", "date"]
} satisfies ListSchema<"status" | "from", "name" | "date">;

describe("parseListState", () => {
  it("uses defaults for an empty address", () => {
    expect(parseListState(new URLSearchParams(), schema)).toEqual(defaultListState(schema));
    expect(defaultListState(schema)).toEqual({
      page: 1, q: "", sort: null, filters: { status: "all", from: "" }
    });
  });

  it("reads every key", () => {
    const params = new URLSearchParams("page=3&q=rose&sort=date&dir=desc&status=active&from=2026-10-01");
    expect(parseListState(params, schema)).toEqual({
      page: 3, q: "rose", sort: { key: "date", direction: "desc" },
      filters: { status: "active", from: "2026-10-01" }
    });
  });

  it("ignores junk values", () => {
    const params = new URLSearchParams("page=-2&sort=price&dir=up&status=gone&from=yesterday");
    expect(parseListState(params, schema)).toEqual(defaultListState(schema));
  });

  it("reads a sort without a direction as ascending", () => {
    expect(parseListState(new URLSearchParams("sort=name"), schema).sort).toEqual({ key: "name", direction: "asc" });
  });
});

describe("serializeListState", () => {
  it("leaves defaults out of the address", () => {
    expect(serializeListState(defaultListState(schema), schema).toString()).toBe("");
  });

  it("writes only what differs from the defaults and round-trips", () => {
    const state: ListState<"status" | "from", "name" | "date"> = {
      page: 2, q: " rose ", sort: { key: "name", direction: "asc" },
      filters: { status: "inactive", from: "" }
    };
    const params = serializeListState(state, schema);
    expect(params.toString()).toBe("page=2&q=rose&sort=name&dir=asc&status=inactive");
    expect(parseListState(params, schema)).toEqual({ ...state, q: "rose" });
  });
});
