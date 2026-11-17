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
  /** Set once the window has refused a request, so only the first refusal is logged. */
  blocked?: boolean;
};

const buckets = new Map<string, RateLimitBucket>();

const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/** Evaluate (and mutate) a rate-limit bucket store for one request in O(1) — only the caller's own bucket is inspected and an expired bucket for the same key is lazily reset; bounding the map across many keys is handled out of band by the periodic cleaner (pruneExpiredBuckets), so request handling never pays for a full-map scan. */
export function evaluateRateLimit(
  store: Map<string, RateLimitBucket>,
  key: string,
  now: number,
  windowMs: number,
  max: number
): { allowed: true } | { allowed: false; firstBlock: boolean } {
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= max) {
    const firstBlock = !current.blocked;
    current.blocked = true;
    return { allowed: false, firstBlock };
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
    const result = evaluateRateLimit(buckets, key, Date.now(), options.windowMs, options.max);

    if (!result.allowed) {
      // One line per offender per window: enough to spot brute-force or abuse in the logs without letting an attacker flood them.
      if (result.firstBlock) console.warn(`Rate limit hit: ${options.keyPrefix} from ${req.ip ?? "unknown"} on ${req.method} ${req.path}`);
      return res.status(429).json({ message: "Too many requests" });
    }

    return next();
  };
}

export function authRateLimitKey(req: Request) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${req.ip ?? "unknown"}:${email}`;
}
