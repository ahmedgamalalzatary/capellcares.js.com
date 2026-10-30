import assert from "node:assert/strict";
import test from "node:test";
import { checkoutResponseSchema, checkoutSchema } from "../src/schemas/checkout.schema.js";

test("checkout response contract describes the created order", () => {
  const order = { id: 8, orderCode: "ABCD-008", paymentStatus: "pending" };
  assert.deepEqual(checkoutResponseSchema.parse(order), order);
});

test("checkout accepts cash on delivery only", () => {
  const input = {
    fullName: "Buyer", phone: "01012345678", email: "buyer@example.com", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "1 Main Street", buildingApartment: "2", items: [{ type: "product", variantId: 1, qty: 1 }]
  };
  assert.equal(checkoutSchema.safeParse({ ...input, paymentMethod: "cod" }).success, true);
  assert.equal(checkoutSchema.safeParse({ ...input, paymentMethod: "paymob" }).success, false);
});
