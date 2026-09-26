import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDict } from "@capella/shared";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";

describe("CheckoutSummary", () => {
  it("shows the approved temporary zero shipping charge rather than suggesting a later calculation", () => {
    render(<CheckoutSummary lang="en" dict={getDict("en")} resolved={[]} subtotal={35} />);
    expect(screen.getByText(/EGP\s*0/)).toBeInTheDocument();
    expect(screen.queryByText("Calculated at checkout")).toBeNull();
  });
  it("shows the shipping charge in the total", () => {
    render(<CheckoutSummary lang="en" dict={getDict("en")} resolved={[]} subtotal={35} shippingAmountCents={9729} />);
    expect(screen.getByText(/EGP\s*97.29/)).toBeInTheDocument();
    expect(screen.getByText(/EGP\s*132.29/)).toBeInTheDocument();
  });
  it("does not display free shipping while a required quote is missing", () => {
    render(<CheckoutSummary lang="en" dict={getDict("en")} resolved={[]} subtotal={35} shippingAmountCents={null} />);
    expect(screen.queryByText(/EGP\s*0/)).toBeNull();
    expect(screen.getByText(/select.*destination/i)).toBeInTheDocument();
  });
});
