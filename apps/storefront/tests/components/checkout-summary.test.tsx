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
  it("shows each line at what is paid, and the code's saving separately from the sale prices it replaced", () => {
    const dto = { status: "applied" as const, code: "SAVE10", arName: "خصم", enName: "Save", discount: 12, saleGivenUp: 20, freeShipping: false, replacedSales: [] };
    const promo = { savedCode: "save10", saveCode: () => {}, signedIn: true, loginHref: "/en/login", preview: async () => null, notice: null,
      onlineMinimum: false, productsTotal: 108, confirmation: null, confirm: () => {}, decline: () => {}, result: dto, applied: dto };
    render(<CheckoutSummary lang="en" dict={getDict("en")} subtotal={100} shippingAmountCents={0} promo={promo}
      resolved={[{ key: "p1", index: 0, title: "Serum", meta: "30ml", unit: 100, qty: 1, lineTotal: 108 }]} />);
    expect(screen.getByText("Serum").closest("li")!).toHaveTextContent(/EGP\s*108/);
    expect(screen.getByText("Promo code (SAVE10)").parentElement).toHaveTextContent(/-\s*EGP\s*12/);
    expect(screen.getByText("Sale prices replaced by the code").parentElement).toHaveTextContent(/\+\s*EGP\s*20/);
    // Subtotal + replaced sales - code saving = the total charged: 100 + 20 - 12 = 108.
    expect(screen.getByText("Subtotal").parentElement).toHaveTextContent(/EGP\s*100/);
  });
  it("shows delivery as free with the fee the code waived", () => {
    render(<CheckoutSummary lang="en" dict={getDict("en")} resolved={[]} subtotal={35} shippingAmountCents={0} carrierShippingAmountCents={9729} />);
    const row = screen.getByText("Shipping").parentElement!;
    expect(row).toHaveTextContent("Free");
    expect(row.querySelector("del")).toHaveTextContent(/EGP\s*97.29/);
  });
});
