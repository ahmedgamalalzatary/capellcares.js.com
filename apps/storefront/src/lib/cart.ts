import type { CartLine } from "@capella/shared";
import { CART_STORAGE_KEY as STORAGE_KEY, CART_SYNCED_STORAGE_KEY as SYNCED_STORAGE_KEY } from "@/constants/storage";

export function normalizeCartLine(line: unknown): CartLine | null {
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
    if (Number.isInteger(offerLine.offerId) && Number.isInteger(offerLine.qty) && offerLine.qty! > 0) {
      return {
        type: "offer",
        offerId: offerLine.offerId!,
        qty: offerLine.qty!
      };
    }
  }

  if ((line as CartLine).type === "collection") {
    const collectionLine = line as Partial<CartLine & { type: "collection" }>;
    if (Number.isInteger(collectionLine.collectionId) && Number.isInteger(collectionLine.qty) && collectionLine.qty! > 0) {
      return {
        type: "collection",
        collectionId: collectionLine.collectionId!,
        qty: collectionLine.qty!
      };
    }
  }

  return null;
}

function normalizeCartLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCartLine).filter((line): line is CartLine => line !== null);
}

export function cartLineKey(line: CartLine): string {
  return line.type === "product"
    ? `p:${line.productId}:${line.variantId}`
    : line.type === "offer"
      ? `o:${line.offerId}`
      : `c:${line.collectionId}`;
}

/**
 * Merge the server cart with the local one for a signed-in customer. The
 * server cart is the canonical base (its order wins); local-only lines are
 * appended, and quantities are summed when the same line exists on both sides
 * so nothing added on either device is lost.
 */
export function mergeCartLines(local: CartLine[], server: CartLine[]): CartLine[] {
  const merged = [...server];
  for (const line of local) {
    const key = cartLineKey(line);
    const idx = merged.findIndex((l) => cartLineKey(l) === key);
    if (idx === -1) merged.push({ ...line });
    else merged[idx] = { ...merged[idx], qty: merged[idx].qty + line.qty };
  }
  return merged;
}

/**
 * Extract the local changes that the server has not seen yet: lines missing
 * from the last synced snapshot in full, plus quantities added on top of it.
 * Decreases are dropped so the server snapshot wins on conflicts — merging a
 * previously synced cart against its own snapshot must not re-add those
 * quantities (which would double the cart on every reload).
 */
export function cartLineAdditions(local: CartLine[], lastSynced: CartLine[] | null): CartLine[] {
  if (lastSynced == null) return local.map((line) => ({ ...line }));

  const syncedByKey = new Map(lastSynced.map((line) => [cartLineKey(line), line] as const));
  const additions: CartLine[] = [];
  for (const line of local) {
    const syncedLine = syncedByKey.get(cartLineKey(line));
    if (!syncedLine) {
      additions.push({ ...line });
    } else if (line.qty > syncedLine.qty) {
      additions.push({ ...line, qty: line.qty - syncedLine.qty });
    }
  }
  return additions;
}

export function loadCartLines(storage: Pick<Storage, "getItem">): CartLine[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? normalizeCartLines(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveCartLines(storage: Pick<Storage, "setItem">, lines: CartLine[]) {
  storage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

export function clearCartLines(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(STORAGE_KEY);
}

/**
 * The last cart snapshot known to be stored on the server (after a successful
 * GET or PUT). Persisted so a page reload can still tell synced quantities
 * apart from unsynced local additions.
 */
export function loadLastSyncedCartLines(storage: Pick<Storage, "getItem">): CartLine[] | null {
  try {
    const raw = storage.getItem(SYNCED_STORAGE_KEY);
    if (raw == null) return null;
    return normalizeCartLines(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLastSyncedCartLines(storage: Pick<Storage, "setItem">, lines: CartLine[]) {
  storage.setItem(SYNCED_STORAGE_KEY, JSON.stringify(lines));
}

export function clearLastSyncedCartLines(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(SYNCED_STORAGE_KEY);
}
