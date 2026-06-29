"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { pickLang, formatPrice, formatPriceRange, getEffectiveVariantPrice, getProductBadgeState, type Language, type Product } from "@capella/shared";
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
  /** Resolved category name shown as the classification line beneath the product name. */
  categoryName?: string;
}

export function ProductCard({ product, lang, dict, categoryName }: Props) {
  const router = useRouter();
  const { has, toggle } = useWishlist();
  const { user } = useAuth();
  const cart = useCart();
  const prices = product.variants.map((v) => getEffectiveVariantPrice(v));
  const basePrices = product.variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minBasePrice = Math.min(...basePrices);
  const maxBasePrice = Math.max(...basePrices);
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
    return pool.reduce((lo, v) => (getEffectiveVariantPrice(v) < getEffectiveVariantPrice(lo) ? v : lo), pool[0]);
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
    toggle("product", product.id);
  };

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOutOfStock || !buyVariant) return;
    cart.add({ type: "product", productId: product.id, variantId: buyVariant.id, qty: 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article className="group">
      <div className="relative aspect-8/9 overflow-hidden rounded-t-lg bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)">
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
            className="pointer-events-none absolute top-0 z-10 inline-flex items-center gap-1.5 rounded-ss-lg bg-accent px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-canvas"
          >
            {tag}
          </span>
        ) : null}
        {isOutOfStock ? (
          <span className="pointer-events-none absolute top-0 z-10 inline-flex items-center gap-1.5 rounded-ss-lg bg-ink px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-canvas">
            {dict.common.outOfStock}
          </span>
        ) : null}

        <button
          className={`absolute top-3 rounded-full inset-e-3 z-20 grid h-9 w-9 place-items-center text-ink backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
            has("product", product.id) ? "border-accent! bg-accent text-canvas" : "bg-surface/85 hover:bg-(--warm-soft)"
          }`}
          aria-label={dict.common.addToWishlist}
          onClick={onWish}
        >
          {has("product", product.id) ? <Icon.HeartFill size={17} /> : <Icon.Heart size={17} className="stroke-[2.4]" />}
        </button>

      </div>

      {/* Details: image → name → category → price, stacked beneath the image. */}
      <div className="mt-3 grid gap-1 text-start">
        <Link href={href} className="block">
          <h3
            className={`m-0 leading-tight text-ink ${
              isAr
                ? "text-sm font-bold font-(family-name:--font-ar)"
                : "text-sm font-bold uppercase tracking-[0.06em]"
            }`}
          >
            {pickLang(product.name, lang)}
          </h3>
        </Link>

        {categoryName ? (
          <p
            className={`m-0 ${
              isAr ? "text-md font-(family-name:--font-ar)" : "text-md tracking-[0.04em]"
            }`}
          >
            {categoryName}
          </p>
        ) : null}

        <span
          className={`font-bold leading-none text-accent ${isAr ? "text-base" : "text-lg"}`}
        >
          {prices.length > 1
            ? formatPriceRange(minPrice, maxPrice, lang)
            : formatPrice(minPrice, lang)}
        </span>
        {(minBasePrice !== minPrice || maxBasePrice !== maxPrice) ? (
          <span className="text-sm text-(--ink-3) line-through">
            {basePrices.length > 1
              ? formatPriceRange(minBasePrice, maxBasePrice, lang)
              : formatPrice(minBasePrice, lang)}
          </span>
        ) : null}
      </div>

      {!isOutOfStock ? (
        <div className="mt-3 flex gap-2">
          <Link
            href={href}
            className="inline-flex flex-1 items-center justify-center gap-2 h-11 px-5.5 border border-ink font-semibold tracking-[0.01em] text-ink transition-[transform,background,color,box-shadow] duration-150 hover:-translate-y-px hover:shadow-(--shadow-1) active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            {dict.common.view}
          </Link>
          <button
            onClick={onAdd}
            className="inline-flex flex-1 items-center justify-center gap-2 h-11 px-2 bg-accent font-semibold tracking-[0.01em] text-canvas transition-[transform,background,color,box-shadow] duration-150 hover:-translate-y-px hover:bg-accent-deep hover:shadow-(--shadow-1) active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            {added ? <Icon.Check size={16} /> : null}
            <span>{added ? dict.common.added : dict.common.addToCart}</span>
          </button>
        </div>
      ) : null}
    </article>
  );
}
