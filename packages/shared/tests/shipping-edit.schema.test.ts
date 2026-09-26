import assert from "node:assert/strict";
import test from "node:test";
import * as schemas from "../src/schemas/shipping.schema.js";

function editSchema() {
  const schema = (schemas as Record<string, any>).shipmentEditSchema;
  assert.ok(schema, "strict no-money shipment edit contract is required");
  return schema;
}
test("shipment edits accept recipient, full supported address, notes and package size", () => {
  const result = editSchema().parse({ recipient: { fullName: "Corrected name", phone: "01012345678" },
    address: { cityId: "city", zoneId: "zone", districtId: "district", addressLine: "Street", buildingApartment: "2" },
    notes: " Notes as written\n", size: "medium" });
  assert.equal(result.notes, " Notes as written\n");
  assert.equal(result.size, "medium");
  assert.equal(editSchema().safeParse({ recipient: { phone: "01012345678" } }).success, true);
});
test("shipment edits reject items, quantities and every customer money/quote field even at the same value", () => {
  for (const key of ["items", "qty", "variantId", "totalAmount", "shippingAmountCents", "shippingQuoteId", "shippingSize",
    "shippingSnapshot", "cod", "collection", "paymentMethod", "paymentStatus", "providerPaymentStatus", "refundedAmountCents", "manualState"]) {
    assert.equal(editSchema().safeParse({ notes: "Edit", [key]: 0 }).success, false, key);
  }
  assert.equal(editSchema().safeParse({ recipient: { fullName: "Buyer", cod: 100 } }).success, false);
  assert.equal(editSchema().safeParse({ address: { cityId: "c", zoneId: "z", districtId: "d", addressLine: "Street", buildingApartment: "1", shippingAmountCents: 0 } }).success, false);
});
test("shipment edits reject empty, malformed and unsupported changes", () => {
  for (const body of [{}, { recipient: {} }, { recipient: { fullName: " " } }, { recipient: { phone: "bad" } },
    { address: { addressLine: "Street" } }, { size: "SMALL" }, { notes: "x".repeat(4001) }, { verified: true, notes: "Edit" }]) {
    assert.equal(editSchema().safeParse(body).success, false);
  }
});
