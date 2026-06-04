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

/**
 * Evaluate (and mutate) a rate-limit bucket store for one request. Expired
 * buckets are pruned on each call so the in-memory map cannot grow unbounded
 * under high-cardinality traffic.
 */
export function evaluateRateLimit(
  store: Map<string, RateLimitBucket>,
  key: string,
  now: number,
  windowMs: number,
  max: number
): { allowed: boolean } {
  for (const [bucketKey, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(bucketKey);
    }
  }

  const current = store.get(key);
  if (!current) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= max) {
    return { allowed: false };
  }

  current.count += 1;
  return { allowed: true };
}

export function rateLimit(options: RateLimitOptions) {
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
