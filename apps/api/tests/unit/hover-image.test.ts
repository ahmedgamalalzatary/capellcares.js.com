import assert from "node:assert/strict";
import test from "node:test";

import {
  parseHoverImageInput,
  resolveHoverImageUpdate
} from "../../src/modules/shared/hover-image/hover-image.js";

test("resolveHoverImageUpdate leaves both columns untouched when the payload omits hover fields", () => {
  const update = resolveHoverImageUpdate({});
  assert.equal(update.hasEnHoverUpdate, false);
  assert.equal(update.hasArHoverUpdate, false);
});

test("resolveHoverImageUpdate seeds the English column from a legacy hover value", () => {
  const update = resolveHoverImageUpdate({ hoverImagePath: "/uploads/legacy.jpg" });
  assert.equal(update.hasEnHoverUpdate, true);
  assert.equal(update.enHoverImagePath, "/uploads/legacy.jpg");
  assert.equal(update.hasArHoverUpdate, false);
});

test("resolveHoverImageUpdate preserves an explicitly null English value", () => {
  const update = resolveHoverImageUpdate({ enHoverImagePath: null });
  assert.equal(update.hasEnHoverUpdate, true);
  assert.equal(update.enHoverImagePath, null);
});

test("resolveHoverImageUpdate preserves an explicitly null Arabic value", () => {
  const update = resolveHoverImageUpdate({ arHoverImagePath: null });
  assert.equal(update.hasArHoverUpdate, true);
  assert.equal(update.arHoverImagePath, null);
});

test("parseHoverImageInput keeps omitted fields, explicit nulls, and strings apart", () => {
  assert.deepEqual(parseHoverImageInput({}), {
    hoverImagePath: undefined,
    arHoverImagePath: undefined,
    enHoverImagePath: undefined
  });
  assert.deepEqual(parseHoverImageInput({ enHoverImagePath: null }), {
    hoverImagePath: undefined,
    arHoverImagePath: undefined,
    enHoverImagePath: null
  });
  assert.deepEqual(parseHoverImageInput({ arHoverImagePath: "/uploads/ar.jpg" }), {
    hoverImagePath: undefined,
    arHoverImagePath: "/uploads/ar.jpg",
    enHoverImagePath: undefined
  });
});

test("parseHoverImageInput rejects non-string hover values", () => {
  for (const value of [123, true, { url: "/uploads/x.jpg" }, ["/uploads/x.jpg"], { toString: 123 }]) {
    assert.throws(
      () => parseHoverImageInput({ enHoverImagePath: value }),
      (error: NodeJS.ErrnoException & { code?: string }) => error.code === "INVALID_HOVER_IMAGE",
      `expected a value to be rejected`
    );
  }
});

test("parseHoverImageInput rejects string values that are not image paths or URLs", () => {
  for (const value of [
    "123",
    "not a path with spaces",
    // Whitespace is rejected consistently for relative paths and http(s) URLs alike.
    "https://cdn.example.com/hover image.jpg",
    "javascript:alert(1)",
    "uploads/relative.jpg",
    "   ",
    // Protocol-relative URLs are rejected by Next Image.
    "//cdn.example.com/hover.jpg",
    // A malformed URL must not reach the storefront.
    "https://[",
    // Control characters must be rejected even inside an otherwise valid path.
    "/uploads/a\u0000.jpg"
  ]) {
    assert.throws(
      () => parseHoverImageInput({ enHoverImagePath: value }),
      (error: NodeJS.ErrnoException & { code?: string }) => error.code === "INVALID_HOVER_IMAGE",
      `expected a value to be rejected`
    );
  }
});

test("parseHoverImageInput accepts upload paths, http(s) URLs, and empty/null clears", () => {
  for (const value of ["/uploads/hover.jpg", "https://cdn.example.com/hover.jpg", "http://cdn.example.com/hover.jpg", ""]) {
    assert.doesNotThrow(() => parseHoverImageInput({ enHoverImagePath: value }), `expected ${String(value)} to be accepted`);
  }
  assert.equal(parseHoverImageInput({ enHoverImagePath: "" }).enHoverImagePath, "");
  assert.equal(parseHoverImageInput({ enHoverImagePath: null }).enHoverImagePath, null);
});

test("parseHoverImageInput rejects oversized hover values", () => {
  assert.throws(
    () => parseHoverImageInput({ arHoverImagePath: `https://example.com/${"a".repeat(1024)}` }),
    (error: NodeJS.ErrnoException & { code?: string }) => error.code === "INVALID_HOVER_IMAGE"
  );
});
