import { useCollapsedSet } from "@/hooks/use-collapsed-set";

const SHOP_MEDIA_COLLAPSED_STORAGE_KEY = "erp:shop-media:collapsed";

// Sections are told apart by their editing key; numbers left in storage from the old fixed slots are simply ignored.
const isSectionKey = (value: unknown): value is string => typeof value === "string";

/** Tracks which shop-media sections are collapsed, persisting the set to localStorage so the fold/unfold state survives navigation and page reloads. */
export function useCollapsedShopMedia() {
  return useCollapsedSet<string>(SHOP_MEDIA_COLLAPSED_STORAGE_KEY, isSectionKey);
}
