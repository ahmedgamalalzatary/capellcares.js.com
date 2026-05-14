import { type Category, type Language, pickLang } from "@capella/shared";

export interface NavGroup {
  root: Category;
  children: { id: number; slug: string; label: string }[];
}

export function buildNav(categories: Category[], lang: Language): NavGroup[] {
  const roots = categories.filter((c) => c.parentId === null && !c.deletedAt);
  return roots.map((root) => ({
    root,
    children: categories
      .filter((c) => c.parentId === root.id && !c.deletedAt)
      .slice(0, 8)
      .map((c) => ({ id: c.id, slug: c.slug, label: pickLang(c.name, lang) }))
  }));
}
