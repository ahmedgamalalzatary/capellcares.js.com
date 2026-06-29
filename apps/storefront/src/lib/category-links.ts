import type { Language } from "@capella/shared";

type CategoryLinkable = {
  id?: number;
  slug: string;
};

export function buildCategoryHref(lang: Language, category: CategoryLinkable) {
  const baseHref = `/${lang}/category/${category.slug}`;
  return category.id == null ? baseHref : `${baseHref}?categoryId=${category.id}`;
}
