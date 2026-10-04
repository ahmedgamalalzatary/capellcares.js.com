import type { CartLine } from "@capella/shared";

/** Mirrors CartProvider's internal line key, so card tests that fake `useCart` still assert the keys production would actually produce; the real key function is exercised end to end in add-to-cart-control.test.tsx against the genuine CartProvider. */
export function cartKeyOf(line: CartLine): string {
  return line.type === "product"
    ? `p:${line.productId}:${line.variantId}`
    : line.type === "offer"
      ? `o:${line.offerId}`
      : `c:${line.collectionId}`;
}
