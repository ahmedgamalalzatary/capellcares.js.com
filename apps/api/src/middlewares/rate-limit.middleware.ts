import type { Request, Response, NextFunction } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  key?: (req: Request) => string;
};

export type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Evaluate (and mutate) a rate-limit bucket store for one request in O(1): only
 * the caller's own bucket is inspected. An expired bucket for the same key is
 * lazily reset. Bounding the map across many distinct keys is handled out of
 * band by the periodic cleaner (see pruneExpiredBuckets), so request handling
 * never pays for a full-map scan.
 */
export function evaluateRateLimit(
  store: Map<string, RateLimitBucket>,
  key: string,
  now: number,
  windowMs: number,
  max: number
): { allowed: boolean } {
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= max) {
    return { allowed: false };
  }

  current.count += 1;
  return { allowed: true };
}

/** Remove all expired buckets. Called periodically to bound memory. */
export function pruneExpiredBuckets(store: Map<string, RateLimitBucket>, now: number) {
  for (const [bucketKey, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(bucketKey);
    }
  }
}

function ensureCleanupScheduled() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => pruneExpiredBuckets(buckets, Date.now()), CLEANUP_INTERVAL_MS);
  // Do not keep the event loop alive solely for cleanup (tests, graceful exit).
  cleanupTimer.unref?.();
}

export function rateLimit(options: RateLimitOptions) {
  ensureCleanupScheduled();
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = options.key?.(req) ?? req.ip ?? "unknown";
    const key = `${options.keyPrefix}:${identity}`;
    const { allowed } = evaluateRateLimit(buckets, key, Date.now(), options.windowMs, options.max);

    if (!allowed) {
      return res.status(429).json({ message: "Too many requests" });
    }

    return next();
  };
}

export function authRateLimitKey(req: Request) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${req.ip ?? "unknown"}:${email}`;
}
