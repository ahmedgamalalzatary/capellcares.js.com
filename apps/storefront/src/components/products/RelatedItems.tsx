"use client";

import type { RelatedItemCard } from "@minikoshk/shared";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice } from "@/lib/format";

const DETAIL_PATH: Record<RelatedItemCard["type"], string> = {
  product: "products",
  offer: "offers",
  collection: "collections"
};

/** "You may also like" strip rendered under product/offer/collection detail pages. */
export function RelatedItems({ items }: { items?: RelatedItemCard[] }) {
  const { lang, dict } = useLocale();
  if (!items || items.length === 0) {
    return null;
  }
  return (
    <section aria-label={dict.pages.relatedItems} className="mx-auto max-w-5xl px-4 pb-12">
      <h2 className="mb-5 text-xl font-bold uppercase tracking-[0.2em] text-brand-dark">{dict.pages.relatedItems}</h2>
      <div className="grid grid-cols-2 gap-4 min-[600px]:grid-cols-3 min-[900px]:grid-cols-4">
        {items.map((item) => (
          <a
            key={`${item.type}-${item.id}`}
            href={`/${lang}/${DETAIL_PATH[item.type]}/${item.slug}`}
            className="group rounded-2xl border border-transparent bg-white p-3 transition hover:border-gray-200 hover:shadow-lg"
          >
            <div className="aspect-square overflow-hidden rounded-xl bg-[#f5f5f5]">
              {item.imagePath ? (
                <img src={item.imagePath} alt={item.name[lang]} className="h-full w-full object-contain p-4" />
              ) : null}
            </div>
            <h3 className="mt-2 text-sm font-bold uppercase text-brand-dark">{item.name[lang]}</h3>
            <p className="mt-1 text-sm font-extrabold text-brand-dark">{formatPrice(item.price, lang, dict.product.currency)}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
