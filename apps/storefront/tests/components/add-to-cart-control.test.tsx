import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The provider revalidates its lines against the catalog; the network is the
// only boundary worth stubbing — the cart itself runs for real.
vi.mock("@/lib/api/client", () => ({
  fetchProducts: async () => [],
  fetchOffers: async () => [],
  fetchCollections: async () => []
}));

import { CartProvider, useCart } from "@/components/providers/cart-provider";
import { AddToCartControl } from "@/components/ui/add-to-cart-control";

const dict = { common: { addToCart: "Add to cart", added: "Added", quantity: "Quantity" } };
const line = { type: "product" as const, productId: 1, variantId: 11, qty: 1 };

/** Surfaces the real cart contents so assertions test the cart, not the button. */
function CartProbe() {
  const { lines } = useCart();
  return createElement("div", { "data-testid": "cart" }, JSON.stringify(lines));
}

function renderControl(props: Record<string, unknown> = {}) {
  return render(createElement(
    CartProvider,
    null,
    createElement(AddToCartControl, { line, dict, ...props } as any),
    createElement(CartProbe)
  ));
}

const cartLines = () => JSON.parse(screen.getByTestId("cart").textContent || "[]");

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("AddToCartControl", () => {
  it("offers a plain add button while the line is not in the cart", () => {
    renderControl();

    expect(screen.getByRole("button", { name: "Add to cart" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+" })).toBeNull();
    expect(cartLines()).toHaveLength(0);
  });

  it("adds the line, confirms it, then settles into the quantity stepper", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderControl();

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(cartLines()).toEqual([{ type: "product", productId: 1, variantId: 11, qty: 1 }]);
    expect(screen.getByText("Added")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1400);
    });

    expect(screen.queryByText("Added")).toBeNull();
    expect(screen.getByText("Quantity: 1")).toBeInTheDocument();
  });

  it("clears its pending confirmation timer when the card unmounts", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    // Pin the confirmation timer specifically — React schedules timers of its own.
    const flashIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 1400);
    expect(flashIndex).toBeGreaterThan(-1);
    const flashTimer = setTimeoutSpy.mock.results[flashIndex]!.value;

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(flashTimer);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it("opens as a stepper when the line is already in the cart", () => {
    localStorage.setItem("capella.cart.v1", JSON.stringify([{ ...line, qty: 3 }]));

    renderControl();

    expect(screen.getByText("Quantity: 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
  });

  it("raises and lowers the cart quantity from the stepper", () => {
    localStorage.setItem("capella.cart.v1", JSON.stringify([{ ...line, qty: 1 }]));
    renderControl();

    fireEvent.click(screen.getByRole("button", { name: "+" }));

    expect(cartLines()[0].qty).toBe(2);
    expect(screen.getByText("Quantity: 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "−" }));

    expect(cartLines()[0].qty).toBe(1);
    expect(screen.getByText("Quantity: 1")).toBeInTheDocument();
  });

  it("removes the line and returns to the add button when − is pressed at one", () => {
    localStorage.setItem("capella.cart.v1", JSON.stringify([{ ...line, qty: 1 }]));
    renderControl();

    fireEvent.click(screen.getByRole("button", { name: "−" }));

    expect(cartLines()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeInTheDocument();
  });

  it("stops + at the available stock", () => {
    localStorage.setItem("capella.cart.v1", JSON.stringify([{ ...line, qty: 2 }]));
    renderControl({ maxQty: 2 });

    const plus = screen.getByRole("button", { name: "+" });
    expect(plus).toBeDisabled();

    fireEvent.click(plus);
    expect(cartLines()[0].qty).toBe(2);
  });
});
