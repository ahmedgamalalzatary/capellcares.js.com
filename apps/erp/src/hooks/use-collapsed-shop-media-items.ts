import { useCollapsedSet } from "./use-collapsed-set";

export const SHOP_MEDIA_ITEMS_COLLAPSED_STORAGE_KEY = "erp:shop-media:items:collapsed";

const isItemKey = (value: unknown): value is string => typeof value === "string";

/**
 * Tracks which shop-media items (rows) are collapsed, persisting the set to
 * localStorage so the fold/unfold state survives navigation and page reloads.
 * Keys are `${slot}:${itemId}` so rows stay distinct across sections.
 */
export function useCollapsedShopMediaItems() {
  return useCollapsedSet<string>(SHOP_MEDIA_ITEMS_COLLAPSED_STORAGE_KEY, isItemKey);
}
