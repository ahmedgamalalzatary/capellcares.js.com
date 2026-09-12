import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";
import { CheckoutForm } from "@/components/checkout/checkout-form";

const form = {
  fullName: "", phone: "", email: "", governorate: "", cityArea: "", addressLine: "",
  buildingApartment: "", notes: "", paymentMethod: "cod" as const
};

describe("CheckoutForm payment choices", () => {
  it("keeps online payment hidden until the API confirms a method", () => {
    render(<CheckoutForm lang="en" dict={getDict("en")} form={form} errors={{}} placing={false}
      paymobMethods={[]} setField={vi.fn()} placeOrder={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /cash on delivery/i })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /pay online/i })).toBeNull();
  });

  it("offers Paymob when a server-confirmed method is available", () => {
    const setField = vi.fn();
    render(<CheckoutForm lang="en" dict={getDict("en")} form={form} errors={{}} placing={false}
      paymobMethods={["card", "wallet"]} setField={setField} placeOrder={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /pay online/i }));
    expect(setField).toHaveBeenCalledWith("paymentMethod", "paymob");
  });
});
