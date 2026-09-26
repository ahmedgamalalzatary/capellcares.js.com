import assert from "node:assert/strict";
import test from "node:test";
import { formatPrice } from "../src/constants/currency.js";
test("customer prices preserve charged cents in English and Arabic", () => {
  assert.match(formatPrice(97.29, "en"), /97\.29/);
  assert.match(formatPrice(97.29, "ar"), /٩٧٫٢٩/);
});
