import { useCallback, useState } from "react";

export const CATEGORIES_COLLAPSED_STORAGE_KEY = "erp:categories:collapsed";

function readStoredCollapsed(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CATEGORIES_COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is number => typeof id === "number"));
  } catch {
    return new Set();
  }
}

function persist(ids: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CATEGORIES_COLLAPSED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable (private mode / quota) — keep the in-memory state */
  }
}

/**
 * Tracks which categories are collapsed in the tree, persisting the set to
 * localStorage so the fold/unfold state survives navigation and page reloads.
 *
 * The stored set is read synchronously in the initializer so the first render
 * already reflects it — hydrating in an effect would paint the tree expanded
 * for one frame and then animate it closed (a visible flash) when returning to
 * the page. This is SSR-safe: the tree has no server-rendered rows (the store
 * starts empty on the server and first mount), so there is no markup mismatch.
 */
export function useCollapsedCategories() {
  const [collapsed, setCollapsed] = useState<Set<number>>(readStoredCollapsed);

  const toggle = useCallback((id: number) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persist(next);
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
