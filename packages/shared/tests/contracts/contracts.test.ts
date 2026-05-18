import test from "node:test";

import { categories } from "../../src/mock/categories.js";
import { offers } from "../../src/mock/offers.js";
import { products } from "../../src/mock/products.js";
import {
  assertConformsTo,
  assertForbiddenFieldsAbsent,
  storefrontCategoryContract,
  storefrontOfferContract,
  storefrontProductContract
} from "./index.js";

test("product contract accepts storefront product shape and rejects buyingPrice leaks", () => {
  const product = products[0]!;
  const { buyingPrice: _buyingPrice, ...storefrontProduct } = product;
  assertConformsTo(storefrontProduct, storefrontProductContract);
  assertForbiddenFieldsAbsent(
    storefrontProduct,
    ["buyingPrice"]
  );
});

test("offer contract accepts storefront offer shape", () => {
  assertConformsTo(offers[0], storefrontOfferContract);
});

test("category contract accepts storefront category shape", () => {
  assertConformsTo(categories[0], storefrontCategoryContract);
});
