import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { CartLine } from "@capella/shared";
import { useAuth } from "@/lib/auth/auth-context";
import { fetchCollections, fetchOffers, fetchProducts, fetchCustomerCart, replaceCustomerCart } from "@/lib/api/client";
import {
  cartLineAdditions,
  cartLineKey,
  clearCartOwner,
  clearLastSyncedCartLines,
  clearPendingCart,
  loadCartLines,
  loadCartOwner,
  loadLastSyncedCartLines,
  loadPendingCart,
  mergeCartLines,
  normalizeCartLine,
  saveCartLines,
  saveCartOwner,
  saveLastSyncedCartLines,
  savePendingCart,
  unionCartLines
} from "@/lib/cart-lines";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  keyOf: (line: CartLine) => string;
};

const CartContext = createContext<CartContextValue | null>(null);

const UPLOAD_RETRY_DELAY_MS = 750;

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Bumped when the app returns to the foreground so a previously failed pull is retried.
  const [pullNonce, setPullNonce] = useState(0);

  const mountedRef = useRef(true);
  const linesRef = useRef<CartLine[]>([]);
  const userRef = useRef(user);
  const accessTokenRef = useRef(accessToken);
  // Customer whose cart has been pulled from the API; null means pushes stay disabled until a successful pull lands.
  const syncedCustomerIdRef = useRef<number | null>(null);
  // Last snapshot known to be on the server; lets the merge tell unsynced additions apart from already-synced quantities.
  const syncedLinesRef = useRef<CartLine[] | null>(null);
  // Checkout can clear the cart while its GET/pull is in flight; the stale response must not restore purchased items.
  const pendingClearCustomerIdRef = useRef<number | null>(null);
  // Last signed-in customer, used to detect logout (as opposed to a guest who was never signed in).
  const previousUserIdRef = useRef<number | null>(null);
  const uploadRef = useRef<{ pending: CartLine[] | null; inFlight: boolean; retryTimer: ReturnType<typeof setTimeout> | null }>({
    pending: null,
    inFlight: false,
    retryTimer: null
  });
  // Stable indirection so the upload retry timer can re-enter drainUpload without referring to the callback before its declaration.
  const drainUploadRef = useRef<() => void>(() => {});
  const accountEpochRef = useRef(0);

  useEffect(() => {
    userRef.current = user;
    accessTokenRef.current = accessToken;
  }, [user, accessToken]);

  useEffect(() => {
    mountedRef.current = true;
    const upload = uploadRef.current;
    return () => {
      mountedRef.current = false;
      if (upload.retryTimer != null) clearTimeout(upload.retryTimer);
      upload.retryTimer = null;
      upload.inFlight = false;
      upload.pending = null;
    };
  }, []);

  const commitLines = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
    void saveCartLines(next);
    // Record which customer owns the persisted cart so it is never re-used for another account.
    void saveCartOwner(userRef.current?.id ?? null);
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = await loadCartLines();
      // Merge with any lines added before the storage read resolved rather than overwriting them.
      const pending = linesRef.current;
      const next = (() => {
        if (pending.length === 0) return stored;
        const merged = [...stored];
        for (const line of pending) {
          const key = cartLineKey(line);
          const index = merged.findIndex((candidate) => cartLineKey(candidate) === key);
          if (index === -1) merged.push(line);
          else merged[index] = { ...merged[index], qty: merged[index].qty + line.qty };
        }
        return merged;
      })();
      linesRef.current = next;
      setLines(next);
      setHydrated(true);
    })();
  }, []);

  const drainUpload = useCallback(() => {
    if (!mountedRef.current) return;
    const upload = uploadRef.current;
    if (upload.inFlight) return;
    const token = accessTokenRef.current;
    const customerId = userRef.current?.id ?? null;
    if (!token || customerId == null || syncedCustomerIdRef.current !== customerId) return;

    const snapshot = upload.pending;
    if (snapshot == null) return;

    // Serialize: one PUT in flight per customer; a change during flight waits in the one-slot queue.
    upload.pending = null;
    upload.inFlight = true;
    const epoch = accountEpochRef.current;

    const failUpload = (failed: CartLine[]) => {
      if (upload.pending == null) upload.pending = failed;
      void savePendingCart(customerId, upload.pending);
      if (upload.retryTimer == null) {
        upload.retryTimer = setTimeout(() => {
          upload.retryTimer = null;
          drainUploadRef.current();
        }, UPLOAD_RETRY_DELAY_MS);
      }
    };

    void replaceCustomerCart(token, snapshot)
      .then((storedLines) => {
        if (!mountedRef.current || epoch !== accountEpochRef.current || userRef.current?.id !== customerId) return;
        upload.inFlight = false;
        syncedLinesRef.current = storedLines;
        void saveLastSyncedCartLines(storedLines);
        void clearPendingCart();
        if (upload.pending != null) drainUploadRef.current();
      })
      .catch(() => {
        if (!mountedRef.current || epoch !== accountEpochRef.current || userRef.current?.id !== customerId) return;
        upload.inFlight = false;
        failUpload(snapshot);
      });
  }, []);

  useEffect(() => {
    drainUploadRef.current = drainUpload;
  }, [drainUpload]);

  const uploadLines = useCallback((next: CartLine[]) => {
    uploadRef.current.pending = next;
    drainUpload();
  }, [drainUpload]);

  // Re-attempt a cart pull when the app returns to the foreground: a pull that failed while
  // offline leaves sync disabled, so the local cart would otherwise never reach the server.
  useEffect(() => {
    if (!hydrated) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setPullNonce((value) => value + 1);
    });
    return () => subscription.remove();
  }, [hydrated]);

  // Logout: the account's local cart and sync snapshot belong to that account, so drop them rather than
  // presenting them as the guest cart or leaking them into the next account. A guest who was never
  // signed in is untouched, so the guest cart still survives restarts.
  useEffect(() => {
    if (!hydrated) return;
    const previousId = previousUserIdRef.current;
    const currentId = user?.id ?? null;
    if (previousId === currentId) return;
    previousUserIdRef.current = currentId;
    accountEpochRef.current += 1;
    const upload = uploadRef.current;
    if (upload.retryTimer != null) clearTimeout(upload.retryTimer);
    upload.retryTimer = null;
    upload.inFlight = false;
    upload.pending = null;
    if (previousId == null) return;

    syncedCustomerIdRef.current = null;
    syncedLinesRef.current = null;
    pendingClearCustomerIdRef.current = null;
    linesRef.current = [];
    setLines([]);
    void saveCartLines([]);
    if (currentId == null) void clearCartOwner();
    else void saveCartOwner(currentId);
    void clearLastSyncedCartLines();
    void clearPendingCart();
  }, [hydrated, user]);

  // Signed-in pull: never overwrite the server before a successful GET, merge only unsynced local additions, and isolate accounts.
  useEffect(() => {
    if (!hydrated || !user || !accessToken) return;
    if (syncedCustomerIdRef.current === user.id) return;

    let cancelled = false;
    const previousCustomerId = syncedCustomerIdRef.current;
    void (async () => {
      try {
        const serverLines = await fetchCustomerCart(accessToken);
        if (cancelled) return;

        const pending = await loadPendingCart();
        if (cancelled || !mountedRef.current || userRef.current?.id !== user.id) return;
        // Reuse the persisted local cart only when it belongs to this account, or to a guest who is now
        // signing in. A cold start or a logout followed by a different login must not merge another account's cart.
        const storedOwner = await loadCartOwner();
        if (cancelled || !mountedRef.current || userRef.current?.id !== user.id) return;
        const ownsLocalCart = storedOwner === user.id || (storedOwner == null && previousCustomerId == null);
        const localLines = ownsLocalCart ? linesRef.current : [];
        // A persisted failed-upload snapshot duplicates the local cart it came from; fold it in as a union (never a sum) so a retry does not multiply quantities.
        const localCart = pending && pending.customerId === user.id ? unionCartLines(localLines, pending.lines) : localLines;
        const lastSynced = ownsLocalCart ? syncedLinesRef.current ?? (await loadLastSyncedCartLines()) : null;
        if (cancelled || !mountedRef.current || userRef.current?.id !== user.id) return;
        const additions = cartLineAdditions(localCart, lastSynced);

        const clearedDuringPull = pendingClearCustomerIdRef.current === user.id;
        const merged = clearedDuringPull ? [...localCart] : mergeCartLines(additions, serverLines);

        syncedLinesRef.current = serverLines;
        void saveLastSyncedCartLines(serverLines);
        syncedCustomerIdRef.current = user.id;
        commitLines(merged);
        if (clearedDuringPull) pendingClearCustomerIdRef.current = null;
      } catch {
        // A failed GET must never be followed by a PUT that overwrites the stored cart. Sync stays disabled; the local cart keeps working.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, user, accessToken, commitLines, pullNonce]);

  // Push local changes while signed in, after the pull established the sync baseline.
  useEffect(() => {
    if (!hydrated || !user || !accessToken) return;
    if (syncedCustomerIdRef.current !== user.id) return;
    uploadLines(lines);
  }, [lines, hydrated, user, accessToken, uploadLines]);

  // Prune lines no longer present in the catalog, but only against a catalog that actually returned data.
  useEffect(() => {
    if (!hydrated || lines.length === 0) return;
    let cancelled = false;

    void Promise.all([fetchProducts(), fetchOffers(), fetchCollections()])
      .then(([products, offers, collections]) => {
        if (cancelled) return;
        const productVariants = new Map(products.map((product) => [product.id, new Set(product.variants.map((variant) => variant.id))]));
        const offerIds = new Set(offers.map((offer) => offer.id));
        const collectionIds = new Set(collections.map((collection) => collection.id));

        setLines((current) => {
          const next = current.filter((line) => {
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
          });
          // Nothing to prune: keep the same reference so we do not trigger a redundant re-render/upload.
          if (next.length === current.length) return current;
          linesRef.current = next;
          void saveCartLines(next);
          return next;
        });
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
    const key = cartLineKey(normalized);
    const index = prev.findIndex((candidate) => cartLineKey(candidate) === key);
    const next = index === -1 ? [...prev, normalized] : [...prev];
    if (index !== -1) next[index] = { ...next[index], qty: next[index].qty + normalized.qty };
    commitLines(next);
  }, [commitLines]);

  const setQty = useCallback((key: string, qty: number) => {
    commitLines(linesRef.current.map((line) => (cartLineKey(line) === key ? { ...line, qty: Math.max(1, qty) } : line)));
  }, [commitLines]);

  const remove = useCallback((key: string) => {
    commitLines(linesRef.current.filter((line) => cartLineKey(line) !== key));
  }, [commitLines]);

  const clear = useCallback(() => {
    const customerId = userRef.current?.id ?? null;
    pendingClearCustomerIdRef.current = customerId != null && syncedCustomerIdRef.current !== customerId ? customerId : null;
    commitLines([]);
  }, [commitLines]);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((total, line) => total + line.qty, 0),
    add,
    setQty,
    remove,
    clear,
    keyOf: cartLineKey
  }), [lines, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
