"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { pickLang, formatPrice, formatPriceRange, getProductBadgeState, type Language, type Product } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { Icon } from "@/components/ui/icons";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useCart } from "@/components/providers/cart-provider";
import { useRouter } from "next/navigation";

interface Props {
  product: Product;
  lang: Language;
  dict: any;
}

export function ProductCard({ product, lang, dict }: Props) {
  const router = useRouter();
  const { has, toggle } = useWishlist();
  const { user } = useAuth();
  const cart = useCart();
  const prices = product.variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const { isNew, isBestseller, isOffer, isOutOfStock } = getProductBadgeState(product);
  const isAr = lang === "ar";
  const imageMedia = useMemo(() => (product.media ?? []).filter((item) => item.type === "image"), [product.media]);
  const primaryImage = imageMedia[0]?.url ?? product.imagePath;
  const hoverImage = product.hoverImagePath || primaryImage;
  const [previewImage, setPreviewImage] = useState(primaryImage);
  const [added, setAdded] = useState(false);

  // The variant we transact on from the card: cheapest one that is in stock,
  // falling back to the cheapest overall so the buttons still resolve a target.
  const buyVariant = useMemo(() => {
    const inStock = product.variants.filter((v) => (v.stock ?? 0) > 0);
    const pool = inStock.length ? inStock : product.variants;
    return pool.reduce((lo, v) => (v.price < lo.price ? v : lo), pool[0]);
  }, [product.variants]);

  // The floating label on the image — mirrors the lead badge of the card.
  const tag = isNew
    ? dict.badges.new
    : isBestseller
      ? dict.badges.bestseller
      : isOffer
        ? dict.badges.offer
        : null;

  const href = `/${lang}/products/${product.slug}`;

  const onWish = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      router.push(`/${lang}/wishlist`);
      return;
    }
    toggle(product.id);
  };

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOutOfStock || !buyVariant) return;
    cart.add({ type: "product", productId: product.id, variantId: buyVariant.id, qty: 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  const onBuy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOutOfStock || !buyVariant) return;
    cart.add({ type: "product", productId: product.id, variantId: buyVariant.id, qty: 1 });
    router.push(`/${lang}/checkout`);
  };

  return (
    <article className="group">
      <div className="relative aspect-8/9 overflow-hidden bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)">
        {/* The whole card is the image; everything else floats on top of it. */}
      <Link
        href={href}
        aria-label={pickLang(product.name, lang)}
        className="absolute inset-0 grid place-items-center"
        onMouseEnter={() => setPreviewImage(hoverImage)}
        onMouseLeave={() => setPreviewImage(primaryImage)}
      >
        <ProductIllustration
          product={{ ...product, imagePath: previewImage }}
          className="object-contain transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-[1.05]"
        />
      </Link>

        {tag ? (
          <span
            className={`pointer-events-none absolute top-0 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-[0.16em] ${
              isNew ? "bg-[#c5bda8] text-ink" : "bg-accent text-canvas"
            }`}
          >
            {tag}
          </span>
        ) : null}
        {isOutOfStock ? (
          <span className="pointer-events-none absolute top-0 z-10 inline-flex items-center gap-1.5 bg-ink px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-canvas">
            {dict.common.outOfStock}
          </span>
        ) : null}

        <button
          className={`absolute top-3 rounded-full inset-e-3 z-20 grid h-9 w-9 place-items-center text-ink backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
            has(product.id) ? "border-accent! bg-accent text-canvas" : "bg-surface/85 hover:bg-(--warm-soft)"
          }`}
          aria-label={dict.common.addToWishlist}
          onClick={onWish}
        >
          {has(product.id) ? <Icon.HeartFill size={17} /> : <Icon.Heart size={17} className="stroke-[2.4]" />}
        </button>

        <div className="absolute inset-x-0 bottom-0 z-10 grid px-4 pb-6 pt-12">
          <Link
            href={href}
            className="pcard-caption pointer-events-auto col-start-1 row-start-1 flex items-end justify-end gap-3 sm:justify-between"
          >
            <h3
              className={`m-0 hidden leading-tight sm:block ${
                isAr
                  ? "text-sm font-bold font-(family-name:--font-ar)"
                  : "text-sm font-bold uppercase tracking-[0.06em]"
              }`}
            >
              {pickLang(product.name, lang)}
            </h3>
            <span
              className={`shrink-0 font-bold leading-none font-sans ${
                isAr ? "text-lg" : "text-xl "
              }`}
            >
              {prices.length > 1
                ? formatPriceRange(minPrice, maxPrice, lang)
                : formatPrice(minPrice, lang)}
            </span>
          </Link>

          {!isOutOfStock ? (
            <div className="pcard-actions col-start-1 row-start-1 hidden gap-2 sm:flex">
              <button
                onClick={onBuy}
                className="flex h-11 flex-1 items-center justify-center bg-canvas px-4 text-sm font-semibold text-ink shadow-(--shadow-1) transition-[background,transform] duration-150 hover:bg-(--warm-soft) active:translate-y-px"
              >
                {dict.common.buyNow}
              </button>
              <button
                onClick={onAdd}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 bg-ink px-4 text-sm font-semibold text-canvas backdrop-blur-sm transition-[background,transform] duration-150 hover:bg-ink/70 active:translate-y-px"
              >
                {added ? <Icon.Check size={16} /> : <Icon.Cart size={16} />}
                <span className="sm:hidden">{dict.nav.cart}</span>
                <span className="hidden sm:inline">{dict.common.addToCart}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {!isOutOfStock ? (
        <div className="mt-2 flex gap-2 sm:hidden">
          <Link
            href={href}
            className="flex h-10 flex-1 items-center justify-center border border-(--hairline) bg-surface px-3 text-sm font-semibold text-ink active:translate-y-px"
          >
            {isAr ? "عرض" : "View"}
          </Link>
          <button
            onClick={onAdd}
            className="flex h-10 flex-1 items-center justify-center border border-(--hairline) bg-surface px-3 text-sm font-semibold text-ink active:translate-y-px"
          >
            {added ? <Icon.Check size={16} /> : <Icon.Cart size={16} />}
            {dict.nav.cart}
          </button>
        </div>
      ) : null}
    </article>
  );
}
