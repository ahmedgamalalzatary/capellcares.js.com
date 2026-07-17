"use client";

import { apiSendAuthed, readAuth } from "./auth";

/**
 * Wishlist of product ids. localStorage is the immediate source of truth so
 * hearts respond instantly and guests can wishlist too; when a customer is
 * logged in every change is mirrored to the API (`/api/v1/wishlist`), and
 * `syncWishlist` merges the server list on page load.
 */

const WISHLIST_KEY = "minikoshk_wishlist";
export const WISHLIST_UPDATED_EVENT = "minikoshk:wishlist-updated";

/**
 * Ids removed locally this page load. `syncWishlist` must not resurrect these
 * when it merges the server list — even after the server delete succeeds, an
 * in-flight GET may carry an older snapshot that still contains the id, so
 * tombstones persist until the product is wishlisted again.
 */
const pendingRemovals = new Set<number>();

/** Sync bookkeeping: one in-flight request at a time, one sync per user per page load. */
let inFlightSync: Promise<number[]> | null = null;
let syncedUserId: number | null = null;

export function readWishlist(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(WISHLIST_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0))];
  } catch {
    return [];
  }
}

function writeWishlist(ids: number[]): number[] {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(WISHLIST_UPDATED_EVENT, { detail: ids }));
  return ids;
}

export function isWishlisted(productId: number): boolean {
  return readWishlist().includes(productId);
}

/** Mirror a change to the API for logged-in customers; local state already updated, so failures are non-fatal. */
async function mirrorToServer(productId: number, wishlisted: boolean): Promise<void> {
  if (!readAuth()) return;
  try {
    if (wishlisted) {
      await apiSendAuthed("/wishlist", { body: { productId } });
    } else {
      await apiSendAuthed(`/wishlist/${productId}`, { method: "DELETE" });
    }
  } catch {
    // Keep the optimistic local state; the next sync will reconcile.
  }
}

/** Toggle a product and return the new wishlist. Fires the server mirror without blocking the UI. */
export function toggleWishlist(productId: number): number[] {
  const current = readWishlist();
  const wishlisted = !current.includes(productId);
  if (wishlisted) {
    pendingRemovals.delete(productId);
  } else {
    pendingRemovals.add(productId);
  }
  const next = wishlisted ? [...current, productId] : current.filter((id) => id !== productId);
  writeWishlist(next);
  void mirrorToServer(productId, wishlisted);
  return next;
}

/**
 * For logged-in customers: merge the server wishlist into the local one and
 * push local-only ids up, so both sides converge. No-op for guests. Runs at
 * most once per user per page load, and concurrent callers share one request.
 */
export async function syncWishlist(): Promise<number[]> {
  const auth = readAuth();
  if (!auth) return readWishlist();
  if (syncedUserId === auth.user.id) return readWishlist();
  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    try {
      const payload = await apiSendAuthed<{ items?: Array<{ productId: number }> }>("/wishlist", { method: "GET" });
      // Drop server ids the user removed locally while this request was in
      // flight, and re-read local state at merge time for the same reason.
      const serverIds = (payload.items ?? [])
        .map((item) => item.productId)
        .filter((id) => !pendingRemovals.has(id));
      const local = readWishlist();
      const merged = [...new Set([...serverIds, ...local])];
      for (const id of local.filter((candidate) => !serverIds.includes(candidate))) {
        void mirrorToServer(id, true);
      }
      syncedUserId = auth.user.id;
      return writeWishlist(merged);
    } catch {
      return readWishlist();
    } finally {
      inFlightSync = null;
    }
  })();
  return inFlightSync;
}
