"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice, pickLang, type Category, type Collection, type Language, type Product, type RelatedItemCard } from "@capella/shared";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { RelatedItems } from "@/components/products/related-items";

interface ItemEntry {
  qty: number;
  variantId: number;
  product: Product;
  size: string;
  unitPrice: number;
  available: number;
}

export function CollectionDetail({
  collection,
  category,
  items,
  lang,
  dict,
  relatedItems = []
}: {
  collection: Collection;
  category?: Category;
  items: ItemEntry[];
  lang: Language;
  dict: any;
  relatedItems?: RelatedItemCard[];
}) {
  const router = useRouter();
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const savings = collection.originalTotal - collection.price;
  const inStock = items.every((item) => item.available >= item.qty);
  const isAr = lang === "ar";

  const add = () => {
    cart.add({ type: "collection", collectionId: collection.id, qty: 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const buyNow = () => {
    cart.add({ type: "collection", collectionId: collection.id, qty: 1 });
    router.push(`/${lang}/checkout`);
  };

  return (
    <>
      <div className="grid gap-7 py-3 sm:gap-10 sm:py-6 lg:grid-cols-2 lg:gap-[64px]">
        <div className="relative overflow-hidden rounded-(--radius-lg) border border-(--hairline) bg-[radial-gradient(120%_120%_at_50%_0%,var(--surface),var(--warm-soft))] sm:rounded-(--radius-xl)">
          <div className="absolute end-4 top-4 inline-flex items-center gap-1.5 rounded-(--radius-pill) bg-(--accent) px-3 py-1.5 text-[11px] tracking-[0.16em] text-(--canvas) uppercase sm:end-5 sm:top-5">
            ★ {dict.collections.badge}
          </div>
          <CollectionIllustration collection={collection} lang={lang} className="min-h-[260px] w-full sm:min-h-[360px] lg:min-h-[420px]" />
        </div>

        <div className="grid gap-5 self-start sm:gap-6">
          <span className="eyebrow !text-(--accent)">{dict.collections.collectionEyebrow}</span>
          <h1 className={`m-0 leading-[1.05] ${isAr
            ? "text-[clamp(28px,3.2vw,42px)] font-bold font-(--font-ar) tracking-normal text-(--ink)"
            : "text-[clamp(30px,3.4vw,46px)] italic font-(--font-display) tracking-[-0.01em] text-(--ink)"}`}>
            {pickLang(collection.name, lang)}
          </h1>
          <p className="max-w-[60ch] text-[15px] leading-[1.75] text-(--ink-2)">{pickLang(collection.description, lang)}</p>
          {category && (
            <div className="text-[13px] text-(--ink-3)">{dict.collections.categoryLabel}: {pickLang(category.name, lang)}</div>
          )}

          <div className="flex flex-wrap items-end gap-3 border-y border-(--hairline) py-4 sm:py-5">
            <span className={`leading-none text-(--accent) ${isAr
              ? "text-[30px] font-bold font-(--font-ar) sm:text-[36px]"
              : "text-[32px] italic font-(--font-display) sm:text-[40px]"}`}>
              {formatPrice(collection.price, lang)}
            </span>
            {savings > 0 && (
              <>
                <span className="text-(--ink-3) line-through">{formatPrice(collection.originalTotal, lang)}</span>
                <span className="chip chip--accent">{dict.common.save} {formatPrice(savings, lang)}</span>
              </>
            )}
          </div>

          <div className="grid gap-3">
            <div className="eyebrow !text-(--ink-3)">{dict.collections.itemsLabel}</div>
            <div className="grid gap-2">
              {items.map((item) => (
                <Link
                  key={`${item.product.id}-${item.variantId}`}
                  href={`/${lang}/products/${item.product.slug}`}
                  className="grid grid-cols-[68px_1fr_auto] items-center gap-4 rounded-(--radius) border border-(--hairline) bg-(--surface) p-3 transition-colors hover:border-(--warm) hover:bg-(--warm-soft)"
                >
                  <div className="h-[68px] w-[68px] overflow-hidden rounded-[10px] bg-(--warm-soft)">
                    <ProductIllustration product={item.product} className="h-full w-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-(--ink)">{pickLang(item.product.name, lang)}</div>
                    <div className="mt-0.5 text-[13px] text-(--ink-3)">{item.size} · ×{item.qty}</div>
                  </div>
                  <div className="ms-auto text-[14px] text-(--ink)">{formatPrice(item.unitPrice * item.qty, lang)}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn btn--primary btn--lg btn--block" onClick={add} disabled={!inStock}>
              <Icon.Cart size={18} /> {added ? dict.collections.added : dict.collections.addCollectionToCart}
            </button>
            <button className="btn btn--ghost btn--lg btn--block" onClick={buyNow} disabled={!inStock}>
              {dict.common.buyNow}
            </button>
          </div>

          {!inStock && (
            <p className="rounded-(--radius) bg-[color-mix(in_oklch,var(--error)_10%,transparent)] px-4 py-3 text-[13px] text-(--error)">
              {dict.collections.unavailable}
            </p>
          )}
        </div>
      </div>
      <RelatedItems items={relatedItems} lang={lang} title={dict.collections.related} />
    </>
  );
}
