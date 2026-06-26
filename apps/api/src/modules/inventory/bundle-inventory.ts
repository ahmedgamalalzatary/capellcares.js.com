import { inArray } from "drizzle-orm";
import { db } from "@minikoshk/database/src/db";
import { productVariants } from "@minikoshk/database/drizzle/schema";

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
