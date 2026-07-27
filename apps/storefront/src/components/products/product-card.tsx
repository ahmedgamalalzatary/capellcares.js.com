"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { pickLang, formatPrice, formatPriceRange, getEffectiveVariantPrice, getProductBadgeState, type Language, type Product } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { ItemTagPill, getProductTags } from "@/components/ui/item-tags";
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
  const { isOutOfStock } = getProductBadgeState(product);
  const leadTag = getProductTags(product, dict, { lead: true })[0];
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
      {/* The product sits in a lit recess — the same warm bloom as the niche,
          scaled down to a single shelf. */}
      <div className="pcard__img relative aspect-8/9 overflow-hidden rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-glow)">
        {/* The whole card is the image; everything else floats on top of it. */}
      <Link
        href={href}
        aria-label={pickLang(product.name, lang)}
        className="absolute inset-0 grid place-items-center"
        onMouseEnter={() => setPreviewImage(hoverImage)}
        onMouseLeave={() => setPreviewImage(primaryImage)}
      >
        {/* Photography fills the card edge to edge and crops to fit; the SVG
            placeholder is inset instead (see .pcard__img svg) so a drawn box
            does not stretch across the whole tile. */}
        <ProductIllustration
          product={{ ...product, imagePath: previewImage }}
          className="h-full w-full object-cover transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-[1.05]"
        />
      </Link>

        {/* inset-s-0 pins the tag to the reading-start corner: top-left in
            English, top-right in Arabic. Without an explicit inline inset an
            absolutely positioned box falls back to its static position, which
            does not follow the writing direction. */}
        {leadTag ? (
          <ItemTagPill tag={leadTag} className="absolute top-0 inset-s-0 z-10 rounded-ss-lg" />
        ) : null}
        {isOutOfStock ? (
          <ItemTagPill
            tag={{ kind: "outOfStock", label: dict.common.outOfStock }}
            className="absolute top-0 inset-s-0 z-10 rounded-ss-lg"
          />
        ) : null}

        <button
          className={`absolute top-2 rounded-full inset-e-2 z-20 grid h-9 w-9 place-items-center text-ink backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
            has("product", product.id) ? "border-accent! bg-accent text-canvas" : "bg-surface/85 hover:bg-(--warm-soft)"
          }`}
          aria-label={dict.common.addToWishlist}
          onClick={onWish}
        >
          {has("product", product.id) ? <Icon.HeartFill size={17} /> : <Icon.Heart size={17} className="stroke-[2.4]" />}
        </button>

      </div>

      {/* Details: category → name → price. Category leads as a small label so
          the eye lands on the product name set at full weight beneath it. */}
      <div className="mt-3.5 grid gap-1 text-start">
        {categoryName ? (
          <p className={`eyebrow m-0 ${isAr ? "font-(family-name:--font-ar)" : ""}`}>
            {categoryName}
          </p>
        ) : null}

        <Link href={href} className="block">
          <h3
            className={`m-0 leading-snug text-ink ${
              isAr
                ? "text-base font-bold font-(family-name:--font-ar)"
                : "text-[15px] font-semibold"
            }`}
          >
            {pickLang(product.name, lang)}
          </h3>
        </Link>

        <div className="mt-0.5 flex items-baseline gap-2">
          <span className={`price ${isAr ? "text-lg" : "text-xl"}`}>
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
      </div>

      {!isOutOfStock ? (
        <div className="mt-3.5 flex gap-2">
          <Link
            href={href}
            className="btn btn--ghost btn--sm flex-1"
          >
            {dict.common.view}
          </Link>
          <button
            onClick={onAdd}
            className="btn btn--primary btn--sm flex-1"
          >
            {added ? <Icon.Check size={16} /> : null}
            <span>{added ? dict.common.added : dict.common.addToCart}</span>
          </button>
        </div>
      ) : null}
    </article>
  );
}
