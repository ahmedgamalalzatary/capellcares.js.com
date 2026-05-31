import type { NextFunction, Request, Response } from "express";
import { inArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { productVariants } from "@capella/database/drizzle/schema";
import {
  listOffersRepo,
  restoreOfferRepo,
  softDeleteOfferRepo,
  upsertOfferRepo
} from "../../../repositories/offer.repository.js";
import {
  listRelatedLinksForSourceRepo,
  setRelatedLinksForSourceRepo,
  type RelatedEntityType,
  type RelatedRef
} from "../../../repositories/related-item.repository.js";
import { toSlug } from "../../../services/slug.service.js";
import { toAdminOffer } from "../offers/admin-offers.mapper.js";

const RELATED_ENTITY_TYPES: RelatedEntityType[] = ["product", "offer", "collection"];

function isDuplicateEntryError(error: unknown) {
  const candidate = error as
    | { code?: string; message?: string; cause?: { code?: string; message?: string } }
    | undefined;

  return (
    candidate?.code === "ER_DUP_ENTRY" ||
    candidate?.cause?.code === "ER_DUP_ENTRY" ||
    candidate?.message?.includes("Duplicate entry") ||
    candidate?.cause?.message?.includes("Duplicate entry")
  );
}

function parseRelatedItems(value: unknown): RelatedRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const refs: RelatedRef[] = [];
  for (const item of value) {
    const type = (item as any)?.type;
    const id = Number((item as any)?.id);
    if (RELATED_ENTITY_TYPES.includes(type) && Number.isInteger(id) && id > 0) {
      const key = `${type}:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ type, id });
      }
    }
  }
  return refs;
}

async function calculateOfferInventory(items: Array<{ variantId: number; qty: number }>) {
  if (items.length === 0) {
    return { originalTotal: 0, stock: 0 };
  }

  const variantRows = await db
    .select({
      id: productVariants.id,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty
    })
    .from(productVariants)
    .where(inArray(productVariants.id, items.map((item) => item.variantId)));

  const originalTotal = items.reduce((sum, item) => {
    const variant = variantRows.find((row) => row.id === item.variantId);
    return sum + Number(variant?.sellingPrice ?? 0) * item.qty;
  }, 0);

  const stock = items.reduce((minAvailable, item) => {
    const variant = variantRows.find((row) => row.id === item.variantId);
    const availableBundles = Math.floor((variant?.stockQty ?? 0) / item.qty);
    return Math.min(minAvailable, availableBundles);
  }, Number.POSITIVE_INFINITY);

  return {
    originalTotal,
    stock: Number.isFinite(stock) ? stock : 0
  };
}

export async function adminListOffers(_req: Request, res: Response) {
  const offers = await listOffersRepo(true);
  const items = await Promise.all(
    offers.map(async (offer) => {
      const inventory = await calculateOfferInventory(offer.items);
      return toAdminOffer(offer, inventory.originalTotal, inventory.stock);
    })
  );
  res.json({ items });
}

export async function adminGetOffer(req: Request, res: Response) {
  const id = Number(req.params.id);
  const offer = (await listOffersRepo(true)).find((item) => item.id === id);
  if (!offer) {
    return res.status(404).json({ ok: false, reason: "not-found" });
  }

  const inventory = await calculateOfferInventory(offer.items);
  const relatedItems = await listRelatedLinksForSourceRepo("offer", id);
  return res.json({ ...toAdminOffer(offer, inventory.originalTotal, inventory.stock), relatedItems });
}

export async function adminUpsertOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const incoming = req.body as any;
    const { id: offerId } = await upsertOfferRepo({
      id: incoming.id,
      slug: toSlug(incoming.slug || incoming.name?.en || incoming.enName || incoming.name?.ar || incoming.arName),
      arName: incoming.name?.ar ?? incoming.arName ?? "",
      enName: incoming.name?.en ?? incoming.enName ?? "",
      arDescription: incoming.description?.ar ?? incoming.arDescription ?? null,
      enDescription: incoming.description?.en ?? incoming.enDescription ?? null,
      imagePath: incoming.imagePath ?? null,
      fixedPrice: Number(incoming.price ?? incoming.fixedPrice ?? 0),
      status: incoming.status ?? "inactive",
      visibility: incoming.visibility ?? "visible",
      items: (incoming.items ?? []).map((item: any) => ({
        id: item.id ? Number(item.id) : undefined,
        variantId: Number(item.variantId),
        qty: Number(item.qty)
      }))
    });
    if (Object.prototype.hasOwnProperty.call(incoming, "relatedItems")) {
      const relatedRefs = parseRelatedItems(incoming.relatedItems).filter(
        (target) => !(target.type === "offer" && target.id === offerId)
      );
      await setRelatedLinksForSourceRepo({ type: "offer", id: offerId }, relatedRefs);
    }
    res.json({ ok: true });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      return res.status(409).json({ ok: false, reason: "slug-conflict" });
    }
    next(error);
  }
}

export async function adminSoftDeleteOffer(req: Request, res: Response) {
  await softDeleteOfferRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminRestoreOffer(req: Request, res: Response) {
  await restoreOfferRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminToggleOfferStatus(req: Request, res: Response) {
  const { toggleOfferStatusRepo } = await import("../../../repositories/offer.repository.js");
  await toggleOfferStatusRepo(Number(req.params.id));
  res.json({ ok: true });
}
