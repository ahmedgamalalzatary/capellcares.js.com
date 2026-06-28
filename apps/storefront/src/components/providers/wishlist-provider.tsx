"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { PUBLIC_API_BASE as API_BASE } from "@/constants/api";

interface WishlistContextValue {
  ids: number[];
  has: (id: number) => boolean;
  toggle: (id: number) => void;
  clear: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    if (!user || !accessToken) {
      setIds([]);
      return;
    }
    fetch(`${API_BASE}/api/v1/wishlist`, {
      headers: { authorization: `Bearer ${accessToken}` }
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setIds((data.items ?? []).map((x: any) => Number(x.productId))))
      .catch(() => setIds([]));
  }, [user, accessToken]);

  const has = useCallback((id: number) => ids.includes(id), [ids]);
  const toggle = useCallback((id: number) => {
    if (!accessToken) return;
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      fetch(`${API_BASE}/api/v1/wishlist${prev.includes(id) ? `/${id}` : ""}`, {
        method: prev.includes(id) ? "DELETE" : "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: prev.includes(id) ? undefined : JSON.stringify({ productId: id })
      }).catch(() => {});
      return next;
    });
  }, [accessToken]);
  const clear = useCallback(() => setIds([]), []);

  const value = useMemo(() => ({ ids, has, toggle, clear }), [ids, has, toggle, clear]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
