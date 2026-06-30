"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, type Language, type Offer, type Product, type RelatedItemCard } from "@capella/shared";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { ItemTagPill } from "@/components/ui/item-tags";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { RelatedItems } from "@/components/products/related-items";

interface ItemEntry {
  qty: number;
  variantId: number;
  product: Product;
  size: string;
  unitPrice: number;
  available: number;
}

interface Props {
  offer: Offer;
  items: ItemEntry[];
  lang: Language;
  dict: any;
  relatedItems?: RelatedItemCard[];
}

export function OfferDetail({ offer, items, lang, dict, relatedItems = [] }: Props) {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();
  const { user } = useAuth();
  const [added, setAdded] = useState(false);
  const savings = offer.originalTotal - offer.price;
  const inStock = items.every((item) => item.available >= item.qty);

  const add = () => {
    cart.add({ type: "offer", offerId: offer.id, qty: 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const buyNow = () => {
    cart.add({ type: "offer", offerId: offer.id, qty: 1 });
    router.push(`/${lang}/checkout`);
  };

  const onWish = () => {
    if (!user) {
      router.push(`/${lang}/wishlist`);
      return;
    }
    wishlist.toggle("offer", offer.id);
  };

  const isAr = lang === "ar";
  return (
    <>
      <div className="grid gap-7 py-3 sm:gap-10 sm:py-6 lg:grid-cols-2 lg:gap-16">
        <div className="relative overflow-hidden rounded-lg border border-(--hairline) bg-[radial-gradient(120%_120%_at_50%_0%,var(--surface),var(--warm-soft))] sm:rounded-xl">
          <ItemTagPill
            tag={{ kind: "offer", label: dict.offers.badge, star: true }}
            className="absolute inset-e-4 top-4 sm:inset-e-5 sm:top-5"
          />
          <OfferIllustration offer={offer} className="min-h-65 w-full sm:min-h-90 lg:min-h-105" />
        </div>

        <div className="grid gap-5 self-start sm:gap-6">
          <h1 className={`m-0 leading-[1.05] ${isAr
            ? "text-[clamp(28px,3.2vw,42px)] font-bold font-(family-name:--font-ar) tracking-normal text-ink"
            : "text-[clamp(30px,3.4vw,46px)] font-(--font-display) tracking-[-0.01em] text-ink"}`}>
            {pickLang(offer.name, lang)}
          </h1>
          <p className="max-w-[60ch] text-base leading-[1.75] text-(--ink-2)">{pickLang(offer.description, lang)}</p>

          <div className="flex flex-wrap items-end gap-3 border-y border-(--hairline) py-4 sm:py-5">
            <span className={`leading-none text-accent ${isAr
              ? "text-3xl font-bold font-(family-name:--font-ar) sm:text-[36px]"
              : "text-3xl font-(--font-display) sm:text-[40px]"}`}>
              {formatPrice(offer.price, lang)}
            </span>
            {savings > 0 && (
              <>
                <span className="text-(--ink-3) line-through">{formatPrice(offer.originalTotal, lang)}</span>
                <span className="chip chip--accent">{dict.offers.save.replace("{amount}", formatPrice(savings, lang))}</span>
              </>
            )}
          </div>

          <div className="grid gap-3">
            <div className="eyebrow text-(--ink-3)!">{dict.offers.includes}</div>
            <div className="grid gap-2">
              {items.map((item) => (
                <Link
                  key={`${item.product.id}-${item.variantId}`}
                  href={`/${lang}/products/${item.product.slug}`}
                  className="grid grid-cols-[68px_1fr_auto] items-center gap-4 rounded-(--radius) border border-(--hairline) bg-surface p-3 transition-colors hover:border-warm hover:bg-(--warm-soft)"
                >
                  <div className="h-17 w-17 overflow-hidden rounded-md bg-(--warm-soft)">
                    <ProductIllustration product={item.product} className="h-full w-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{pickLang(item.product.name, lang)}</div>
                    <div className="mt-0.5 text-sm text-(--ink-3)">
                      {item.size} · ×{item.qty}
                    </div>
                  </div>
                  <div className="ms-auto text-sm text-ink">
                    {formatPrice(item.unitPrice * item.qty, lang)}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
            <button className="btn btn--soft" onClick={onWish} aria-label={dict.offers.saveToWishlist ?? dict.common.addToWishlist}>
              {wishlist.has("offer", offer.id) ? <Icon.HeartFill /> : <Icon.Heart />}
            </button>
            <button className="btn btn--primary btn--lg btn--block capitalize" onClick={add} disabled={!inStock}>
              {added ? dict.offers.added : dict.offers.addBundleToCart}
            </button>
            <button className="btn btn--ghost btn--lg btn--block" onClick={buyNow} disabled={!inStock}>
              {dict.common.buyNow}
            </button>
          </div>

          {!inStock && (
            <p className="rounded-(--radius) bg-[color-mix(in_oklch,var(--error)_10%,transparent)] px-4 py-3 text-sm text-(--error)">
              {dict.offers.unavailable}
            </p>
          )}
        </div>
      </div>
      <RelatedItems items={relatedItems} lang={lang} title={dict.offers?.related} />
    </>
  );
}
