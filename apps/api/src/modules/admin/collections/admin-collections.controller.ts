import type { NextFunction, Request, Response } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { productVariants, products } from "@capella/database/drizzle/schema";
import {
  listCollectionsRepo,
  restoreCollectionRepo,
  softDeleteCollectionRepo,
  toggleCollectionStatusRepo,
  upsertCollectionRepo
} from "../../../repositories/collection.repository.js";
import {
  listRelatedLinksForSourceRepo,
  setRelatedLinksForSourceRepo,
  type RelatedEntityType,
  type RelatedRef
} from "../../../repositories/related-item.repository.js";
import { toSlug } from "../../../services/slug.service.js";
import { calculateCollectionInventory, computeCollectionInventoryFromMap } from "../../collections/collection-inventory.js";
import { toAdminCollection } from "./admin-collections.mapper.js";

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
    const inventory = computeCollectionInventoryFromMap(collection.items, variantMap);
    return toAdminCollection(collection, inventory.originalTotal, inventory.stock);
  });
  res.json({ items });
}

export async function adminGetCollection(req: Request, res: Response) {
  const id = Number(req.params.id);
  const collection = (await listCollectionsRepo(true)).find((item) => item.id === id);
  if (!collection) {
    return res.status(404).json({ ok: false, reason: "not-found" });
  }

  const inventory = await calculateCollectionInventory(collection.items);
  const relatedItems = await listRelatedLinksForSourceRepo("collection", id);
  return res.json({ ...toAdminCollection(collection, inventory.originalTotal, inventory.stock), relatedItems });
}

export async function adminUpsertCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const incoming = req.body as any;
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
      slug: toSlug(incoming.slug || incoming.name?.en || incoming.enName || incoming.name?.ar || incoming.arName),
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
    res.json({ ok: true });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      return res.status(409).json({ ok: false, reason: "slug-conflict" });
    }
    next(error);
  }
}

export async function adminSoftDeleteCollection(req: Request, res: Response) {
  await softDeleteCollectionRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminRestoreCollection(req: Request, res: Response) {
  await restoreCollectionRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminToggleCollectionStatus(req: Request, res: Response) {
  await toggleCollectionStatusRepo(Number(req.params.id));
  res.json({ ok: true });
}
