import type { Language } from "@capella/shared";

type CategoryLinkable = {
  id: number;
  slug: string;
};

export function buildCategoryHref(lang: Language, category: CategoryLinkable) {
  return `/${lang}/category/${category.slug}?categoryId=${category.id}`;
}
