import test from "node:test";
import assert from "node:assert/strict";
import { productVariantSchema } from "../src/schemas/product.schema.ts";

const baseVariant = {
  id: 1,
  productId: 1,
  sizeLabel: "100ml",
  sellingPrice: 50,
  stockQty: 3,
  sortOrder: 1
};

test("productVariantSchema rejects discount timestamps that are not parseable dates", () => {
  const result = productVariantSchema.safeParse({
    ...baseVariant,
    discount: {
      type: "percentage",
      value: 10,
      startsAt: "not-a-date",
      endsAt: "2026-06-01T12:00:00.000Z",
      status: "active"
    }
  });

  assert.equal(result.success, false);
});

test("productVariantSchema rejects discount ranges where startsAt is not before endsAt", () => {
  const result = productVariantSchema.safeParse({
    ...baseVariant,
    discount: {
      type: "percentage",
      value: 10,
      startsAt: "2026-06-01T12:00:00.000Z",
      endsAt: "2026-06-01T12:00:00.000Z",
      status: "active"
    }
  });

  assert.equal(result.success, false);
});
