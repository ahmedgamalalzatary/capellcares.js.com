import { type Category, type Language, pickLang } from "@capella/shared";

export interface NavLeaf {
  id: number;
  slug: string;
  label: string;
}

export interface NavChild extends NavLeaf {
  grandchildren: NavLeaf[];
}

export interface NavGroup {
  root: Category;
  children: NavChild[];
}

export function buildNav(categories: Category[], lang: Language): NavGroup[] {
  const active = categories.filter((c) => !c.deletedAt);
  const roots = active.filter((c) => c.parentId === null);

  return roots.map((root) => ({
    root,
    children: active
      .filter((c) => c.parentId === root.id)
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        label: pickLang(c.name, lang),
        grandchildren: active
          .filter((gc) => gc.parentId === c.id)
          .map((gc) => ({ id: gc.id, slug: gc.slug, label: pickLang(gc.name, lang) }))
      }))
  }));
}
