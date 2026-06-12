import type { Category } from "@capella/shared";

export function getDescendantCategoryIds(categories: Category[], rootId: number): Set<number> {
  const ids = new Set<number>([rootId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.deletedAt) {
        continue;
      }
      if (category.parentId != null && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }

  return ids;
}
