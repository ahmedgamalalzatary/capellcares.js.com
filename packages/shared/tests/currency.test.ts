import assert from "node:assert/strict";
import test from "node:test";
import { CURRENCY, formatPrice } from "../src/constants/currency.js";
import { getEffectiveVariantPrice } from "../src/types/index.js";

test("prices are Kuwaiti dinars", () => {
  assert.equal(CURRENCY, "KWD");
  assert.match(formatPrice(5, "en"), /KWD/);
  assert.match(formatPrice(5, "ar"), /د\.ك/);
});

test("customer prices keep all three fils digits in English and Arabic", () => {
  assert.match(formatPrice(97.125, "en"), /97\.125/);
  assert.match(formatPrice(97.125, "ar"), /٩٧٫١٢٥/);
});

test("discounted variant prices round to fils, not cents", () => {
  const discount = { id: 1, type: "percentage" as const, value: 10, startsAt: "2000-01-01", endsAt: "2999-01-01", status: "active" as const };
  assert.equal(getEffectiveVariantPrice({ price: 2.5, discount: { ...discount, type: "fixed" as const, value: 0.125 } } as any), 2.375);
  assert.equal(getEffectiveVariantPrice({ price: 1.25, discount } as any), 1.125);
});
