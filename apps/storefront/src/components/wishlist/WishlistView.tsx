"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ProductCard } from "@/components/homepage/ProductCard";
import { useWishlist } from "@/hooks/useWishlist";
import { apiGetOr } from "@/lib/api/client";
import type { StorefrontProduct } from "@/lib/products";

/**
 * Wishlist page body: resolves the wishlisted product ids against the live
 * catalog and renders the standard product cards (whose hearts un-wishlist in
 * place). Ids no longer in the catalog are simply not rendered.
 */
export function WishlistView() {
  const { lang, dict } = useLocale();
  const { ids } = useWishlist();
  const [catalog, setCatalog] = useState<StorefrontProduct[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGetOr<{ items: StorefrontProduct[] }>("/products", { items: [] }).then((payload) => {
      if (!cancelled) setCatalog(payload.items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const products = (catalog ?? []).filter((product) => ids.includes(product.id));

  if (catalog !== null && products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-lg text-gray-500">{dict.wishlistPage.empty}</p>
        <a
          href={`/${lang}/products`}
          className="mt-6 inline-block rounded-full bg-brand-dark px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black"
        >
          {dict.wishlistPage.browse}
        </a>
      </div>
    );
  }

  return (
    <section aria-label={dict.wishlistPage.title} className="py-8">
      <h1 className="mb-6 text-2xl font-extrabold uppercase tracking-[0.15em] text-brand-dark">
        {dict.wishlistPage.title}
      </h1>
      <div className="grid grid-cols-2 gap-4 min-[600px]:grid-cols-3 min-[900px]:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
        ))}
      </div>
    </section>
  );
}
