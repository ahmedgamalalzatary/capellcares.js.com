"use client";

/**
 * Client-side cart. The API has no cart resource — checkout receives the lines
 * directly — so the cart lives in localStorage and is resolved against the
 * catalog when rendered. Lines mirror the checkout item DTO exactly.
 */

export type CartLine =
  | { type: "product"; variantId: number; qty: number }
  | { type: "offer"; offerId: number; qty: number }
  | { type: "collection"; collectionId: number; qty: number };

export const CART_KEY = "minikoshk_cart";
export const CART_UPDATED_EVENT = "minikoshk:cart-updated";

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parseLine(raw: unknown): CartLine | null {
  if (raw == null || typeof raw !== "object") return null;
  const line = raw as Record<string, unknown>;
  if (!isPositiveInt(line.qty)) return null;
  // Legacy format ({ variantId, qty } with no type) is upgraded to a product line.
  if ((line.type === "product" || line.type === undefined) && isPositiveInt(line.variantId)) {
    return { type: "product", variantId: line.variantId, qty: line.qty };
  }
  if (line.type === "offer" && isPositiveInt(line.offerId)) {
    return { type: "offer", offerId: line.offerId, qty: line.qty };
  }
  if (line.type === "collection" && isPositiveInt(line.collectionId)) {
    return { type: "collection", collectionId: line.collectionId, qty: line.qty };
  }
  return null;
}

/** Two lines match when they reference the same catalog entity. */
export function sameLine(a: CartLine, b: CartLine): boolean {
  if (a.type === "product" && b.type === "product") return a.variantId === b.variantId;
  if (a.type === "offer" && b.type === "offer") return a.offerId === b.offerId;
  if (a.type === "collection" && b.type === "collection") return a.collectionId === b.collectionId;
  return false;
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.map(parseLine).filter((line): line is CartLine => line !== null);
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]): CartLine[] {
  localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: lines }));
  return lines;
}

export function addToCart(line: CartLine): CartLine[] {
  const cart = readCart();
  const existing = cart.find((candidate) => sameLine(candidate, line));
  if (existing) {
    existing.qty += line.qty;
  } else {
    cart.push(line);
  }
  return writeCart(cart);
}

export function setLineQty(line: CartLine, qty: number): CartLine[] {
  const cart = readCart();
  if (qty <= 0) {
    return writeCart(cart.filter((candidate) => !sameLine(candidate, line)));
  }
  const existing = cart.find((candidate) => sameLine(candidate, line));
  if (existing) {
    existing.qty = qty;
  }
  return writeCart(cart);
}

export function removeLine(line: CartLine): CartLine[] {
  return writeCart(readCart().filter((candidate) => !sameLine(candidate, line)));
}

export function clearCart(): CartLine[] {
  return writeCart([]);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.qty, 0);
}
