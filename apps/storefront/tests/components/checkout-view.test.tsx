import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CheckoutView } from "@/components/checkout/checkout-view";
import { offers, products } from "@capella/shared/mock";

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({
    lines: [{ type: "product", productId: products[0]!.id, variantId: products[0]!.variants[0]!.id, qty: 1 }],
    clear: vi.fn()
  })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: null,
    accessToken: null
  })
}));

vi.mock("@/lib/api/client", async () => {
  const sharedMock = await import("@capella/shared/mock");
  return {
    fetchProducts: vi.fn().mockResolvedValue(sharedMock.products),
    fetchOffers: vi.fn().mockResolvedValue(sharedMock.offers)
  };
});

const fetchSpy = vi.fn();
vi.stubGlobal("fetch", fetchSpy);

const dict = {
  checkout: {
    required: "Required",
    egPhoneInvalid: "Invalid Egyptian phone number",
    contact: "Contact",
    shipping: "Shipping",
    payment: "Payment",
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    governorate: "Governorate",
    city: "City",
    addressLine: "Address line",
    building: "Building",
    notes: "Notes",
    cod: "Cash on delivery",
    codDesc: "Pay on arrival",
    placeOrder: "Place order",
    review: "Review"
  },
  common: {
    quantity: "Quantity",
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
    calculatedAtCheckout: "Calculated at checkout",
    orderPlaced: "Order placed",
    orderPlacedDesc: "Done",
    loading: "Loading"
  },
  cart: {
    empty: "Empty",
    keepShopping: "Keep shopping"
  },
  offers: {
    badge: "Offer"
  }
};

describe("CheckoutView", () => {
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it("blocks submission for invalid phone numbers and missing required fields", async () => {
    render(createElement(CheckoutView, { lang: "en", dict }));

    await waitFor(() => {
      expect(screen.getByText("Review")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("01XXXXXXXXX"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText("Invalid Egyptian phone number")).toBeInTheDocument();
    expect(screen.getAllByText("Required").length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
