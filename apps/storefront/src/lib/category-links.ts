import type { Language } from "@capella/shared";

/** Whether shoppers are shown this category in menus, filters, search and the sitemap: not deleted, and not empty. A category with no visible product stays reachable by link, where its page says "coming soon". */
export function isListedCategory(category: { deletedAt?: string | null; hasProducts?: boolean }) {
  return !category.deletedAt && category.hasProducts !== false;
}

type CategoryLinkable = {
  id?: number;
  slug: string;
};

export function buildCategoryHref(lang: Language, category: CategoryLinkable) {
  const baseHref = `/${lang}/category/${category.slug}`;
  return category.id == null ? baseHref : `${baseHref}?categoryId=${category.id}`;
}
