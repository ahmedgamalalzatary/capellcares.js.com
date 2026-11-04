import { Router, type Request, type Response } from "express";
import { deliverySettingsPayloadSchema } from "@capella/shared";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import { listCheckoutGovernoratesRepo, listDeliverySettingsRepo, saveDeliverySettingsRepo } from "./delivery.repository.js";

/** Storefront: where checkout can deliver. Not cached, so ERP changes show on the next checkout visit. */
export const storefrontDeliveryRoutes = Router();
storefrontDeliveryRoutes.get("/governorates", wrapAsync(async (_req: Request, res: Response) => {
  res.set("cache-control", "no-store");
  res.json({ governorates: await listCheckoutGovernoratesRepo() });
}));

/** ERP: the whole governorate → area → fee setup, read and saved at once. */
export const adminDeliveryRoutes = Router();
adminDeliveryRoutes.get("/", requireErpPermission("delivery.read"), wrapAsync(async (_req: Request, res: Response) => {
  res.json({ governorates: await listDeliverySettingsRepo() });
}));
adminDeliveryRoutes.put("/", requireErpPermission("delivery.update"), wrapAsync(async (req: Request, res: Response) => {
  const parsed = deliverySettingsPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid delivery settings" });
  }
  await saveDeliverySettingsRepo(parsed.data);
  res.json({ governorates: await listDeliverySettingsRepo() });
}));
