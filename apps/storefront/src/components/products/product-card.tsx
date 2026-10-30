"use client";

import Link from "next/link";
import { useMemo } from "react";
import { pickLang, formatPrice, formatPriceRange, getEffectiveVariantPrice, getProductBadgeState, type Language, type Product } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { ItemTagPill, getProductTags } from "@/components/ui/item-tags";
import { Icon } from "@/components/ui/icons";
import { AddToCartControl } from "@/components/ui/add-to-cart-control";
import { CardRating } from "@/components/reviews/card-rating";
import { CardImageCarousel } from "@/components/ui/card-image-carousel";
import { buildCardImages } from "@/lib/card-images";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
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
  const prices = product.variants.map((v) => getEffectiveVariantPrice(v));
  const basePrices = product.variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minBasePrice = Math.min(...basePrices);
  const maxBasePrice = Math.max(...basePrices);
  const { isOutOfStock } = getProductBadgeState(product);
  const leadTag = getProductTags(product, dict, { lead: true })[0];
  const images = useMemo(() => buildCardImages(product, lang), [product, lang]);

  // The variant we transact on from the card: cheapest one that is in stock, falling back to the cheapest overall so the buttons still resolve a target.
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

  return (
    <article className="group">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-(--warm-soft)">
        {/* The whole card is the image; everything else floats on top of it. */}
        <CardImageCarousel
          images={images}
          hoverImage={product.hoverImagePath}
          href={href}
          label={pickLang(product.name, lang)}
          lang={lang}
          renderImage={(url) => (
            <ProductIllustration
              product={{ ...product, imagePath: url }}
              lang={lang}
              className="object-contain"
            />
          )}
        />

        {/* inset-s-0 so the badge mirrors in RTL, matching SectionCard. */}
        {leadTag ? (
          <ItemTagPill tag={leadTag} className="absolute top-0 inset-s-0 z-10 rounded-ee-2xl" />
        ) : null}
        {isOutOfStock ? (
          <ItemTagPill
            tag={{ kind: "outOfStock", label: dict.common.outOfStock }}
            className="absolute top-0 inset-s-0 z-10 rounded-ee-2xl"
          />
        ) : null}

        <button
          className="absolute top-2 rounded-full inset-e-2 z-20 grid h-9 w-9 place-items-center text-ink backdrop-blur-sm transition-all duration-200 hover:scale-105 bg-surface/85 hover:bg-(--warm-soft)"
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
            className={"m-0 text-base font-bold leading-tight text-ink"}
          >
            {pickLang(product.name, lang)}
          </h3>
        </Link>

        {categoryName ? (
          <p
            className={"m-0 text-sm text-(--ink-3)"}
          >
            {categoryName}
          </p>
        ) : null}

        <CardRating rating={product.rating} dict={dict} lang={lang} />

        <span
          className={"text-lg font-extrabold leading-none text-(--magenta-deep)"}
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

      {!isOutOfStock && buyVariant ? (
        <div className="mt-3 flex gap-2">
          <AddToCartControl
            line={{ type: "product", productId: product.id, variantId: buyVariant.id, qty: 1 }}
            dict={dict}
            maxQty={buyVariant.stock}
          />
        </div>
      ) : null}
    </article>
  );
}
