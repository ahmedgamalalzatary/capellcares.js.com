import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict, type CheckoutDeliveryGovernorate } from "@capella/shared";
import { CheckoutForm } from "@/components/checkout/checkout-form";

const emptyForm = {
  fullName: "", phone: "", email: "", governorateId: "", areaId: "", addressLine: "",
  buildingApartment: "", notes: ""
};

const governorates: CheckoutDeliveryGovernorate[] = [
  { id: 1, arName: "حولي", enName: "Hawalli", areas: [{ id: 10, arName: "السالمية", enName: "Salmiya" }, { id: 11, arName: "الجابرية", enName: "Jabriya" }] },
  { id: 2, arName: "الأحمدي", enName: "Ahmadi", areas: [{ id: 20, arName: "الفحيحيل", enName: "Fahaheel" }] }
];

function renderForm({ lang = "en" as "en" | "ar", form = emptyForm, list = governorates as CheckoutDeliveryGovernorate[] | null, setField = vi.fn(), placeOrder = vi.fn() } = {}) {
  render(
    <CheckoutForm lang={lang} dict={getDict(lang)} form={form} errors={{}} placing={false} governorates={list} setField={setField} placeOrder={placeOrder} />
  );
  return { setField, placeOrder };
}

describe("CheckoutForm", () => {
  it("offers cash on delivery as the only way to pay", () => {
    renderForm();
    expect(screen.getByText(getDict("en").checkout.cod)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText(getDict("en").checkout.payOnline)).not.toBeInTheDocument();
  });

  it("places the order on submit", () => {
    const { placeOrder } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: getDict("en").checkout.placeOrder }));
    expect(placeOrder).toHaveBeenCalledTimes(1);
  });

  it("delivers in Kuwait only", () => {
    renderForm();
    expect(screen.getByRole("combobox", { name: "Country" })).toHaveDisplayValue("Kuwait");
  });

  it("lists the governorates set up in the ERP, in the page language", () => {
    renderForm({ lang: "ar" });
    const select = screen.getByRole("combobox", { name: "المحافظة" });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["—", "حولي", "الأحمدي"]);
  });

  it("shows only the chosen governorate's areas, and clears the area when the governorate changes", () => {
    const { setField } = renderForm({ form: { ...emptyForm, governorateId: "1", areaId: "10" } });
    const area = screen.getByRole("combobox", { name: "Area" });
    expect(within(area).getAllByRole("option").map((o) => o.textContent)).toEqual(["—", "Salmiya", "Jabriya"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Governorate" }), { target: { value: "2" } });
    expect(setField).toHaveBeenCalledWith("governorateId", "2");
    expect(setField).toHaveBeenCalledWith("areaId", "");
  });

  it("keeps the area list disabled until a governorate is chosen", () => {
    renderForm();
    expect(screen.getByRole("combobox", { name: "Area" })).toBeDisabled();
  });

  it("explains when no delivery areas are available", () => {
    renderForm({ list: [] });
    expect(screen.getByText(getDict("en").checkout.noDeliveryAreas)).toBeInTheDocument();
  });
});
