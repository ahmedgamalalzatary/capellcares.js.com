import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ success: vi.fn(), showErrorToast: vi.fn() }));

vi.mock("sonner", () => ({ toast: { success: mocks.success, error: vi.fn() } }));
vi.mock("@/lib/errors", () => ({ showErrorToast: mocks.showErrorToast }));

import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";

const baseInput = { persistedIds: [1, 2, 3], successMessage: "تم الحفظ", errorMessage: "تعذر الحفظ" };

describe("useListReorder", () => {
  beforeEach(() => {
    mocks.success.mockClear();
    mocks.showErrorToast.mockClear();
  });

  it("moves an item within bounds and marks the draft dirty", () => {
    const { result } = renderHook(() => useListReorder({ ...baseInput, save: vi.fn() }));

    expect(result.current.isDirty).toBe(false);

    act(() => result.current.moveItem(1, 1));

    expect(result.current.orderedIds).toEqual([2, 1, 3]);
    expect(result.current.isDirty).toBe(true);
  });

  it("ignores moves past either end", () => {
    const { result } = renderHook(() => useListReorder({ ...baseInput, save: vi.fn() }));

    act(() => result.current.moveItem(1, -1));
    act(() => result.current.moveItem(3, 1));

    expect(result.current.orderedIds).toEqual([1, 2, 3]);
    expect(result.current.isDirty).toBe(false);
  });

  it("saves the ordered ids, toasts success and clears the draft", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useListReorder({ ...baseInput, save }));

    act(() => result.current.moveItem(1, 1));

    await act(async () => {
      await result.current.saveOrder();
    });

    expect(save).toHaveBeenCalledWith([2, 1, 3]);
    expect(mocks.success).toHaveBeenCalledWith("تم الحفظ");
    expect(result.current.isDirty).toBe(false);
  });

  it("reports a failed save and keeps the draft dirty", async () => {
    const error = new Error("boom");
    const save = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useListReorder({ ...baseInput, save }));

    act(() => result.current.moveItem(1, 1));

    await act(async () => {
      await result.current.saveOrder();
    });

    expect(mocks.showErrorToast).toHaveBeenCalledWith(error, "تعذر الحفظ");
    expect(result.current.isDirty).toBe(true);
  });

  it("resets the draft when the persisted order changes", () => {
    const save = vi.fn();
    const { result, rerender } = renderHook(
      (props: typeof baseInput & { save: (ids: number[]) => Promise<void> }) => useListReorder(props),
      { initialProps: { ...baseInput, save } }
    );

    act(() => result.current.moveItem(1, 1));
    expect(result.current.orderedIds).toEqual([2, 1, 3]);

    rerender({ ...baseInput, persistedIds: [3, 2, 1], save });

    expect(result.current.orderedIds).toEqual([3, 2, 1]);
    expect(result.current.isDirty).toBe(false);
  });
});

describe("sortByIdOrder", () => {
  it("orders items by the given ids and puts unknown ids last", () => {
    expect(sortByIdOrder([{ id: 1 }, { id: 2 }, { id: 3 }], [3, 1])).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }]);
  });
});
