import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { categories, collectionItems, collections, offerItems, offers, productVariants, products, relatedItems, variantDiscounts } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { getEffectiveVariantPrice, type Language } from "@capella/shared";
import { EMPTY_RATING, safeRatingSummaries } from "../review.repository.js";
import {
  loadEntityMediaRows,
  normalizeEntityMedia,
  resolvePrimaryEntityImagePath
} from "../entity-media.repository.js";
import type { RelatedEntityType, RelatedRef, StorefrontRelatedCard } from "./shared.js";

/** A card as the per-type queries build it; the rating lands at assembly. */
type UnratedRelatedCard = Omit<StorefrontRelatedCard, "rating">;

type VariantPricingRow = {
  sellingPrice: unknown;
  discountType: "percentage" | "fixed" | null;
  discountValue: unknown;
  discountStartsAt: Date | null;
  discountEndsAt: Date | null;
  discountStatus: "active" | "inactive" | null;
};

function effectivePriceOf(variant: VariantPricingRow): number {
  return getEffectiveVariantPrice({
    price: Number(variant.sellingPrice),
    discount: variant.discountStatus
      ? {
          type: variant.discountType!,
          value: Number(variant.discountValue),
          startsAt: variant.discountStartsAt!.toISOString(),
          endsAt: variant.discountEndsAt!.toISOString(),
          status: variant.discountStatus
        }
      : null
  });
}

/** A saving is only worth showing when the original is genuinely higher. */
function savingOrNull(original: number, price: number): number | null {
  return original > price ? original : null;
}

function sumBundleParts(items: { qty: number; sellingPrice: unknown }[]): number {
  return items.reduce((total, item) => total + Number(item.sellingPrice) * item.qty, 0);
}

/**
 * How many whole bundles the scarcest part allows. Zero when there are none.
 * A soft-deleted part counts as unavailable rather than being skipped: dropping
 * it would let the surviving parts make an unshippable bundle look in stock.
 */
function availableBundles(items: { qty: number; stockQty: number; deletedAt: Date | null }[]): number {
  const stock = items.reduce((minAvailable, item) => {
    const onHand = item.deletedAt ? 0 : item.stockQty;
    const available = item.qty > 0 ? Math.floor(onHand / item.qty) : 0;
    return Math.min(minAvailable, available);
  }, Number.POSITIVE_INFINITY);
  return Number.isFinite(stock) ? stock : 0;
}

/**
 * Returns a source entity's related targets in its own rank order.
 */
export async function listRelatedLinksForSourceRepo(
  sourceType: RelatedEntityType,
  sourceId: number
): Promise<RelatedRef[]> {
  const rows = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, sourceType), eq(relatedItems.sourceId, sourceId)))
    .orderBy(asc(relatedItems.rank), asc(relatedItems.id));
  return rows.map((row) => ({ type: row.targetType, id: row.targetId }));
}

/**
 * Hydrates a source entity's related targets into storefront cards, in this
 * source's rank order, filtered at read time:
 * - products: active, non-deleted, in-stock
 * - offers: active, non-deleted, visible
 * Filtered-out targets are dropped; remaining order (with gaps) is preserved.
 */
