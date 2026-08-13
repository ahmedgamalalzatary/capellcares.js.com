import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeEntityMedia,
  parseEntityMediaInput,
  resolvePrimaryEntityImagePath
} from "../../src/repositories/entity-media.repository.js";
import * as productMedia from "../../src/repositories/product/shared.js";

test("parseEntityMediaInput rejects more than one video", () => {
  assert.throws(
    () => parseEntityMediaInput([
      { type: "video", url: "/uploads/one.mp4" },
      { type: "video", url: "/uploads/two.mp4" }
    ]),
    (error: any) => error?.code === "ENTITY_MEDIA_VIDEO_LIMIT"
  );
});

test("parseEntityMediaInput preserves bilingual images and shared videos", () => {
  assert.deepEqual(parseEntityMediaInput([
    { type: "image", arUrl: " /uploads/ar.jpg ", enUrl: " /uploads/en.jpg " },
    { type: "image", arUrl: null, enUrl: "/uploads/en-only.jpg" },
    { type: "video", url: " /uploads/demo.mp4 " }
  ]), [
    { type: "image", arUrl: "/uploads/ar.jpg", enUrl: "/uploads/en.jpg" },
    { type: "image", arUrl: null, enUrl: "/uploads/en-only.jpg" },
    { type: "video", url: "/uploads/demo.mp4" }
  ]);
});

test("normalizeEntityMedia maps stored English images and optional Arabic images", () => {
  assert.deepEqual(normalizeEntityMedia([
    { mediaType: "image", url: "/uploads/en.jpg", arUrl: "/uploads/ar.jpg", sortOrder: 1 },
    { mediaType: "video", url: "/uploads/demo.mp4", arUrl: null, sortOrder: 2 }
  ], null), [
    {
      type: "image",
      arUrl: "http://localhost:4000/uploads/ar.jpg",
      enUrl: "http://localhost:4000/uploads/en.jpg"
    },
    { type: "video", url: "http://localhost:4000/uploads/demo.mp4" }
  ]);
});

test("resolvePrimaryEntityImagePath localizes with opposite-language fallback", () => {
  const media = [
    { type: "image" as const, arUrl: null, enUrl: "/uploads/en.jpg" },
    { type: "video" as const, url: "/uploads/demo.mp4" }
  ];
  assert.equal(resolvePrimaryEntityImagePath(media, null, "ar"), "/uploads/en.jpg");
  assert.equal(resolvePrimaryEntityImagePath(media, null, "en"), "/uploads/en.jpg");
});

test("product hover image resolution uses the requested language with fallback", () => {
  const resolve = (productMedia as Record<string, unknown>).resolveLocalizedHoverImagePath;
  assert.equal(typeof resolve, "function");
  if (typeof resolve !== "function") return;

  assert.equal(resolve("/uploads/ar-hover.jpg", "/uploads/en-hover.jpg", "ar"), "http://localhost:4000/uploads/ar-hover.jpg");
  assert.equal(resolve(null, "/uploads/en-hover.jpg", "ar"), "http://localhost:4000/uploads/en-hover.jpg");
  assert.equal(resolve("/uploads/ar-hover.jpg", null, "en"), "http://localhost:4000/uploads/ar-hover.jpg");
});
