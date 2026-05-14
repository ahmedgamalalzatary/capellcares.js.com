import type { NextFunction, Request, Response } from "express";
import type { Language } from "../types/domain.js";

declare module "express-serve-static-core" {
  interface Request {
    locale?: Language;
  }
}

export function localeMiddleware(req: Request, _res: Response, next: NextFunction) {
  const lang = String(req.headers["x-lang"] ?? "ar").toLowerCase();
  req.locale = lang === "en" ? "en" : "ar";
  next();
}