export async function getStorefrontRelatedCardsRepo(
  source: RelatedRef,
  lang: Language = "ar"
): Promise<StorefrontRelatedCard[]> {
  const ordered = await listRelatedLinksForSourceRepo(source.type, source.id);
  if (ordered.length === 0) {
    return [];
  }

  const productIds = ordered.filter((ref) => ref.type === "product").map((ref) => ref.id);
  const offerIds = ordered.filter((ref) => ref.type === "offer").map((ref) => ref.id);
  const collectionIds = ordered.filter((ref) => ref.type === "collection").map((ref) => ref.id);

  // A related card carries the same stars as the card it mirrors elsewhere.
  // Started here but only awaited at assembly, so the ratings travel alongside
  // the card queries instead of delaying them. Safe to leave floating: these
  // never reject.
  const ratingsPromise = Promise.all([
    safeRatingSummaries("product", productIds),
    safeRatingSummaries("offer", offerIds),
    safeRatingSummaries("collection", collectionIds)
  ]);
  const mediaPromise = Promise.all([
    loadEntityMediaRows("product", productIds),
    loadEntityMediaRows("offer", offerIds),
    loadEntityMediaRows("collection", collectionIds)
  ]);
  const [productMedia, offerMedia, collectionMedia] = await mediaPromise;
  const imageFor = (
    type: "product" | "offer" | "collection",
    id: number,
    imagePath: string | null
  ) => {
    const mediaRows = (type === "product" ? productMedia : type === "offer" ? offerMedia : collectionMedia).get(id);
    return resolvePrimaryEntityImagePath(normalizeEntityMedia(mediaRows, imagePath), imagePath, lang);
  };

  const productCards = new Map<number, UnratedRelatedCard>();
  if (productIds.length > 0) {
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        arName: products.arName,
        enName: products.enName,
        imagePath: products.imagePath,
        categoryArName: categories.arName,
        categoryEnName: categories.enName
      })
      .from(products)
      // A product can point at a soft-deleted category; the shop grid resolves
      // names from active categories only, so the card must not name a dead one.
      .leftJoin(categories, and(eq(categories.id, products.categoryId), isNull(categories.deletedAt)))
      .where(and(inArray(products.id, productIds), eq(products.status, "active"), isNull(products.deletedAt)));

    const variantRows = rows.length
      ? await db
          .select({
            id: productVariants.id,
            productId: productVariants.productId,
            sellingPrice: productVariants.sellingPrice,
            stockQty: productVariants.stockQty,
            discountType: variantDiscounts.type,
            discountValue: variantDiscounts.value,
            discountStartsAt: variantDiscounts.startsAt,
            discountEndsAt: variantDiscounts.endsAt,
            discountStatus: variantDiscounts.status
          })
          .from(productVariants)
          .leftJoin(variantDiscounts, eq(variantDiscounts.variantId, productVariants.id))
          .where(
            and(
              inArray(productVariants.productId, rows.map((row) => row.id)),
              // Soft delete leaves stock_qty untouched, so a deleted variant
              // still looks purchasable here — and checkout would reject it.
              isNull(productVariants.deletedAt)
            )
          )
          // Deterministic tie-break: equal-priced variants must always yield the
          // same card, or the SKU being added would vary between requests.
          .orderBy(asc(productVariants.sortOrder), asc(productVariants.id))
      : [];

    for (const row of rows) {
      const inStockVariants = variantRows
        .filter((variant) => variant.productId === row.id && variant.stockQty > 0)
        .map((variant) => ({ variant, price: effectivePriceOf(variant) }));
      if (inStockVariants.length === 0) {
        continue;
      }
      // The card transacts on the cheapest in-stock variant, so that variant's
      // effective price is the card price and its selling price the original.
      const cheapest = inStockVariants.reduce((lowest, candidate) =>
        candidate.price < lowest.price ? candidate : lowest
      ).variant;
      const price = effectivePriceOf(cheapest);
      productCards.set(row.id, {
        type: "product",
        id: row.id,
        slug: row.slug,
        name: { ar: row.arName, en: row.enName },
        imagePath: imageFor("product", row.id, row.imagePath),
        price,
        variantId: cheapest.id,
        originalTotal: savingOrNull(Number(cheapest.sellingPrice), price),
        categoryName: row.categoryArName != null && row.categoryEnName != null
          ? { ar: row.categoryArName, en: row.categoryEnName }
          : null
      });
    }
  }

  const offerCards = new Map<number, UnratedRelatedCard>();
  if (offerIds.length > 0) {
    const rows = await db
      .select({
        id: offers.id,
        slug: offers.slug,
        arName: offers.arName,
        enName: offers.enName,
        imagePath: offers.imagePath,
        fixedPrice: offers.fixedPrice
      })
      .from(offers)
      .where(
        and(
          inArray(offers.id, offerIds),
          eq(offers.status, "active"),
          eq(offers.visibility, "visible"),
          isNull(offers.deletedAt)
        )
      );

    const itemRows = rows.length
      ? await db
          .select({
            offerId: offerItems.offerId,
            qty: offerItems.qty,
            stockQty: productVariants.stockQty,
            deletedAt: productVariants.deletedAt,
            sellingPrice: productVariants.sellingPrice
          })
          .from(offerItems)
          .innerJoin(productVariants, eq(productVariants.id, offerItems.variantId))
          .where(inArray(offerItems.offerId, rows.map((row) => row.id)))
      : [];

    for (const row of rows) {
      const items = itemRows.filter((item) => item.offerId === row.id);
      // A sold-out bundle must not reach a card that can add it to the cart.
      if (availableBundles(items) <= 0) {
        continue;
      }
      const price = Number(row.fixedPrice);
      const parts = sumBundleParts(items);
      offerCards.set(row.id, {
        type: "offer",
        id: row.id,
        slug: row.slug,
        name: { ar: row.arName, en: row.enName },
        imagePath: imageFor("offer", row.id, row.imagePath),
        price,
        variantId: null,
        originalTotal: savingOrNull(parts, price),
        categoryName: null
      });
    }
  }

  const collectionCards = new Map<number, UnratedRelatedCard>();
  if (collectionIds.length > 0) {
    const rows = await db
      .select({
        id: collections.id,
        slug: collections.slug,
        arName: collections.arName,
        enName: collections.enName,
        imagePath: collections.imagePath,
        fixedPrice: collections.fixedPrice
      })
      .from(collections)
      .where(
        and(
          inArray(collections.id, collectionIds),
          eq(collections.status, "active"),
          eq(collections.visibility, "visible"),
          isNull(collections.deletedAt)
        )
      );

    const itemRows = rows.length
      ? await db
          .select({
            collectionId: collectionItems.collectionId,
            variantId: collectionItems.variantId,
            qty: collectionItems.qty,
            stockQty: productVariants.stockQty,
            deletedAt: productVariants.deletedAt,
            sellingPrice: productVariants.sellingPrice
          })
          .from(collectionItems)
          .innerJoin(productVariants, eq(productVariants.id, collectionItems.variantId))
          .where(inArray(collectionItems.collectionId, rows.map((row) => row.id)))
      : [];

    for (const row of rows) {
      const items = itemRows.filter((item) => item.collectionId === row.id);
      if (availableBundles(items) <= 0) {
        continue;
      }
      const price = Number(row.fixedPrice);
      collectionCards.set(row.id, {
        type: "collection",
        id: row.id,
        slug: row.slug,
        name: { ar: row.arName, en: row.enName },
        imagePath: imageFor("collection", row.id, row.imagePath),
        price,
        variantId: null,
        originalTotal: savingOrNull(sumBundleParts(items), price),
        categoryName: null
      });
    }
  }

  const [productRatings, offerRatings, collectionRatings] = await ratingsPromise;

  return ordered.flatMap((ref) => {
    const card = ref.type === "product"
      ? productCards.get(ref.id)
      : ref.type === "offer"
        ? offerCards.get(ref.id)
        : collectionCards.get(ref.id);
    if (!card) {
      return [];
    }
    const ratings = ref.type === "product"
      ? productRatings
      : ref.type === "offer"
        ? offerRatings
        : collectionRatings;
    return [{ ...card, rating: ratings.get(ref.id) ?? EMPTY_RATING }];
  });
}
