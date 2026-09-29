import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import type { ErpAuthenticatedRequest } from "../../middlewares/admin-auth.middleware.js";
import { requestShippingCancellation, ShippingCancellationError } from "../../repositories/shipping-cancellation.repository.js";
import { recordOrderManualState } from "../../repositories/shipping-state.repository.js";
import { reconcileOrderDeliveryCreation, retryOrderDeliveryCreation, runBulkShippingAction, resolveShippingFlags, editOrderShipment, ShippingConfigurationError } from "../../repositories/shipping-action.repository.js";
import { shipmentManualStateRequestSchema, shipmentEditSchema, shippingFlagResolutionSchema, shippingBulkActionSchema } from "@capella/shared";

export const shippingActionRoutes = Router();

function parsePositiveId(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2_147_483_647 ? id : null;
}

const cancelSchema = z.object({ reason: z.string().trim().min(1).max(1000).optional() }).strict();

shippingActionRoutes.post("/orders/:id/cancel", requireErpPermission("shipping.update_state"), wrapAsync(async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id == null) return res.status(400).json({ message: "Invalid order id" });
  let body: z.infer<typeof cancelSchema>;
  try {
    body = cancelSchema.parse(req.body ?? {});
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid cancellation request" });
    throw error;
  }
  try {
    const result = await requestShippingCancellation(id, {
      source: "staff", actorId: (req as ErpAuthenticatedRequest).adminUser!.id, reason: body.reason
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof ShippingCancellationError) return res.status(409).json({ message: error.message });
    throw error;
  }
}));

function mapActionError(error: unknown, res: Response) {
  if (error instanceof ShippingConfigurationError) return res.status(503).json({ message: error.message });
  const message = error instanceof Error ? error.message : String(error);
  if (/not found/i.test(message)) return res.status(404).json({ message });
  if (/permission|authorized/i.test(message)) return res.status(403).json({ message });
  return res.status(409).json({ message });
}

shippingActionRoutes.post("/orders/:id/manual-state", requireErpPermission("shipping.update_state"), wrapAsync(async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id == null) return res.status(400).json({ message: "Invalid order id" });
  let body: z.infer<typeof shipmentManualStateRequestSchema>;
  try {
    body = shipmentManualStateRequestSchema.parse(req.body ?? {});
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid manual state request" });
    throw error;
  }
  try {
    const changed = await recordOrderManualState(id, body, (req as ErpAuthenticatedRequest).adminUser!.id);
    return res.json({ ok: true, changed });
  } catch (error) {
    return mapActionError(error, res);
  }
}));

shippingActionRoutes.post("/orders/:id/retry", requireErpPermission("shipping.update_state"), wrapAsync(async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id == null) return res.status(400).json({ message: "Invalid order id" });
  try {
    const changed = await retryOrderDeliveryCreation(id, (req as ErpAuthenticatedRequest).adminUser!.id);
    return res.json({ ok: true, changed });
  } catch (error) {
    return mapActionError(error, res);
  }
}));

shippingActionRoutes.post("/orders/:id/reconcile", requireErpPermission("shipping.update_state"), wrapAsync(async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id == null) return res.status(400).json({ message: "Invalid order id" });
  try {
    const changed = await reconcileOrderDeliveryCreation(id, (req as ErpAuthenticatedRequest).adminUser!.id);
    return res.json({ ok: true, changed });
  } catch (error) {
    return mapActionError(error, res);
  }
}));

shippingActionRoutes.post("/orders/:id/shipment-edit", requireErpPermission("shipping.update_state"), wrapAsync(async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id == null) return res.status(400).json({ message: "Invalid order id" });
  const parsed = shipmentEditSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid shipment edit" });
  try { return res.json(await editOrderShipment(id, parsed.data, (req as ErpAuthenticatedRequest).adminUser!.id)); }
  catch (error) { return mapActionError(error, res); }
}));

shippingActionRoutes.post("/orders/:id/flags/:flagId/resolve", requireErpPermission("shipping.update_state"), wrapAsync(async (req, res) => {
  const id = parsePositiveId(req.params.id), flagId = parsePositiveId(req.params.flagId);
  if (id == null || flagId == null) return res.status(400).json({ message: "Invalid order/flag id" });
  const parsed = shippingFlagResolutionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Resolution note required" });
  try { return res.json({ ok: true, changed: await resolveShippingFlags(id, parsed.data, (req as ErpAuthenticatedRequest).adminUser!.id, flagId) }); }
  catch (error) { return mapActionError(error, res); }
}));

shippingActionRoutes.post("/bulk", requireErpPermission("shipping.update_state"), wrapAsync(async (req, res) => {
  let body: z.infer<typeof shippingBulkActionSchema>;
  try {
    body = shippingBulkActionSchema.parse(req.body ?? {});
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid bulk request" });
    throw error;
  }
  const results = await runBulkShippingAction(body.action, body.orderIds,
    { actorId: (req as ErpAuthenticatedRequest).adminUser!.id, state: body.state, reason: body.reason, patch: body.patch, note: body.note, addressLines: body.addressLines });
  return res.json({ results });
}));
