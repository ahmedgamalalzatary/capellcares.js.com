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
    stock: 4,
    status: "active",
    items: [{ variantId: 11, qty: 2 }]
  }, 180);

  assert.deepEqual(offer, {
    id: 7,
    slug: "spring-bundle",
    name: { ar: "باقة الربيع", en: "Spring Bundle" },
    description: { ar: "", en: "Fresh picks" },
    imagePath: "",
    price: 125.5,
    originalTotal: 180,
    stock: 4,
    items: [{ id: undefined, variantId: 11, qty: 2 }],
    status: "active"
  });
});
