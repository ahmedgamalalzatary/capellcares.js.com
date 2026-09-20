import { Router } from "express";
import { paymobWebhookController } from "./paymob-webhook.controller.js";
import { wrapAsync } from "../../../lib/async-route.js";
import { resolvePaymobConfig } from "./paymob-config.js";
import { rateLimit } from "../../../middlewares/rate-limit.middleware.js";

export const paymobWebhookRoutes = Router();
paymobWebhookRoutes.get("/methods", (_req, res) => {
  const methods = resolvePaymobConfig().enabledMethods.map(({ method }) => method);
  res.json({ available: methods.length > 0, methods });
});
const webhookLimit = rateLimit({ keyPrefix: "paymob-webhook", windowMs: 60 * 1000, max: 300 });
paymobWebhookRoutes.post("/webhook", webhookLimit, wrapAsync(paymobWebhookController));
