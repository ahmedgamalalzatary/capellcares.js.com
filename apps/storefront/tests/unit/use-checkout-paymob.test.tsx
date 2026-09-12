import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

const clear = vi.fn();
const submitCheckout = vi.fn();
const redirectToPaymob = vi.fn();

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({ lines: [{ type: "product", productId: 1, variantId: 11, qty: 1 }], clear })
}));
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: null, accessToken: null })
}));
vi.mock("@/lib/api/client", () => ({
  fetchProducts: async () => [{ id: 1, name: { en: "Serum", ar: "سيروم" },
    variants: [{ id: 11, size: "30ml", price: 35, stock: 10 }] }],
  fetchOffers: async () => [],
  fetchCollections: async () => [],
  fetchPaymobMethods: async () => ({ available: true, methods: ["card"] }),
  submitCheckout: (...args: unknown[]) => submitCheckout(...args)
}));
vi.mock("@/lib/paymob-browser-session", () => ({
  redirectToPaymob: (...args: unknown[]) => redirectToPaymob(...args),
  rememberPendingCheckout: (id: string) => sessionStorage.setItem("capella:pending-paymob-checkout", id),
  getCheckoutIdempotencyKey: () => "11111111-1111-4111-8111-111111111111"
}));

import { useCheckout } from "@/hooks/use-checkout";

beforeEach(() => {
  clear.mockReset();
  submitCheckout.mockReset();
  redirectToPaymob.mockReset();
  sessionStorage.clear();
});

describe("useCheckout Paymob flow", () => {
  it("preserves the cart and records the checkout before redirecting to Paymob", async () => {
    submitCheckout.mockResolvedValue({ kind: "paymob_redirect", checkoutId: "checkout_abc",
      checkoutUrl: "https://eg.checkout.paymob.com/?clientSecret=abc",
      expiresAt: "2026-09-11T12:30:00.000Z" });
    const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
    await waitFor(() => expect(result.current.paymobMethods).toEqual(["card"]));
    await act(async () => {
      for (const [key, value] of Object.entries({ fullName: "Customer", phone: "01012345678",
        email: "customer@example.com", governorate: "Cairo", cityArea: "Nasr City",
        addressLine: "Street 1", buildingApartment: "1" })) {
        result.current.setField(key as keyof typeof result.current.form, value);
      }
      result.current.setField("paymentMethod", "paymob");
    });
    await act(async () => { await result.current.placeOrder(); });
    expect(sessionStorage.getItem("capella:pending-paymob-checkout")).toBe("checkout_abc");
    expect(clear).not.toHaveBeenCalled();
    expect(result.current.orderId).toBeNull();
    expect(redirectToPaymob).toHaveBeenCalledWith("https://eg.checkout.paymob.com/?clientSecret=abc");
    expect(submitCheckout.mock.calls[0]?.[2]).toMatchObject({
      idempotencyKey: "11111111-1111-4111-8111-111111111111"
    });
  });

  it("does not submit the same checkout twice while its first request is in flight", async () => {
    let complete!: (value: unknown) => void;
    submitCheckout.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    const { result } = renderHook(() => useCheckout({ lang: "en", dict: getDict("en") }));
    await waitFor(() => expect(result.current.paymobMethods).toEqual(["card"]));
    await act(async () => {
      for (const [key, value] of Object.entries({ fullName: "Customer", phone: "01012345678",
        email: "customer@example.com", governorate: "Cairo", cityArea: "Nasr City",
        addressLine: "Street 1", buildingApartment: "1" })) {
        result.current.setField(key as keyof typeof result.current.form, value);
      }
    });
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.placeOrder();
      second = result.current.placeOrder();
    });
    expect(submitCheckout).toHaveBeenCalledTimes(1);
    complete({ kind: "cod_order", id: 8, orderCode: "CAP-8", paymentStatus: "pending" });
    await act(async () => { await Promise.all([first, second]); });
  });
});
