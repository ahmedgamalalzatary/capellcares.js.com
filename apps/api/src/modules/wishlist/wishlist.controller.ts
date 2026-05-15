import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { addToWishlist, deleteFromWishlist, getWishlist } from "./wishlist.service.js";

function userId(req: Request) {
  return (req as AuthenticatedRequest).user?.id;
}

export async function listWishlistController(req: Request, res: Response) {
  const id = userId(req);
  if (!id) return res.status(401).json({ message: "Unauthorized" });
  const items = await getWishlist(id);
  return res.json({ items });
}

export async function addWishlistController(req: Request, res: Response) {
  const id = userId(req);
  if (!id) return res.status(401).json({ message: "Unauthorized" });
  const productId = Number(req.body?.productId);
  if (!productId) return res.status(400).json({ message: "productId required" });
  await addToWishlist(id, productId);
  return res.json({ ok: true });
}

export async function removeWishlistController(req: Request, res: Response) {
  const id = userId(req);
  if (!id) return res.status(401).json({ message: "Unauthorized" });
  const productId = Number(req.params.productId);
  await deleteFromWishlist(id, productId);
  return res.json({ ok: true });
}
