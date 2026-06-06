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
  setRelatedLinksForSourceRepo
} from "../../../repositories/related-item.repository.js";
import { toSlug } from "../../../services/slug.service.js";
import { calculateBundleInventory, computeBundleInventoryFromMap } from "../../inventory/bundle-inventory.js";
import { isDuplicateEntryError } from "../shared/db-errors.js";
import { parseRelatedItems } from "../shared/related-items.js";
import { toAdminOffer } from "../offers/admin-offers.mapper.js";

export async function adminListOffers(_req: Request, res: Response) {
  const offers = await listOffersRepo(true);
  const variantIds = [...new Set(offers.flatMap((offer) => offer.items.map((item) => item.variantId)))];
  const variantRows = variantIds.length === 0
    ? []
    : await db
        .select({
          id: productVariants.id,
          sellingPrice: productVariants.sellingPrice,
          stockQty: productVariants.stockQty
        })
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds));
  const variantMap = new Map(variantRows.map((row) => [row.id, row] as const));
  const items = offers.map((offer) => {
    const inventory = computeBundleInventoryFromMap(offer.items, variantMap);
    return toAdminOffer(offer, inventory.originalTotal, inventory.stock);
  });
  res.json({ items });
}

export async function adminGetOffer(req: Request, res: Response) {
  const id = Number(req.params.id);
  const offer = (await listOffersRepo(true)).find((item) => item.id === id);
  if (!offer) {
    return res.status(404).json({ ok: false, reason: "not-found" });
  }

  const inventory = await calculateBundleInventory(offer.items);
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
