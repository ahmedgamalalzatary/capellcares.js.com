import assert from "node:assert/strict";
import test from "node:test";

import { toOfferBase } from "../../src/modules/offers/offer-mapper.shared.js";

test("toOfferBase maps common offer fields for shared admin/storefront usage", () => {
  const offer = toOfferBase({
    id: 7,
    slug: "spring-bundle",
    arName: "باقة الربيع",
    enName: "Spring Bundle",
    arDescription: null,
    enDescription: "Fresh picks",
    imagePath: null,
    fixedPrice: "125.50",
    categoryId: 3,
    stock: 4,
    status: "active",
    visibility: "visible",
    items: [{ variantId: 11, qty: 2 }]
  }, 180);

  assert.deepEqual(offer, {
    id: 7,
    slug: "spring-bundle",
    name: { ar: "باقة الربيع", en: "Spring Bundle" },
    description: { ar: "", en: "Fresh picks" },
    imagePath: "",
    media: [],
    price: 125.5,
    originalTotal: 180,
    categoryId: 3,
    stock: 4,
    items: [{ id: undefined, variantId: 11, qty: 2 }],
    status: "active",
    visibility: "visible"
  });
});

test("toOfferBase keeps a legacy offer's missing category as null", () => {
  const offer = toOfferBase({
    id: 8,
    slug: "legacy-bundle",
    arName: "باقة قديمة",
    enName: "Legacy Bundle",
    arDescription: null,
    enDescription: null,
    imagePath: null,
    fixedPrice: "90.00",
    categoryId: null,
    stock: 1,
    status: "inactive",
    visibility: "hidden",
    items: [{ variantId: 12, qty: 1 }]
  }, 120);

  assert.equal(offer.categoryId, null);
  assert.equal(offer.visibility, "hidden");
});
