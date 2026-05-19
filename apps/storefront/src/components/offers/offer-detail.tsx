"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, type Language, type Offer, type Product } from "@capella/shared";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";

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
}

export function OfferDetail({ offer, items, lang, dict }: Props) {
  const router = useRouter();
  const cart = useCart();
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

  return (
    <div className="grid gap-8 py-4 lg:grid-cols-2 lg:gap-[60px]">
      <div className="overflow-hidden rounded-[24px] bg-(--bg-tint)">
        <OfferIllustration offer={offer} className="min-h-[360px] w-full" />
      </div>

      <div className="grid gap-5 self-start">
        <span className="eyebrow">{dict.offers.badge}</span>
        <h1 className="m-0 text-[clamp(28px,3vw,40px)] font-(--font-display) leading-tight tracking-[-0.01em]">
          {pickLang(offer.name, lang)}
        </h1>
        <p className="text-(--ink-2)">{pickLang(offer.description, lang)}</p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[36px] font-(--font-display)">{formatPrice(offer.price, lang)}</span>
          {savings > 0 && (
            <>
              <span className="text-(--ink-3) line-through">{formatPrice(offer.originalTotal, lang)}</span>
              <span className="chip chip--accent">{dict.offers.save.replace("{amount}", formatPrice(savings, lang))}</span>
            </>
          )}
        </div>

        <div className="grid gap-2">
          <div className="eyebrow">{dict.offers.includes}</div>
          <div className="grid gap-2">
            {items.map((item) => (
              <Link
                key={`${item.product.id}-${item.variantId}`}
                href={`/${lang}/products/${item.product.slug}`}
                className="grid grid-cols-[64px_1fr_auto] items-center gap-3.5 rounded-[12px] border border-(--hairline) bg-white p-2.5 transition-colors hover:border-accent"
              >
                <div className="h-16 w-16 overflow-hidden rounded-[10px] bg-(--bg-tint)">
                  <ProductIllustration product={item.product} className="h-full w-full" />
                </div>
                <div>
                  <div className="font-semibold">{pickLang(item.product.name, lang)}</div>
                  <div className="text-[13px] text-(--ink-2)">
                    {item.size} · {dict.common.quantity}: {item.qty}
                  </div>
                </div>
                <div className="ms-auto text-(--ink-2)">
                  {formatPrice(item.unitPrice * item.qty, lang)}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn btn--primary btn--block" onClick={add} disabled={!inStock}>
            <Icon.Cart size={18} /> {added ? (lang === "ar" ? "أُضيف" : "Added") : dict.offers.addBundleToCart}
          </button>
          <button className="btn btn--ghost btn--block" onClick={buyNow} disabled={!inStock}>
            {dict.common.buyNow}
          </button>
        </div>

        {!inStock && (
          <p className="text-[13px] text-(--danger)">
            {lang === "ar" ? "أحد المنتجات بالباقة غير متوفر حاليًا." : "One of the products in this bundle is currently unavailable."}
          </p>
        )}
      </div>
    </div>
  );
}

