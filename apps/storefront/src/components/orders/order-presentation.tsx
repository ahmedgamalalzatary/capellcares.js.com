"use client";

import { useEffect, useState } from "react";
import {
  pickLang,
  type Category,
  type Collection,
  type Language,
  type Offer,
  type OrderItem,
  type PaymentStatus,
  type Product
} from "@capella/shared";
import { fetchCategories, fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
import { Icon } from "@/components/ui/icons";

/**
 * Order lines store only a name/size snapshot — never an image — because an
 * order is a historical record that must not shift when the catalog is edited.
 * To show thumbnails we resolve each line back to the live entity by id, and
 * fall back to a neutral placeholder when that entity has since been deleted.
 * The snapshot still wins for name and price, so the receipt stays truthful.
 */
export interface Catalog {
  products: Product[];
  offers: Offer[];
  collections: Collection[];
  categories: Category[];
  loaded: boolean;
}

export function useCatalog(): Catalog {
  const [catalog, setCatalog] = useState<Catalog>({
    products: [],
    offers: [],
    collections: [],
    categories: [],
    loaded: false
  });

  useEffect(() => {
    let cancelled = false;
    // Settled, not all-or-nothing: one failing catalog used to discard the two
    // that did load, so every order line rendered as "unavailable".
    Promise.allSettled([fetchProducts(), fetchOffers(), fetchCollections(), fetchCategories()])
      .then(([products, offers, collections, categories]) => {
        if (cancelled) return;
        setCatalog((current) => ({
          products: products.status === "fulfilled" ? products.value : current.products,
          offers: offers.status === "fulfilled" ? offers.value : current.offers,
          collections: collections.status === "fulfilled" ? collections.value : current.collections,
          categories: categories.status === "fulfilled" ? categories.value : current.categories,
          loaded: true
        }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return catalog;
}

/** The storefront route an order line points at, or null once the entity is gone. */
export function orderItemHref(item: OrderItem, catalog: Catalog, lang: Language): string | null {
  if (item.itemType === "product_variant") {
    const product = catalog.products.find((p) => p.variants.some((v) => v.id === item.variantId));
    return product ? `/${lang}/products/${product.slug}` : null;
  }
  if (item.itemType === "offer") {
    const offer = catalog.offers.find((o) => o.id === item.offerId);
    return offer ? `/${lang}/offers/${offer.slug}` : null;
  }
  const collection = catalog.collections.find((c) => c.id === item.collectionId);
  return collection ? `/${lang}/collections/${collection.slug}` : null;
}

/**
 * The category a product line belongs to, resolved through the live catalog.
 * Order lines snapshot only name/size, so a deleted product (or an unloaded
 * catalog) yields null and the caller simply omits the category.
 */
export function orderItemCategory(item: OrderItem, catalog: Catalog, lang: Language): string | null {
  if (item.itemType !== "product_variant") return null;
  const product = catalog.products.find((p) => p.variants.some((v) => v.id === item.variantId));
  const category = product ? catalog.categories.find((c) => c.id === product.categoryId) : undefined;
  return category ? pickLang(category.name, lang) : null;
}

export function OrderItemMedia({
  item,
  catalog,
  lang,
  className = "h-full w-full object-cover"
}: {
  item: OrderItem;
  catalog: Catalog;
  lang: Language;
  className?: string;
}) {
  if (item.itemType === "product_variant") {
    const product = catalog.products.find((p) => p.variants.some((v) => v.id === item.variantId));
    if (product) return <ProductIllustration product={product} className={className} />;
  } else if (item.itemType === "offer") {
    const offer = catalog.offers.find((o) => o.id === item.offerId);
    if (offer) return <OfferIllustration offer={offer} className={className} />;
  } else {
    const collection = catalog.collections.find((c) => c.id === item.collectionId);
    if (collection) return <CollectionIllustration collection={collection} lang={lang} className={className} />;
  }

  // The catalog entry is gone (deleted, or the fetch failed): the order line is
  // still valid history, so show a neutral mark rather than a broken image.
  return (
    <div className="grid h-full w-full place-items-center bg-(--warm-soft) text-(--ink-3)">
      <Icon.Cart size={20} />
    </div>
  );
}

export function orderItemName(item: OrderItem, lang: Language): string {
  return lang === "ar"
    ? item.snapshotNameAr ?? item.snapshotNameEn ?? ""
    : item.snapshotNameEn ?? item.snapshotNameAr ?? "";
}

/**
 * `paymentStatus` is a fixed union, so it maps to a localized label directly —
 * the previous substring sniffing on the raw English value leaked untranslated
 * status text into the Arabic pages.
 */
export function paymentStatusLabel(status: PaymentStatus, dict: any): string {
  if (status === "accepted") return dict.orders.statusAccepted;
  if (status === "denied") return dict.orders.statusDenied;
  return dict.orders.statusPending;
}

export function paymentStatusChip(status: PaymentStatus): string {
  if (status === "accepted") return "chip--sage";
  if (status === "denied") return "chip--accent";
  return "chip--gold";
}

export function formatOrderDate(value: string, lang: Language): string {
  return new Date(value).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function itemsCountLabel(units: number, dict: any): string {
  return units === 1
    ? dict.orders.itemsCountOne
    : (dict.orders.itemsCount ?? "{n}").replace("{n}", String(units));
}

export { pickLang };
