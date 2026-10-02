import type { Response } from "express";
import { z } from "zod";
import {
  DeniedOrderLockedError,
  PaidPaymobRefundRequiredError,
  findAdminOrderByIdRepo,
  findOrderByIdRepo,
  getSalesAnalyticsRepo,
  listOrdersRepo,
  OrderNotFoundError,
  PaymobPaymentStatusManagedError,
  ShippingCustodyRequiredError,
  ShippingCodPaymentManagedError,
  updateOrderPaymentStatusRepo
} from "../../repositories/order.repository.js";
import { listOpenOrderReviewFlagsRepo, resolveOrderReviewFlagRepo, SafetyReviewFlagError } from "../../repositories/order-review-flag.repository.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { attachReviewEligibilityToOrder } from "../../repositories/review.repository.js";
import { requestShippingCancellation, ShippingCancellationError } from "../shipping/shipping-cancellation.repository.js";

const allowedPaymentStatuses = ["pending", "accepted", "denied"] as const;
const paymentChangeSchema = z.object({ paymentStatus: z.enum(allowedPaymentStatuses) }).strict();

function parsePositiveId(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2_147_483_647 ? id : null;
}

export async function listAdminOrdersController(_req: AuthenticatedRequest, res: Response) {
  res.json({ items: await listOrdersRepo() });
}

export async function listAdminOrderReviewFlagsController(_req: AuthenticatedRequest, res: Response) {
  res.json({ items: await listOpenOrderReviewFlagsRepo() });
}

export async function resolveAdminOrderReviewFlagController(req: AuthenticatedRequest, res: Response) {
  const id = parsePositiveId(req.params.flagId);
  if (id == null) {
    return res.status(400).json({ message: "Invalid flag id" });
  }
  try {
    if (!await resolveOrderReviewFlagRepo(id)) {
      return res.status(404).json({ message: "Review flag not found" });
    }
  } catch (error) {
    // A safety flag is a dispatch hold owned by the S13 staff action, not the alert feed.
    if (error instanceof SafetyReviewFlagError) {
      return res.status(409).json({ message: error.message });
    }
    throw error;
  }
  return res.json({ ok: true });
}

export async function getAdminSalesController(_req: AuthenticatedRequest, res: Response) {
  res.json(await getSalesAnalyticsRepo());
}

export async function getAdminOrderController(req: AuthenticatedRequest, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id == null) {
    return res.status(400).json({ message: "Invalid order id" });
  }
  const order = await findAdminOrderByIdRepo(Number(id));
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  return res.json(order);
}

export async function updateOrderPaymentStatusController(req: AuthenticatedRequest, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id == null) {
    return res.status(400).json({ message: "Invalid order id" });
  }

  const parsed = paymentChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payment status" });
  }
  const { paymentStatus } = parsed.data;

  try {
    await updateOrderPaymentStatusRepo(Number(id), paymentStatus);
  } catch (error) {
    if (error instanceof DeniedOrderLockedError || error instanceof PaidPaymobRefundRequiredError ||
      error instanceof PaymobPaymentStatusManagedError || error instanceof ShippingCustodyRequiredError || error instanceof ShippingCodPaymentManagedError) {
      return res.status(409).json({ message: error.message });
    }
    if (error instanceof OrderNotFoundError) {
      return res.status(404).json({ message: "Order not found" });
    }
    throw error;
  }
  return res.json({ ok: true });
}

export async function listCustomerOrdersController(req: AuthenticatedRequest, res: Response) {
  res.json({ items: await listOrdersRepo({ customerId: req.user!.id, withItems: true }) });
}

export async function getCustomerOrderController(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const id = parsePositiveId(req.params.id);
  if (id == null) {
    return res.status(400).json({ message: "Invalid order id" });
  }

  const order = await findOrderByIdRepo(Number(id), { customerId: req.user.id });
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  return res.json(await attachReviewEligibilityToOrder(order, req.user.id));
}

export async function cancelCustomerOrderController(req: AuthenticatedRequest, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id == null) return res.status(400).json({ message: "Invalid order id" });
  if (!z.object({}).strict().safeParse(req.body ?? {}).success) return res.status(400).json({ message: "Invalid cancellation request" });
  try {
    const result = await requestShippingCancellation(id, { source: "customer", actorId: req.user!.id });
    const order = await findOrderByIdRepo(id, { customerId: req.user!.id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.status(result.status === "pending" ? 202 : 200).json(await attachReviewEligibilityToOrder(order, req.user!.id));
  } catch (error) {
    if (error instanceof ShippingCancellationError) {
      if (/not found/i.test(error.message)) return res.status(404).json({ message: "Order not found" });
      return res.status(409).json({ message: "Order cancellation is unavailable", code: "ORDER_CANCELLATION_UNAVAILABLE" });
    }
    throw error;
  }
}
