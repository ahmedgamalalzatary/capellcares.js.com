import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

const state = vi.hoisted(() => ({ submit: vi.fn(), quote: vi.fn(), price: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/checkout" }));
vi.mock("@/components/providers/cart-provider", () => ({ useCart: () => ({ lines: [{ type: "product", productId: 1, variantId: 11, qty: 1 }], clear: vi.fn() }) }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: 7, name: "Mona", email: "mona@example.com" }, accessToken: "token" }) }));
vi.mock("@/lib/api/client", () => ({
  fetchProducts: async () => [{ id: 1, name: { en: "Serum", ar: "سيروم" }, variants: [{ id: 11, size: "30ml", price: 100, stock: 10 }] }],
  fetchOffers: async () => [], fetchCollections: async () => [],
  fetchPaymobMethods: async () => ({ available: true, methods: ["card"] }),
  fetchCheckoutShipping: async () => ({ enabled: true, addresses: [address] }),
  fetchCheckoutShippingQuote: (...args: unknown[]) => state.quote(...args),
  fetchCheckoutPrice: (...args: unknown[]) => state.price(...args),
  submitCheckout: (...args: unknown[]) => state.submit(...args)
}));
vi.mock("@/lib/paymob-browser-session", () => ({ getCheckoutIdempotencyKey: async () => "promo-request",
  clearPendingCheckout: vi.fn(), rememberPendingCheckout: vi.fn(), redirectToPaymob: vi.fn() }));
import { useCheckout } from "@/hooks/use-checkout";
import { loadPromoCode, savePromoCode } from "@/lib/promo/promo-code";

const address = { cityId: "cairo", zoneId: "nasr", districtId: "district-1", cityName: { en: "Cairo", ar: "القاهرة" },
  zoneName: { en: "Nasr City", ar: "مدينة نصر" }, districtName: { en: "District 1", ar: "الحي الأول" } };
const applied = { items: [{ index: 0, unitPrice: 100, originalUnitPrice: 100, lineTotal: 90, promoDiscount: 10 }], productsTotal: 90,
  promo: { status: "applied", code: "SAVE10", arName: "خصم", enName: "Save", discount: 10, saleGivenUp: 0, freeShipping: false, replacedSales: [] } };

beforeEach(() => {
  localStorage.clear();
  savePromoCode("save10");
  state.submit.mockReset(); state.quote.mockReset(); state.price.mockReset();
  state.price.mockResolvedValue(applied);
  state.quote.mockImplementation(async (input: { paymentMethod: string }) => ({ quoteId: "quote_promo", shippingAmountCents: 5000, size: "small",
    rateIdentity: "fixture", quotedAt: new Date().toISOString(), productsTotalCents: 9000, amountCents: 14000,
    codAmountCents: 14000, paymentMethod: input.paymentMethod, address }));
  state.submit.mockResolvedValue({ kind: "cod_order", id: 1, orderCode: "ABCD-001", paymentStatus: "pending" });
});

async function fill(result: any) {
  await act(async () => {
    for (const [key, value] of Object.entries({ fullName: "Mona", phone: "01012345678", email: "mona@example.com",
      addressLine: "Street 1", buildingApartment: "1", shippingCityId: "cairo" })) result.current.setField(key, value);
  });
  await act(async () => result.current.setField("shippingZoneId", "nasr"));
  await act(async () => result.current.setField("shippingDistrictId", "district-1"));
}

it("quotes, totals and submits the server-priced cart with the code", async () => {
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(90));
  await fill(result);
  await waitFor(() => expect(result.current.shipping.quote?.quoteId).toBe("quote_promo"));
  expect(state.quote).toHaveBeenLastCalledWith(expect.objectContaining({ promoCode: "save10", paymentMethod: "cod" }), "token", true);
  expect(result.current.totalAmount).toBe(140);

  await act(async () => result.current.placeOrder());
  expect(state.submit).toHaveBeenCalledWith(expect.objectContaining({ promoCode: "save10", paymentMethod: "cod", expectedAmountCents: 14000 }), "token", expect.anything());
});

it("keeps online payment available with a code", async () => {
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(90));
  expect(result.current.paymobMethods).toEqual(["card"]);
  await act(async () => result.current.setField("paymentMethod", "paymob"));
  await fill(result);
  await waitFor(() => expect(result.current.shipping.quote?.paymentMethod).toBe("paymob"));
  await act(async () => result.current.placeOrder());
  expect(state.submit.mock.calls[0][0]).toMatchObject({ promoCode: "save10", paymentMethod: "paymob" });
});

it("hides online payment and explains why when the code brings the total under EGP 10", async () => {
  state.price.mockResolvedValue({ ...applied, productsTotal: 5, items: [{ ...applied.items[0], lineTotal: 5, promoDiscount: 95 }] });
  state.quote.mockImplementation(async (input: { paymentMethod: string }) => ({ quoteId: "quote_small", shippingAmountCents: 0, size: "small",
    rateIdentity: "fixture", quotedAt: new Date().toISOString(), productsTotalCents: 500, amountCents: 500,
    codAmountCents: input.paymentMethod === "cod" ? 500 : 0, paymentMethod: input.paymentMethod, address }));
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(5));
  await act(async () => result.current.setField("paymentMethod", "paymob"));
  await fill(result);
  await waitFor(() => expect(result.current.shipping.quote?.quoteId).toBe("quote_small"));
  await waitFor(() => expect(result.current.form.paymentMethod).toBe("cod"));
  expect(result.current.paymobMethods).toEqual([]);
  expect(result.current.promo.onlineMinimum).toBe(true);
});

it("removes a saved code that no longer applies and says why", async () => {
  state.price.mockResolvedValue({ items: [], productsTotal: 100, promo: { status: "rejected", code: "SAVE10", reason: "inactive" } });
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.notice).toBe("Code SAVE10 was removed: This code isn't active."));
  expect(loadPromoCode()).toBe("");
});

it("drops the code and explains when checkout refuses it, so the customer can review the new total", async () => {
  state.submit.mockRejectedValue(Object.assign(new Error("Promo code rejected"), { code: "PROMO_REJECTED",
    body: { code: "PROMO_REJECTED", promo: { status: "rejected", code: "SAVE10", reason: "usage_limit" } } }));
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(90));
  await fill(result);
  await waitFor(() => expect(result.current.shipping.quote?.quoteId).toBe("quote_promo"));
  await act(async () => result.current.placeOrder());
  expect(result.current.errors.submit).toBe("Code SAVE10 was removed: This code has reached its usage limit.");
  expect(loadPromoCode()).toBe("");
});
