import type { Response } from "express";
import { findOrderByIdRepo, getSalesAnalyticsRepo, listOrdersRepo, updateOrderPaymentStatusRepo } from "../../repositories/order.repository.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

const allowedPaymentStatuses = ["pending", "accepted", "denied"] as const;

function parsePositiveId(value: string) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function listAdminOrdersController(_req: AuthenticatedRequest, res: Response) {
  res.json({ items: await listOrdersRepo() });
}

export async function getAdminSalesController(_req: AuthenticatedRequest, res: Response) {
  res.json(await getSalesAnalyticsRepo());
}

export async function getAdminOrderController(req: AuthenticatedRequest, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id == null) {
    return res.status(400).json({ message: "Invalid order id" });
  }
  const order = await findOrderByIdRepo(Number(id));
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

  const paymentStatus = req.body?.paymentStatus;
  if (!allowedPaymentStatuses.includes(paymentStatus)) {
    return res.status(400).json({ message: "Invalid payment status" });
  }

  await updateOrderPaymentStatusRepo(Number(id), paymentStatus);
  return res.json({ ok: true });
}

export async function listCustomerOrdersController(req: AuthenticatedRequest, res: Response) {
  res.json({ items: await listOrdersRepo({ customerId: req.user!.id }) });
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
  return res.json(order);
}
