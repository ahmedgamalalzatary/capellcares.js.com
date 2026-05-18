import { describe, expect, it } from "vitest";

import {
  clearCartLines,
  loadCartLines,
  saveCartLines
} from "@/lib/cart";

describe("cart localStorage helpers", () => {
  it("persists cart state across reload-like reads", () => {
    clearCartLines(window.localStorage);
    saveCartLines(window.localStorage, [{ type: "product", productId: 1, variantId: 11, qty: 2 }]);

    expect(loadCartLines(window.localStorage)).toEqual([
      { type: "product", productId: 1, variantId: 11, qty: 2 }
    ]);
  });
});
