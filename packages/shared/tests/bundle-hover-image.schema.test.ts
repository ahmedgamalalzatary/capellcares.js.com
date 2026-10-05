import test from "node:test";
import assert from "node:assert/strict";
import type { ZodTypeAny } from "zod";
import { hoverImageSchema } from "../src/schemas/hover-image.schema.ts";
import { offerSchema } from "../src/schemas/offer.schema.ts";
import { collectionSchema } from "../src/schemas/collection.schema.ts";
import { productSchema } from "../src/schemas/product.schema.ts";

test("hoverImageSchema accepts nullable localized hover paths", () => {
  assert.equal(hoverImageSchema.safeParse({ hoverImagePath: null }).success, true);
  assert.equal(
    hoverImageSchema.safeParse({
      hoverImagePath: "/uploads/hover.jpg",
      arHoverImagePath: "/uploads/hover-ar.jpg",
      enHoverImagePath: "/uploads/hover-en.jpg"
    }).success,
    true
  );
});

test("offer and collection schemas carry the shared hover-image fields like products", () => {
  const schemas = { product: productSchema.shape, offer: offerSchema.shape, collection: collectionSchema.shape };

  for (const [name, shape] of Object.entries(schemas) as Array<[string, Record<string, ZodTypeAny>]>) {
    const hover = shape.hoverImagePath;
    assert.ok(hover, `expected hoverImagePath on the ${name} schema`);
    assert.equal(hover.safeParse("/uploads/hover.jpg").success, true);
    assert.equal(hover.safeParse(null).success, true);
    assert.equal(hover.safeParse(3).success, false);

    const arHover = shape.arHoverImagePath;
    assert.ok(arHover, `expected arHoverImagePath on the ${name} schema`);
    assert.equal(arHover.safeParse(undefined).success, true);
    assert.equal(arHover.safeParse("/uploads/hover-ar.jpg").success, true);
    assert.equal(arHover.safeParse(null).success, true);
  }
});
