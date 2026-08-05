import test from "node:test";
import assert from "node:assert/strict";
import { collectionSchema } from "../src/schemas/collection.schema.ts";
import { offerSchema } from "../src/schemas/offer.schema.ts";

const media = [
  { type: "image" as const, url: "/uploads/primary.jpg" },
  { type: "image" as const, url: "/uploads/detail.jpg" },
  { type: "video" as const, url: "/uploads/demo.mp4" }
];

test("offerSchema preserves an ordered media gallery", () => {
  const parsed = offerSchema.parse({
    id: 1,
    slug: "summer-offer",
    arName: "عرض الصيف",
    enName: "Summer offer",
    arDescription: null,
    enDescription: null,
    imagePath: "/uploads/primary.jpg",
    media,
    fixedPrice: 100,
    categoryId: 3,
    status: "active",
    visibility: "visible",
    deletedAt: null,
    items: []
  });

  assert.deepEqual(parsed.media, media);
});

test("collectionSchema preserves an ordered media gallery", () => {
  const parsed = collectionSchema.parse({
    id: 1,
    slug: "summer-collection",
    arName: "مجموعة الصيف",
    enName: "Summer collection",
    arDescription: null,
    enDescription: null,
    imagePath: "/uploads/primary.jpg",
    media,
    fixedPrice: 100,
    categoryId: 1,
    status: "active",
    visibility: "visible",
    deletedAt: null,
    items: []
  });

  assert.deepEqual(parsed.media, media);
});
