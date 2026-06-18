import { useCollapsedSet } from "./use-collapsed-set";

export const SHOP_MEDIA_COLLAPSED_STORAGE_KEY = "erp:shop-media:collapsed";

type Slot = 1 | 2 | 3 | 4;

const isSlot = (value: unknown): value is Slot => value === 1 || value === 2 || value === 3 || value === 4;

/**
 * Tracks which shop-media sections are collapsed, persisting the set to
 * localStorage so the fold/unfold state survives navigation and page reloads.
 */
export function useCollapsedShopMedia() {
  return useCollapsedSet<Slot>(SHOP_MEDIA_COLLAPSED_STORAGE_KEY, isSlot);
}
