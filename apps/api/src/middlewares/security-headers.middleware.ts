import type { NextFunction, Request, Response } from "express";

/** Hardening headers for every API response. The API only serves JSON and uploaded media, so a deny-all CSP is safe here: CSP governs documents, not how another origin embeds an image or video. */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}
