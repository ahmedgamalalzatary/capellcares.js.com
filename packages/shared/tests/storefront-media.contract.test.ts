import assert from "node:assert/strict";
import test from "node:test";

import { storefrontCollectionContract } from "./contracts/collection.contract.js";
import { storefrontOfferContract } from "./contracts/offer.contract.js";
import { storefrontProductContract } from "./contracts/product.contract.js";

const mediaContracts = [
  storefrontProductContract.shape.media,
  storefrontOfferContract.shape.media,
  storefrontCollectionContract.shape.media
];

test("storefront entity contracts require at least one non-empty localized image URL", () => {
  for (const mediaContract of mediaContracts) {
    assert.equal(mediaContract.safeParse([
      { type: "image", arUrl: null, enUrl: null }
    ]).success, false);
    assert.equal(mediaContract.safeParse([
      { type: "image", arUrl: "", enUrl: null }
    ]).success, false);
    assert.equal(mediaContract.safeParse([
      { type: "image", arUrl: null, enUrl: "/uploads/en.jpg" }
    ]).success, true);
  }
});
