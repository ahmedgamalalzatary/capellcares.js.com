"use client";

import { useCallback, useEffect, useState } from "react";
import { readWishlist, syncWishlist, toggleWishlist, WISHLIST_UPDATED_EVENT } from "@/lib/wishlist";

/** Live wishlist state shared across components via the wishlist-updated event. */
export function useWishlist() {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    setIds(readWishlist());
    void syncWishlist().then(setIds);
    const onUpdate = () => setIds(readWishlist());
    window.addEventListener(WISHLIST_UPDATED_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(WISHLIST_UPDATED_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  const toggle = useCallback((productId: number) => setIds(toggleWishlist(productId)), []);
  const has = useCallback((productId: number) => ids.includes(productId), [ids]);

  return { ids, toggle, has };
}
