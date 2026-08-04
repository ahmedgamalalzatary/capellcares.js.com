import { inArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { productVariants } from "@capella/database/drizzle/schema";

type BundleItem = { variantId: number; qty: number };
type VariantPricing = { sellingPrice: unknown; stockQty: number };

function sumOriginalTotal(items: BundleItem[], lookup: (variantId: number) => VariantPricing | undefined) {
  return items.reduce((sum, item) => {
    const variant = lookup(item.variantId);
    return sum + Number(variant?.sellingPrice ?? 0) * item.qty;
  }, 0);
}

function minAvailableBundles(items: BundleItem[], lookup: (variantId: number) => VariantPricing | undefined) {
  const stock = items.reduce((minAvailable, item) => {
    const variant = lookup(item.variantId);
    const availableBundles = item.qty > 0 ? Math.floor((variant?.stockQty ?? 0) / item.qty) : 0;
    return Math.min(minAvailable, availableBundles);
  }, Number.POSITIVE_INFINITY);
  return Number.isFinite(stock) ? stock : 0;
}

export async function calculateBundleInventory(items: BundleItem[]) {
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

  const lookup = (variantId: number) => variantRows.find((row) => row.id === variantId);
  return {
    originalTotal: sumOriginalTotal(items, lookup),
    stock: minAvailableBundles(items, lookup)
  };
}

export const PRICE_NOT_BELOW_ORIGINAL = "price-not-below-original";

/**
 * A bundle (offer or collection) must save the customer money: its fixed price
 * has to be strictly below the sum of its parts. Returns a rejection reason when
 * the price is at or above that total, or null when it is a genuine discount.
 * Bundles with no items are left to the caller's own validation.
 */
export async function validateBundlePriceBelowParts(
  fixedPrice: number,
  items: BundleItem[]
): Promise<typeof PRICE_NOT_BELOW_ORIGINAL | null> {
  if (items.length === 0) {
    return null;
  }
  const { originalTotal } = await calculateBundleInventory(items);
  if (originalTotal > 0 && fixedPrice >= originalTotal) {
    return PRICE_NOT_BELOW_ORIGINAL;
  }
  return null;
}

/**
 * One pricing/stock read covering every bundle on a page, for use with
 * `computeBundleInventoryFromMap` instead of a lookup per bundle.
 */
export async function loadBundleVariantMap(bundles: Array<{ items: BundleItem[] }>) {
  const variantIds = [...new Set(bundles.flatMap((bundle) => bundle.items.map((item) => item.variantId)))];
  if (variantIds.length === 0) {
    return new Map<number, VariantPricing>();
  }

  const variantRows = await db
    .select({
      id: productVariants.id,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty
    })
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds));
  return new Map<number, VariantPricing>(variantRows.map((row) => [row.id, row] as const));
}

export function computeBundleInventoryFromMap(
  items: BundleItem[],
  variantMap: Map<number, VariantPricing>
) {
  if (items.length === 0) {
    return { originalTotal: 0, stock: 0 };
  }

  const lookup = (variantId: number) => variantMap.get(variantId);
  return {
    originalTotal: sumOriginalTotal(items, lookup),
    stock: minAvailableBundles(items, lookup)
  };
}
