import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatPrice, getDict } from "@capella/shared";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";

const resolved = [{ key: "p1", title: "Toy", meta: "One", unit: 1.125, qty: 2 }];
const dict = getDict("en");
// toHaveTextContent folds the non-breaking space formatPrice puts after "KWD".
const price = (amount: number) => formatPrice(amount, "en").replace(/\s/g, " ");

describe("CheckoutSummary", () => {
  it("asks for an area before showing the delivery fee", () => {
    render(<CheckoutSummary lang="en" dict={dict} resolved={resolved} subtotal={2.25} quote={null} quoteState="idle" />);
    expect(screen.getByText(dict.checkout.chooseArea)).toBeInTheDocument();
    expect(screen.getByTestId("checkout-total")).toHaveTextContent(price(2.25));
  });

  it("adds the area's delivery fee to the total", () => {
    render(<CheckoutSummary lang="en" dict={dict} resolved={resolved} subtotal={2.25}
      quote={{ subtotal: 2.25, deliveryFee: 1.5, total: 3.75 }} quoteState="ready" />);
    expect(screen.getByTestId("checkout-delivery")).toHaveTextContent(price(1.5));
    expect(screen.getByTestId("checkout-total")).toHaveTextContent(price(3.75));
  });

  it("says free when the area costs nothing", () => {
    render(<CheckoutSummary lang="en" dict={dict} resolved={resolved} subtotal={2.25}
      quote={{ subtotal: 2.25, deliveryFee: 0, total: 2.25 }} quoteState="ready" />);
    expect(screen.getByTestId("checkout-delivery")).toHaveTextContent(dict.common.freeDelivery);
  });

  it("tells the customer when the fee could not be worked out", () => {
    render(<CheckoutSummary lang="en" dict={dict} resolved={resolved} subtotal={2.25} quote={null} quoteState="error" />);
    expect(screen.getByText(dict.checkout.deliveryQuoteFailed)).toBeInTheDocument();
  });
});
