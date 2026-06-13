"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartLine } from "@capella/shared";
import { fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";
import { clearCartLines, loadCartLines, normalizeCartLine, saveCartLines } from "@/lib/cart";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  keyOf: (line: CartLine) => string;
}

const CartContext = createContext<CartContextValue | null>(null);
function lineKey(line: CartLine) {
  return line.type === "product"
    ? `p:${line.productId}:${line.variantId}`
    : line.type === "offer"
      ? `o:${line.offerId}`
      : `c:${line.collectionId}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadCartLines(localStorage);
    // Merge rather than overwrite: on a slow device the buttons become tappable
    // (handlers attached at hydration) before this passive effect runs, so a quick
    // "add to cart"/"buy now" tap can land first. Overwriting here would silently
    // drop that just-added line; merging preserves it (summing qty on collision).
    setLines((pending) => {
      if (pending.length === 0) return stored;
      const merged = [...stored];
      for (const line of pending) {
        const key = lineKey(line);
        const idx = merged.findIndex((l) => lineKey(l) === key);
        if (idx === -1) merged.push(line);
        else merged[idx] = { ...merged[idx], qty: merged[idx].qty + line.qty };
      }
      return merged;
    });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      saveCartLines(localStorage, lines);
    } catch {}
  }, [lines, hydrated]);

  useEffect(() => {
    if (!hydrated || lines.length === 0) return;

    let cancelled = false;

    Promise.all([fetchProducts(), fetchOffers(), fetchCollections()])
      .then(([products, offers, collections]) => {
        if (cancelled) return;

        const productVariants = new Map(products.map((product) => [
          product.id,
          new Set(product.variants.map((variant) => variant.id))
        ]));
        const offerIds = new Set(offers.map((offer) => offer.id));
        const collectionIds = new Set(collections.map((collection) => collection.id));

        setLines((current) => current.filter((line) => {
          if (line.type === "product") {
            return productVariants.get(line.productId)?.has(line.variantId) ?? false;
          }

          if (line.type === "offer") {
            return offerIds.has(line.offerId);
          }

          return collectionIds.has(line.collectionId);
        }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [hydrated, lines.length]);

  const add = useCallback((line: CartLine) => {
    const normalized = normalizeCartLine(line);
    if (!normalized) return;

    setLines((prev) => {
      const key = lineKey(normalized);
      const idx = prev.findIndex((l) => lineKey(l) === key);
      if (idx === -1) return [...prev, normalized];
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + normalized.qty };
      return next;
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (lineKey(l) === key ? { ...l, qty: Math.max(1, qty) } : l))
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => lineKey(l) !== key));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    clearCartLines(localStorage);
  }, []);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((acc, l) => acc + l.qty, 0),
    add, setQty, remove, clear, keyOf: lineKey
  }), [lines, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
