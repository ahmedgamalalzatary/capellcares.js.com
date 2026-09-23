"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CartLine } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { readStoredAuthUser } from "@/lib/auth-provider.storage";
import { PUBLIC_API_BASE as API_BASE } from "@/constants/api";
import { fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";
import {
  cartLineAdditions,
  cartLineKey as lineKey,
  clearCartLines,
  loadCartLines,
  loadLastSyncedCartLines,
  mergeCartLines,
  normalizeCartLine,
  saveCartLines,
  saveLastSyncedCartLines
} from "@/lib/cart";

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

const UPLOAD_RETRY_DELAY_MS = 750;

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const linesRef = useRef<CartLine[]>([]);
  const pendingClearCustomerIdRef = useRef<number | null>(null);
  // Customer whose cart this browser session has already pulled from the API.
  // Null means "not synced yet", so pushes stay disabled until the pull lands
  // (a failed GET must never be followed by a PUT that would overwrite the
  // stored cart with whatever happens to be in localStorage).
  const syncedCustomerIdRef = useRef<number | null>(null);
  // Last cart snapshot known to be on the server (after a successful GET or
  // PUT). Lets the merge step tell unsynced local additions apart from
  // quantities that were already synced.
  const syncedLinesRef = useRef<CartLine[] | null>(null);
  // Upload queue: serializes PUTs so only one request is active per customer.
  // `pending` is the latest snapshot not yet sent; a cart change during an
  // active upload overwrites it and is sent once the active request completes.
  const uploadStateRef = useRef<{ pending: CartLine[] | null; inFlight: boolean; retryTimer: number | null }>({
    pending: null,
    inFlight: false,
    retryTimer: null
  });
  const accessTokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const uploadState = uploadStateRef.current;
      if (uploadState.retryTimer != null) window.clearTimeout(uploadState.retryTimer);
      uploadState.retryTimer = null;
      uploadState.inFlight = false;
      uploadState.pending = null;
    };
  }, []);

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

  const persistSyncedSnapshot = useCallback((snapshot: CartLine[]) => {
    syncedLinesRef.current = snapshot;
    try {
      saveLastSyncedCartLines(localStorage, snapshot);
    } catch {}
  }, []);

  const drainUpload = useCallback(() => {
    if (!mountedRef.current) return;
    const uploadState = uploadStateRef.current;
    if (uploadState.inFlight) return;
    const token = accessTokenRef.current;
    if (!token || syncedCustomerIdRef.current == null) return;

    const snapshot = uploadState.pending;
    if (snapshot == null) return;

    uploadState.pending = null;
    uploadState.inFlight = true;

    const failUpload = (failed: CartLine[]) => {
      // Retain the latest snapshot: a newer one that arrived mid-flight wins;
      // otherwise the failed snapshot is retried once the upload path frees up.
      if (uploadState.pending == null) uploadState.pending = failed;
      if (uploadState.retryTimer == null) {
        uploadState.retryTimer = window.setTimeout(() => {
          uploadState.retryTimer = null;
          drainUpload();
        }, UPLOAD_RETRY_DELAY_MS);
      }
    };

    fetch(`${API_BASE}/api/v1/cart`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ lines: snapshot })
    })
      .then((response) => {
        if (!mountedRef.current) return;
        uploadState.inFlight = false;
        if (!response.ok) {
          failUpload(snapshot);
          return;
        }
        // The server now holds exactly this snapshot.
        persistSyncedSnapshot(snapshot);
        if (uploadState.pending != null) drainUpload();
      })
      .catch(() => {
        if (!mountedRef.current) return;
        uploadState.inFlight = false;
        failUpload(snapshot);
      });
  }, [persistSyncedSnapshot]);

  const uploadLines = useCallback((next: CartLine[]) => {
    uploadStateRef.current.pending = next;
    drainUpload();
  }, [drainUpload]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      saveCartLines(localStorage, lines);
    } catch {}
  }, [lines, hydrated]);

  // Server cart sync — signed-in customers only. Guests keep the
  // localStorage-only cart, so nothing changes for people who never register.
  useEffect(() => {
    if (!hydrated || !user || !accessToken) return;
    if (syncedCustomerIdRef.current === user.id) return;

    let cancelled = false;
    const previousCustomerId = syncedCustomerIdRef.current;

    fetch(`${API_BASE}/api/v1/cart`, { headers: { authorization: `Bearer ${accessToken}` } })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(`cart fetch failed: ${response.status}`))
      )
      .then((data: { lines?: unknown }) => {
        if (cancelled) return;
        const serverLines = Array.isArray(data?.lines)
          ? data.lines
              .map((line) => normalizeCartLine(line))
              .filter((line): line is CartLine => line !== null)
          : [];
        // Another account was signed in on this browser before: its leftover
        // local lines must not leak into this account's cart.
        const localLines =
          previousCustomerId != null && previousCustomerId !== user.id ? [] : linesRef.current;
        // Only the local additions the server has not seen are merged in; the
        // rest of the local cart was already synced and must not be summed
        // again (that would double quantities on every page reload).
        const lastSynced = syncedLinesRef.current ?? loadLastSyncedCartLines(localStorage);
        const additions = cartLineAdditions(localLines, lastSynced);
        // Checkout can finish while this GET is in flight. Its response is then
        // an older cart snapshot and must not restore the purchased items.
        const clearedDuringPull = pendingClearCustomerIdRef.current === user.id;
        const merged = clearedDuringPull ? [...localLines] : mergeCartLines(additions, serverLines);
        // The server snapshot is the new sync baseline; the merged cart is
        // queued for upload by the lines-change effect.
        persistSyncedSnapshot(serverLines);
        syncedCustomerIdRef.current = user.id;
        commitLines(merged);
        if (clearedDuringPull) pendingClearCustomerIdRef.current = null;
      })
      .catch(() => {
        // Sync stays disabled: a failed GET must never be followed by a PUT
        // that would overwrite the stored cart with whatever is in localStorage.
        // The localStorage cart keeps working; the next page load retries.
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, user, accessToken, commitLines]);

  // Push local changes while signed in so every device converges on the same
  // cart. Uploads are serialized — one PUT in flight per customer; a change
  // during an active upload waits in a one-slot queue and is sent when the
  // active request completes. Failed uploads retain the latest snapshot and
  // retry without needing another cart change.
  useEffect(() => {
    if (!hydrated || !user || !accessToken) return;
    if (syncedCustomerIdRef.current !== user.id) return;
    uploadLines(lines);
  }, [lines, hydrated, user, accessToken, uploadLines]);

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
    const customerId = user?.id ?? readStoredAuthUser()?.id;
    pendingClearCustomerIdRef.current = customerId != null && syncedCustomerIdRef.current !== customerId
      ? customerId : null;
    commitLines([]);
  }, [commitLines, user?.id]);

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
