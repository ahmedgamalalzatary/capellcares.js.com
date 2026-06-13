import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  fetchProducts: vi.fn().mockResolvedValue([]),
  fetchOffers: vi.fn().mockResolvedValue([]),
  fetchCollections: vi.fn().mockResolvedValue([])
}));

import {
  loadCartLines,
  clearCartLines,
  saveCartLines
} from "@/lib/cart";
import { CartProvider, useCart } from "@/components/providers/cart-provider";

function CartAddProbe() {
  const cart = useCart();
  const [snapshot, setSnapshot] = useState("[]");

  return createElement(
    "div",
    null,
    createElement(
      "button",
      {
        onClick: () => {
          cart.add({ type: "product", productId: 1, variantId: 11, qty: 1 });
          setSnapshot(JSON.stringify(loadCartLines(window.localStorage)));
        }
      },
      "add"
    ),
    createElement("output", null, snapshot)
  );
}

describe("cart localStorage helpers", () => {
  it("persists cart state across reload-like reads", () => {
    clearCartLines(window.localStorage);
    saveCartLines(window.localStorage, [{ type: "product", productId: 1, variantId: 11, qty: 2 }]);

    expect(loadCartLines(window.localStorage)).toEqual([
      { type: "product", productId: 1, variantId: 11, qty: 2 }
    ]);
  });

  it("persists added lines before post-click navigation code can run", () => {
    clearCartLines(window.localStorage);

    render(createElement(CartProvider, null, createElement(CartAddProbe)));

    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(screen.getByText('[{"type":"product","productId":1,"variantId":11,"qty":1}]')).toBeInTheDocument();
  });
});
