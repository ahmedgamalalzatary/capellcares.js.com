import { afterEach, describe, expect, it } from "vitest";
import {
  addToCart,
  cartCount,
  clearCart,
  readCart,
  removeLine,
  sameLine,
  setLineQty,
  type CartLine
} from "@/lib/cart";

const CART_KEY = "minikoshk_cart";

afterEach(() => {
  localStorage.clear();
});

describe("cart storage", () => {
  it("upgrades legacy {variantId, qty} entries to typed product lines and drops malformed ones", () => {
    localStorage.setItem(CART_KEY, JSON.stringify([
      { variantId: 5, qty: 2 },
      null,
      { variantId: "9", qty: 1 },
      { type: "offer", offerId: 3, qty: 1 },
      { type: "collection", collectionId: 0, qty: 1 },
      { type: "product", variantId: 7, qty: -1 }
    ]));

    expect(readCart()).toEqual([
      { type: "product", variantId: 5, qty: 2 },
      { type: "offer", offerId: 3, qty: 1 }
    ]);
  });

  it("merges quantities when the same line is added twice", () => {
    addToCart({ type: "offer", offerId: 1, qty: 1 });
    addToCart({ type: "product", variantId: 1, qty: 2 });
    addToCart({ type: "offer", offerId: 1, qty: 3 });

    expect(readCart()).toEqual([
      { type: "offer", offerId: 1, qty: 4 },
      { type: "product", variantId: 1, qty: 2 }
    ]);
    expect(cartCount(readCart())).toBe(6);
  });

  it("does not conflate different line kinds sharing the same id", () => {
    const offer: CartLine = { type: "offer", offerId: 1, qty: 1 };
    const collection: CartLine = { type: "collection", collectionId: 1, qty: 1 };
    expect(sameLine(offer, collection)).toBe(false);

    addToCart(offer);
    addToCart(collection);
    expect(readCart()).toHaveLength(2);
  });

  it("updates, removes at qty 0, and clears lines", () => {
    addToCart({ type: "product", variantId: 8, qty: 1 });
    addToCart({ type: "collection", collectionId: 2, qty: 1 });

    setLineQty({ type: "product", variantId: 8, qty: 1 }, 5);
    expect(readCart()).toContainEqual({ type: "product", variantId: 8, qty: 5 });

    setLineQty({ type: "product", variantId: 8, qty: 5 }, 0);
    expect(readCart()).toEqual([{ type: "collection", collectionId: 2, qty: 1 }]);

    removeLine({ type: "collection", collectionId: 2, qty: 1 });
    expect(readCart()).toEqual([]);

    addToCart({ type: "product", variantId: 1, qty: 1 });
    clearCart();
    expect(readCart()).toEqual([]);
  });

  it("notifies listeners on every mutation", () => {
    const events: unknown[] = [];
    const listener = (event: Event) => events.push((event as CustomEvent).detail);
    window.addEventListener("minikoshk:cart-updated", listener);
    addToCart({ type: "product", variantId: 1, qty: 1 });
    clearCart();
    window.removeEventListener("minikoshk:cart-updated", listener);

    expect(events).toEqual([[{ type: "product", variantId: 1, qty: 1 }], []]);
  });
});
