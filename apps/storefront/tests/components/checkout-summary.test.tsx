import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatPrice, getDict } from "@capella/shared";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";

describe("CheckoutSummary", () => {
  it("shows free delivery and a total equal to the items", () => {
    const resolved = [{ key: "p1", title: "Toy", meta: "One", unit: 100, qty: 2 }];
    render(<CheckoutSummary lang="en" dict={getDict("en")} resolved={resolved} subtotal={200} />);
    expect(screen.getByText("Free delivery")).toBeInTheDocument();
    expect(document.body.textContent).toContain(formatPrice(200, "en"));
  });
});
