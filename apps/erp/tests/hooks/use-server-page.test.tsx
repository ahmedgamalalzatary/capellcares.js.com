import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ api: { get: apiGet } }));

import { useServerPage } from "@/hooks/use-paginated-list";

const pageOf = (ids: number[], total = ids.length) => ({
  items: ids.map((id) => ({ id })),
  pagination: { page: 1, pageSize: 20, total, totalPages: Math.ceil(total / 20) }
});

beforeEach(() => {
  apiGet.mockReset();
});

describe("useServerPage", () => {
  it("does not fetch without a path", () => {
    const { result } = renderHook(() => useServerPage<{ id: number }>(null));
    expect(apiGet).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ items: [], total: 0, loading: true, error: false });
  });

  it("fetches the page and exposes its rows and total", async () => {
    apiGet.mockResolvedValueOnce(pageOf([1, 2], 45));
    const { result } = renderHook(() => useServerPage<{ id: number }>("/api/erp/things?page=1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet).toHaveBeenCalledWith("/api/erp/things?page=1");
    expect(result.current).toMatchObject({ items: [{ id: 1 }, { id: 2 }], total: 45, error: false });
  });

  it("keeps the last rows and total while the next page loads, and ignores a stale answer", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    apiGet
      .mockResolvedValueOnce(pageOf([1], 45))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(pageOf([3], 45));
    const { result, rerender } = renderHook(({ path }) => useServerPage<{ id: number }>(path), { initialProps: { path: "/x?page=1" } });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ path: "/x?page=2" });
    expect(result.current).toMatchObject({ items: [{ id: 1 }], total: 45, loading: true });

    rerender({ path: "/x?page=3" });
    await waitFor(() => expect(result.current.items).toEqual([{ id: 3 }]));
    await act(async () => resolveFirst(pageOf([2], 45)));
    expect(result.current.items).toEqual([{ id: 3 }]);
  });

  it("reports a failed load and retries on reload", async () => {
    apiGet.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(pageOf([1]));
    const { result } = renderHook(() => useServerPage<{ id: number }>("/x"));
    await waitFor(() => expect(result.current.error).toBe(true));
    await act(async () => { await result.current.reload(); });
    expect(result.current).toMatchObject({ items: [{ id: 1 }], error: false, loading: false });
  });
});
