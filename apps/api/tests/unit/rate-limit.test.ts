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

// Records every full-map traversal so "does not scan" can be observed rather than inferred from an entry surviving.
class IterationCountingMap extends Map<string, RateLimitBucket> {
  iterations = 0;

  override [Symbol.iterator](): MapIterator<[string, RateLimitBucket]> {
    this.iterations += 1;
    return super[Symbol.iterator]();
  }

  override entries(): MapIterator<[string, RateLimitBucket]> {
    this.iterations += 1;
    return super.entries();
  }

  override values(): MapIterator<RateLimitBucket> {
    this.iterations += 1;
    return super.values();
  }

  override keys(): MapIterator<string> {
    this.iterations += 1;
    return super.keys();
  }

  override forEach(callbackfn: (value: RateLimitBucket, key: string, map: Map<string, RateLimitBucket>) => void): void {
    this.iterations += 1;
    super.forEach(callbackfn);
  }
}

test("evaluateRateLimit never iterates the bucket store, so its cost is independent of key count", () => {
  const buckets = new IterationCountingMap();
  for (let index = 0; index < 50; index += 1) {
    evaluateRateLimit(buckets, `key-${index}`, 0, 1000, 5);
  }
  const afterFilling = buckets.iterations;

  // A request for an unrelated key must neither read the map's entries nor evict an expired bucket belonging to somebody else.
  evaluateRateLimit(buckets, "unrelated", 2000, 1000, 5);
  evaluateRateLimit(buckets, "unrelated", 2001, 1000, 5);

  assert.equal(buckets.iterations, afterFilling, "evaluateRateLimit must not traverse the store");
  assert.equal(buckets.has("key-0"), true, "an expired bucket for another key must survive");
  assert.equal(evaluateRateLimit(buckets, "unrelated", 2002, 1000, 5).allowed, true);
});

test("pruneExpiredBuckets does iterate the store, unlike evaluateRateLimit", () => {
  const buckets = new IterationCountingMap();
  evaluateRateLimit(buckets, "stale", 0, 1000, 5);

  const before = buckets.iterations;
  pruneExpiredBuckets(buckets, 2500);

  assert.ok(buckets.iterations > before, "the periodic cleaner is the component that scans");
});

test("pruneExpiredBuckets removes only expired entries", () => {
  const buckets = new Map<string, RateLimitBucket>();
  evaluateRateLimit(buckets, "stale", 0, 1000, 5);
  evaluateRateLimit(buckets, "fresh", 2000, 1000, 5);

  pruneExpiredBuckets(buckets, 2500);

  assert.equal(buckets.has("stale"), false);
  assert.equal(buckets.has("fresh"), true);
});
