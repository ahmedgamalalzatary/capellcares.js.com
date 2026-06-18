import { useCollapsedSet } from "./use-collapsed-set";

export const CATEGORIES_COLLAPSED_STORAGE_KEY = "erp:categories:collapsed";

const isCategoryId = (value: unknown): value is number => typeof value === "number";

/**
 * Tracks which categories are collapsed in the tree, persisting the set to
 * localStorage so the fold/unfold state survives navigation and page reloads.
 */
export function useCollapsedCategories() {
  return useCollapsedSet<number>(CATEGORIES_COLLAPSED_STORAGE_KEY, isCategoryId);
}
