import { compareByScopedOrdering, type Category } from "@capella/shared";

export type CategoryTreeOption = { id: number; label: string; depth: number };

// Flattens the active categories the way every ERP category picker shows them: each parent is followed by its own descendants, and `depth` drives the "— " prefix.
export function buildCategoryTreeOptions(categories: Category[]): CategoryTreeOption[] {
  const active = categories
    .filter((category) => !category.deletedAt)
    .slice()
    .sort(compareByScopedOrdering.bind(null, "erp"));
  const childrenByParent = new Map<number | null, Category[]>();
  for (const category of active) {
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const options: CategoryTreeOption[] = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const category of childrenByParent.get(parentId) ?? []) {
      options.push({ id: category.id, label: category.name.ar, depth });
      visit(category.id, depth + 1);
    }
  };
  visit(null, 0);
  return options;
}

export function isInCategoryTree(categories: Category[], categoryId: number | null, selectedCategoryId: number) {
  if (categoryId == null) return false;
  let current = categories.find((category) => category.id === categoryId);
  const visited = new Set<number>();
  while (current) {
    if (visited.has(current.id)) return false;
    if (current.id === selectedCategoryId) return true;
    visited.add(current.id);
    current = current.parentId != null ? categories.find((category) => category.id === current!.parentId) : undefined;
  }
  return false;
}

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
