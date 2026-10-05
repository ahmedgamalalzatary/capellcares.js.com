import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartLine } from "@capella/shared";
import { CART_OWNER_STORAGE_KEY, CART_PENDING_STORAGE_KEY, CART_STORAGE_KEY, CART_SYNCED_STORAGE_KEY } from "@/constants/storage";

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
      return { type: "product", productId: productLine.productId!, variantId: productLine.variantId!, qty: productLine.qty! };
    }
    return null;
  }

  if ((line as CartLine).type === "offer") {
    const offerLine = line as Partial<CartLine & { type: "offer" }>;
    if (Number.isInteger(offerLine.offerId) && Number.isInteger(offerLine.qty) && offerLine.qty! > 0) {
      return { type: "offer", offerId: offerLine.offerId!, qty: offerLine.qty! };
    }
    return null;
  }

  if ((line as CartLine).type === "collection") {
    const collectionLine = line as Partial<CartLine & { type: "collection" }>;
    if (Number.isInteger(collectionLine.collectionId) && Number.isInteger(collectionLine.qty) && collectionLine.qty! > 0) {
      return { type: "collection", collectionId: collectionLine.collectionId!, qty: collectionLine.qty! };
    }
    return null;
  }

  return null;
}

export function normalizeCartLines(raw: unknown): CartLine[] {
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

/** Server cart is the canonical base (its order wins); local-only lines are appended and quantities summed when a line exists on both sides. */
export function mergeCartLines(local: CartLine[], server: CartLine[]): CartLine[] {
  const merged = [...server];
  for (const line of local) {
    const key = cartLineKey(line);
    const index = merged.findIndex((candidate) => cartLineKey(candidate) === key);
    if (index === -1) merged.push({ ...line });
    else merged[index] = { ...merged[index], qty: merged[index].qty + line.qty };
  }
  return merged;
}

/** Extract the local changes the server has not seen: lines missing from the last synced snapshot, plus quantities added on top. Decreases are dropped so the server snapshot wins and quantities are never doubled on reload. */
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

/** Combine two representations of the same cart without summing shared keys; `primary` wins. Used to fold a persisted failed-upload snapshot back into the local cart it duplicated. */
export function unionCartLines(primary: CartLine[], secondary: CartLine[]): CartLine[] {
  const seen = new Set(primary.map(cartLineKey));
  const merged = primary.map((line) => ({ ...line }));
  for (const line of secondary) {
    const key = cartLineKey(line);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({ ...line });
    }
  }
  return merged;
}

export async function loadCartLines(): Promise<CartLine[]> {
  try {
    const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
    return raw ? normalizeCartLines(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export async function saveCartLines(lines: CartLine[]): Promise<void> {
  try {
    if (lines.length === 0) await AsyncStorage.removeItem(CART_STORAGE_KEY);
    else await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // The in-memory cart remains authoritative for this run.
  }
}

export async function loadLastSyncedCartLines(): Promise<CartLine[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CART_SYNCED_STORAGE_KEY);
    if (raw == null) return null;
    return normalizeCartLines(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveLastSyncedCartLines(lines: CartLine[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CART_SYNCED_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Best effort.
  }
}

export async function clearLastSyncedCartLines(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CART_SYNCED_STORAGE_KEY);
  } catch {
    // Best effort.
  }
}

/** Customer that owns the persisted local cart: a number for an account, null for a guest cart, null when unset. */
export async function loadCartOwner(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(CART_OWNER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { customerId?: unknown };
    return typeof parsed?.customerId === "number" ? parsed.customerId : null;
  } catch {
    return null;
  }
}

export async function saveCartOwner(customerId: number | null): Promise<void> {
  try {
    await AsyncStorage.setItem(CART_OWNER_STORAGE_KEY, JSON.stringify({ customerId }));
  } catch {
    // Best effort.
  }
}

export async function clearCartOwner(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CART_OWNER_STORAGE_KEY);
  } catch {
    // Best effort.
  }
}

type PendingCart = { customerId: number; lines: CartLine[] };

export async function loadPendingCart(): Promise<PendingCart | null> {
  try {
    const raw = await AsyncStorage.getItem(CART_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { customerId?: unknown; lines?: unknown };
    if (typeof parsed?.customerId !== "number") return null;
    return { customerId: parsed.customerId, lines: normalizeCartLines(parsed.lines) };
  } catch {
    return null;
  }
}

export async function savePendingCart(customerId: number, lines: CartLine[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CART_PENDING_STORAGE_KEY, JSON.stringify({ customerId, lines }));
  } catch {
    // Best effort.
  }
}

export async function clearPendingCart(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CART_PENDING_STORAGE_KEY);
  } catch {
    // Best effort.
  }
}
