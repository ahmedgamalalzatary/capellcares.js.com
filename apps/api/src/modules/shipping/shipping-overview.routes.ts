import { Router } from "express";
import { z } from "zod";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import { listShippingOverviewRepo } from "../../repositories/shipping-overview.repository.js";

export const shippingOverviewRoutes = Router();

const querySchema = z.object({
  cursor: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\|\d{1,10}$/).optional()
}).strict();

shippingOverviewRoutes.get("/", requireErpPermission("shipping.read"), wrapAsync(async (req, res) => {
  const { cursor } = querySchema.parse(req.query);
  let parsed: { createdAt: Date; id: number } | null = null;
  if (cursor) {
    const [iso, id] = cursor.split("|");
    parsed = { createdAt: new Date(iso), id: Number(id) };
  }
  res.json(await listShippingOverviewRepo(parsed));
}));
