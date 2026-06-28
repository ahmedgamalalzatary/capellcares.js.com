"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { PUBLIC_API_BASE as API_BASE } from "@/constants/api";
import type { WishlistEntry, WishlistEntityType } from "@capella/shared";

interface WishlistContextValue {
  ids: string[];
  items: WishlistEntry[];
  has: (entityType: WishlistEntityType, entityId: number) => boolean;
  toggle: (entityType: WishlistEntityType, entityId: number) => void;
  remove: (entityType: WishlistEntityType, entityId: number) => void;
  clear: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function keyOf(entityType: WishlistEntityType, entityId: number) {
  return `${entityType}:${entityId}`;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [ids, setIds] = useState<string[]>([]);

  const refresh = useCallback(() => {
    if (!user || !accessToken) {
      setItems([]);
      setIds([]);
      return;
    }
    fetch(`${API_BASE}/api/v1/wishlist`, {
      headers: { authorization: `Bearer ${accessToken}` }
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const nextItems = (data.items ?? []) as WishlistEntry[];
        setItems(nextItems);
        setIds(nextItems.map((item) => keyOf(item.entityType, item.entityId)));
      })
      .catch(() => {
        setItems([]);
        setIds([]);
      });
  }, [user, accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const has = useCallback((entityType: WishlistEntityType, entityId: number) => ids.includes(keyOf(entityType, entityId)), [ids]);
  const remove = useCallback((entityType: WishlistEntityType, entityId: number) => {
    if (!accessToken) return;
    const key = keyOf(entityType, entityId);
    setIds((prev) => prev.filter((item) => item !== key));
    setItems((prev) => prev.filter((item) => !(item.entityType === entityType && item.entityId === entityId)));
    fetch(`${API_BASE}/api/v1/wishlist/${entityType}/${entityId}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    })
      .then((response) => {
        if (!response.ok) refresh();
      })
      .catch(() => {
        refresh();
      });
  }, [accessToken, refresh]);
  const toggle = useCallback((entityType: WishlistEntityType, entityId: number) => {
    if (!accessToken) return;
    if (has(entityType, entityId)) {
      remove(entityType, entityId);
      return;
    }

    const key = keyOf(entityType, entityId);
    setIds((prev) => [...prev, key]);
    fetch(`${API_BASE}/api/v1/wishlist`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ entityType, entityId })
    })
      .then(() => refresh())
      .catch(() => {
        setIds((prev) => prev.filter((item) => item !== key));
      });
  }, [accessToken, has, refresh, remove]);
  const clear = useCallback(() => {
    setItems([]);
    setIds([]);
  }, []);

  const value = useMemo(() => ({ ids, items, has, toggle, remove, clear }), [ids, items, has, toggle, remove, clear]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
