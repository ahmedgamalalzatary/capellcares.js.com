import assert from "node:assert/strict";
import test from "node:test";

import { resolveUploadPermission } from "../../src/modules/uploads/uploads.permissions.js";

test("resolveUploadPermission allows create contexts so new items can upload images", () => {
  assert.equal(resolveUploadPermission("products.create"), "products.create");
  assert.equal(resolveUploadPermission("offers.create"), "offers.create");
  assert.equal(resolveUploadPermission("collections.create"), "collections.create");
  assert.equal(resolveUploadPermission("advices.create"), "advices.create");
});

test("resolveUploadPermission still allows update contexts", () => {
  assert.equal(resolveUploadPermission("products.update"), "products.update");
  assert.equal(resolveUploadPermission("offers.update"), "offers.update");
  assert.equal(resolveUploadPermission("collections.update"), "collections.update");
  assert.equal(resolveUploadPermission("advices.update"), "advices.update");
});

test("resolveUploadPermission rejects unknown, unrelated, or missing contexts", () => {
  assert.equal(resolveUploadPermission("categories.create"), null);
  assert.equal(resolveUploadPermission("products.delete"), null);
  assert.equal(resolveUploadPermission("nonsense"), null);
  assert.equal(resolveUploadPermission(undefined), null);
  assert.equal(resolveUploadPermission(["offers.create"]), null);
});
