import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

const state = vi.hoisted(() => ({ lines: [{ type: "product", productId: 1, variantId: 11, qty: 1 }],
  subtotal: 35, submit: vi.fn(), quote: vi.fn(), availability: vi.fn(), clear: vi.fn() }));
vi.mock("@/components/providers/cart-provider", () => ({ useCart: () => ({ lines: state.lines, clear: state.clear }) }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: null, accessToken: null }) }));
vi.mock("@/lib/api/client", () => ({
  fetchProducts: async () => [{ id: 1, name: { en: "Serum", ar: "سيروم" }, variants: [{ id: 11, size: "30ml", price: state.subtotal, stock: 10 }] }],
  fetchOffers: async () => [], fetchCollections: async () => [],
  fetchPaymobMethods: async () => ({ available: true, methods: ["card"] }),
  fetchCheckoutShipping: () => state.availability(), fetchCheckoutShippingQuote: (...args: unknown[]) => state.quote(...args),
  submitCheckout: (...args: unknown[]) => state.submit(...args)
}));
vi.mock("@/lib/paymob-browser-session", () => ({ getCheckoutIdempotencyKey: async () => "shipping-request",
  clearPendingCheckout: vi.fn(), rememberPendingCheckout: vi.fn(), redirectToPaymob: vi.fn() }));
import { useCheckout } from "@/hooks/use-checkout";
const address = { cityId: "cairo", zoneId: "nasr", districtId: "district-1", cityName: { en: "Cairo", ar: "القاهرة" },
  zoneName: { en: "Nasr City", ar: "مدينة نصر" }, districtName: { en: "District 1", ar: "الحي الأول" } };
