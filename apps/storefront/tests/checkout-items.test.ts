import { describe, expect, it } from "vitest";
import { toCheckoutItems } from "@/lib/checkout";
import type { CartLine } from "@/lib/cart";

describe("toCheckoutItems", () => {
  it("maps every cart line kind onto the checkout DTO shape", () => {
    const lines: CartLine[] = [
      { type: "product", variantId: 11, qty: 2 },
      { type: "offer", offerId: 22, qty: 1 },
      { type: "collection", collectionId: 33, qty: 3 }
    ];

    expect(toCheckoutItems(lines)).toEqual([
      { type: "product", variantId: 11, qty: 2 },
      { type: "offer", offerId: 22, qty: 1 },
      { type: "collection", collectionId: 33, qty: 3 }
    ]);
  });
});
