import {
  compareByScopedOrdering,
  pickLang,
  type Bilingual,
  type Collection,
  type Language,
  type Offer,
  type Product
} from "@capella/shared";

import type { NavGroup, NavNode } from "@/lib/nav";

interface HeaderMenuMediaLink {
  id: number;
  slug: string;
  label: string;
  name: Bilingual;
  imagePath: string;
}

type HeaderMenuProductLink = HeaderMenuMediaLink;

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
  createdAt?: string;
  id?: number;
  children: NavNode[];
}

interface HeaderMenuOffersEntry {
  type: "offers";
  key: string;
  slug: string;
  label: string;
  offers: HeaderMenuMediaLink[];
}

interface HeaderMenuCollectionsEntry {
  type: "collections";
  key: string;
  slug: string;
  label: string;
  collections: HeaderMenuMediaLink[];
}

export type HeaderMenuEntry =
  | HeaderMenuProductsEntry
  | HeaderMenuCategoryEntry
  | HeaderMenuOffersEntry
  | HeaderMenuCollectionsEntry;

function toMediaLink(item: { id: number; slug: string; name: Bilingual; imagePath: string }, lang: Language): HeaderMenuMediaLink {
  return { id: item.id, slug: item.slug, label: pickLang(item.name, lang), name: item.name, imagePath: item.imagePath };
}

export function buildHeaderMenu({
  navGroups,
  products,
  offers,
  collections,
  dict,
  lang
}: {
  navGroups: NavGroup[];
  products: Product[];
  offers: Offer[];
  collections: Collection[];
  dict: { nav: { new: string; bestsellers: string; offers: string; collections: string } };
  lang: Language;
}): HeaderMenuEntry[] {
  const activeProducts = products.filter((product) => product.status === "active" && !product.deletedAt);

  return [
    {
      type: "products",
      key: "new",
      slug: "new",
      label: dict.nav.new,
      products: activeProducts.filter((product) => product.isNew).map((product) => toMediaLink(product, lang))
    },
    {
      type: "products",
      key: "bestsellers",
      slug: "bestsellers",
      label: dict.nav.bestsellers,
      products: activeProducts.filter((product) => product.isBestseller).map((product) => toMediaLink(product, lang))
    },
    {
      type: "offers",
      key: "offers",
      slug: "offers",
      label: dict.nav.offers,
      offers: offers
        .filter((offer) => offer.status === "active" && !offer.deletedAt)
        .map((offer) => toMediaLink(offer, lang))
    },
    ...navGroups.map((group) => ({
      type: "category" as const,
      key: `category-${group.root.id}`,
      id: group.root.id,
      slug: group.root.slug,
      label: pickLang(group.root.name, lang),
      sortOrder: group.root.sortOrder,
      createdAt: group.root.createdAt,
      children: group.children
    })),
    {
      type: "collections",
      key: "collections",
      slug: "collections",
      label: dict.nav.collections,
      collections: collections
        .filter((collection) => collection.status === "active" && collection.visibility === "visible" && !collection.deletedAt)
        .map((collection) => toMediaLink(collection, lang))
    }
  ];
}

export function compareHeaderCategoryEntries(left: HeaderMenuCategoryEntry, right: HeaderMenuCategoryEntry) {
  // Categories mirror the ERP tree (oldest unranked first), so use the "erp" surface.
  return compareByScopedOrdering(
    "erp",
    { ...left, id: left.id ?? 0 },
    { ...right, id: right.id ?? 0 }
  );
}
