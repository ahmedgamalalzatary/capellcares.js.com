import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import { listShippingPageRepo, shippingListQuerySchema } from "./shipping-overview.repository.js";

export const shippingOverviewRoutes = Router();

shippingOverviewRoutes.get("/", requireErpPermission("shipping.read"), wrapAsync(async (req, res) => {
  const query = shippingListQuerySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Invalid shipping query" });
  res.json(await listShippingPageRepo(query.data));
}));
