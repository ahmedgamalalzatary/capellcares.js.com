import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

const checkout = vi.hoisted(() => ({ placedPromo: null as unknown }));
vi.mock("@/components/providers/cart-provider", () => ({ useCart: () => ({ lines: [] }) }));
vi.mock("@/hooks/use-checkout", () => ({
  useCheckout: () => ({ orderId: "ABCD-001", placedPromo: checkout.placedPromo, resolved: [], form: {}, errors: {}, placing: false,
    subtotal: 0, governorates: [], quote: null, quoteState: "idle", promo: {}, setField: vi.fn(), placeOrder: vi.fn() })
}));
import { CheckoutView } from "@/components/checkout/checkout-view";

describe("CheckoutView confirmation", () => {
  it("shows the code used and what it saved next to the order code", () => {
    checkout.placedPromo = { status: "applied", code: "SAVE10", arName: "خصم", enName: "Save", discount: 1.25, saleGivenUp: 0, freeShipping: false, replacedSales: [] };
    render(<CheckoutView lang="en" dict={getDict("en")} />);
    expect(screen.getByText("ABCD-001")).toBeInTheDocument();
    expect(screen.getByText(/^Code SAVE10 saved you .*1\.25/)).toBeInTheDocument();
  });

  it("says nothing about codes for an order placed without one", () => {
    checkout.placedPromo = null;
    render(<CheckoutView lang="en" dict={getDict("en")} />);
    expect(screen.queryByText(/saved you/)).toBeNull();
  });
});
