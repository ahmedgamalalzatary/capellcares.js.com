import assert from "node:assert/strict";
import test from "node:test";

import * as schemas from "../src/schemas/index.js";

test("reviewSubmissionSchema requires a 1-5 rating and allows an omitted comment", () => {
  const reviewSubmissionSchema = Reflect.get(schemas, "reviewSubmissionSchema") as
    | { safeParse(value: unknown): { success: boolean } }
    | undefined;

  assert.ok(reviewSubmissionSchema, "reviewSubmissionSchema should be exported");
  assert.equal(reviewSubmissionSchema.safeParse({ entityType: "product", entityId: 1, rating: 5 }).success, true);
  assert.equal(reviewSubmissionSchema.safeParse({ entityType: "offer", entityId: 1, rating: 0 }).success, false);
  assert.equal(reviewSubmissionSchema.safeParse({ entityType: "collection", entityId: 1, rating: 6 }).success, false);
});

test("reviewSubmissionSchema accepts an optional trimmed comment and rejects unsupported entities", () => {
  const reviewSubmissionSchema = Reflect.get(schemas, "reviewSubmissionSchema") as
    | { safeParse(value: unknown): { success: boolean; data?: { comment?: string } } }
    | undefined;

  assert.ok(reviewSubmissionSchema, "reviewSubmissionSchema should be exported");
  const parsed = reviewSubmissionSchema.safeParse({ entityType: "product", entityId: 1, rating: 4, comment: "  useful  " });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.comment, "useful");
  assert.equal(reviewSubmissionSchema.safeParse({ entityType: "variant", entityId: 1, rating: 4 }).success, false);
});
