import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  fetchProducts: vi.fn().mockResolvedValue([]),
  fetchOffers: vi.fn().mockResolvedValue([]),
  fetchCollections: vi.fn().mockResolvedValue([])
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: null, accessToken: null })
}));

import {
  loadCartLines,
  clearCartLines,
  saveCartLines,
  mergeCartLines,
  cartLineAdditions,
  clearLastSyncedCartLines,
  loadLastSyncedCartLines,
  saveLastSyncedCartLines
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

describe("mergeCartLines", () => {
  it("keeps server lines in server order and appends local-only lines", () => {
    const server = [
      { type: "offer" as const, offerId: 2, qty: 1 },
      { type: "product" as const, productId: 1, variantId: 11, qty: 1 }
    ];
    const local = [
      { type: "collection" as const, collectionId: 3, qty: 1 },
      { type: "product" as const, productId: 1, variantId: 12, qty: 1 }
    ];

    expect(mergeCartLines(local, server)).toEqual([
      { type: "offer", offerId: 2, qty: 1 },
      { type: "product", productId: 1, variantId: 11, qty: 1 },
      { type: "collection", collectionId: 3, qty: 1 },
      { type: "product", productId: 1, variantId: 12, qty: 1 }
    ]);
  });

  it("sums quantities when the same line exists locally and on the server", () => {
    const server = [{ type: "offer" as const, offerId: 2, qty: 3 }];
    const local = [{ type: "offer" as const, offerId: 2, qty: 2 }];

    expect(mergeCartLines(local, server)).toEqual([{ type: "offer", offerId: 2, qty: 5 }]);
  });
});

describe("cartLineAdditions", () => {
  it("treats every local line as an addition when no snapshot was ever synced", () => {
    expect(cartLineAdditions([{ type: "offer", offerId: 2, qty: 1 }], null)).toEqual([
      { type: "offer", offerId: 2, qty: 1 }
    ]);
  });

  it("returns only the quantity added since the synced snapshot", () => {
    const synced = [{ type: "offer" as const, offerId: 2, qty: 2 }];
    const local = [{ type: "offer" as const, offerId: 2, qty: 3 }];

    expect(cartLineAdditions(local, synced)).toEqual([{ type: "offer", offerId: 2, qty: 1 }]);
  });

  it("reports nothing when local lines match the synced snapshot exactly", () => {
    const synced = [
      { type: "offer" as const, offerId: 2, qty: 3 },
      { type: "collection" as const, collectionId: 5, qty: 1 }
    ];
    const local = [
      { type: "offer" as const, offerId: 2, qty: 3 },
      { type: "collection" as const, collectionId: 5, qty: 1 }
    ];

    expect(cartLineAdditions(local, synced)).toEqual([]);
  });

  it("drops local decreases so the server snapshot wins on conflicts", () => {
    const synced = [{ type: "offer" as const, offerId: 2, qty: 3 }];
    const local = [{ type: "offer" as const, offerId: 2, qty: 1 }];

    expect(cartLineAdditions(local, synced)).toEqual([]);
  });

  it("keeps local-only lines that the synced snapshot does not know", () => {
    const synced = [{ type: "offer" as const, offerId: 2, qty: 1 }];
    const local = [
      { type: "offer" as const, offerId: 2, qty: 1 },
      { type: "product" as const, productId: 1, variantId: 11, qty: 2 }
    ];

    expect(cartLineAdditions(local, synced)).toEqual([
      { type: "product", productId: 1, variantId: 11, qty: 2 }
    ]);
  });
});

describe("last synced cart snapshot storage", () => {
  it("round-trips a synced snapshot", () => {
    clearLastSyncedCartLines(window.localStorage);
    saveLastSyncedCartLines(window.localStorage, [{ type: "offer", offerId: 2, qty: 1 }]);

    expect(loadLastSyncedCartLines(window.localStorage)).toEqual([{ type: "offer", offerId: 2, qty: 1 }]);
  });

  it("returns null when no snapshot was ever stored", () => {
    clearLastSyncedCartLines(window.localStorage);

    expect(loadLastSyncedCartLines(window.localStorage)).toBeNull();
  });

  it("keeps an empty snapshot distinct from a missing one", () => {
    clearLastSyncedCartLines(window.localStorage);
    saveLastSyncedCartLines(window.localStorage, []);

    expect(loadLastSyncedCartLines(window.localStorage)).toEqual([]);
  });
});
