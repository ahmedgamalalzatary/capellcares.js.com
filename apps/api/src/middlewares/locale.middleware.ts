import type { NextFunction, Request, Response } from "express";
import type { Language } from "../types/domain.js";

export type LocalizedRequest = Request & { locale?: Language };

export function localeMiddleware(req: Request, _res: Response, next: NextFunction) {
  const localizedReq = req as LocalizedRequest;
  const lang = String(req.headers["x-lang"] ?? "ar").toLowerCase();
  localizedReq.locale = lang === "en" ? "en" : "ar";
  next();
}
