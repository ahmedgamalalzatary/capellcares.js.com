import { pickLang, type Bilingual, type Language, type Product } from "@capella/shared";

import type { NavGroup, NavNode } from "@/lib/nav";

interface HeaderMenuProductLink {
  id: number;
  slug: string;
  label: string;
  name: Bilingual;
  imagePath: string;
}

interface HeaderMenuProductsEntry {
  type: "products";
  key: string;
  slug: string;
  label: string;
  products: HeaderMenuProductLink[];
}

interface HeaderMenuCategoryEntry {
  type: "category";
  key: string;
  slug: string;
  label: string;
  sortOrder?: number;
  children: NavNode[];
}

export type HeaderMenuEntry = HeaderMenuProductsEntry | HeaderMenuCategoryEntry;

export function buildHeaderMenu({
  navGroups,
  products,
  dict,
  lang
}: {
  navGroups: NavGroup[];
  products: Product[];
  dict: { nav: { new: string; bestsellers: string } };
  lang: Language;
}): HeaderMenuEntry[] {
  const activeProducts = products.filter((product) => product.status === "active" && !product.deletedAt);

  return [
    {
      type: "products",
      key: "new",
      slug: "new",
      label: dict.nav.new,
      products: activeProducts
        .filter((product) => product.isNew)
        .map((product) => ({ id: product.id, slug: product.slug, label: pickLang(product.name, lang), name: product.name, imagePath: product.imagePath }))
    },
    {
      type: "products",
      key: "bestsellers",
      slug: "bestsellers",
      label: dict.nav.bestsellers,
      products: activeProducts
        .filter((product) => product.isBestseller)
        .map((product) => ({ id: product.id, slug: product.slug, label: pickLang(product.name, lang), name: product.name, imagePath: product.imagePath }))
    },
    ...navGroups.map((group) => ({
      type: "category" as const,
      key: `category-${group.root.id}`,
      slug: group.root.slug,
      label: pickLang(group.root.name, lang),
      sortOrder: group.root.sortOrder ?? 0,
      children: group.children
    }))
  ];
}
