import { inArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { productVariants } from "@capella/database/drizzle/schema";

export async function calculateCollectionInventory(items: Array<{ variantId: number; qty: number }>) {
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
    const availableBundles = item.qty > 0 ? Math.floor((variant?.stockQty ?? 0) / item.qty) : 0;
    return Math.min(minAvailable, availableBundles);
  }, Number.POSITIVE_INFINITY);

  return {
    originalTotal,
    stock: Number.isFinite(stock) ? stock : 0
  };
}

export function computeCollectionInventoryFromMap(
  items: Array<{ variantId: number; qty: number }>,
  variantMap: Map<number, { sellingPrice: unknown; stockQty: number }>
) {
  if (items.length === 0) {
    return { originalTotal: 0, stock: 0 };
  }

  const originalTotal = items.reduce((sum, item) => {
    const variant = variantMap.get(item.variantId);
    return sum + Number(variant?.sellingPrice ?? 0) * item.qty;
  }, 0);

  const stock = items.reduce((minAvailable, item) => {
    const variant = variantMap.get(item.variantId);
    const availableBundles = item.qty > 0 ? Math.floor((variant?.stockQty ?? 0) / item.qty) : 0;
    return Math.min(minAvailable, availableBundles);
  }, Number.POSITIVE_INFINITY);

  return {
    originalTotal,
    stock: Number.isFinite(stock) ? stock : 0
  };
}
