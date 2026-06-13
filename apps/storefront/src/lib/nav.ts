import { compareByScopedOrdering, type Category, type Language, pickLang } from "@capella/shared";

export interface NavNode {
  id: number;
  slug: string;
  label: string;
  children: NavNode[];
}

export interface NavGroup {
  root: Category;
  children: NavNode[];
}

export function buildNav(categories: Category[], lang: Language): NavGroup[] {
  const active = categories.filter((c) => !c.deletedAt);
  // Categories display the same as the ERP tree (oldest unranked first), unlike
  // other storefront entities — so order them with the "erp" surface.
  const roots = active
    .filter((c) => c.parentId === null)
    .sort(compareByScopedOrdering.bind(null, "erp"));
  const byParent = new Map<number | null, Category[]>();

  for (const category of active) {
    const children = byParent.get(category.parentId) ?? [];
    children.push(category);
    byParent.set(category.parentId, children);
  }

  const buildNodes = (parentId: number): NavNode[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort(compareByScopedOrdering.bind(null, "erp"))
      .map((category) => ({
      id: category.id,
      slug: category.slug,
      label: pickLang(category.name, lang),
      children: buildNodes(category.id)
      }));

  return roots.map((root) => ({
    root,
    children: buildNodes(root.id)
  }));
}
