import type { Response } from "express";
import { findOrderByIdRepo, listOrdersRepo, updateOrderPaymentStatusRepo } from "../../repositories/order.repository.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

export async function listAdminOrdersController(_req: AuthenticatedRequest, res: Response) {
  res.json({ items: await listOrdersRepo() });
}

export async function getAdminOrderController(req: AuthenticatedRequest, res: Response) {
  const order = await findOrderByIdRepo(Number(req.params.id));
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  return res.json(order);
}

export async function updateOrderPaymentStatusController(req: AuthenticatedRequest, res: Response) {
  await updateOrderPaymentStatusRepo(Number(req.params.id), req.body?.paymentStatus);
  return res.json({ ok: true });
}

export async function listCustomerOrdersController(req: AuthenticatedRequest, res: Response) {
  res.json({ items: await listOrdersRepo({ customerId: req.user!.id }) });
}

export async function getCustomerOrderController(req: AuthenticatedRequest, res: Response) {
  const order = await findOrderByIdRepo(Number(req.params.id), { customerId: req.user!.id });
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  return res.json(order);
}
