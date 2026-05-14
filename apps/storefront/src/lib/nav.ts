import { mock, type Category, type Language, pickLang } from "@capella/shared";

export interface NavGroup {
  root: Category;
  children: { id: number; slug: string; label: string }[];
}

export function buildNav(lang: Language): NavGroup[] {
  const roots = mock.categories.filter((c) => c.parentId === null);
  return roots.map((root) => ({
    root,
    children: mock.categories
      .filter((c) => c.parentId === root.id)
      .slice(0, 8)
      .map((c) => ({ id: c.id, slug: c.slug, label: pickLang(c.name, lang) }))
  }));
}
