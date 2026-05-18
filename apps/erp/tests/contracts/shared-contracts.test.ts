import { describe, it } from "vitest";

import {
  assertConformsTo,
  assertForbiddenFieldsAbsent,
  storefrontCategoryContract,
  storefrontOfferContract,
  storefrontProductContract
} from "@capella/shared/tests/contracts";
import { categories, offers, products } from "@capella/shared/mock";

describe("ERP shared contract checks", () => {
  it("accepts storefront product-compatible DTOs without buyingPrice leakage", () => {
    const { buyingPrice: _buyingPrice, ...storefrontProduct } = products[0]!;
    assertConformsTo(storefrontProduct, storefrontProductContract);
    assertForbiddenFieldsAbsent(storefrontProduct, ["buyingPrice"]);
  });

  it("accepts storefront offer-compatible DTOs", () => {
    assertConformsTo(offers[0], storefrontOfferContract);
  });

  it("accepts storefront category-compatible DTOs", () => {
    assertConformsTo(categories[0], storefrontCategoryContract);
  });
});
