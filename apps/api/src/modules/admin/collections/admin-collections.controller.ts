import type { NextFunction, Request, Response } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { collectionItems, collections, productVariants, products } from "@capella/database/drizzle/schema";
import {
  findCollectionByIdRepo,
  listCollectionsRepo,
  restoreCollectionRepo,
  softDeleteCollectionRepo,
  toggleCollectionStatusRepo,
  upsertCollectionRepo
} from "../../../repositories/collection.repository.js";
import {
  listRelatedLinksForSourceRepo,
  setRelatedLinksForSourceRepo
} from "../../../repositories/related-item.repository.js";
import { toSlug } from "../../../services/slug.service.js";
import { calculateBundleInventory, computeBundleInventoryFromMap } from "../../inventory/bundle-inventory.js";
import { isDuplicateEntryError } from "../shared/db-errors.js";
import { parseRelatedItems } from "../shared/related-items.js";
import { toAdminCollection } from "./admin-collections.mapper.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";

async function findCollectionRevalidationData(id: number): Promise<{ slug: string; relatedProductSlugs: string[] } | null> {
  const [collection] = await db.select({ slug: collections.slug }).from(collections).where(eq(collections.id, id)).limit(1);
  if (!collection) {
    return null;
  }

  const itemRows = await db
    .select({ variantId: collectionItems.variantId })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, id));
  const variantIds = [...new Set(itemRows.map((row) => row.variantId))];
  const relatedProductSlugs = variantIds.length === 0
    ? []
    : [
        ...new Set(
          (
            await db
              .select({ slug: products.slug })
              .from(productVariants)
              .innerJoin(products, eq(products.id, productVariants.productId))
              .where(inArray(productVariants.id, variantIds))
          ).map((row) => row.slug)
        )
      ];

  return { slug: collection.slug, relatedProductSlugs };
}

async function safeTriggerCollectionRevalidation(payload: { slug: string; relatedProductSlugs?: string[] }) {
  try {
    await triggerStorefrontRevalidation({
      entity: "collection",
      slug: payload.slug,
      relatedProductSlugs: payload.relatedProductSlugs
    });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for collection", payload.slug, error);
  }
}

async function validateCollectionItems(categoryId: number, items: Array<{ variantId: number; qty: number }>) {
  if (items.length < 2) {
    return "collection-min-two-variants";
  }

  for (const item of items) {
    if (!Number.isInteger(item.variantId) || item.variantId < 1) {
      return "collection-item-invalid-variant";
    }
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      return "collection-item-invalid-qty";
    }
  }

  const variantIds = items.map((item) => item.variantId);
  const variantIdsDistinct = [...new Set(variantIds)];
  if (variantIdsDistinct.length < 2) {
    return "collection-min-two-variants";
  }

  const rows = await db
    .select({
      variantId: productVariants.id,
      categoryId: products.categoryId
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(inArray(productVariants.id, variantIdsDistinct), isNull(productVariants.deletedAt), isNull(products.deletedAt)));

  if (rows.length !== variantIdsDistinct.length) {
    return "collection-item-not-found";
  }

  if (rows.some((row) => row.categoryId !== categoryId)) {
    return "collection-item-category-mismatch";
  }

  return null;
}

export async function adminListCollections(_req: Request, res: Response) {
  const collections = await listCollectionsRepo(true);
  const variantIds = [...new Set(collections.flatMap((collection) => collection.items.map((item) => item.variantId)))];
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
  const items = collections.map((collection) => {
    const inventory = computeBundleInventoryFromMap(collection.items, variantMap);
    return toAdminCollection(collection, inventory.originalTotal, inventory.stock);
  });
  res.json({ items });
}

export async function adminGetCollection(req: Request, res: Response) {
  const id = Number(req.params.id);
  const collection = await findCollectionByIdRepo(id);
  if (!collection) {
    return res.status(404).json({ ok: false, reason: "not-found" });
  }

  const inventory = await calculateBundleInventory(collection.items);
  const relatedItems = await listRelatedLinksForSourceRepo("collection", id);
  return res.json({ ...toAdminCollection(collection, inventory.originalTotal, inventory.stock), relatedItems });
}

export async function adminUpsertCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const incoming = req.body as any;
    const slug = toSlug(incoming.slug || incoming.name?.en || incoming.enName || incoming.name?.ar || incoming.arName);
    const items = (incoming.items ?? []).map((item: any) => ({
      id: item.id ? Number(item.id) : undefined,
      variantId: Number(item.variantId),
      qty: Number(item.qty)
    }));
    const categoryId = Number(incoming.categoryId ?? 0);
    const validationError = await validateCollectionItems(categoryId, items);
    if (validationError) {
      return res.status(400).json({ ok: false, reason: validationError });
    }

    const { id: collectionId } = await upsertCollectionRepo({
      id: incoming.id,
      slug,
      arName: incoming.name?.ar ?? incoming.arName ?? "",
      enName: incoming.name?.en ?? incoming.enName ?? "",
      arDescription: incoming.description?.ar ?? incoming.arDescription ?? null,
      enDescription: incoming.description?.en ?? incoming.enDescription ?? null,
      imagePath: incoming.imagePath ?? null,
      fixedPrice: Number(incoming.price ?? incoming.fixedPrice ?? 0),
      categoryId,
      status: incoming.status ?? "inactive",
      visibility: incoming.visibility ?? "visible",
      items
    });
    if (Object.prototype.hasOwnProperty.call(incoming, "relatedItems")) {
      const relatedRefs = parseRelatedItems(incoming.relatedItems).filter(
        (target) => !(target.type === "collection" && target.id === collectionId)
      );
      await setRelatedLinksForSourceRepo({ type: "collection", id: collectionId }, relatedRefs);
    }
    const revalidation = await findCollectionRevalidationData(collectionId);
    await safeTriggerCollectionRevalidation(revalidation ?? { slug });
    res.json({ ok: true });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      return res.status(409).json({ ok: false, reason: "slug-conflict" });
    }
    next(error);
  }
}

export async function adminSoftDeleteCollection(req: Request, res: Response) {
  const revalidation = await findCollectionRevalidationData(Number(req.params.id));
  await softDeleteCollectionRepo(Number(req.params.id));
  if (revalidation) {
    await safeTriggerCollectionRevalidation(revalidation);
  }
  res.json({ ok: true });
}

export async function adminRestoreCollection(req: Request, res: Response) {
  const revalidation = await findCollectionRevalidationData(Number(req.params.id));
  await restoreCollectionRepo(Number(req.params.id));
  if (revalidation) {
    await safeTriggerCollectionRevalidation(revalidation);
  }
  res.json({ ok: true });
}

export async function adminToggleCollectionStatus(req: Request, res: Response) {
  const revalidation = await findCollectionRevalidationData(Number(req.params.id));
  await toggleCollectionStatusRepo(Number(req.params.id));
  if (revalidation) {
    await safeTriggerCollectionRevalidation(revalidation);
  }
  res.json({ ok: true });
}
