import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

const state = vi.hoisted(() => ({ submit: vi.fn(), quote: vi.fn(), price: vi.fn() }));
// The real cart keeps one array in state; a fresh array per render would re-price forever.
const cartLines = vi.hoisted(() => [{ type: "product", productId: 1, variantId: 11, qty: 1 }]);
vi.mock("next/navigation", () => ({ usePathname: () => "/en/checkout" }));
vi.mock("@/components/providers/cart-provider", () => ({ useCart: () => ({ lines: cartLines, clear: vi.fn() }) }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: 7, name: "Mona", email: "mona@example.com" }, accessToken: "token" }) }));
vi.mock("@/lib/checkout-request", () => ({ getCheckoutIdempotencyKey: async () => "promo-request", clearCheckoutRequest: vi.fn() }));
vi.mock("@/lib/cart-line-size", () => ({ cartLineSizeLabel: () => null, productLineOptions: () => ({ size: "", color: "" }) }));
vi.mock("@/lib/api/client", () => ({
  fetchProducts: async () => [{ id: 1, name: { en: "Swing", ar: "مرجيحة" }, variants: [{ id: 11, price: 10, stock: 10, sizeLabel: "" }] }],
  fetchOffers: async () => [], fetchCollections: async () => [],
  fetchDeliveryGovernorates: async () => [{ id: 1, arName: "حولي", enName: "Hawalli", areas: [{ id: 10, arName: "السالمية", enName: "Salmiya" }] }],
  quoteCheckout: (...args: unknown[]) => state.quote(...args),
  fetchCheckoutPrice: (...args: unknown[]) => state.price(...args),
  submitCheckout: (...args: unknown[]) => state.submit(...args)
}));
import { useCheckout } from "@/hooks/use-checkout";
import { loadPromoCode, salesSignature, savePromoCode } from "@/lib/promo/promo-code";

const applied = { items: [{ index: 0, unitPrice: 10, originalUnitPrice: 10, lineTotal: 9, promoDiscount: 1 }], productsTotal: 9,
  promo: { status: "applied", code: "SAVE10", arName: "خصم", enName: "Save", discount: 1, saleGivenUp: 0, freeShipping: false, replacedSales: [] } };
const replacing = { items: [{ index: 0, unitPrice: 12, originalUnitPrice: 12, lineTotal: 10.8, promoDiscount: 1.2 }], productsTotal: 10.8,
  promo: { status: "applied", code: "SAVE10", arName: "خصم", enName: "Save", discount: 1.2, saleGivenUp: 2, freeShipping: false,
    replacedSales: [{ index: 0, item: "product_variant:11", nameAr: "مرجيحة", nameEn: "Swing", previousLineTotal: 10, lineTotal: 10.8 }] } };

beforeEach(() => {
  localStorage.clear();
  savePromoCode("save10");
  state.submit.mockReset(); state.quote.mockReset(); state.price.mockReset();
  state.price.mockResolvedValue(applied);
  state.quote.mockImplementation(async (input: { promoCode?: string }) => input.promoCode
    ? { subtotal: 9, deliveryFee: 1.5, total: 10.5, deliveryFeeWaived: 0, items: applied.items, promo: applied.promo }
    : { subtotal: 10, deliveryFee: 1.5, total: 11.5 });
  state.submit.mockResolvedValue({ id: 1, orderCode: "ABCD-001", paymentStatus: "pending" });
});

async function fill(result: any) {
  await act(async () => {
    for (const [key, value] of Object.entries({ fullName: "Mona", phone: "55123456", email: "mona@example.com",
      governorateId: "1", areaId: "10", addressLine: "Block 3", buildingApartment: "1" })) result.current.setField(key, value);
  });
}

it("quotes, totals and submits the server-priced cart with the code", async () => {
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(9));
  await fill(result);
  await waitFor(() => expect(result.current.quote?.total).toBe(10.5));
  expect(state.quote).toHaveBeenLastCalledWith(expect.objectContaining({ areaId: 10, promoCode: "save10", phone: "55123456" }), "token");

  await act(async () => result.current.placeOrder());
  expect(state.submit).toHaveBeenCalledWith(expect.objectContaining({ promoCode: "save10", expectedAmountFils: 10500, promoAcceptedSales: [] }), "token", expect.anything());
});

it("removes a saved code that no longer applies and says why", async () => {
  state.price.mockResolvedValue({ items: [], productsTotal: 10, promo: { status: "rejected", code: "SAVE10", reason: "inactive" } });
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.notice).toBe("Code SAVE10 was removed: This code isn't active."));
  expect(loadPromoCode()).toBe("");
});

