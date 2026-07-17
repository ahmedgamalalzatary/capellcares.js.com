import assert from "node:assert/strict";
import test from "node:test";

import { GOVERNORATES, GOVERNORATE_LABELS } from "../src/constants/payment-methods.js";

test("every governorate has ar and en display labels", () => {
  for (const governorate of GOVERNORATES) {
    const labels = GOVERNORATE_LABELS[governorate];
    assert.ok(labels, `missing labels for ${governorate}`);
    assert.ok(labels.ar.trim().length > 0, `empty ar label for ${governorate}`);
    // The English label doubles as the API enum value.
    assert.equal(labels.en, governorate);
  }
  assert.equal(Object.keys(GOVERNORATE_LABELS).length, GOVERNORATES.length);
});
