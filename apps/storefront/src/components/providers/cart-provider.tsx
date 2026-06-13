"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const linesRef = useRef<CartLine[]>([]);

  const persistLines = useCallback((next: CartLine[]) => {
    try {
      if (next.length === 0) clearCartLines(localStorage);
      else saveCartLines(localStorage, next);
    } catch {}
  }, []);

  const commitLines = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
    persistLines(next);
  }, [persistLines]);

  useEffect(() => {
    const stored = loadCartLines(localStorage);
    // Merge rather than overwrite: on a slow device the buttons become tappable
    // (handlers attached at hydration) before this passive effect runs, so a quick
    // "add to cart"/"buy now" tap can land first. Overwriting here would silently
    // drop that just-added line; merging preserves it (summing qty on collision).
    const pending = linesRef.current;
    const next = (() => {
      if (pending.length === 0) return stored;
      const merged = [...stored];
      for (const line of pending) {
        const key = lineKey(line);
        const idx = merged.findIndex((l) => lineKey(l) === key);
        if (idx === -1) merged.push(line);
        else merged[idx] = { ...merged[idx], qty: merged[idx].qty + line.qty };
      }
      return merged;
    })();
    linesRef.current = next;
    setLines(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

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
          // Only ever prune a line against a catalog we actually received. An empty
          // result means the fetch came back without data (transient/flaky), not
          // that every item is invalid — pruning then would silently wipe a real
          // cart. Keep the line in that case and let a later good fetch validate it.
          if (line.type === "product") {
            if (products.length === 0) return true;
            return productVariants.get(line.productId)?.has(line.variantId) ?? false;
          }

          if (line.type === "offer") {
            if (offers.length === 0) return true;
            return offerIds.has(line.offerId);
          }

          if (collections.length === 0) return true;
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

    const prev = linesRef.current;
    const key = lineKey(normalized);
    const idx = prev.findIndex((l) => lineKey(l) === key);
    const next = idx === -1 ? [...prev, normalized] : [...prev];
    if (idx !== -1) next[idx] = { ...next[idx], qty: next[idx].qty + normalized.qty };
    commitLines(next);
  }, [commitLines]);

  const setQty = useCallback((key: string, qty: number) => {
    const next = linesRef.current.map((l) => (lineKey(l) === key ? { ...l, qty: Math.max(1, qty) } : l));
    commitLines(next);
  }, [commitLines]);

  const remove = useCallback((key: string) => {
    const next = linesRef.current.filter((l) => lineKey(l) !== key);
    commitLines(next);
  }, [commitLines]);

  const clear = useCallback(() => {
    commitLines([]);
  }, [commitLines]);

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
