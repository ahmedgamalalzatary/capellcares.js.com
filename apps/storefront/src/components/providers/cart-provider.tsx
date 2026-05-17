"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartLine } from "@capella/shared";
import { fetchOffers, fetchProducts } from "@/lib/api/client";

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
const STORAGE_KEY = "capella.cart.v1";

function lineKey(line: CartLine) {
  return line.type === "product"
    ? `p:${line.productId}:${line.variantId}`
    : `o:${line.offerId}`;
}

function normalizeLine(line: unknown): CartLine | null {
  if (!line || typeof line !== "object") return null;

  if ((line as CartLine).type === "product") {
    const productLine = line as Partial<CartLine & { type: "product" }>;
    if (
      Number.isInteger(productLine.productId) &&
      Number.isInteger(productLine.variantId) &&
      Number.isInteger(productLine.qty) &&
      productLine.qty! > 0
    ) {
      return {
        type: "product",
        productId: productLine.productId!,
        variantId: productLine.variantId!,
        qty: productLine.qty!
      };
    }
    return null;
  }

  if ((line as CartLine).type === "offer") {
    const offerLine = line as Partial<CartLine & { type: "offer" }>;
    if (
      Number.isInteger(offerLine.offerId) &&
      Number.isInteger(offerLine.qty) &&
      offerLine.qty! > 0
    ) {
      return {
        type: "offer",
        offerId: offerLine.offerId!,
        qty: offerLine.qty!
      };
    }
  }

  return null;
}

function normalizeLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeLine).filter((line): line is CartLine => line !== null);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(normalizeLines(JSON.parse(raw)));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch {}
  }, [lines, hydrated]);

  useEffect(() => {
    if (!hydrated || lines.length === 0) return;

    let cancelled = false;

    Promise.all([fetchProducts(), fetchOffers()])
      .then(([products, offers]) => {
        if (cancelled) return;

        const productVariants = new Map(products.map((product) => [
          product.id,
          new Set(product.variants.map((variant) => variant.id))
        ]));
        const offerIds = new Set(offers.map((offer) => offer.id));

        setLines((current) => current.filter((line) => {
          if (line.type === "product") {
            return productVariants.get(line.productId)?.has(line.variantId) ?? false;
          }

          return offerIds.has(line.offerId);
        }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [hydrated, lines.length]);

  const add = useCallback((line: CartLine) => {
    const normalized = normalizeLine(line);
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

  const clear = useCallback(() => setLines([]), []);

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
