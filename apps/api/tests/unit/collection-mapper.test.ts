import assert from "node:assert/strict";
import test from "node:test";

import { toCollectionBase } from "../../src/modules/collections/collection-mapper.shared.js";

test("toCollectionBase maps the optional YouTube URL", () => {
  const collection = toCollectionBase({
    id: 9,
    slug: "routine",
    arName: "Routine",
    enName: "Routine",
    arDescription: null,
    enDescription: null,
    youtubeUrl: "https://www.youtube.com/watch?v=routine",
    imagePath: null,
    fixedPrice: "100",
    categoryId: 2,
    stock: 1,
    status: "active",
    visibility: "visible",
    items: []
  }, 120);

  assert.equal(collection.youtubeUrl, "https://www.youtube.com/watch?v=routine");
});

test("toCollectionBase omits a missing YouTube URL", () => {
  const collection = toCollectionBase({
    id: 10,
    slug: "routine-without-video",
    arName: "Routine",
    enName: "Routine",
    arDescription: null,
    enDescription: null,
    youtubeUrl: null,
    imagePath: null,
    fixedPrice: "100",
    categoryId: 2,
    stock: 1,
    status: "active",
    visibility: "visible",
    items: []
  }, 120);

  assert.equal(collection.youtubeUrl, undefined);
});
