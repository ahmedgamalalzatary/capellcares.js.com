import type { CartLine } from "@capella/shared";

const STORAGE_KEY = "capella.cart.v1";

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

  return null;
}

export function normalizeCartLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCartLine).filter((line): line is CartLine => line !== null);
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
