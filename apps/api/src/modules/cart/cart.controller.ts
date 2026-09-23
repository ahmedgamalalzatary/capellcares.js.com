import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { getCart, saveCart } from "./cart.service.js";

function customerId(req: Request) {
  return (req as AuthenticatedRequest).user?.id;
}

export async function getCartController(req: Request, res: Response) {
  const id = customerId(req);
  if (!id) return res.status(401).json({ message: "Unauthorized" });
  const lines = await getCart(id);
  return res.json({ lines });
}

export async function saveCartController(req: Request, res: Response) {
  const id = customerId(req);
  if (!id) return res.status(401).json({ message: "Unauthorized" });
  const lines = await saveCart(id, req.body.lines);
  return res.json({ lines });
}
