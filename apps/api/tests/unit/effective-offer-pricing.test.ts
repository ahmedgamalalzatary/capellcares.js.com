import assert from "node:assert/strict";
import test from "node:test";

import {
  findSingleVariantActiveOfferPriceByVariantId,
  isSingleVariantActiveOffer
} from "../../src/modules/offers/effective-offer-pricing.js";

test("isSingleVariantActiveOffer accepts only active one-item qty-1 offers", () => {
  assert.equal(
    isSingleVariantActiveOffer({
      status: "active",
      fixedPrice: "80.00",
      items: [{ variantId: 11, qty: 1 }]
    }),
    true
  );
  assert.equal(
    isSingleVariantActiveOffer({
      status: "inactive",
      fixedPrice: "80.00",
      items: [{ variantId: 11, qty: 1 }]
    }),
    false
  );
  assert.equal(
    isSingleVariantActiveOffer({
      status: "active",
      fixedPrice: "80.00",
      items: [{ variantId: 11, qty: 2 }]
    }),
    false
  );
  assert.equal(
    isSingleVariantActiveOffer({
      status: "active",
      fixedPrice: "80.00",
      items: [{ variantId: 11, qty: 1 }, { variantId: 12, qty: 1 }]
    }),
    false
  );
});

test("findSingleVariantActiveOfferPriceByVariantId returns qualifying offer prices by variant id", () => {
  const prices = findSingleVariantActiveOfferPriceByVariantId([
    {
      id: 1,
      status: "active",
      fixedPrice: "75.50",
      items: [{ variantId: 11, qty: 1 }]
    },
    {
      id: 2,
      status: "inactive",
      fixedPrice: "60.00",
      items: [{ variantId: 12, qty: 1 }]
    },
    {
      id: 3,
      status: "active",
      fixedPrice: "50.00",
      items: [{ variantId: 13, qty: 2 }]
    }
  ]);

  assert.deepEqual([...prices.entries()], [[11, 75.5]]);
});

