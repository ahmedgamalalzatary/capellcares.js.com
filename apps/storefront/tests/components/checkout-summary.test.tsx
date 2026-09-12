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
});
