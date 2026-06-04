import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRateLimit,
  pruneExpiredBuckets,
  type RateLimitBucket
} from "../../src/middlewares/rate-limit.middleware.js";

test("evaluateRateLimit allows requests under the limit and blocks at the cap", () => {
  const buckets = new Map<string, RateLimitBucket>();
  assert.equal(evaluateRateLimit(buckets, "a", 0, 1000, 2).allowed, true);
  assert.equal(evaluateRateLimit(buckets, "a", 1, 1000, 2).allowed, true);
  assert.equal(evaluateRateLimit(buckets, "a", 2, 1000, 2).allowed, false);
});

test("evaluateRateLimit resets the window after expiry", () => {
  const buckets = new Map<string, RateLimitBucket>();
  evaluateRateLimit(buckets, "a", 0, 1000, 1);
  assert.equal(evaluateRateLimit(buckets, "a", 5, 1000, 1).allowed, false);
  assert.equal(evaluateRateLimit(buckets, "a", 1001, 1000, 1).allowed, true);
});

test("evaluateRateLimit is O(1): it does not scan or evict unrelated keys", () => {
  const buckets = new Map<string, RateLimitBucket>();
  evaluateRateLimit(buckets, "stale", 0, 1000, 5);
  assert.equal(buckets.has("stale"), true);

  // A request for a different key must not touch the stale entry (no full scan).
  evaluateRateLimit(buckets, "fresh", 2000, 1000, 5);
  assert.equal(buckets.has("stale"), true);
  assert.equal(buckets.has("fresh"), true);
});

test("pruneExpiredBuckets removes only expired entries", () => {
  const buckets = new Map<string, RateLimitBucket>();
  evaluateRateLimit(buckets, "stale", 0, 1000, 5);
  evaluateRateLimit(buckets, "fresh", 2000, 1000, 5);

  pruneExpiredBuckets(buckets, 2500);

  assert.equal(buckets.has("stale"), false);
  assert.equal(buckets.has("fresh"), true);
});