function quoteResponse(paymentMethod = "cod", productsTotalCents = 3500) {
  return { quoteId: "quote_fixture", shippingAmountCents: 9729, size: "small", rateIdentity: "fixture",
    quotedAt: new Date().toISOString(), productsTotalCents, amountCents: productsTotalCents + 9729,
    codAmountCents: paymentMethod === "cod" ? productsTotalCents + 9729 : 0, paymentMethod, address };
}
beforeEach(() => {
  state.lines = [{ type: "product", productId: 1, variantId: 11, qty: 1 }]; state.subtotal = 35;
  state.submit.mockReset(); state.quote.mockReset(); state.availability.mockReset(); state.clear.mockReset();
  state.availability.mockResolvedValue({ enabled: true, addresses: [address] });
  state.quote.mockImplementation(async input => quoteResponse(input.paymentMethod, state.subtotal * 100 * state.lines[0].qty));
  state.submit.mockResolvedValue({ kind: "cod_order", id: 1, orderCode: "ABCD-001", paymentStatus: "pending" });
});
async function fill(result: any) {
  await act(async () => {
    for (const [key, value] of Object.entries({ fullName: "Buyer", phone: "01012345678", email: "buyer@example.com",
      addressLine: "Street 1", buildingApartment: "1", shippingCityId: "cairo" })) result.current.setField(key, value);
  });
  await act(async () => result.current.setField("shippingZoneId", "nasr"));
  await act(async () => result.current.setField("shippingDistrictId", "district-1"));
}
it("submits the agreed shipping-inclusive total and quote for a guest", async () => {
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.subtotal).toBe(35));
  await fill(result);
  await waitFor(() => expect(result.current.shipping.quote?.quoteId).toBe("quote_fixture"));
  await act(async () => result.current.placeOrder());
  expect(state.submit).toHaveBeenCalledWith(expect.objectContaining({ expectedAmountCents: 13229, shippingQuoteId: "quote_fixture",
    shippingAddress: { cityId: "cairo", zoneId: "nasr", districtId: "district-1" } }), null, expect.anything());
  expect(result.current.orderId).toBe("ABCD-001");
});
it("keeps Paymob selected when the products are free and shipping is chargeable", async () => {
  state.subtotal = 0;
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.resolved).toHaveLength(1)); await fill(result);
  await act(async () => result.current.setField("paymentMethod", "paymob"));
  await waitFor(() => expect(result.current.shipping.quote?.paymentMethod).toBe("paymob"));
  await act(async () => result.current.placeOrder());
  expect(state.submit.mock.calls[0][0]).toMatchObject({ paymentMethod: "paymob", expectedAmountCents: 9729 });
});
it("clears dependent address fields and cannot place an order using the previous destination quote", async () => {
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.subtotal).toBe(35)); await fill(result);
  await waitFor(() => expect(result.current.shipping.quote).not.toBeNull());
  await act(async () => result.current.setField("shippingCityId", "another-city"));
  expect(result.current.form.shippingZoneId).toBe(""); expect(result.current.form.shippingDistrictId).toBe("");
  expect(result.current.shipping.quote).toBeNull();
  await act(async () => result.current.placeOrder());
  expect(state.submit).not.toHaveBeenCalled();
});
it("blocks checkout when shipping availability fails and lets the buyer retry", async () => {
  state.availability.mockRejectedValueOnce(new Error("provider error"));
  const { result } = renderHook(() => useCheckout({ lang: "ar", dict: getDict("ar") }));
  await waitFor(() => expect(result.current.shipping.error).toBeTruthy()); await fill(result);
  await act(async () => result.current.placeOrder()); expect(state.submit).not.toHaveBeenCalled();
  expect(result.current.shipping.error).not.toContain("provider error");
  await act(async () => result.current.shipping.retry());
  await waitFor(() => expect(result.current.shipping.enabled).toBe(true));
});
it("invalidates a quote when the cart changes before a replacement quote has loaded", async () => {
  const { result, rerender } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.subtotal).toBe(35)); await fill(result);
  await waitFor(() => expect(result.current.shipping.quote).not.toBeNull());
  state.quote.mockReturnValue(new Promise(() => {}));
  state.lines = [{ ...state.lines[0], qty: 2 }]; rerender();
  expect(result.current.shipping.quote).toBeNull();
  await act(async () => result.current.placeOrder()); expect(state.submit).not.toHaveBeenCalled();
});
it("shows a translated quote-change error and refreshes without automatically resubmitting", async () => {
  state.submit.mockRejectedValue(Object.assign(new Error("internal API message"), { code: "SHIPPING_QUOTE_CHANGED" }));
  const { result } = renderHook(() => useCheckout({ lang: "ar", dict: getDict("ar") }));
  await waitFor(() => expect(result.current.subtotal).toBe(35)); await fill(result);
  await waitFor(() => expect(result.current.shipping.quote).not.toBeNull());
  await act(async () => result.current.placeOrder());
  expect(result.current.errors.submit).not.toContain("internal API message");
  expect(result.current.errors.submit).toBeTruthy();
  expect(state.submit).toHaveBeenCalledTimes(1);
});
it("finishes loading when an in-flight quote is canceled by changing the city", async () => {
  state.quote.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.subtotal).toBe(35)); await fill(result);
  await waitFor(() => expect(result.current.shipping.loading).toBe(true));
  await act(async () => result.current.setField("shippingCityId", "another-city"));
  expect(result.current.shipping.loading).toBe(false);
});
it("explains an unsupported district in the selected language", async () => {
  state.quote.mockRejectedValue(Object.assign(new Error("provider error"), { code: "SHIPPING_UNSUPPORTED" }));
  const { result } = renderHook(() => useCheckout({ lang: "ar", dict: getDict("ar") }));
  await waitFor(() => expect(result.current.subtotal).toBe(35)); await fill(result);
  await waitFor(() => expect(result.current.shipping.error).toBe(getDict("ar").checkout.shippingUnsupported));
});
it("explains online-payment availability failures in Arabic", async () => {
  state.submit.mockRejectedValue(Object.assign(new Error("Paymob checkout is not configured"), { code: "PAYMENT_UNAVAILABLE" }));
  const { result } = renderHook(() => useCheckout({ lang: "ar", dict: getDict("ar") }));
  await waitFor(() => expect(result.current.subtotal).toBe(35)); await fill(result);
  await act(async () => result.current.setField("paymentMethod", "paymob"));
  await waitFor(() => expect(result.current.shipping.quote?.paymentMethod).toBe("paymob"));
  await act(async () => result.current.placeOrder());
  expect(result.current.errors.submit).toBe("تعذر بدء الدفع الإلكتروني. حاول مرة أخرى.");
});
