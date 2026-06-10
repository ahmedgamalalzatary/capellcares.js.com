import { createElement } from "react";
import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CATEGORIES_COLLAPSED_STORAGE_KEY, useCollapsedCategories } from "@/hooks/use-collapsed-categories";

describe("useCollapsedCategories", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts with nothing collapsed when storage is empty", () => {
    const { result } = renderHook(() => useCollapsedCategories());
    expect(result.current.collapsed.size).toBe(0);
  });

  it("hydrates the collapsed set from localStorage on mount", () => {
    localStorage.setItem(CATEGORIES_COLLAPSED_STORAGE_KEY, JSON.stringify([3, 7]));

    const { result } = renderHook(() => useCollapsedCategories());

    expect(result.current.collapsed.has(3)).toBe(true);
    expect(result.current.collapsed.has(7)).toBe(true);
    expect(result.current.collapsed.size).toBe(2);
  });

  it("persists a collapsed id to localStorage when toggled on", () => {
    const { result } = renderHook(() => useCollapsedCategories());

    act(() => result.current.toggle(5));

    expect(result.current.collapsed.has(5)).toBe(true);
    expect(JSON.parse(localStorage.getItem(CATEGORIES_COLLAPSED_STORAGE_KEY)!)).toEqual([5]);
  });

  it("removes an id from storage when toggled off", () => {
    localStorage.setItem(CATEGORIES_COLLAPSED_STORAGE_KEY, JSON.stringify([5]));
    const { result } = renderHook(() => useCollapsedCategories());

    act(() => result.current.toggle(5));

    expect(result.current.collapsed.has(5)).toBe(false);
    expect(JSON.parse(localStorage.getItem(CATEGORIES_COLLAPSED_STORAGE_KEY)!)).toEqual([]);
  });

  it("has the stored set on the very first render (no expand→collapse flash)", () => {
    localStorage.setItem(CATEGORIES_COLLAPSED_STORAGE_KEY, JSON.stringify([9]));

    const renders: Array<Set<number>> = [];
    function Probe() {
      const { collapsed } = useCollapsedCategories();
      renders.push(collapsed);
      return null;
    }

    render(createElement(Probe));

    // First committed render must already reflect storage — if hydration happened
    // in an effect, renders[0] would be empty and the tree would animate closed.
    expect(renders[0].has(9)).toBe(true);
  });

  it("ignores malformed storage without throwing", () => {
    localStorage.setItem(CATEGORIES_COLLAPSED_STORAGE_KEY, "not-json");

    const { result } = renderHook(() => useCollapsedCategories());

    expect(result.current.collapsed.size).toBe(0);
  });
});
