import { beforeEach, describe, expect, it } from "vitest";
import { getCheckoutIdempotencyKey } from "@/lib/paymob-browser-session";

const payload = {
  fullName: "Private Customer", phone: "01012345678", email: "private@example.com",
  governorate: "Cairo", cityArea: "Nasr City", addressLine: "Secret Street 1",
  buildingApartment: "4", paymentMethod: "paymob" as const,
  items: [{ type: "product" as const, variantId: 11, qty: 1 }]
};

beforeEach(() => sessionStorage.clear());

describe("Paymob checkout browser session", () => {
  it("reuses one key for the same checkout without storing customer details", async () => {
    const first = await getCheckoutIdempotencyKey(payload);
    const second = await getCheckoutIdempotencyKey(payload);
    expect(second).toBe(first);
    expect(sessionStorage.getItem("capella:paymob-checkout-request")).not.toContain("Secret Street 1");
    expect(sessionStorage.getItem("capella:paymob-checkout-request")).not.toContain("private@example.com");
  });

  it("uses a new key when the checkout contents change", async () => {
    const first = await getCheckoutIdempotencyKey(payload);
    const second = await getCheckoutIdempotencyKey({ ...payload, items: [{ type: "product", variantId: 11, qty: 2 }] });
    expect(second).not.toBe(first);
  });
});
