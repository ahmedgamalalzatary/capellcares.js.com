import type { Category, Product } from "@capella/shared";

/** A category section's row shows this many products; the rest are one "View all" away. */
export const CATEGORY_SECTION_PRODUCT_LIMIT = 12;

/** The category and every category beneath it, at any depth. Empty when the category is unknown. */
function collectBranchIds(categoryId: number, categories: Category[]): Set<number> {
  if (!categories.some((category) => category.id === categoryId)) {
    return new Set();
  }
  const childrenByParent = new Map<number, number[]>();
  for (const category of categories) {
    if (category.parentId == null) continue;
    childrenByParent.set(category.parentId, [...(childrenByParent.get(category.parentId) ?? []), category.id]);
  }
  const ids = new Set<number>([categoryId]);
  const queue = [categoryId];
  while (queue.length > 0) {
    for (const childId of childrenByParent.get(queue.shift()!) ?? []) {
      if (!ids.has(childId)) {
        ids.add(childId);
        queue.push(childId);
      }
    }
  }
  return ids;
}

/** A category section's products: live products from the category and everything beneath it, newest first, at most 12. */
export function pickCategoryRowProducts(categoryId: number, categories: Category[], products: Product[]): Product[] {
  const branchIds = collectBranchIds(categoryId, categories);
  return products
    .filter((product) => branchIds.has(product.categoryId) && product.status === "active" && !product.deletedAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)
    .slice(0, CATEGORY_SECTION_PRODUCT_LIMIT);
}
