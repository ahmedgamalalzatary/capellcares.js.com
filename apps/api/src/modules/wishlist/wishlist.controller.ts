import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { addToWishlist, deleteFromWishlist, getWishlist } from "./wishlist.service.js";
import type { WishlistItemDto } from "@capella/shared";
import { WishlistEntityValidationError } from "../../repositories/wishlist.repository.js";

function userId(req: Request) {
  return (req as AuthenticatedRequest).user?.id;
}

function parseEntityType(value: unknown): WishlistItemDto["entityType"] | null {
  return value === "product" || value === "offer" || value === "collection" ? value : null;
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
  const requestedEntityType = req.body?.entityType;
  const parsedEntityType = parseEntityType(requestedEntityType);
  const canFallbackToProductId = requestedEntityType == null || requestedEntityType === "product";
  const entityType = parsedEntityType ?? (canFallbackToProductId && req.body?.productId ? "product" : null);
  const entityId = Number(req.body?.entityId ?? (canFallbackToProductId ? req.body?.productId : undefined));
  if (!entityType || !entityId) return res.status(400).json({ message: "entityType and entityId required" });
  try {
    await addToWishlist(id, entityType, entityId);
  } catch (error) {
    if (error instanceof WishlistEntityValidationError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }
  return res.json({ ok: true });
}

export async function removeWishlistController(req: Request, res: Response) {
  const id = userId(req);
  if (!id) return res.status(401).json({ message: "Unauthorized" });
  const entityType = parseEntityType(req.params.entityType);
  const entityId = Number(req.params.entityId);
  if (!entityType || !entityId) return res.status(400).json({ message: "entityType and entityId required" });
  await deleteFromWishlist(id, entityType, entityId);
  return res.json({ ok: true });
}
