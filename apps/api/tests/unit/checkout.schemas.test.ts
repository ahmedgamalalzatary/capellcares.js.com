import assert from "node:assert/strict";
import test from "node:test";

import { parseCheckoutBody } from "../../src/modules/checkout/checkout.schemas.js";

test("parseCheckoutBody accepts COD checkout payload with API field names", () => {
  const parsed = parseCheckoutBody({
    fullName: "Test User",
    phone: "01012345678",
    email: "test@example.com",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 2, Apt 5",
    paymentMethod: "cod",
    customerId: 42,
    items: [{ type: "product", variantId: 123, qty: 2 }]
  });

  assert.equal(parsed.cityArea, "Nasr City");
  assert.equal(parsed.buildingApartment, "Building 2, Apt 5");
  assert.equal(parsed.customerId, 42);
  assert.equal(parsed.items[0]?.type, "product");
});

test("parseCheckoutBody rejects storefront-legacy field names and invalid item id types", () => {
  assert.throws(
    () =>
      parseCheckoutBody({
        fullName: "Test User",
        phone: "01012345678",
        email: "test@example.com",
        governorate: "Cairo",
        city: "Nasr City",
        addressLine: "Street 10",
        building: "Building 2, Apt 5",
        paymentMethod: "cod",
        items: [{ type: "product", variantId: "123", qty: 2 }]
      }),
    /cityArea|buildingApartment|variantId/i
  );
});

test("parseCheckoutBody accepts Egyptian numbers with the 0020 prefix", () => {
  const parsed = parseCheckoutBody({
    fullName: "Prefix User",
    phone: "00201012345678",
    email: "prefix@example.com",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 2, Apt 5",
    paymentMethod: "cod",
    items: [{ type: "product", variantId: 123, qty: 2 }]
  });

  assert.equal(parsed.phone, "00201012345678");
});

test("parseCheckoutBody rejects malformed Egyptian phone numbers", () => {
  assert.throws(
    () =>
      parseCheckoutBody({
        fullName: "Bad Phone User",
        phone: "01912345678",
        email: "bad-phone@example.com",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 2, Apt 5",
        paymentMethod: "cod",
        items: [{ type: "product", variantId: 123, qty: 2 }]
      }),
    /phone/i
  );
});

test("parseCheckoutBody rejects governorates outside the canonical list", () => {
  assert.throws(
    () =>
      parseCheckoutBody({
        fullName: "Bad Governorate User",
        phone: "01012345678",
        email: "bad-governorate@example.com",
        governorate: "NotARealGovernorate",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 2, Apt 5",
        paymentMethod: "cod",
        items: [{ type: "product", variantId: 123, qty: 2 }]
      }),
    /governorate/i
  );
});
