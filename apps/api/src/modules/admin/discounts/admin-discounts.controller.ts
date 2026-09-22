import type { Request, Response } from "express";
import { and, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@capella/database/src/db";
import { bundleDiscounts, categories, collections, offers, products, productVariants, variantDiscounts } from "@capella/database/drizzle/schema";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";

const ids = z.array(z.number().int().positive()).default([]);
const payloadSchema = z.object({
  productIds: ids,
  offerIds: ids,
  collectionIds: ids,
  categoryIds: ids,
  excludeVariantIds: ids,
  excludeOfferIds: ids,
  excludeCollectionIds: ids,
  discount: z.object({
    type: z.enum(["percentage", "fixed"]),
    value: z.number().positive(),
    startsAt: z.string(),
    endsAt: z.string(),
    status: z.enum(["active", "inactive"])
  }).nullable()
});

class InvalidDiscountSelection extends Error {
  constructor(readonly reason: string) { super(reason); }
}

const UPSERT_BATCH_SIZE = 200;

function includesCategory(categoryId: number, selected: Set<number>, parentById: Map<number, number | null>) {
  let current: number | null | undefined = categoryId;
  const seen = new Set<number>();
  while (current != null && !seen.has(current)) {
    if (selected.has(current)) return true;
    seen.add(current);
    current = parentById.get(current);
  }
  return false;
}

export async function adminBulkApplyDiscount(req: Request, res: Response) {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, reason: "invalid-discount-input" });
  const input = parsed.data;
  const startsAt = input.discount ? new Date(input.discount.startsAt) : null;
  const endsAt = input.discount ? new Date(input.discount.endsAt) : null;
  if (input.discount && (!startsAt || !endsAt || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt ||
    (input.discount.type === "percentage" && input.discount.value > 100))) {
    return res.status(400).json({ ok: false, reason: "invalid-discount-input" });
  }

  try {
    const counts = await db.transaction(async (tx) => {
      const [categoryRows, productRows, offerRows, collectionRows] = await Promise.all([
        tx.select({ id: categories.id, parentId: categories.parentId }).from(categories).where(isNull(categories.deletedAt)),
        tx.select({ id: products.id, categoryId: products.categoryId }).from(products).where(isNull(products.deletedAt)),
        tx.select({ id: offers.id, categoryId: offers.categoryId, fixedPrice: offers.fixedPrice }).from(offers).where(isNull(offers.deletedAt)),
        tx.select({ id: collections.id, categoryId: collections.categoryId, fixedPrice: collections.fixedPrice }).from(collections).where(isNull(collections.deletedAt))
      ]);
      const parentById = new Map(categoryRows.map((row) => [row.id, row.parentId]));
      const categoryIds = new Set(input.categoryIds);
      if (input.categoryIds.some((id) => !parentById.has(id))) throw new InvalidDiscountSelection("category-not-found");
      const selectedProducts = new Set(input.productIds);
      const selectedOffers = new Set(input.offerIds);
      const selectedCollections = new Set(input.collectionIds);
      if (input.productIds.some((id) => !productRows.some((row) => row.id === id)) ||
        input.offerIds.some((id) => !offerRows.some((row) => row.id === id)) ||
        input.collectionIds.some((id) => !collectionRows.some((row) => row.id === id))) {
        throw new InvalidDiscountSelection("item-not-found");
      }
      const targetProducts = productRows.filter((row) => selectedProducts.has(row.id) || includesCategory(row.categoryId, categoryIds, parentById));
      const targetOffers = offerRows.filter((row) => (selectedOffers.has(row.id) ||
        (row.categoryId != null && includesCategory(row.categoryId, categoryIds, parentById))) &&
        !input.excludeOfferIds.includes(row.id));
      const targetCollections = collectionRows.filter((row) => (selectedCollections.has(row.id) ||
        includesCategory(row.categoryId, categoryIds, parentById)) &&
        !input.excludeCollectionIds.includes(row.id));
      const lockedOffers = targetOffers.length
        ? await tx.select({ id: offers.id, fixedPrice: offers.fixedPrice }).from(offers)
          .where(inArray(offers.id, targetOffers.map((row) => row.id))).for("update") : [];
      const lockedCollections = targetCollections.length
        ? await tx.select({ id: collections.id, fixedPrice: collections.fixedPrice }).from(collections)
          .where(inArray(collections.id, targetCollections.map((row) => row.id))).for("update") : [];
      if (lockedOffers.length !== targetOffers.length || lockedCollections.length !== targetCollections.length) {
        throw new InvalidDiscountSelection("item-not-found");
      }
      const selectedVariants = targetProducts.length
        ? await tx.select({ id: productVariants.id, sellingPrice: productVariants.sellingPrice }).from(productVariants)
          .where(and(inArray(productVariants.productId, targetProducts.map((row) => row.id)), isNull(productVariants.deletedAt)))
        : [];
      const variants = selectedVariants.filter((row) => !input.excludeVariantIds.includes(row.id));
      if (variants.length + targetOffers.length + targetCollections.length === 0) {
        throw new InvalidDiscountSelection("empty-selection");
      }
      const prices = [...variants.map((row) => Number(row.sellingPrice)),
        ...lockedOffers.map((row) => Number(row.fixedPrice)),
        ...lockedCollections.map((row) => Number(row.fixedPrice))];
      if (input.discount && prices.some((price) => price <= 0 ||
        (input.discount!.type === "fixed" && input.discount!.value >= price))) {
        throw new InvalidDiscountSelection("discount-exceeds-price");
      }
      if (input.discount && startsAt && endsAt) {
        const discount = {
          type: input.discount.type,
          value: sql`${input.discount.value}`,
          startsAt,
          endsAt,
          status: input.discount.status
        };
        for (let start = 0; start < variants.length; start += UPSERT_BATCH_SIZE) {
          await tx.insert(variantDiscounts).values(variants.slice(start, start + UPSERT_BATCH_SIZE)
            .map((variant) => ({ variantId: variant.id, ...discount })))
            .onDuplicateKeyUpdate({ set: discount });
        }
        for (let start = 0; start < targetOffers.length; start += UPSERT_BATCH_SIZE) {
          await tx.insert(bundleDiscounts).values(targetOffers.slice(start, start + UPSERT_BATCH_SIZE)
            .map((offer) => ({ offerId: offer.id, ...discount })))
            .onDuplicateKeyUpdate({ set: discount });
        }
        for (let start = 0; start < targetCollections.length; start += UPSERT_BATCH_SIZE) {
          await tx.insert(bundleDiscounts).values(targetCollections.slice(start, start + UPSERT_BATCH_SIZE)
            .map((collection) => ({ collectionId: collection.id, ...discount })))
            .onDuplicateKeyUpdate({ set: discount });
        }
      } else {
        if (variants.length) await tx.delete(variantDiscounts).where(inArray(variantDiscounts.variantId, variants.map((row) => row.id)));
        if (targetOffers.length) await tx.delete(bundleDiscounts).where(inArray(bundleDiscounts.offerId, targetOffers.map((row) => row.id)));
        if (targetCollections.length) await tx.delete(bundleDiscounts).where(inArray(bundleDiscounts.collectionId, targetCollections.map((row) => row.id)));
      }
      return { variants: variants.length, offers: targetOffers.length, collections: targetCollections.length };
    });
    try {
      await triggerStorefrontRevalidation({ entity: "discounts" });
    } catch (error) {
      console.warn("Failed to revalidate storefront discounts", error);
    }
    return res.json({ ok: true, counts });
  } catch (error) {
    if (error instanceof InvalidDiscountSelection) {
      return res.status(400).json({ ok: false, reason: error.reason });
    }
    throw error;
  }
}
