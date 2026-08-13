import type { Request } from "express";

export function isMobileClient(req: Request): boolean {
  return req.get("x-client") === "mobile" && req.get("origin") === undefined;
}

type RefreshTokenSource = "cookie" | "header" | "body";

function resolveRefreshToken(
  req: Request,
  cookieName: string
): { token: string | undefined; source: RefreshTokenSource | undefined } {
  if (isMobileClient(req)) {
    const headerToken = req.get("x-refresh-token");
    if (headerToken !== undefined) return { token: headerToken, source: "header" };
    const bodyToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
    return { token: bodyToken, source: bodyToken === undefined ? undefined : "body" };
  }

  const cookieToken = req.cookies?.[cookieName];
  if (typeof cookieToken === "string") return { token: cookieToken, source: "cookie" };
  return { token: undefined, source: undefined };
}

export function extractRefreshToken(req: Request, cookieName: string): string | undefined {
  return resolveRefreshToken(req, cookieName).token;
}

export function canExposeRefreshToken(req: Request, cookieName: string): boolean {
  const source = resolveRefreshToken(req, cookieName).source;
  return isMobileClient(req) && (source === "header" || source === "body");
}
