import test from "node:test";
import assert from "node:assert/strict";
import { collectionSchema } from "../src/schemas/collection.schema.ts";
import { offerSchema } from "../src/schemas/offer.schema.ts";
import { nullableYouTubeUrlSchema } from "../src/schemas/youtube-url.schema.ts";

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
    youtubeUrl: "https://www.youtube.com/watch?v=offer",
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
  assert.equal(parsed.youtubeUrl, "https://www.youtube.com/watch?v=offer");
});

test("collectionSchema preserves an ordered media gallery", () => {
  const parsed = collectionSchema.parse({
    id: 1,
    slug: "summer-collection",
    arName: "مجموعة الصيف",
    enName: "Summer collection",
    arDescription: null,
    enDescription: null,
    youtubeUrl: "https://www.youtube.com/watch?v=collection",
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
  assert.equal(parsed.youtubeUrl, "https://www.youtube.com/watch?v=collection");
});

test("collections and offers share the nullable YouTube URL validator", () => {
  assert.equal(collectionSchema.shape.youtubeUrl, nullableYouTubeUrlSchema);
  assert.equal(offerSchema.shape.youtubeUrl, nullableYouTubeUrlSchema);
  assert.equal(nullableYouTubeUrlSchema.parse(null), null);
});

test("YouTube URL validator accepts every gallery-supported YouTube form", () => {
  const maximumLengthUrl = `https://youtu.be/${"a".repeat(1007)}`;
  const urls = [
    "https://youtu.be/capella",
    "https://www.youtube.com/watch?v=capella",
    "https://m.youtube.com/shorts/capella",
    "http://youtube.com/embed/capella",
    maximumLengthUrl
  ];

  assert.equal(maximumLengthUrl.length, 1024);
  for (const url of urls) {
    assert.equal(nullableYouTubeUrlSchema.parse(url), url);
  }
});

test("YouTube URL validator rejects unsupported hosts, forms, and oversized values", () => {
  const oversizedUrl = `https://youtu.be/${"a".repeat(1008)}`;
  const urls = [
    "https://example.com/watch?v=capella",
    "https://notyoutube.com/watch?v=capella",
    "https://youtube.com/channel/capella",
    "https://youtube.com/watch",
    "https://youtu.be/",
    oversizedUrl
  ];

  assert.equal(oversizedUrl.length, 1025);
  for (const url of urls) {
    assert.equal(nullableYouTubeUrlSchema.safeParse(url).success, false, url);
  }
});
