import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";
import { CheckoutForm } from "@/components/checkout/checkout-form";

const form = {
  fullName: "", phone: "", email: "", governorate: "", cityArea: "", addressLine: "",
  buildingApartment: "", notes: "", paymentMethod: "cod" as const
};

describe("CheckoutForm payment choices", () => {
  it("shows supported district choices within the selected city and area", () => {
    const setField = vi.fn();
    const destination = { cityId: "c1", zoneId: "z1", districtId: "d1",
      cityName: { en: "Cairo", ar: "القاهرة" }, zoneName: { en: "Nasr City", ar: "مدينة نصر" },
      districtName: { en: "District 1", ar: "الحي الأول" } };
    render(<CheckoutForm lang="ar" dict={getDict("ar")} form={{ ...form, shippingCityId: "c1", shippingZoneId: "z1" }}
      errors={{}} placing={false} paymobMethods={[]} setField={setField} placeOrder={vi.fn()}
      shipping={{ enabled: true, addresses: [destination, { ...destination, cityId: "c2", zoneId: "z2", districtId: "d2",
        districtName: { en: "Other District", ar: "حي آخر" } }], quote: null, loading: false, error: null, retry: vi.fn() }} />);
    const district = screen.getByRole("combobox", { name: "الحي" });
    expect(district).toHaveTextContent("الحي الأول");
    expect(district).not.toHaveTextContent("حي آخر");
    fireEvent.change(district, { target: { value: "d1" } });
    expect(setField).toHaveBeenCalledWith("shippingDistrictId", "d1");
    expect(screen.getByRole("button", { name: getDict("ar").checkout.placeOrder })).toBeDisabled();
  });
  it("offers recovery while shipping availability is unknown", () => {
    const retry = vi.fn();
    render(<CheckoutForm lang="en" dict={getDict("en")} form={form} errors={{}} placing={false}
      paymobMethods={[]} setField={vi.fn()} placeOrder={vi.fn()}
      shipping={{ enabled: null, addresses: [], quote: null, loading: false,
        error: getDict("en").checkout.shippingUnavailable, retry }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(getDict("en").checkout.shippingUnavailable);
    fireEvent.click(screen.getByRole("button", { name: getDict("en").checkout.retryShipping }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: getDict("en").checkout.placeOrder })).toBeDisabled();
  });
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
