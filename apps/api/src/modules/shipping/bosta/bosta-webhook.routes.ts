import express, { Router, type ErrorRequestHandler } from "express";
import { rateLimit } from "../../../middlewares/rate-limit.middleware.js";
import { resolveBostaSyncRuntime, type BostaSyncRuntime, type BostaObservation } from "./bosta-sync.service.js";
import { recordShippingObservation } from "../../../repositories/shipping-sync.repository.js";

export const bostaWebhookRoutes = Router();
const path = "/api/v1/shipping/bosta/webhook";
bostaWebhookRoutes.post(path,
  rateLimit({ windowMs: 60_000, max: 300, keyPrefix: "bosta-webhook" }),
  (req, res, next) => {
    let runtime: BostaSyncRuntime | null;
    try { runtime = resolveBostaSyncRuntime(); } catch { return res.status(503).json({ message: "Bosta synchronization is unavailable" }); }
    if (!runtime) return res.status(503).json({ message: "Bosta synchronization is disabled" });
    if (!runtime.authenticate(req.get("X-Bosta-Webhook-Secret") ?? "")) return res.status(401).json({ message: "Invalid Bosta callback authentication" });
    res.locals.bostaSync = runtime;
    next();
  },
  express.json({ limit: "48kb", inflate: false }),
  (req, res, next) => {
    const runtime = res.locals.bostaSync as BostaSyncRuntime;
    let event: BostaObservation;
    try { event = runtime.parseWebhook(req.body); } catch { return res.status(422).json({ message: "Invalid Bosta callback" }); }
    recordShippingObservation(runtime, event).then(result => res.status(result === "processed" ? 200 : 202).json({ status: result })).catch(next);
  });
const bodyErrors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.too.large") return void res.status(413).json({ message: "Bosta callback is too large" });
  if (error?.type === "entity.parse.failed") return void res.status(400).json({ message: "Invalid callback JSON" });
  if (error?.type === "encoding.unsupported") return void res.status(415).json({ message: "Unsupported callback encoding" });
  next(error);
};
bostaWebhookRoutes.use(path, bodyErrors);
