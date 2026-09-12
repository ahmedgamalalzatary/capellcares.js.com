import { Router } from "express";
import { paymobWebhookController } from "./paymob-webhook.controller.js";
import { wrapAsync } from "../../../lib/async-route.js";
import { resolvePaymobConfig } from "./paymob-config.js";

export const paymobWebhookRoutes = Router();
paymobWebhookRoutes.get("/methods", (_req, res) => {
  const methods = resolvePaymobConfig().enabledMethods.map(({ method }) => method);
  res.json({ available: methods.length > 0, methods });
});
paymobWebhookRoutes.post("/webhook", wrapAsync(paymobWebhookController));
