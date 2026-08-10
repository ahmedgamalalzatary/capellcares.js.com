import { and, eq, inArray, isNull } from "drizzle-orm";
import { entityOrderings, orderingScopeTypes, products } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { listCategoryBranchIdsRepo } from "../category.repository.js";
import {
  assertCompleteOrderedIds,
  replaceScopedOrderingRepo
} from "../entity-ordering.repository.js";

export type ProductOrderingRow = {
  scopeType: (typeof orderingScopeTypes)[number];
  scopeId: number | null;
  entityId: number;
  rank: number;
};

export async function loadProductOrderingRowsRepo(productIds: number[]): Promise<ProductOrderingRow[]> {
  if (productIds.length === 0) {
    return [];
  }

  return db
    .select({
      scopeType: entityOrderings.scopeType,
      scopeId: entityOrderings.scopeId,
      entityId: entityOrderings.entityId,
      rank: entityOrderings.rank
    })
    .from(entityOrderings)
    .where(
      and(
        eq(entityOrderings.entityType, "product"),
        inArray(entityOrderings.entityId, productIds)
      )
    );
}

export function rankForProductScope(
  orderingRows: ProductOrderingRow[],
  scopeCategoryId: number | null
) {
  const rankByProductId = new Map<number, number>();
  for (const row of orderingRows) {
    const matchesScope = scopeCategoryId == null
      ? row.scopeType === "root" && row.scopeId == null
      : row.scopeType === "category" && row.scopeId === scopeCategoryId;
    if (matchesScope) {
      rankByProductId.set(row.entityId, row.rank);
    }
  }
  return rankByProductId;
}

export async function reorderProductsRepo(input: { categoryId: number | null; ids: number[] }) {
  const { categoryId, ids } = input;
  const scopeRows = categoryId == null
    ? await db.select({ id: products.id }).from(products).where(isNull(products.deletedAt))
    : await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            inArray(products.categoryId, await listCategoryBranchIdsRepo(categoryId)),
            isNull(products.deletedAt)
          )
        );

  assertCompleteOrderedIds({
    requestedIds: ids,
    scopeEntityIds: scopeRows.map((row) => row.id),
    errorCode: "INVALID_PRODUCT_ORDER",
    errorMessage: "Product order does not match the scope's products"
  });

  await replaceScopedOrderingRepo({
    scopeType: categoryId == null ? "root" : "category",
    scopeId: categoryId,
    entityType: "product",
    ids
  });
}
