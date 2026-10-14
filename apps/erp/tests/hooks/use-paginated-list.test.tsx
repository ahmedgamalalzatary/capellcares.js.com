import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import type { ListSchema } from "@/lib/pagination";

const schema = {
  filters: { status: { default: "all", values: ["all", "active", "inactive"] } },
  sortKeys: ["name", "date"]
} satisfies ListSchema<"status", "name" | "date">;

function visit(url: string) {
  window.history.replaceState(null, "", url);
}

function render(options: { searchDelay?: number } = {}) {
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
    expect(result.current.state).toMatchObject({ page: 1, size: 20, more: 0, q: "", sort: null, filters: { status: "all" } });
  });

  it("restores its state from the address", () => {
    visit("/things?page=3&size=50&q=rose&sort=date&dir=desc&status=active");
    const { result } = render();
    expect(result.current.state).toMatchObject({ page: 3, size: 50, q: "rose", sort: { key: "date", direction: "desc" }, filters: { status: "active" } });
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

  it("goes back to page 1 when a filter, the sort or the rows per page change", () => {
    const { result } = render();
    act(() => result.current.setPage(3));
    act(() => result.current.setFilter("status", "active"));
    expect(result.current.state.page).toBe(1);

    act(() => result.current.setPage(3));
    act(() => result.current.toggleSort("name"));
    expect(result.current.state).toMatchObject({ page: 1, sort: { key: "name", direction: "asc" } });

    act(() => result.current.setPage(3));
    act(() => result.current.setSize(50));
    expect(result.current.state).toMatchObject({ page: 1, size: 50 });
  });

  it("loads more pages and clears them on any page jump", () => {
    const { result } = render();
    act(() => result.current.loadMore());
    act(() => result.current.loadMore());
    expect(result.current.state.more).toBe(2);
    act(() => result.current.setPage(5));
    expect(result.current.state).toMatchObject({ page: 5, more: 0 });
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
    act(() => result.current.setPage(2));
    act(() => result.current.loadMore());
    expect(result.current.pageOf(rows)).toEqual(rows.slice(20, 45));
  });

  it("builds the server query for remote lists", () => {
    visit("/things?page=2&more=1&q=rose&sort=date&dir=desc&status=active");
    const { result } = render();
    expect(result.current.requestQuery).toBe("page=2&pageSize=20&pages=2&q=rose&sort=date&dir=desc&status=active");
  });

  it("hands the pagination bar its state and actions", () => {
    const { result } = render();
    const props = result.current.paginationProps(134, true);
    expect(props).toMatchObject({ page: 1, more: 0, pageSize: 20, total: 134, loading: true });
    act(() => props.onPageChange(3));
    expect(result.current.state.page).toBe(3);
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