it("drops the code and explains when checkout refuses it, so the customer can review the new total", async () => {
  state.submit.mockRejectedValue(Object.assign(new Error("Promo code rejected"), { code: "PROMO_REJECTED",
    body: { code: "PROMO_REJECTED", promo: { status: "rejected", code: "SAVE10", reason: "usage_limit" } } }));
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(9));
  await fill(result);
  await waitFor(() => expect(result.current.quoteState).toBe("ready"));
  await act(async () => result.current.placeOrder());
  expect(result.current.errors.submit).toBe("Code SAVE10 was removed: This code has reached its usage limit.");
  expect(loadPromoCode()).toBe("");
});

it("takes the code off when the checkout quote says it no longer applies, so the customer sees why", async () => {
  // The code runs out between pricing the cart and quoting delivery for the area: only the quote knows.
  state.quote.mockImplementation(async (input: { promoCode?: string }) => input.promoCode
    ? { subtotal: 10, deliveryFee: 1.5, total: 11.5, items: [], promo: { status: "rejected", code: "SAVE10", reason: "usage_limit" } }
    : { subtotal: 10, deliveryFee: 1.5, total: 11.5 });
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(9));
  await fill(result);
  await waitFor(() => expect(result.current.promo.notice).toBe("Code SAVE10 was removed: This code has reached its usage limit."));
  expect(loadPromoCode()).toBe("");
});

it("blocks checkout with a clear message when the code could not be priced, instead of charging without it", async () => {
  state.price.mockRejectedValue(new Error("network"));
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(state.price).toHaveBeenCalled());
  await fill(result);
  await act(async () => result.current.placeOrder());
  expect(state.submit).not.toHaveBeenCalled();
  expect(result.current.errors.submit).toBe("We couldn't check this code. Please try again.");
});

it("does not let a saved code replace a sale until the customer confirms those exact prices (after login or a re-price)", async () => {
  state.price.mockResolvedValue(replacing);
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.confirmation?.code).toBe("SAVE10"));
  expect(result.current.promo.productsTotal).toBe(10);
  await fill(result);
  await act(async () => result.current.placeOrder());
  expect(state.submit).not.toHaveBeenCalled();
  expect(result.current.errors.submit).toBe("Confirm the new prices for your code first.");

  await act(async () => result.current.promo.confirm());
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(10.8));
  expect(result.current.promo.confirmation).toBeNull();
});

it("uses a code without asking again when the customer already accepted these exact prices, and sends that confirmation", async () => {
  state.price.mockResolvedValue(replacing);
  savePromoCode("save10", salesSignature(replacing.promo.replacedSales as never));
  state.quote.mockResolvedValue({ subtotal: 10.8, deliveryFee: 1.5, total: 12.3, items: replacing.items, promo: replacing.promo });
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(10.8));
  expect(result.current.promo.confirmation).toBeNull();
  await fill(result);
  await waitFor(() => expect(result.current.quote?.total).toBe(12.3));
  await act(async () => result.current.placeOrder());
  expect(state.submit.mock.calls[0][0].promoAcceptedSales).toEqual([{ item: "product_variant:11", previousLineTotal: 10, lineTotal: 10.8 }]);
});

it("dropping the code from the confirmation keeps the sale prices", async () => {
  state.price.mockResolvedValue(replacing);
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.confirmation).not.toBeNull());
  await act(async () => result.current.promo.decline());
  expect(loadPromoCode()).toBe("");
});

it("checks the code against the checkout phone once a valid one is typed", async () => {
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(9));
  expect(state.price).not.toHaveBeenCalledWith(expect.objectContaining({ phone: expect.anything() }), expect.anything());
  await fill(result);
  await waitFor(() => expect(state.price).toHaveBeenLastCalledWith(expect.objectContaining({ promoCode: "save10", phone: "55123456" }), "token"));
});

it("shows each line at the price the server charges with the code", async () => {
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.resolved[0]?.lineTotal).toBe(9));
  expect(result.current.resolved[0]?.unit).toBe(10);
});

it("keeps the code and its saving for the order confirmation", async () => {
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(9));
  await fill(result);
  await waitFor(() => expect(result.current.quoteState).toBe("ready"));
  await act(async () => result.current.placeOrder());
  expect(result.current.orderId).toBe("ABCD-001");
  expect(result.current.placedPromo).toMatchObject({ code: "SAVE10", discount: 1 });
});

it("prices the code again when checkout says its sale replacements changed, so the customer is asked to confirm", async () => {
  state.submit.mockRejectedValue(Object.assign(new Error("Confirm"), { code: "PROMO_CONFIRMATION_REQUIRED" }));
  const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
  await waitFor(() => expect(result.current.promo.productsTotal).toBe(9));
  await fill(result);
  await waitFor(() => expect(result.current.quoteState).toBe("ready"));
  const calls = state.price.mock.calls.length;
  await act(async () => result.current.placeOrder());
  expect(result.current.errors.submit).toBe("Confirm the new prices for your code first.");
  await waitFor(() => expect(state.price.mock.calls.length).toBeGreaterThan(calls));
});
