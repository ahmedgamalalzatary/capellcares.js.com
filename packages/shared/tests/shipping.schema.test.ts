import assert from "node:assert/strict";
import test from "node:test";
import * as schemas from "../src/schemas/shipping.schema.js";

test("shipping money schema rejects decimals and negative amounts", () => {
  const schema = (schemas as { shippingMoneyCentsSchema?: { safeParse: (value: unknown) => { success: boolean } } }).shippingMoneyCentsSchema;
  assert.ok(schema, "shippingMoneyCentsSchema must exist");
  assert.equal(schema.safeParse(9700).success, true);
  assert.equal(schema.safeParse(0).success, true);
  assert.equal(schema.safeParse(97.5).success, false);
  assert.equal(schema.safeParse(-100).success, false);
  assert.equal(schema.safeParse("9700").success, false);
  assert.equal(schema.safeParse(Number.MAX_SAFE_INTEGER + 1).success, false);
});

test("shipment size schema accepts only the three supported sizes", () => {
  const schema = (schemas as { shipmentSizeSchema?: { safeParse: (value: unknown) => { success: boolean } } }).shipmentSizeSchema;
  assert.ok(schema, "shipmentSizeSchema must exist");
  assert.equal(schema.safeParse("small").success, true);
  assert.equal(schema.safeParse("medium").success, true);
  assert.equal(schema.safeParse("large").success, true);
  assert.equal(schema.safeParse("Small").success, false);
  assert.equal(schema.safeParse("xlarge").success, false);
});

test("shipment kind schema separates outgoing, return and exchange movements", () => {
  const schema = (schemas as { shipmentKindSchema?: { safeParse: (value: unknown) => { success: boolean } } }).shipmentKindSchema;
  assert.ok(schema, "shipmentKindSchema must exist");
  assert.equal(schema.safeParse("outgoing").success, true);
  assert.equal(schema.safeParse("return").success, true);
  assert.equal(schema.safeParse("exchange").success, true);
  assert.equal(schema.safeParse("delivery").success, false);
});

test("shipping quote request schema requires supported address ids and a valid products total", () => {
  const schema = (schemas as { shippingQuoteRequestSchema?: { safeParse: (value: unknown) => { success: boolean } } }).shippingQuoteRequestSchema;
  assert.ok(schema, "shippingQuoteRequestSchema must exist");
  assert.equal(schema.safeParse({ cityId: "1", zoneId: "2", districtId: "3", productsTotalCents: 500_000 }).success, true);
  assert.equal(schema.safeParse({ cityId: "1", zoneId: "2", districtId: "3", productsTotalCents: 0 }).success, true);
  assert.equal(schema.safeParse({ cityId: "1", zoneId: "2", districtId: "3", productsTotalCents: -1 }).success, false);
  assert.equal(schema.safeParse({ cityId: "1", zoneId: "2", districtId: "3", productsTotalCents: 10.5 }).success, false);
  assert.equal(schema.safeParse({ cityId: "", zoneId: "2", districtId: "3", productsTotalCents: 100 }).success, false);
  assert.equal(schema.safeParse({ cityId: "1", districtId: "3", productsTotalCents: 100 }).success, false);
});

test("shipping quote response schema carries the server-authoritative quote identity", () => {
  const schema = (schemas as { shippingQuoteResponseSchema?: { safeParse: (value: unknown) => { success: boolean } } }).shippingQuoteResponseSchema;
  assert.ok(schema, "shippingQuoteResponseSchema must exist");
  const valid = {
    quoteId: "quote_123",
    shippingAmountCents: 9700,
    size: "small",
    rateIdentity: "bosta:v2:1:2:3:small:cod",
    quotedAt: "2026-09-26T12:00:00.000Z"
  };
  assert.equal(schema.safeParse(valid).success, true);
  assert.equal(schema.safeParse({ ...valid, shippingAmountCents: -1 }).success, false);
  assert.equal(schema.safeParse({ ...valid, size: "huge" }).success, false);
  assert.equal(schema.safeParse({ ...valid, quoteId: "" }).success, false);
  assert.equal(schema.safeParse({ ...valid, rateIdentity: "" }).success, false);
});

test("shipment state schema keeps provider, normalized and manual states distinct", () => {
  const schema = (schemas as { shipmentStateSchema?: { safeParse: (value: unknown) => { success: boolean } } }).shipmentStateSchema;
  assert.ok(schema, "shipmentStateSchema must exist");
  const valid = {
    rawProviderState: "10",
    rawProviderCode: 10,
    normalizedState: "created",
    manualState: null
  };
  assert.equal(schema.safeParse(valid).success, true);
  assert.equal(schema.safeParse({ ...valid, manualState: "preparing" }).success, true);
  assert.equal(schema.safeParse({ ...valid, manualState: "delivered" }).success, true);
  assert.equal(schema.safeParse({ ...valid, manualState: "collected" }).success, false);
  assert.equal(schema.safeParse({ ...valid, normalizedState: "collected" }).success, false);
  assert.equal(schema.safeParse({ ...valid, rawProviderCode: "10" }).success, false);
});
