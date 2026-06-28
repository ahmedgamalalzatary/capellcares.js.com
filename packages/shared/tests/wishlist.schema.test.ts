import test from "node:test";
import assert from "node:assert/strict";
import { wishlistItemSchema } from "../src/schemas/wishlist.schema.ts";

test("wishlistItemSchema preserves optional createdAt when present", () => {
  const result = wishlistItemSchema.safeParse({
    id: 1,
    customerId: 1,
    entityType: "product",
    entityId: 1,
    createdAt: "2026-06-28T10:00:00.000Z"
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.createdAt, "2026-06-28T10:00:00.000Z");
});
