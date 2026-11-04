import assert from "node:assert/strict";
import test from "node:test";

import { parseCheckoutBody } from "../../src/modules/checkout/checkout.schemas.js";

const valid = {
  fullName: "Test User",
  phone: "55123456",
  email: "test@example.com",
  areaId: 7,
  addressLine: "Block 3, Street 10",
  buildingApartment: "Building 2, Apt 5",
  paymentMethod: "cod",
  items: [{ type: "product", variantId: 123, qty: 2 }]
};

test("parseCheckoutBody accepts a COD checkout with a delivery area", () => {
  const parsed = parseCheckoutBody({ ...valid, customerId: 42, expectedAmountFils: 2250 });

  assert.equal(parsed.areaId, 7);
  assert.equal(parsed.buildingApartment, "Building 2, Apt 5");
  assert.equal(parsed.customerId, 42);
  assert.equal(parsed.expectedAmountFils, 2250);
  assert.equal(parsed.items[0]?.type, "product");
});

test("parseCheckoutBody requires a delivery area id", () => {
  const { areaId: _areaId, ...withoutArea } = valid;
  assert.throws(() => parseCheckoutBody(withoutArea), /areaId/i);
  assert.throws(() => parseCheckoutBody({ ...valid, areaId: "7" }), /areaId/i);
});

test("parseCheckoutBody rejects invalid item id types", () => {
  assert.throws(
    () => parseCheckoutBody({ ...valid, items: [{ type: "product", variantId: "123", qty: 2 }] }),
    /variantId/i
  );
});

test("parseCheckoutBody accepts Kuwaiti mobiles with and without the country code", () => {
  for (const phone of ["55123456", "65123456", "95123456", "+96555123456", "0096555123456"]) {
    assert.equal(parseCheckoutBody({ ...valid, phone }).phone, phone);
  }
});

test("parseCheckoutBody rejects non-Kuwaiti or malformed phone numbers", () => {
  for (const phone of ["01012345678", "25123456", "5512345", "551234567", "+2055123456"]) {
    assert.throws(() => parseCheckoutBody({ ...valid, phone }), /phone/i, phone);
  }
});
