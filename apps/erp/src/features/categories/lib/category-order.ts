import { compareByScopedOrdering, type Category } from "@capella/shared";

export function categoryParentKey(parentId: number | null) {
  return parentId == null ? "root" : `parent:${parentId}`;
}

export function buildPersistedCategoryOrders(categories: Category[]) {
  const grouped = new Map<string, number[]>();
  const byParent = new Map<number | null, Category[]>();
  for (const category of categories) {
    const siblings = byParent.get(category.parentId) ?? [];
    siblings.push(category);
    byParent.set(category.parentId, siblings);
  }
  for (const [parentId, siblings] of byParent.entries()) {
    grouped.set(
      categoryParentKey(parentId),
      siblings
        .slice()
        .sort(compareByScopedOrdering.bind(null, "erp"))
        .map((category) => category.id)
    );
  }
  return grouped;
}
