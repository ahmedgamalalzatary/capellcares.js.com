import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalList, usePaginatedList } from "@/hooks/use-paginated-list";
import type { ListSchema } from "@/lib/pagination";

const schema = {
  filters: { status: { default: "all", values: ["all", "active", "inactive"] } },
  sortKeys: ["name", "date"]
} satisfies ListSchema<"status", "name" | "date">;

function visit(url: string) {
  window.history.replaceState(null, "", url);
}

function render(options: { searchDelay?: number; paramPrefix?: string } = {}) {
  return renderHook(() => usePaginatedList({ listId: "things", schema, ...options }));
}

beforeEach(() => {
  sessionStorage.clear();
  visit("/things");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePaginatedList", () => {
  it("starts from defaults", () => {
    const { result } = render();
    expect(result.current.ready).toBe(true);
    expect(result.current.state).toEqual({ page: 1, q: "", sort: null, filters: { status: "all" } });
  });

  it("restores its state from the address", () => {
    visit("/things?page=3&q=rose&sort=date&dir=desc&status=active");
    const { result } = render();
    expect(result.current.state).toMatchObject({ page: 3, q: "rose", sort: { key: "date", direction: "desc" }, filters: { status: "active" } });
    expect(result.current.searchInput).toBe("rose");
  });

  it("restores from the session copy when the address has no list keys, and writes it back to the address", () => {
    sessionStorage.setItem("capella-erp-list:things", "page=4&status=inactive");
    visit("/things?tab=x");
    const { result } = render();
    expect(result.current.state).toMatchObject({ page: 4, filters: { status: "inactive" } });
    expect(window.location.search).toBe("?tab=x&page=4&status=inactive");
  });

  it("keeps the address and the session copy in step with the state", () => {
    const { result } = render();
    act(() => result.current.setPage(2));
    expect(window.location.search).toBe("?page=2");
    expect(sessionStorage.getItem("capella-erp-list:things")).toBe("page=2");
  });

  it("goes back to page 1 when a filter or the sort changes", () => {
    const { result } = render();
    act(() => result.current.setPage(3));
    act(() => result.current.setFilter("status", "active"));
    expect(result.current.state.page).toBe(1);

    act(() => result.current.setPage(3));
    act(() => result.current.toggleSort("name"));
    expect(result.current.state).toMatchObject({ page: 1, sort: { key: "name", direction: "asc" } });

  });

  it("applies search at once by default and resets to page 1", () => {
    const { result } = render();
    act(() => result.current.setPage(2));
    act(() => result.current.setSearch("rose"));
    expect(result.current.state).toMatchObject({ q: "rose", page: 1 });
  });

  it("debounces search when asked, while the input updates at once", () => {
    vi.useFakeTimers();
    const { result } = render({ searchDelay: 300 });
    act(() => result.current.setSearch("ro"));
    act(() => result.current.setSearch("rose"));
    expect(result.current.searchInput).toBe("rose");
    expect(result.current.state.q).toBe("");
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.state.q).toBe("rose");
  });

  it("returns the visible rows of a full list", () => {
    const rows = Array.from({ length: 45 }, (_, index) => index + 1);
    const { result } = render();
    expect(result.current.pageOf(rows)).toEqual(rows.slice(0, 20));
    act(() => result.current.setPage(3));
    expect(result.current.pageOf(rows)).toEqual(rows.slice(40, 45));
  });

  it("builds the server query for remote lists", () => {
    visit("/things?page=2&q=rose&sort=date&dir=desc&status=active");
    const { result } = render();
    expect(result.current.requestQuery).toBe("page=2&q=rose&sort=date&dir=desc&status=active");
  });

  it("hands the pagination bar its state and actions", () => {
    const { result } = render();
    const props = result.current.paginationProps(134, true);
    expect(props).toEqual({ page: 1, total: 134, loading: true, onPageChange: expect.any(Function) });
    act(() => props.onPageChange(3));
    expect(result.current.state.page).toBe(3);
  });

  it("lets a list translate its filters for the server", () => {
    visit("/things?status=active&q=rose");
    const { result } = renderHook(() => usePaginatedList({
      listId: "things",
      schema,
      toRequest: (filters) => ({ state: filters.status === "all" ? undefined : filters.status.toUpperCase() })
    }));
    expect(result.current.requestQuery).toBe("page=1&q=rose&state=ACTIVE");
  });

  it("keeps two lists on one page apart with a key prefix", () => {
    visit("/things?page=2&best_page=3&best_sort=name");
    const { result } = render({ paramPrefix: "best_" });
    expect(result.current.state).toMatchObject({ page: 3, sort: { key: "name", direction: "asc" } });
    act(() => result.current.setPage(4));
    expect(window.location.search).toBe("?page=2&best_page=4&best_sort=name&best_dir=asc");
  });

  it("ignores a broken session store", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const { result } = render();
    act(() => result.current.setPage(2));
    expect(result.current.state.page).toBe(2);
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe("useLocalList", () => {
  it("sorts the whole list, then shows one page of it", () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }));
    const accessors = { id: (row: { id: number }) => row.id };
    const { result } = renderHook(() => useLocalList(rows, accessors, { listId: "local", schema: { filters: {}, sortKeys: ["id"] } }));
    expect(result.current.total).toBe(25);
    expect(result.current.sortedRows.map((row) => row.id)).toEqual(rows.slice(0, 20).map((row) => row.id));
    act(() => result.current.toggleSort("id"));
    act(() => result.current.toggleSort("id"));
    expect(result.current.sortedRows[0].id).toBe(25);
    expect(result.current.paginationProps(25).page).toBe(1);
  });
});
