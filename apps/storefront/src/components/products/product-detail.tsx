"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, getProductBadgeState, type Language, type Product, type Offer } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";

type Tab = "description" | "ingredients" | "howToUse" | "warnings";

interface Props {
  product: Product;
  offers: Offer[];
  lang: Language;
  dict: any;
}

export function ProductDetail({ product, offers, lang, dict }: Props) {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();
  const auth = useAuth();
  const { isNew, isBestseller } = getProductBadgeState(product);

  const inStockVariants = product.variants.filter((variant) => variant.stock > 0);
  const [variantId, setVariantId] = useState<number>(inStockVariants[0]?.id ?? product.variants[0].id);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>("description");
  const [added, setAdded] = useState(false);

  const variant = useMemo(() => product.variants.find((item) => item.id === variantId)!, [variantId, product.variants]);
  const isOutOfStock = variant.stock === 0;

  const addToCart = () => {
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const buyNow = () => {
    cart.add({ type: "product", productId: product.id, variantId: variant.id, qty });
    router.push(`/${lang}/checkout`);
  };

  const onWish = () => {
    if (!auth.user) {
      router.push(`/${lang}/wishlist`);
      return;
    }
    wishlist.toggle(product.id);
  };

  const tabs: { key: Tab; label: string; content: string }[] = [
    { key: "description", label: dict.product.description, content: pickLang(product.description, lang) },
    { key: "ingredients", label: dict.product.ingredients, content: pickLang(product.ingredients, lang) },
    { key: "howToUse", label: dict.product.howToUse, content: pickLang(product.howToUse, lang) },
    { key: "warnings", label: dict.product.warnings, content: pickLang(product.warnings, lang) }
  ];

  return (
    <div className="grid gap-8 py-4 lg:grid-cols-[1.1fr_1fr] lg:gap-[60px]">
      <div className="grid gap-4 self-start lg:sticky lg:top-[140px]">
        <div className="relative grid aspect-4/5 place-items-center overflow-hidden rounded-[24px] bg-(--bg-tint)">
          <ProductIllustration product={product} className="h-4/5 w-4/5" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="aspect-square rounded-[12px] border border-transparent bg-(--bg-tint) p-1"
            >
              <ProductIllustration product={product} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 self-start lg:gap-7">
        <div className="grid gap-2">
          <h1 className="m-0 text-[clamp(28px,3vw,40px)] font-(--font-display) leading-tight tracking-[-0.01em]">
            {pickLang(product.name, lang)}
          </h1>
          {(isNew || isBestseller || offers.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {isNew && <span className="badge badge--new">{dict.badges.new}</span>}
              {isBestseller && <span className="badge badge--gold">{dict.badges.bestseller}</span>}
              {offers.map((offer) => (
                <Link key={offer.id} href={`/${lang}/offers/${offer.slug}`} className="badge badge--offer">
                  ★ {pickLang(offer.name, lang)}
                </Link>
              ))}
            </div>
          )}
        </div>

        <p className="text-(--ink-2)">{pickLang(product.description, lang)}</p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[32px] font-(--font-display)">{formatPrice(variant.price, lang)}</span>
          {isOutOfStock ? (
            <span className="chip chip--accent">{dict.common.outOfStock}</span>
          ) : variant.stock <= 5 ? (
            <span className="chip chip--gold">{dict.common.lowStock.replace("{n}", String(variant.stock))}</span>
          ) : (
            <span className="chip chip--sage">{dict.common.inStock}</span>
          )}
        </div>

        <div className="grid gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
            {dict.product.selectSize}
          </div>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((item) => (
              <button
                key={item.id}
                className={[
                  "grid min-w-24 gap-0.5 rounded-[12px] border bg-white px-3.5 py-2.5 text-start transition-colors",
                  item.stock > 0 ? "hover:border-(--ink-3)" : "cursor-not-allowed opacity-45 line-through",
                  variantId === item.id ? "border-accent bg-(--accent-soft)" : "border-(--hairline)"
                ].join(" ")}
                data-active={variantId === item.id}
                data-out={item.stock === 0 ? "true" : undefined}
                onClick={() => item.stock > 0 && setVariantId(item.id)}
                disabled={item.stock === 0}
              >
                <span>{item.size}</span>
                <span className="text-xs text-(--ink-2)">{formatPrice(item.price, lang)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
            {dict.common.quantity}
          </div>
          <div className="inline-grid grid-cols-[36px_60px_36px] items-center rounded-full border border-(--hairline) bg-white">
            <button
              className="grid h-10 place-items-center border-0 bg-transparent"
              onClick={() => setQty((value) => Math.max(1, value - 1))}
              aria-label="−"
            >
              <Icon.Minus />
            </button>
            <span className="text-center font-semibold">{qty}</span>
            <button
              className="grid h-10 place-items-center border-0 bg-transparent"
              onClick={() => setQty((value) => Math.min(variant.stock || 1, value + 1))}
              aria-label="+"
            >
              <Icon.Plus />
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <button className="btn btn--primary btn--block" onClick={addToCart} disabled={isOutOfStock}>
            <Icon.Cart size={18} />
            {added ? (lang === "ar" ? "أُضيف" : "Added") : dict.common.addToCart}
          </button>
          <button className="btn btn--ghost btn--block" onClick={buyNow} disabled={isOutOfStock}>
            {dict.common.buyNow}
          </button>
          <button className="btn btn--soft" onClick={onWish} aria-label={dict.common.addToWishlist}>
            {wishlist.has(product.id) ? <Icon.HeartFill /> : <Icon.Heart />}
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-(--hairline)">
          {tabs.map((item) => (
            <button
              key={item.key}
              className="mr-4 border-0 bg-transparent px-1 py-3 text-[14px] text-(--ink-3)"
              data-active={tab === item.key}
              onClick={() => setTab(item.key)}
              style={
                tab === item.key
                  ? { borderBottom: "2px solid var(--accent)", color: "var(--ink)" }
                  : { borderBottom: "2px solid transparent" }
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-20 leading-7 text-(--ink-2)">
          {tabs.find((item) => item.key === tab)?.content}
        </div>

        {offers.length > 0 && (
          <div className="grid gap-2.5 pt-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
              {dict.product.relatedOffers}
            </div>
            <div className="grid gap-2.5">
              {offers.map((offer) => (
                <Link
                  key={offer.id}
                  href={`/${lang}/offers/${offer.slug}`}
                  className="grid grid-cols-[80px_1fr] items-center gap-3.5 rounded-[12px] border border-(--hairline) bg-white p-2.5 transition-colors hover:border-accent"
                >
                  <div className="h-[60px] w-20 overflow-hidden rounded-[8px] bg-(--bg-tint)">
                    <OfferIllustration offer={offer} className="h-full w-full" />
                  </div>
                  <div>
                    <div className="font-semibold">{pickLang(offer.name, lang)}</div>
                    <div className="text-[13px] text-(--ink-2)">
                      {formatPrice(offer.price, lang)} · {dict.offers.save.replace("{amount}", formatPrice(offer.originalTotal - offer.price, lang))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

