import type { Response } from "express";
import { z } from "zod";
import {
  DeniedOrderLockedError,
  findAdminOrderByIdRepo,
  findOrderByIdRepo,
  getSalesAnalyticsRepo,
  adminOrderPaymentSummaryRepo,
  adminOrdersQuerySchema,
  cancelCustomerOrderRepo,
  listAdminOrdersPageRepo,
  paymentSummaryQuerySchema,
  listCustomerOrdersRepo,
  OrderNotFoundError,
  updateOrderPaymentStatusRepo
} from "./order.repository.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { attachReviewEligibilityToOrder } from "../reviews/review.repository.js";

const allowedPaymentStatuses = ["pending", "accepted", "denied"] as const;
const paymentChangeSchema = z.object({ paymentStatus: z.enum(allowedPaymentStatuses) }).strict();

function parsePositiveId(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2_147_483_647 ? id : null;
}

export async function listAdminOrdersController(req: AuthenticatedRequest, res: Response) {
  const query = adminOrdersQuerySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Invalid order list query" });
  return res.json(await listAdminOrdersPageRepo(query.data));
}

export async function getAdminOrderPaymentSummaryController(req: AuthenticatedRequest, res: Response) {
  const query = paymentSummaryQuerySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Invalid payment summary query" });
  return res.json(await adminOrderPaymentSummaryRepo(query.data.since));
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
    if (error instanceof DeniedOrderLockedError) {
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
  res.json({ items: await listCustomerOrdersRepo(req.user!.id) });
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
  const outcome = await cancelCustomerOrderRepo(id, req.user!.id);
  if (outcome === "not_found") return res.status(404).json({ message: "Order not found" });
  if (outcome === "not_cancellable") return res.status(409).json({ message: "Order cancellation is unavailable", code: "ORDER_CANCELLATION_UNAVAILABLE" });
  const order = await findOrderByIdRepo(id, { customerId: req.user!.id });
  return res.json(await attachReviewEligibilityToOrder(order!, req.user!.id));
}
