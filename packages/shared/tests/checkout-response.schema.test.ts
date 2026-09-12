import assert from "node:assert/strict";
import test from "node:test";
import * as schemas from "../src/schemas/checkout.schema.js";

test("checkout response contract distinguishes an order from a provider redirect", () => {
  const schema = (schemas as { checkoutResponseSchema?: { parse: (value: unknown) => unknown } }).checkoutResponseSchema;
  assert.deepEqual(schema?.parse({ kind: "cod_order", id: 8, orderCode: "ABCD-008", paymentStatus: "pending" }),
    { kind: "cod_order", id: 8, orderCode: "ABCD-008", paymentStatus: "pending" });
  assert.deepEqual(schema?.parse({ kind: "paymob_redirect", checkoutId: "checkout_123", checkoutUrl: "https://eg.checkout.paymob.com/", expiresAt: "2026-09-11T12:30:00.000Z" }),
    { kind: "paymob_redirect", checkoutId: "checkout_123", checkoutUrl: "https://eg.checkout.paymob.com/", expiresAt: "2026-09-11T12:30:00.000Z" });
});
