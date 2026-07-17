"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiGet } from "@/lib/api/client";
import type { StorefrontBundle } from "@/lib/bundles";
import type { StorefrontProduct } from "@/lib/products";
import { CART_UPDATED_EVENT, readCart, type CartLine } from "@/lib/cart";

export interface ResolvedLine {
  line: CartLine;
  name: string;
  detail: string;
  imagePath: string;
  unitPrice: number;
  /** How many can be bought (variant/bundle stock); Infinity when unknown. */
  maxQty: number;
  href: string;
  /** False when the referenced product/offer/collection no longer exists in the catalog. */
  available: boolean;
}

interface Catalog {
  products: StorefrontProduct[];
  offers: StorefrontBundle[];
  collections: StorefrontBundle[];
}

function resolveLine(line: CartLine, catalog: Catalog, lang: "ar" | "en", sizeLabel: string): ResolvedLine {
  if (line.type === "product") {
    for (const product of catalog.products) {
      const variant = product.variants.find((candidate) => candidate.id === line.variantId);
      if (variant) {
        const size = product.sizes.find((candidate) => candidate.id === variant.sizeId);
        return {
          line,
          name: product.name[lang],
          detail: size ? `${sizeLabel}: ${size.label}` : "",
          imagePath: product.imagePath,
          unitPrice: variant.price,
          maxQty: variant.stock,
          href: `/${lang}/products/${product.slug}?variant=${variant.id}`,
          available: true
        };
      }
    }
    return { line, name: `#${line.variantId}`, detail: "", imagePath: "", unitPrice: 0, maxQty: 0, href: "", available: false };
  }
  const isOffer = line.type === "offer";
  const id = isOffer ? line.offerId : line.collectionId;
  const bundle = (isOffer ? catalog.offers : catalog.collections).find((candidate) => candidate.id === id);
  if (!bundle) {
    return { line, name: `#${id}`, detail: "", imagePath: "", unitPrice: 0, maxQty: 0, href: "", available: false };
  }
  return {
    line,
    name: bundle.name[lang],
    detail: "",
    imagePath: bundle.imagePath,
    unitPrice: bundle.price,
    maxQty: bundle.stock,
    href: `/${lang}/${isOffer ? "offers" : "collections"}/${bundle.slug}`,
    available: true
  };
}

/**
 * Live cart lines resolved against the current catalog. The cart stores only
 * catalog references, so prices/names always reflect what checkout will
 * actually charge. `loading` is true until the catalog arrives.
 */
export function useResolvedCart() {
  const { lang, dict } = useLocale();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setLines(readCart());
    const onUpdate = () => setLines(readCart());
    window.addEventListener(CART_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(CART_UPDATED_EVENT, onUpdate);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<{ items: StorefrontProduct[] }>("/products"),
      apiGet<{ items: StorefrontBundle[] }>("/offers"),
      apiGet<{ items: StorefrontBundle[] }>("/collections")
    ]).then(([products, offers, collections]) => {
      if (!cancelled) {
        setCatalog({ products: products?.items ?? [], offers: offers?.items ?? [], collections: collections?.items ?? [] });
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = useMemo(
    () => (catalog ? lines.map((line) => resolveLine(line, catalog, lang, dict.cart.size)) : []),
    [catalog, lines, lang, dict]
  );
  const total = resolved.reduce(
    (sum, item) => (item.available ? sum + item.unitPrice * item.line.qty : sum),
    0
  );

  return { lines, resolved, total, loading: catalog === null && error === null, error };
}
