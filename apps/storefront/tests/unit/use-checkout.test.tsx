import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

const submitCheckout = vi.fn();
const quoteCheckout = vi.fn();
const fetchDeliveryGovernorates = vi.fn();
const clear = vi.fn();

const product = {
  id: 1, name: { ar: "لعبة", en: "Toy" }, variants: [{ id: 7, price: 1.125, stock: 5, sizeLabel: "" }]
};

// The real cart keeps one array in state; a fresh array per render would re-price forever.
const cartLines = [{ type: "product", productId: 1, variantId: 7, qty: 2 }];
vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({ lines: cartLines, clear })
}));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: null, accessToken: null }) }));
vi.mock("@/lib/checkout-request", () => ({ getCheckoutIdempotencyKey: async () => "key-1", clearCheckoutRequest: vi.fn() }));
vi.mock("@/lib/cart-line-size", () => ({ cartLineSizeLabel: () => null, productLineOptions: () => ({ size: "", color: "" }) }));
vi.mock("@/lib/api/client", () => ({
  fetchProducts: async () => [product],
  fetchOffers: async () => [],
  fetchCollections: async () => [],
  fetchDeliveryGovernorates: (...args: unknown[]) => fetchDeliveryGovernorates(...args),
  quoteCheckout: (...args: unknown[]) => quoteCheckout(...args),
  submitCheckout: (...args: unknown[]) => submitCheckout(...args)
}));

import { useCheckout } from "@/hooks/use-checkout";

const dict = getDict("en");

beforeEach(() => {
  vi.clearAllMocks();
  fetchDeliveryGovernorates.mockResolvedValue([{ id: 1, arName: "حولي", enName: "Hawalli", areas: [{ id: 10, arName: "السالمية", enName: "Salmiya" }] }]);
  quoteCheckout.mockResolvedValue({ subtotal: 2.25, deliveryFee: 1.5, total: 3.75 });
  submitCheckout.mockResolvedValue({ id: 9, orderCode: "ABCD-009", paymentStatus: "pending" });
});

async function filledCheckout() {
  const hook = renderHook(() => useCheckout({ lang: "en", dict }));
  await waitFor(() => expect(hook.result.current.governorates).toHaveLength(1));
  await waitFor(() => expect(hook.result.current.resolved).toHaveLength(1));
  act(() => {
    hook.result.current.setField("fullName", "Buyer");
    hook.result.current.setField("email", "buyer@example.com");
    hook.result.current.setField("phone", "55123456");
    hook.result.current.setField("governorateId", "1");
    hook.result.current.setField("areaId", "10");
    hook.result.current.setField("addressLine", "Block 3, Street 10");
    hook.result.current.setField("buildingApartment", "House 4");
  });
  await waitFor(() => expect(hook.result.current.quoteState).toBe("ready"));
  return hook;
}

describe("useCheckout", () => {
  it("prices delivery for the chosen area", async () => {
    const { result } = await filledCheckout();
    expect(quoteCheckout).toHaveBeenLastCalledWith({ areaId: 10, items: [{ type: "product", variantId: 7, qty: 2 }] });
    expect(result.current.quote).toEqual({ subtotal: 2.25, deliveryFee: 1.5, total: 3.75 });
  });

  it("sends the area and the total the customer saw, in fils", async () => {
    const { result } = await filledCheckout();
    await act(async () => { await result.current.placeOrder(); });
    expect(submitCheckout).toHaveBeenCalledTimes(1);
    const payload = submitCheckout.mock.calls[0]![0];
    expect(payload).toMatchObject({ areaId: 10, phone: "55123456", expectedAmountFils: 3750 });
    expect(payload).not.toHaveProperty("governorate");
    expect(result.current.orderId).toBe("ABCD-009");
  });

  it("refuses a non-Kuwaiti phone number", async () => {
    const { result } = await filledCheckout();
    act(() => result.current.setField("phone", "01012345678"));
    await act(async () => { await result.current.placeOrder(); });
    expect(result.current.errors.phone).toBe(dict.checkout.kwPhoneInvalid);
    expect(submitCheckout).not.toHaveBeenCalled();
  });

  it("requires an area", async () => {
    const { result } = await filledCheckout();
    act(() => result.current.setField("areaId", ""));
    await act(async () => { await result.current.placeOrder(); });
    expect(result.current.errors.areaId).toBe(dict.checkout.required);
    expect(submitCheckout).not.toHaveBeenCalled();
  });

  it("does not order while the delivery fee is unknown", async () => {
    quoteCheckout.mockRejectedValue(new Error("down"));
    const hook = renderHook(() => useCheckout({ lang: "en", dict }));
    await waitFor(() => expect(hook.result.current.governorates).toHaveLength(1));
    act(() => {
      hook.result.current.setField("fullName", "Buyer");
      hook.result.current.setField("email", "buyer@example.com");
      hook.result.current.setField("phone", "55123456");
      hook.result.current.setField("governorateId", "1");
      hook.result.current.setField("areaId", "10");
      hook.result.current.setField("addressLine", "Block 3");
      hook.result.current.setField("buildingApartment", "House 4");
    });
    await waitFor(() => expect(hook.result.current.quoteState).toBe("error"));
    await act(async () => { await hook.result.current.placeOrder(); });
    expect(submitCheckout).not.toHaveBeenCalled();
    expect(hook.result.current.errors.submit).toBe(dict.checkout.deliveryQuoteFailed);
  });
});
