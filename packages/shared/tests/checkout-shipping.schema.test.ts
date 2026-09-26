import assert from "node:assert/strict";
import test from "node:test";
import * as schemas from "../src/schemas/checkout.schema.js";

const checkout = { fullName: "Buyer", phone: "01012345678", email: "buyer@example.com",
  governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
  paymentMethod: "cod", items: [{ type: "product", variantId: 1, qty: 1 }] };
const shippingAddress = { cityId: "c1", zoneId: "z1", districtId: "d1" };

test("checkout preserves the selected destination and agreed quote without accepting browser shipping prices", () => {
  const parsed = schemas.checkoutSchema.parse({ ...checkout, shippingAddress, shippingQuoteId: "quote_1", shippingAmountCents: 1 });
  assert.deepEqual((parsed as any).shippingAddress, shippingAddress);
  assert.equal((parsed as any).shippingQuoteId, "quote_1");
  assert.equal("shippingAmountCents" in parsed, false);
  assert.equal(schemas.checkoutSchema.safeParse({ ...checkout, shippingAddress }).success, false);
  assert.equal(schemas.checkoutSchema.safeParse({ ...checkout, shippingQuoteId: "quote_1" }).success, false);
});

test("quote requests carry cart items and payment method so the API can derive money", () => {
  const schema = (schemas as any).checkoutShippingQuoteRequestSchema;
  assert.ok(schema, "authoritative cart quote schema is required");
  const parsed = schema.parse({ items: checkout.items, paymentMethod: "paymob", shippingAddress, productsTotalCents: 1 });
  assert.deepEqual(parsed, { items: checkout.items, paymentMethod: "paymob", shippingAddress });
  assert.equal(schema.safeParse({ shippingAddress, paymentMethod: "cod", productsTotalCents: 3500 }).success, false);
});

test("a genuinely free COD order remains a valid shared response", () => {
  assert.equal(schemas.checkoutResponseSchema.safeParse({ kind: "cod_order", id: 1, orderCode: "ABCD-001", paymentStatus: "accepted" }).success, true);
});
test("carrier city names are allowed with shipping ids while legacy governorates stay validated", () => {
  assert.equal(schemas.checkoutSchema.safeParse({ ...checkout, governorate: "Carrier city name", shippingAddress, shippingQuoteId: "quote_1" }).success, true);
  assert.equal(schemas.checkoutSchema.safeParse({ ...checkout, governorate: "Carrier city name" }).success, false);
});
