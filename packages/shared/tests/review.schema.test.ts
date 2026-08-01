import assert from "node:assert/strict";
import test from "node:test";

import * as schemas from "../src/schemas/index.js";
import { ar } from "../src/i18n/ar.js";
import { en } from "../src/i18n/en.js";

test("reviewCreateSchema accepts and trims a valid review", () => {
  const reviewCreateSchema = (schemas as typeof schemas & {
    reviewCreateSchema?: { parse: (input: unknown) => unknown };
  }).reviewCreateSchema;
  assert.ok(reviewCreateSchema, "reviewCreateSchema must be exported");

  assert.deepEqual(
    reviewCreateSchema.parse({
      entityType: "product",
      entityId: 12,
      rating: 5,
      comment: "  Excellent product  "
    }),
    {
      entityType: "product",
      entityId: 12,
      rating: 5,
      comment: "Excellent product"
    }
  );
});

test("reviewCreateSchema enforces target, whole-star, and comment limits", () => {
  const reviewCreateSchema = (schemas as typeof schemas & {
    reviewCreateSchema?: { safeParse: (input: unknown) => { success: boolean } };
  }).reviewCreateSchema;
  assert.ok(reviewCreateSchema, "reviewCreateSchema must be exported");

  const validBase = { entityType: "offer", entityId: 1, rating: 4, comment: "Good" };
  const invalidInputs = [
    { ...validBase, entityType: "category" },
    { ...validBase, entityId: 0 },
    { ...validBase, entityId: 1.5 },
    { ...validBase, rating: 0 },
    { ...validBase, rating: 6 },
    { ...validBase, rating: 4.5 },
    { ...validBase, comment: "ok" },
    { ...validBase, comment: "x".repeat(1001) }
  ];

  for (const input of invalidInputs) {
    assert.equal(reviewCreateSchema.safeParse(input).success, false, JSON.stringify(input));
  }
});

test("the permanent review-prompt dismissal uses permanent wording", () => {
  assert.equal(en.reviews.dismiss, "No thanks");
  assert.equal(ar.reviews.dismiss, "لا شكرًا");
});
