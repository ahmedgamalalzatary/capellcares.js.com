import { Router } from "express";
import { z } from "zod";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import { listShippingOverviewRepo } from "../../repositories/shipping-overview.repository.js";

export const shippingOverviewRoutes = Router();

const querySchema = z.object({
  cursor: z.string().max(64).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z\|[1-9]\d{0,9}$/).optional()
}).strict();

shippingOverviewRoutes.get("/", requireErpPermission("shipping.read"), wrapAsync(async (req, res) => {
  const query = querySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Invalid shipping query" });
  const { cursor } = query.data;
  let parsed: { createdAt: Date; id: number } | null = null;
  if (cursor) {
    const [iso, id] = cursor.split("|");
    parsed = { createdAt: new Date(iso), id: Number(id) };
    if (Number.isNaN(parsed.createdAt.getTime()) || parsed.createdAt.toISOString().slice(0, 19) !== iso.slice(0, 19) ||
      !Number.isSafeInteger(parsed.id) || parsed.id > 2_147_483_647) {
      return res.status(400).json({ message: "Invalid shipping cursor" });
    }
  }
  res.json(await listShippingOverviewRepo(parsed));
}));
