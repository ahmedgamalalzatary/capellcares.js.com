import assert from "node:assert/strict";
import test from "node:test";
import { customerOrderSchema, customerOrdersSchema } from "../src/schemas/customer-api.schema.js";

const summary = {
  id: 7, orderCode: "FT-007", customerType: "registered", customerId: 3,
  fullName: "Buyer", phone: "+96555123456", email: "buyer@example.com", governorate: "Hawalli", cityArea: "Salmiya",
  areaId: 4, addressLine: "Block 1", buildingApartment: "2", notes: null,
  paymentMethod: "cod", paymentStatus: "pending", deliveryFee: 1.5, totalAmount: 12.75,
  createdAt: "2026-11-23T09:00:00.000Z"
};
const item = {
  id: 1, orderId: 7, itemType: "product_variant", variantId: 9, offerId: null, collectionId: null,
  qty: 1, unitPrice: 11.25, lineTotal: 11.25, snapshotNameAr: "لعبة", snapshotNameEn: "Toy", snapshotSizeLabel: null
};

test("a customer order keeps its delivery area and delivery fee", () => {
  const order = customerOrderSchema.parse({ ...summary, items: [item] });
  assert.equal(order.areaId, 4);
  assert.equal(order.deliveryFee, 1.5);
  assert.equal(customerOrdersSchema.parse({ items: [{ ...summary, areaId: null }] }).items[0]?.areaId, null);
});

test("a customer order without a numeric delivery fee or area id is rejected", () => {
  assert.equal(customerOrderSchema.safeParse({ ...summary, deliveryFee: "1.500", items: [item] }).success, false);
  const { deliveryFee: _fee, ...withoutFee } = summary;
  assert.equal(customerOrdersSchema.safeParse({ items: [withoutFee] }).success, false);
  const { areaId: _area, ...withoutArea } = summary;
  assert.equal(customerOrdersSchema.safeParse({ items: [withoutArea] }).success, false);
});
