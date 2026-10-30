import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";
import { CheckoutForm } from "@/components/checkout/checkout-form";

const form = {
  fullName: "", phone: "", email: "", governorate: "", cityArea: "", addressLine: "",
  buildingApartment: "", notes: ""
};

function renderForm(placeOrder = vi.fn()) {
  render(
    <CheckoutForm lang="en" dict={getDict("en")} form={form} errors={{}} placing={false} setField={vi.fn()} placeOrder={placeOrder} />
  );
  return placeOrder;
}

describe("CheckoutForm", () => {
  it("offers cash on delivery as the only way to pay", () => {
    renderForm();
    expect(screen.getByText(getDict("en").checkout.cod)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText(getDict("en").checkout.payOnline)).not.toBeInTheDocument();
  });

  it("places the order on submit", () => {
    const placeOrder = renderForm();
    fireEvent.click(screen.getByRole("button", { name: getDict("en").checkout.placeOrder }));
    expect(placeOrder).toHaveBeenCalledTimes(1);
  });
});
